import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const getAllowedOrigins = () => (Deno.env.get('ALLOWED_ORIGINS') || 'http://127.0.0.1:5501,http://localhost:5500')
  .split(',').map(value => value.trim()).filter(Boolean);

const corsHeaders = (origin: string) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
  if (origin && getAllowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};

const jsonResponse = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

const findExistingProfile = async (admin: ReturnType<typeof createClient>, email: string) => {
  const emailPattern = email.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await admin.from('profiles')
    .select('id,email').ilike('email', emailPattern).limit(2);
  if (error) throw new HttpError(`Could not check for an existing staff account: ${error.message}`, 500);
  const matches = (data || []).filter(profile => String(profile.email || '').toLowerCase() === email);
  if (matches.length > 1) throw new HttpError('More than one account matches this email. Contact support before inviting this person.', 409);
  return matches[0] || null;
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  if (origin && !getAllowedOrigins().includes(origin)) {
    return jsonResponse({ error: 'This app origin is not allowed to use the staff invitation service.' }, 403, headers);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, headers);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceRoleKey) {
      throw new HttpError('Invite function is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY as function secrets.', 500);
    }
    const authorization = request.headers.get('authorization');
    if (!authorization?.match(/^Bearer\s+\S+$/i)) throw new HttpError('Authentication required.', 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser();
    if (userError || !userResult.user) throw new HttpError('Invalid or expired session. Sign in again and retry.', 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('Request body must be valid JSON.', 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError('Request body must be a JSON object.', 400);
    const input = body as Record<string, unknown>;
    const businessId = String(input.business_id || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const requestedRole = String(input.role || 'cashier').trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) {
      throw new HttpError('A valid business ID is required.', 400);
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError('Enter a valid staff email address.', 400);
    }
    if (!['cashier', 'manager'].includes(requestedRole)) {
      throw new HttpError('Only cashier or manager roles can be invited.', 400);
    }

    const { data: membership, error: membershipError } = await userClient.from('business_members')
      .select('role,is_active').eq('business_id', businessId).eq('user_id', userResult.user.id).maybeSingle();
    if (membershipError) {
      throw new HttpError(`Could not verify your business membership: ${membershipError.message}`, 500);
    }
    if (!membership || membership.is_active !== true || !['owner', 'manager'].includes(membership.role)) {
      throw new HttpError('An active owner or manager membership is required to add staff.', 403);
    }
    if (membership.role === 'manager' && requestedRole !== 'cashier') {
      throw new HttpError('Managers may add cashiers only.', 403);
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const existingProfile = await findExistingProfile(admin, email);
    let userId = existingProfile?.id;
    let invitationSent = false;
    if (!userId) {
      const inviteOptions = origin ? { redirectTo: new URL('/', origin).toString() } : {};
      const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
      if (inviteError) {
        const inviteErrorDetail = `${inviteError.code || ''} ${inviteError.message || ''}`;
        const isExistingUserError = /email_exists|user_already_exists|already registered|already exists/i.test(inviteErrorDetail);
        if (!isExistingUserError) {
          throw new HttpError(`Supabase could not send the staff invitation: ${inviteError.message}`, 502);
        }
        const profileAfterInvite = await findExistingProfile(admin, email);
        if (!profileAfterInvite) {
          throw new HttpError('This email already has an Auth account, but its EasyBill profile is missing. Check the profiles setup trigger before retrying.', 409);
        }
        userId = profileAfterInvite.id;
      } else if (!invitation.user) {
        throw new HttpError('Supabase did not return the invited account. Check the Supabase Auth logs.', 502);
      } else {
        userId = invitation.user.id;
        invitationSent = true;
      }
    }
    if (!userId) throw new HttpError('Could not resolve the staff account for this email.', 500);
    if (userId === userResult.user.id) {
      throw new HttpError('You already have access to this business and cannot invite yourself as staff.', 409);
    }

    const { data: existingMembership, error: existingMembershipError } = await admin.from('business_members')
      .select('role,is_active').eq('business_id', businessId).eq('user_id', userId).maybeSingle();
    if (existingMembershipError) {
      throw new HttpError(`Could not check existing business access: ${existingMembershipError.message}`, 500);
    }
    if (existingMembership?.role === 'owner') {
      throw new HttpError('This account is already the business owner and cannot be changed through staff invitations.', 409);
    }
    if (existingMembership?.is_active === true) {
      throw new HttpError(`This account already has active ${existingMembership.role} access to this business.`, 409);
    }
    if (membership.role === 'manager' && existingMembership && existingMembership.role !== 'cashier') {
      throw new HttpError('Managers may reactivate cashier accounts only. Ask an owner to manage this account.', 403);
    }

    const { error: insertError } = await admin.from('business_members').upsert({
      business_id: businessId,
      user_id: userId,
      role: requestedRole,
      is_active: true
    }, { onConflict: 'business_id,user_id' });
    if (insertError) {
      const context = invitationSent ? 'An invitation was sent, but business access could not be saved' : 'Business access could not be saved';
      throw new HttpError(`${context}: ${insertError.message}`, 500);
    }

    const message = invitationSent
      ? 'Invitation sent. The staff member must accept the email invitation and sign in.'
      : existingProfile
        ? 'Existing account added to this business. The staff member can sign in with their current account.'
        : 'Existing account access restored for this business.';
    return jsonResponse({ ok: true, email, role: requestedRole, message }, 200, headers);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unable to add staff access.';
    if (!(error instanceof HttpError)) console.error('[invite-staff] Unexpected error:', error);
    return jsonResponse({ error: message }, status, headers);
  }
});
