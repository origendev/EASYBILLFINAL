# EasyBILL role and permission matrix

Roles come from `business_members.role` for the authenticated user and active business membership; the UI must not grant a role based on a choice made on a login screen. The additive migration adds `is_active` and updates `is_business_member` / `has_business_role` to ignore inactive memberships.

| Action | Owner | Manager | Cashier |
|---|---:|---:|---:|
| POS checkout and permitted payment allocations | Yes | Yes | Yes |
| Search products and view available stock | Yes | Yes | Yes |
| Read cost price / profit analytics | Yes | Yes | No (cost price RPC is manager-only; reports navigation is hidden) |
| Create/edit products, prices, costs, stock settings | Yes | Yes | No |
| Add customer | Yes | Yes | Yes (after migration) |
| Edit/delete existing customer | Yes | Yes | No |
| Manage suppliers and receive purchases | Yes | Yes | No |
| Request invoice return | Yes | Yes | Yes |
| Approve returns/refund completion | Yes | Yes | No |
| Open/close own cashier shift | Yes | Yes | Yes |
| Review other cashiers' shifts | Yes | Yes | No |
| Read audit logs | Yes | Yes | No |
| Create audit entries | Yes | Yes | Yes |
| Change loyalty rules / manual point adjustment | Yes | Yes | No |
| Read/adjust loyalty ledger | Yes | Yes | Customer-scoped balance and redemption at POS only; no manual adjustments or full ledger access |
| Bulk product import/export | Yes | Yes | No |
| Deactivate staff membership | Owner-controlled policy/function path | Not owner-level role changes | No |

## Security notes

- Supabase service-role credentials must never be placed in renderer code. Staff invitations should use a trusted Supabase Edge Function or backend endpoint with narrowly scoped admin credentials; no service-role secret is included in this package.
- The migration limits direct `products.purchase_price` column reads and exposes costs through `get_business_product_costs`, which checks owner/manager membership.
- `audit_logs` intentionally has no update/delete policy. Local audit records are useful for local operation but are not tamper-proof.
- Returns are requests; a payment provider refund is not performed by this application. A refund must not be marked completed until independently confirmed.
- Validate these permissions with real test accounts after applying the migration. Static checks do not substitute for RLS integration tests.
