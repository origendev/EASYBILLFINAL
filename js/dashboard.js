/* ============================================
   EASYBILL — Dashboard Module
   ============================================ */

const Dashboard = {
  render() {
    const invoices = Storage.getAll('invoices');
    const customers = Storage.getAll('customers');
    const products = Storage.getAll('products');
    const lowStockCount = products.filter(product => {
      const stock = Number(product.stock) || 0;
      const threshold = Number(product.lowStockThreshold ?? 5) || 0;
      return stock > 0 && stock <= threshold;
    }).length;

    // Calculate stats
    const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid');
    const paidAmount = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);

    // Recent invoices (last 5)
    const recentInvoices = [...invoices].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 5);

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in">
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card stagger-item">
            <div class="stat-card-header">
              <span class="stat-card-label">Total Revenue</span>
              <div class="stat-card-icon teal">
                <i data-lucide="indian-rupee"></i>
              </div>
            </div>
            <div class="stat-card-value">${Utils.formatCurrency(totalRevenue)}</div>
            <div class="stat-card-sub">${invoices.length} total invoices</div>
          </div>

          <div class="stat-card stagger-item">
            <div class="stat-card-header">
              <span class="stat-card-label">Paid Amount</span>
              <div class="stat-card-icon green">
                <i data-lucide="circle-check-big"></i>
              </div>
            </div>
            <div class="stat-card-value">${Utils.formatCurrency(paidAmount)}</div>
            <div class="stat-card-sub">${paidInvoices.length} paid invoices</div>
          </div>

          <div class="stat-card stagger-item">
            <div class="stat-card-header">
              <span class="stat-card-label">Unpaid Amount</span>
              <div class="stat-card-icon orange">
                <i data-lucide="clock"></i>
              </div>
            </div>
            <div class="stat-card-value">${Utils.formatCurrency(unpaidAmount)}</div>
            <div class="stat-card-sub">${unpaidInvoices.length} pending invoices</div>
          </div>

          <div class="stat-card stagger-item">
            <div class="stat-card-header">
              <span class="stat-card-label">Total Customers</span>
              <div class="stat-card-icon blue">
                <i data-lucide="users"></i>
              </div>
            </div>
            <div class="stat-card-value">${customers.length}</div>
            <div class="stat-card-sub">${products.length} products · ${lowStockCount} low stock</div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <div class="quick-action-card stagger-item" onclick="App.navigate('new-invoice')">
            <i data-lucide="file-plus"></i>
            <h3>New Invoice</h3>
            <p>Create a new invoice</p>
          </div>
          <div class="quick-action-card stagger-item" onclick="App.navigate('customers')">
            <i data-lucide="user-plus"></i>
            <h3>Add Customer</h3>
            <p>Manage your customers</p>
          </div>
          <div class="quick-action-card stagger-item" onclick="App.navigate('products')">
            <i data-lucide="package-plus"></i>
            <h3>Add Product</h3>
            <p>Manage your catalog</p>
          </div>
          <div class="quick-action-card stagger-item" onclick="App.navigate('settings')">
            <i data-lucide="building-2"></i>
            <h3>Business Profile</h3>
            <p>Setup your business</p>
          </div>
        </div>

        <!-- Recent Invoices -->
        <div class="card stagger-item">
          <div class="card-header">
            <h3 class="card-title">Recent Invoices</h3>
            ${invoices.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="App.navigate('invoices')">
              View All <i data-lucide="arrow-right"></i>
            </button>` : ''}
          </div>
          <div class="card-body" style="padding: 0;">
            ${recentInvoices.length > 0 ? `
              <div class="table-wrapper" style="border: none; border-radius: 0;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentInvoices.map(inv => {
                      const customer = Storage.getById('customers', inv.customerId);
                      return `
                        <tr>
                          <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(inv.invoiceNumber)}</strong></td>
                          <td>${customer ? Utils.escapeHtml(customer.name) : 'N/A'}</td>
                          <td>${Utils.formatDate(inv.invoiceDate)}</td>
                          <td><strong style="color: var(--text-primary);">${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                          <td>
                            <span class="badge badge-${inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'}">
                              ${inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Unpaid'}
                            </span>
                          </td>
                          <td>
                            <div class="table-actions">
                              <button class="btn btn-ghost btn-sm" onclick="InvoiceList.viewInvoice('${inv.id}')" title="View">
                                <i data-lucide="eye"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="empty-state">
                <i data-lucide="file-text"></i>
                <h3>No Invoices Yet</h3>
                <p>Create your first invoice to get started</p>
                <button class="btn btn-primary" onclick="App.navigate('new-invoice')">
                  <i data-lucide="plus"></i> Create Invoice
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }
};
