/* ============================================
   EASYBILL — Supabase Authentication and Sync
   ============================================ */

const Cloud = {
  bucket: 'easybill-assets',
  client: null,
  user: null,
  business: null,
  businessId: null,
  role: null,
  needsBusiness: false,
  configured: false,
  ready: false,
  hydrating: false,
  status: 'local',
  queues: new Map(),
  imageUrls: new Map(),
  imageRefreshTimer: null,
  hasShownSyncError: false,
  authMode: 'signin',

  isConfigured() {
    const config = window.EASYBILL_SUPABASE_CONFIG || {};
    const url = window.SUPABASE_URL || config.url;
    const key = window.SUPABASE_PUBLISHABLE_KEY || config.publishableKey;
    return Boolean(this.configured && url && key);
  },

  async initialize() {
    const config = window.EASYBILL_SUPABASE_CONFIG || {};
    const url = window.SUPABASE_URL || config.url;
    const key = window.SUPABASE_PUBLISHABLE_KEY || config.publishableKey;
    const hasCredentials = Boolean(
      url && key && !url.includes('YOUR_') && !key.includes('YOUR_')
    );
    if (!hasCredentials) {
      this.configured = false;
      this.status = 'local';
      return false;
    }

    if (!window.supabase) {
      throw new Error('Supabase client library did not load. Check your internet connection.');
    }
    this.configured = true;
    this.client = window.supabase.createClient(url, key);
    this.client.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') this.showPasswordReset();
      if (event === 'SIGNED_OUT' && this.user) {
        this.user = null;
        this.business = null;
        this.businessId = null;
        this.role = null;
        this.ready = false;
        Storage.PREFIX = 'easybill_';
        if (this.imageRefreshTimer) clearInterval(this.imageRefreshTimer);
        this.imageRefreshTimer = null;
        this.updateAccountAction();
        this.showAuth('Your session ended. Sign in again to continue.');
      }
    });

    const { data, error } = await this.client.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    if (!data.user) return false;

    this.user = data.user;
    const { data: memberships, error: membershipError } = await this.client
      .from('business_members')
      .select('business_id, role, created_at')
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: true });
    if (membershipError) throw membershipError;
    if (!memberships || memberships.length === 0) {
      this.needsBusiness = true;
      return true;
    }
    await this.activateBusiness(memberships[0].business_id, memberships[0].role);
    return true;
  },

  showAuth(message = '') {
    const screen = document.getElementById('auth-screen');
    if (!screen) return;
    screen.hidden = false;
    this.renderAuth(message);
    this.setStatus('signed-out');
  },

  renderAuth(message = '') {
    const screen = document.getElementById('auth-screen');
    if (!screen) return;
    const signingUp = this.authMode === 'signup';
    screen.innerHTML = `
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-brand"><span>EB</span><strong>EASYBILL</strong></div>
        <h1 id="auth-title">${signingUp ? 'Create your business account' : 'Sign in to EasyBill'}</h1>
        <p class="auth-description">${signingUp ? 'Your business data will be private to this account.' : ' Once you sign up, please confirm your account by clicking the verification link sent to your email.'}</p>
        <form class="auth-form" onsubmit="Cloud.submitAuth(event)">
          ${signingUp ? '<label class="form-label" for="auth-name">Your name</label><input class="form-control" id="auth-name" name="name" autocomplete="name">' : ''}
          <label class="form-label" for="auth-email">Email</label>
          <input class="form-control" id="auth-email" name="email" type="email" autocomplete="email" required>
          <label class="form-label" for="auth-password">Password</label>
          <input class="form-control" id="auth-password" name="password" type="password" autocomplete="${signingUp ? 'new-password' : 'current-password'}" minlength="6" required>
          <p class="auth-message" role="status" aria-live="polite">${Utils.escapeHtml(message)}</p>
          <button class="btn btn-primary auth-submit" type="submit">${signingUp ? 'Create account' : 'Sign in'}</button>
        </form>
        ${signingUp ? '' : '<button class="auth-switch" type="button" onclick="Cloud.requestPasswordReset()">Forgot password?</button>'}
        <button class="auth-switch" type="button" onclick="Cloud.toggleAuthMode()">
          ${signingUp ? 'Already have an account? Sign in' : 'New to EasyBill? Create a business account'}
        </button>
      </section>
    `;
  },

  toggleAuthMode() {
    this.authMode = this.authMode === 'signin' ? 'signup' : 'signin';
    this.renderAuth();
  },

  async submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = this.authMode === 'signup' ? 'Creating account...' : 'Signing in...';

    try {
      const result = this.authMode === 'signup'
        ? await this.client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname,
            data: { name: form.name ? form.name.value.trim() : '' }
          }
        })
        : await this.client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (!result.data.session) {
        this.renderAuth('Check your email to confirm the account, then sign in here.');
        return;
      }
      this.user = result.data.user;
      this.needsBusiness = true;
      await this.findBusiness();
      if (this.needsBusiness) {
        this.showBusinessSetup();
        return;
      }
      document.getElementById('auth-screen').hidden = true;
      App.startApplication();
    } catch (error) {
      console.error('Supabase authentication error:', error);
      this.renderAuth(this.friendlyError(error));
    }
  },

  async requestPasswordReset() {
    const email = document.getElementById('auth-email')?.value.trim();
    if (!email) {
      this.renderAuth('Enter your email address first.');
      return;
    }
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '#reset-password'
      });
      if (error) throw error;
      this.renderAuth('Password reset instructions have been sent if that account exists.');
    } catch (error) {
      console.error('Supabase password reset error:', error);
      this.renderAuth(this.friendlyError(error));
    }
  },

  showPasswordReset(message = '') {
    const screen = document.getElementById('auth-screen');
    if (!screen) return;
    screen.hidden = false;
    screen.innerHTML = `
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-brand"><span>EB</span><strong>EASYBILL</strong></div>
        <h1 id="auth-title">Choose a new password</h1>
        <form class="auth-form" onsubmit="Cloud.updatePassword(event)">
          <label class="form-label" for="reset-password">New password</label>
          <input class="form-control" id="reset-password" name="password" type="password" autocomplete="new-password" minlength="6" required>
          <p class="auth-message" role="status" aria-live="polite">${Utils.escapeHtml(message)}</p>
          <button class="btn btn-primary auth-submit" type="submit">Update password</button>
        </form>
      </section>
    `;
  },

  async updatePassword(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const password = event.currentTarget.password.value;
      const { error } = await this.client.auth.updateUser({ password });
      if (error) throw error;
      const { data, error: userError } = await this.client.auth.getUser();
      if (userError) throw userError;
      this.user = data.user;
      await this.findBusiness();
      if (this.needsBusiness) {
        this.showBusinessSetup();
        return;
      }
      document.getElementById('auth-screen').hidden = true;
      App.startApplication();
    } catch (error) {
      console.error('Supabase password update error:', error);
      this.showPasswordReset(this.friendlyError(error));
    }
  },

  showBusinessSetup(message = '') {
    const screen = document.getElementById('auth-screen');
    if (!screen) return;
    screen.hidden = false;
    screen.innerHTML = `
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-brand"><span>EB</span><strong>EASYBILL</strong></div>
        <h1 id="auth-title">Set up your business</h1>
        <p class="auth-description">Your account will be the owner of this business. You can add team access later.</p>
        <form class="auth-form" onsubmit="Cloud.createBusiness(event)">
          <label class="form-label" for="business-name">Business name</label>
          <input class="form-control" id="business-name" name="name" required>
          <label class="form-label" for="business-phone">Phone</label>
          <input class="form-control" id="business-phone" name="phone" type="tel">
          <label class="form-label" for="business-email">Business email</label>
          <input class="form-control" id="business-email" name="email" type="email" value="${Utils.escapeHtml(this.user?.email || '')}">
          <label class="form-label" for="business-gstin">GSTIN</label>
          <input class="form-control" id="business-gstin" name="gstin">
          <label class="form-label" for="business-address">Address</label>
          <textarea class="form-control" id="business-address" name="address" rows="2"></textarea>
          <p class="auth-message" role="status" aria-live="polite">${Utils.escapeHtml(message)}</p>
          <button class="btn btn-primary auth-submit" type="submit">Create business</button>
        </form>
        <button class="auth-switch" type="button" onclick="Cloud.signOut()">Sign out</button>
      </section>
    `;
  },

  async createBusiness(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Creating business...';
    const details = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      gstin: form.gstin.value.trim(),
      address: form.address.value.trim()
    };
    try {
      const { data: businessId, error } = await this.client.rpc('create_business', {
        p_name: details.name,
        p_gstin: details.gstin || null,
        p_phone: details.phone || null,
        p_email: details.email || null,
        p_address: details.address || null
      });
      if (error) throw error;
      this.businessId = businessId;
      this.role = 'owner';
      const { data: business, error: businessError } = await this.client
        .from('businesses').select('*').eq('id', businessId).single();
      if (businessError) throw businessError;
      this.business = business;
      Storage.PREFIX = `easybill_${businessId}_`;
      await this.migrateLegacyData();
      await this.loadBusinessData();
      this.ready = true;
      this.needsBusiness = false;
      document.getElementById('auth-screen').hidden = true;
      this.updateAccountAction();
      App.startApplication();
    } catch (error) {
      console.error('Business setup error:', error);
      if (this.businessId) {
        this.showAuth(`Your business account was created, but setup could not finish. Sign in again to continue. ${this.friendlyError(error)}`);
      } else {
        this.showBusinessSetup(this.friendlyError(error));
      }
    }
  },

  async findBusiness() {
    const { data: memberships, error } = await this.client.from('business_members')
      .select('business_id, role, created_at')
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!memberships?.length) {
      this.businessId = null;
      this.business = null;
      this.role = null;
      this.needsBusiness = true;
      return;
    }
    await this.activateBusiness(memberships[0].business_id, memberships[0].role);
  },

  friendlyError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('invalid login credentials')) return 'Email or password is incorrect.';
    if (message.includes('already registered')) return 'An account with this email already exists. Sign in instead.';
    if (message.includes('password')) return 'Password must contain at least 6 characters.';
    if (message.includes('fetch') || message.includes('network')) return 'Could not reach Supabase. Check your internet connection.';
    if (message.includes('relation') || message.includes('function') || message.includes('schema cache')) {
      return 'Supabase setup is incomplete. Run supabase/setup.sql in the SQL Editor, then reload.';
    }
    return 'The request could not be completed. Check your connection and Supabase setup.';
  },

  async activateBusiness(businessId, role) {
    this.ready = false;
    this.hydrating = true;
    this.businessId = businessId;
    this.role = role;
    Storage.PREFIX = `easybill_${businessId}_`;
    try {
      const { data: business, error } = await this.client.from('businesses')
        .select('*').eq('id', businessId).single();
      if (error) throw error;
      this.business = business;
      await this.loadBusinessData();
      this.hydrating = false;
      this.ready = true;
      this.needsBusiness = false;
      this.startImageRefresh();
      this.setStatus('synced');
      this.updateAccountAction();
    } catch (error) {
      this.hydrating = false;
      this.ready = false;
      this.setStatus('error');
      throw error;
    }
  },

  async loadBusinessData() {
    const businessId = this.businessId;
    const queries = await Promise.all([
      this.client.from('customers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      this.client.from('products').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      this.client.from('invoices').select('*, invoice_items(*)').eq('business_id', businessId).order('created_at', { ascending: false }),
      this.client.from('business_settings').select('*').eq('business_id', businessId).maybeSingle()
    ]);
    const failed = queries.find(result => result.error);
    if (failed) throw failed.error;
    const [customers, products, invoices, settings] = queries.map(result => result.data);
    const mappedCustomers = (customers || []).map(row => this.mapCustomer(row));
    const mappedProducts = (products || []).map(row => this.mapProduct(row));
    const mappedInvoices = (invoices || []).map(row => this.mapInvoice(row));
    this.hydrating = true;
    Storage.replaceLocal('customers', mappedCustomers);
    Storage.replaceLocal('products', mappedProducts);
    Storage.replaceLocal('invoices', mappedInvoices);
    Storage.replaceLocal('settings', this.mapSettings(settings, this.business));
    Storage.setInvoiceCounter(Number(settings?.last_invoice_number) || 0);
    this.hydrating = false;
    await this.refreshAssetUrls(mappedProducts, Storage.get('settings'));
  },

  mapCustomer(row) {
    return {
      id: row.id, name: row.name, phone: row.phone || '', email: row.email || '',
      gstin: row.gstin || '', address: row.address || '',
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  },

  mapProduct(row) {
    return {
      id: row.id, name: row.name, description: row.description || '',
      image: row.image_url ? `storage://${row.image_url}` : '', barcode: row.barcode || '',
      hsn: row.hsn_sac || '', unit: row.unit || 'Pcs', price: Number(row.unit_price) || 0,
      purchasePrice: Number(row.purchase_price) || 0, gstRate: Number(row.gst_rate) || 0,
      stock: Number(row.current_stock) || 0, lowStockThreshold: Number(row.low_stock_threshold) || 0,
      trackStock: Boolean(row.track_stock), createdAt: row.created_at, updatedAt: row.updated_at
    };
  },

  mapInvoice(row) {
    const items = (row.invoice_items || []).map(item => ({
      id: item.id, productId: item.product_id || '', name: item.product_name,
      hsn: item.hsn_sac || '', quantity: Number(item.quantity) || 0,
      rate: Number(item.price) || 0, discount: 0, discountType: 'percent',
      gstRate: Number(item.gst_rate) || 0,
      taxableAmount: Number(item.price) * Number(item.quantity) - Number(item.discount_amount || 0),
      gstAmount: Number(item.tax) || 0, discountAmount: Number(item.discount_amount) || 0,
      amount: Number(item.total) || 0
    }));
    return {
      id: row.id, invoiceNumber: row.invoice_number, invoiceDate: row.invoice_date,
      dueDate: row.due_date, customerId: row.customer_id || '',
      customerName: row.customer_id ? '' : 'Walk-in Customer', status: row.status,
      paymentMethod: row.payment_method || '', items, subtotal: Number(row.subtotal) || 0,
      totalDiscount: Number(row.discount) || 0, totalTaxable: Number(row.subtotal) - Number(row.discount),
      totalGst: Number(row.tax) || 0, grandTotal: Number(row.total) || 0,
      notes: row.notes || '', terms: row.terms || '', createdAt: row.created_at, updatedAt: row.updated_at
    };
  },

  mapSettings(row, business = this.business) {
    return {
      businessName: row?.business_name || business?.name || '',
      phone: row?.phone || business?.phone || '', email: row?.email || business?.email || '',
      address: row?.address || business?.address || '', gstin: row?.gstin || business?.gstin || '',
      logo: row?.logo_url ? `storage://${row.logo_url}` : '', invoicePrefix: row?.invoice_prefix || 'EB',
      defaultTerms: row?.default_terms || '', website: row?.website || ''
    };
  },

  async migrateLegacyData() {
    let legacy;
    try {
      legacy = {
        customers: JSON.parse(localStorage.getItem('easybill_customers') || '[]'),
        products: JSON.parse(localStorage.getItem('easybill_products') || '[]'),
        invoices: JSON.parse(localStorage.getItem('easybill_invoices') || '[]'),
        settings: JSON.parse(localStorage.getItem('easybill_settings') || '{}')
      };
    } catch (error) {
      console.error('Legacy EasyBill data could not be read:', error);
      return;
    }
    const hasData = legacy.customers.length || legacy.products.length || legacy.invoices.length || Object.keys(legacy.settings).length;
    if (!hasData || !window.confirm('Existing EasyBill data was found in this browser. Import it into this business?')) return;

    const customerIds = new Map();
    const productIds = new Map();
    for (const customer of legacy.customers) {
      const saved = await this.saveCustomer(customer, null);
      customerIds.set(customer.id, saved.id);
    }
    for (const product of legacy.products) {
      const saved = await this.saveProduct(product, null);
      productIds.set(product.id, saved.id);
    }
    for (const invoice of legacy.invoices) {
      const migrated = {
        ...invoice,
        customerId: customerIds.get(invoice.customerId) || '',
        items: (invoice.items || []).map(item => ({
          ...item, productId: productIds.get(item.productId) || '',
          product: productIds.has(item.productId) ? Storage.getById('products', productIds.get(item.productId)) : null
        }))
      };
      await this.importLegacyInvoice(migrated);
    }
    if (Object.keys(legacy.settings || {}).length) await this.saveBusinessSettings(legacy.settings);
    const oldCounter = Number(localStorage.getItem('eb_last_invoice_num')) || 0;
    Storage.setInvoiceCounter(oldCounter);
    if (oldCounter) await this.saveBusinessSettings(Storage.get('settings') || {});
  },

  isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  },

  async saveCustomer(customer, id = null) {
    const payload = {
      business_id: this.businessId,
      name: customer.name.trim(), phone: customer.phone || null,
      email: customer.email || null, gstin: customer.gstin || null,
      address: customer.address || null
    };
    let query = id && this.isUuid(id)
      ? this.client.from('customers').update(payload).eq('id', id).eq('business_id', this.businessId)
      : this.client.from('customers').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    const saved = this.mapCustomer(data);
    Storage.upsertLocal('customers', saved);
    return saved;
  },

  async deleteCustomer(id) {
    const { error } = await this.client.from('customers').delete()
      .eq('id', id).eq('business_id', this.businessId);
    if (error) throw error;
    Storage.removeLocal('customers', id);
  },

  async uploadAsset(folder, id, imageData) {
    let blob;
    if (imageData instanceof Blob) blob = imageData;
    else {
      const response = await fetch(imageData);
      blob = await response.blob();
    }
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ? blob.type : 'image/jpeg';
    const path = `${this.businessId}/${folder}/${id}.${extension}`;
    const { error } = await this.client.storage.from(this.bucket).upload(path, blob, {
      contentType, upsert: true, cacheControl: '3600'
    });
    if (error) throw error;
    this.imageUrls.delete(path);
    await this.refreshAssetUrls([], { logo: `storage://${path}` }, true);
    return path;
  },

  async saveProduct(product, id = null) {
    const productId = id && this.isUuid(id) ? id : crypto.randomUUID();
    const previousImage = Storage.getById('products', productId)?.image || '';
    let imagePath = product.image || '';
    if (imagePath.startsWith('data:image/')) {
      imagePath = await this.uploadAsset('products', productId, imagePath);
    } else if (imagePath.startsWith('storage://')) {
      imagePath = imagePath.slice('storage://'.length);
    } else if (!imagePath) {
      imagePath = null;
    }
    const payload = {
      id: productId,
      name: product.name.trim(), description: product.description || null,
      image_url: imagePath, barcode: product.barcode || null,
      hsn_sac: product.hsn || null, unit: product.unit || 'Pcs',
      unit_price: Number(product.price) || 0, purchase_price: Number(product.purchasePrice) || 0,
      gst_rate: Number(product.gstRate) || 0, current_stock: Number(product.stock) || 0,
      low_stock_threshold: Number(product.lowStockThreshold) || 0,
      track_stock: Boolean(product.trackStock || Number(product.stock) > 0)
    };
    const { error } = await this.client.rpc('save_product', {
      p_business_id: this.businessId, p_product: payload
    });
    if (error) throw error;
    const { data, error: readError } = await this.client.from('products')
      .select('*').eq('id', productId).eq('business_id', this.businessId).single();
    if (readError) throw readError;
    const saved = this.mapProduct(data);
    Storage.upsertLocal('products', saved);
    await this.refreshAssetUrls([saved]);
    if (previousImage.startsWith('storage://') && previousImage !== saved.image) {
      const oldPath = previousImage.slice('storage://'.length);
      const { error: removeError } = await this.client.storage.from(this.bucket).remove([oldPath]);
      if (removeError) console.error('Old product image cleanup error:', removeError);
    }
    return saved;
  },

  async deleteProduct(id) {
    const product = Storage.getById('products', id);
    const { error } = await this.client.from('products').delete()
      .eq('id', id).eq('business_id', this.businessId);
    if (error) throw error;
    Storage.removeLocal('products', id);
    if (product?.image?.startsWith('storage://')) {
      await this.client.storage.from(this.bucket).remove([product.image.slice('storage://'.length)]);
    }
  },

  invoicePayload(invoice) {
    return {
      ...(this.isUuid(invoice.id) ? { id: invoice.id } : {}),
      customer_id: this.isUuid(invoice.customerId) ? invoice.customerId : null,
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate || new Date().toISOString().slice(0, 10),
      due_date: invoice.dueDate || null,
      subtotal: Number(invoice.subtotal) || 0,
      tax: Number(invoice.totalGst ?? invoice.tax) || 0,
      discount: Number(invoice.totalDiscount ?? invoice.discount) || 0,
      total: Number(invoice.grandTotal ?? invoice.total) || 0,
      status: invoice.status || 'unpaid', payment_method: invoice.paymentMethod || null,
      notes: invoice.notes || null, terms: invoice.terms || null
    };
  },

  invoiceItemsPayload(items) {
    return items.map(item => ({
      product_id: this.isUuid(item.productId) ? item.productId : null,
      product_name: item.name || item.product?.name || 'Item',
      hsn_sac: item.hsn || item.product?.hsn || null,
      quantity: Number(item.quantity) || 1,
      price: Number(item.rate ?? item.product?.price) || 0,
      gst_rate: Number(item.gstRate ?? item.product?.gstRate) || 0,
      discount_amount: Number(item.discountAmount) || 0,
      tax: Number(item.gstAmount) || 0,
      total: Number(item.amount) || 0
    }));
  },

  async saveInvoice(invoice, id = null) {
    const payload = this.invoicePayload({ ...invoice, id: id || invoice.id });
    const { data: invoiceId, error } = await this.client.rpc('save_invoice_with_stock', {
      p_business_id: this.businessId,
      p_invoice: payload,
      p_items: this.invoiceItemsPayload(invoice.items || [])
    });
    if (error) throw error;
    const { data, error: readError } = await this.client.from('invoices')
      .select('*, invoice_items(*)').eq('id', invoiceId).eq('business_id', this.businessId).single();
    if (readError) throw readError;
    const saved = this.mapInvoice(data);
    Storage.upsertLocal('invoices', saved);
    const counterMatch = /([0-9]+)$/.exec(saved.invoiceNumber || '');
    if (counterMatch) {
      Storage.setInvoiceCounter(Math.max(Storage.getInvoiceCounter(), Number(counterMatch[1])));
    }
    await this.refreshBusinessProducts();
    return saved;
  },

  async importLegacyInvoice(invoice) {
    const { data: invoiceId, error } = await this.client.rpc('import_legacy_invoice', {
      p_business_id: this.businessId,
      p_invoice: this.invoicePayload(invoice),
      p_items: this.invoiceItemsPayload(invoice.items || [])
    });
    if (error) throw error;
    return invoiceId;
  },

  async refreshBusinessProducts() {
    const { data, error } = await this.client.from('products').select('*')
      .eq('business_id', this.businessId).order('created_at', { ascending: false });
    if (error) throw error;
    const products = (data || []).map(row => this.mapProduct(row));
    Storage.replaceLocal('products', products);
    await this.refreshAssetUrls(products);
  },

  async updateInvoiceStatus(id, status) {
    const { error } = await this.client.rpc('set_invoice_status', {
      p_business_id: this.businessId,
      p_invoice_id: id,
      p_status: status
    });
    if (error) throw error;
    const { data, error: readError } = await this.client.from('invoices')
      .select('*, invoice_items(*)').eq('id', id).eq('business_id', this.businessId).single();
    if (readError) throw readError;
    const saved = this.mapInvoice(data);
    Storage.upsertLocal('invoices', saved);
    return saved;
  },

  async deleteInvoice(id) {
    const { error } = await this.client.rpc('delete_invoice_and_restore_stock', {
      p_business_id: this.businessId, p_invoice_id: id
    });
    if (error) throw error;
    Storage.removeLocal('invoices', id);
    await this.refreshBusinessProducts();
  },

  async clearBusinessData() {
    const { error } = await this.client.rpc('clear_business_data', {
      p_business_id: this.businessId
    });
    if (error) throw error;
    const paths = [];
    for (const folder of ['products', 'logo']) {
      const { data, error: listError } = await this.client.storage.from(this.bucket)
        .list(`${this.businessId}/${folder}`, { limit: 1000 });
      if (listError) throw listError;
      (data || []).forEach(file => paths.push(`${this.businessId}/${folder}/${file.name}`));
    }
    if (paths.length) {
      const { error: removeError } = await this.client.storage.from(this.bucket).remove(paths);
      if (removeError) throw removeError;
    }
    this.imageUrls.clear();
    Storage.replaceLocal('customers', []);
    Storage.replaceLocal('products', []);
    Storage.replaceLocal('invoices', []);
    Storage.setInvoiceCounter(0);
    const { data: settings, error: settingsError } = await this.client.from('business_settings')
      .select('*').eq('business_id', this.businessId).single();
    if (settingsError) throw settingsError;
    Storage.writeLocal('settings', this.mapSettings(settings, this.business));
  },

  async saveBusinessSettings(settings) {
    const previousLogo = Storage.get('settings')?.logo || '';
    let logoPath = settings.logo || '';
    if (logoPath.startsWith('data:image/')) {
      logoPath = await this.uploadAsset('logo', 'business-logo', logoPath);
    } else if (logoPath.startsWith('storage://')) {
      logoPath = logoPath.slice('storage://'.length);
    } else if (!logoPath) {
      logoPath = null;
    }
    const { data, error } = await this.client.rpc('save_business_settings', {
      p_business_id: this.businessId,
      p_settings: {
        business_name: settings.businessName || this.business?.name || 'EasyBill Business',
        phone: settings.phone || null, email: settings.email || null,
        address: settings.address || null, gstin: settings.gstin || null,
        logo_url: logoPath, invoice_prefix: settings.invoicePrefix || 'EB',
        last_invoice_number: Storage.getInvoiceCounter(),
        default_terms: settings.defaultTerms || null, website: settings.website || null
      }
    });
    if (error) throw error;
    this.business = { ...this.business, name: data.business_name, logo_url: data.logo_url };
    const mapped = this.mapSettings(data, this.business);
    Storage.writeLocal('settings', mapped);
    await this.refreshAssetUrls([], mapped);
    if (previousLogo.startsWith('storage://') && previousLogo !== mapped.logo) {
      const oldPath = previousLogo.slice('storage://'.length);
      const { error: removeError } = await this.client.storage.from(this.bucket).remove([oldPath]);
      if (removeError) console.error('Old business logo cleanup error:', removeError);
    }
    return mapped;
  },

  async importBackup(backup) {
    const customerIds = new Map();
    const productIds = new Map();
    for (const customer of backup.customers || []) {
      const saved = await this.saveCustomer(customer);
      customerIds.set(customer.id, saved.id);
    }
    for (const product of backup.products || []) {
      const saved = await this.saveProduct(product);
      productIds.set(product.id, saved.id);
    }
    for (const invoice of backup.invoices || []) {
      const mapped = {
        ...invoice,
        customerId: customerIds.get(invoice.customerId) || '',
        items: (invoice.items || []).map(item => ({
          ...item, productId: productIds.get(item.productId) || ''
        }))
      };
      await this.importLegacyInvoice(mapped);
    }
    if (backup.settings) await this.saveBusinessSettings(backup.settings);
    if (backup.lastInvoiceNum !== undefined) {
      Storage.setInvoiceCounter(backup.lastInvoiceNum);
      await this.saveBusinessSettings(Storage.get('settings') || {});
    }
    await this.loadBusinessData();
    return true;
  },

  setInvoiceCounter(value) {
    const counter = Number(value) || 0;
    localStorage.setItem(`${Storage.PREFIX}last_invoice_num`, String(counter));
  },

  getInvoiceCounter() {
    return Number(localStorage.getItem(`${Storage.PREFIX}last_invoice_num`)) || 0;
  },

  async uploadProductImage(productId, imageData) {
    const path = await this.uploadAsset('products', productId, imageData);
    return `storage://${path}`;
  },

  assetUrl(image) {
    if (!image) return '';
    if (!image.startsWith('storage://')) return image;
    const path = image.slice('storage://'.length);
    const cached = this.imageUrls.get(path);
    return cached && cached.expiresAt > Date.now() ? cached.url : '';
  },

  productImageUrl(image) {
    return this.assetUrl(image);
  },

  async refreshProductImageUrls(products = Storage.getAll('products'), force = false) {
    return this.refreshAssetUrls(products, Storage.get('settings') || {}, force);
  },

  startImageRefresh() {
    if (this.imageRefreshTimer) clearInterval(this.imageRefreshTimer);
    this.imageRefreshTimer = setInterval(async () => {
      try {
        const refreshed = await this.refreshProductImageUrls();
        if (refreshed && App.currentView === 'pos') POS.refreshCatalog();
        if (refreshed && App.currentView === 'products') Products.render();
      } catch (error) {
        console.error('Could not refresh private asset links:', error);
      }
    }, 45 * 60 * 1000);
  },

  async refreshAssetUrls(products = [], settings = {}, force = false) {
    if (!this.client || !this.user || !this.businessId) return false;
    const refreshBefore = Date.now() + 60 * 60 * 1000;
    const images = [
      ...products.map(product => product.image || ''),
      settings.logo || ''
    ];
    const paths = [...new Set(images
      .filter(image => image.startsWith('storage://'))
      .map(image => image.slice('storage://'.length)))]
      .filter(path => force || !this.imageUrls.has(path) || this.imageUrls.get(path).expiresAt <= refreshBefore);
    if (!paths.length) return false;
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrls(paths, 60 * 60);
    if (error) throw error;
    (data || []).forEach(item => {
      if (item.signedUrl) {
        this.imageUrls.set(item.path, {
          url: item.signedUrl,
          expiresAt: Date.now() + 60 * 60 * 1000
        });
      }
    });
    return true;
  },

  async exportProductImage(image) {
    if (!image || !image.startsWith('storage://')) return image;
    await this.refreshAssetUrls(Storage.getAll('products'), Storage.get('settings') || {});
    const url = this.assetUrl(image);
    if (!url) throw new Error('Could not create a download link for a product image');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not download a product image for the backup');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read a product image for the backup'));
      reader.readAsDataURL(blob);
    });
  },

  deleteProductImage(productId) {
    if (!this.businessId || !this.client) return;
    const path = `${this.businessId}/products/${productId}.jpg`;
    this.imageUrls.delete(path);
    return this.client.storage.from(this.bucket).remove([path]);
  },

  setStatus(status) {
    this.status = status;
    if (typeof App !== 'undefined' && typeof App.updateStorageStatus === 'function') {
      App.updateStorageStatus();
    }
  },

  updateAccountAction() {
    const button = document.getElementById('account-action');
    if (!button) return;
    button.hidden = !this.configured;
    button.textContent = this.user ? `Sign out (${this.user.email})` : 'Sign in';
    button.onclick = this.user ? () => this.signOut() : () => this.showAuth();
    const modeLabel = document.getElementById('storage-mode-label');
    if (modeLabel) modeLabel.textContent = this.configured
      ? 'EASYBILL v1.0 — Supabase Cloud'
      : 'EASYBILL v1.0 — Local Storage';
  },

  async signOut() {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) {
      Utils.toast('Could not sign out. Please try again.', 'error');
      return;
    }
    this.user = null;
    this.business = null;
    this.businessId = null;
    this.role = null;
    this.ready = false;
    this.needsBusiness = false;
    if (this.imageRefreshTimer) clearInterval(this.imageRefreshTimer);
    this.imageRefreshTimer = null;
    this.updateAccountAction();
    this.showAuth('You have been signed out.');
  }
};
