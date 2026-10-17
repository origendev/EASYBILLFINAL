/* ============================================
   EASYBILL — Dashboard Module (Insights & Right Panel Quick Actions)
   ============================================ */

const Dashboard = {
  render() {
    const invoices = Storage.getAll('invoices');
    const customers = Storage.getAll('customers');
    const products = Storage.getAll('products');
    const expenses = Storage.getAll('expenses');

    // Filter today's sales
    const todayStr = new Date().toDateString();
    const todayInvoices = invoices.filter(inv => new Date(inv.createdAt || inv.invoiceDate || Date.now()).toDateString() === todayStr);
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);

    // Calculate overall revenue & profits
    const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    
    // COGS
    let totalCogs = 0;
    invoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const costPrice = prod && prod.costPrice !== undefined && prod.costPrice !== null && prod.costPrice !== ''
            ? parseFloat(prod.costPrice)
            : (parseFloat(item.rate) * 0.7);
          totalCogs += costPrice * (parseFloat(item.quantity) || 1);
        });
      }
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalCogs - totalExpenses;

    const lowStockProducts = products.filter(product => {
      const stock = Number(product.stock) || 0;
      const threshold = Number(product.lowStockThreshold ?? 5) || 0;
      return stock > 0 && stock <= threshold;
    });

    const recentInvoices = [...invoices].sort((a, b) =>
      new Date(b.createdAt || b.invoiceDate) - new Date(a.createdAt || a.invoiceDate)
    ).slice(0, 6);

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in dashboard-layout">
        <!-- Main Insights Column (Left ~75%) -->
        <div class="dashboard-main-insights">
          <!-- Top KPI Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card stagger-item">
              <div class="stat-card-header">
                <span class="stat-card-label">Today's Sales</span>
                <div class="stat-card-icon teal">
                  <i data-lucide="zap"></i>
                </div>
              </div>
              <div class="stat-card-value">${Utils.formatCurrency(todayRevenue)}</div>
              <div class="stat-card-sub">${todayInvoices.length} orders today</div>
            </div>

            <div class="stat-card stagger-item">
              <div class="stat-card-header">
                <span class="stat-card-label">Total Revenue</span>
                <div class="stat-card-icon blue">
                  <i data-lucide="indian-rupee"></i>
                </div>
              </div>
              <div class="stat-card-value">${Utils.formatCurrency(totalRevenue)}</div>
              <div class="stat-card-sub">${invoices.length} total invoices</div>
            </div>

            <div class="stat-card stagger-item">
              <div class="stat-card-header">
                <span class="stat-card-label">Net Profit</span>
                <div class="stat-card-icon green">
                  <i data-lucide="trending-up"></i>
                </div>
              </div>
              <div class="stat-card-value" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                ${Utils.formatCurrency(netProfit)}
              </div>
              <div class="stat-card-sub">Revenue minus COGS & Expenses</div>
            </div>

            <div class="stat-card stagger-item">
              <div class="stat-card-header">
                <span class="stat-card-label">Catalog & Stock</span>
                <div class="stat-card-icon ${lowStockProducts.length > 0 ? 'orange' : 'teal'}">
                  <i data-lucide="package"></i>
                </div>
              </div>
              <div class="stat-card-value">${products.length}</div>
              <div class="stat-card-sub">
                ${lowStockProducts.length > 0 ? `<span style="color: var(--danger); font-weight: 700;">⚠️ ${lowStockProducts.length} low stock items</span>` : 'Stock healthy'}
              </div>
            </div>
          </div>

          <!-- Business Performance Visual Insight -->
          <div class="card stagger-item" style="padding: 20px;">
            <div class="card-header" style="border: none; padding: 0 0 16px 0; margin: 0;">
              <h3 class="card-title">Business Overview & Insights</h3>
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('reports')">
                Full Report <i data-lucide="arrow-right"></i>
              </button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <!-- Revenue vs Net Profit mini bar bar -->
              <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 8px;">Profit Margin Summary</span>
                <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px;">
                  ${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}% <small style="font-size: 13px; font-weight: 500; color: var(--text-muted);">Net Margin</small>
                </div>
                <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; display: flex;">
                  <div style="width: ${totalRevenue > 0 ? Math.max(0, Math.min(100, (netProfit / totalRevenue) * 100)) : 0}%; background: var(--success);"></div>
                </div>
              </div>

              <!-- Customer Insights -->
              <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 8px;">Customer Base</span>
                <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
                  ${customers.length} <small style="font-size: 13px; font-weight: 500; color: var(--text-muted);">Registered (by Mobile)</small>
                </div>
                <span style="font-size: 12px; color: var(--text-secondary);">Walk-in customers served instantly via POS</span>
              </div>
            </div>
          </div>

          <!-- Low Stock Alert Banner (If Any) -->
          ${lowStockProducts.length > 0 ? `
            <div class="card" style="border-left: 4px solid var(--warning); background: rgba(245, 158, 11, 0.05);">
              <div class="card-header" style="border: none; padding-bottom: 8px;">
                <h3 class="card-title" style="color: #d97706; display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="alert-triangle"></i> Low Stock Alert
                </h3>
                <button class="btn btn-secondary btn-sm" onclick="App.navigate('stocks')">Manage Stocks</button>
              </div>
              <div class="card-body" style="padding-top: 0; font-size: 13px; color: var(--text-secondary);">
                ${lowStockProducts.slice(0, 3).map(p => `<strong>${Utils.escapeHtml(p.name)}</strong> (${p.stock} left)`).join(' · ')}
                ${lowStockProducts.length > 3 ? ` and ${lowStockProducts.length - 3} more` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Recent Transactions Table -->
          <div class="card stagger-item">
            <div class="card-header">
              <h3 class="card-title">Recent Sales</h3>
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('pos')">
                Point of Sale <i data-lucide="scan-line"></i>
              </button>
            </div>
            <div class="card-body" style="padding: 0;">
              ${recentInvoices.length > 0 ? `
                <div class="table-wrapper" style="border: none; border-radius: 0;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Receipt #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recentInvoices.map(inv => {
                        const cust = inv.customerId ? Storage.getById('customers', inv.customerId) : null;
                        const customerDisplay = cust ? `${Utils.escapeHtml(cust.name || 'Customer')} (${Utils.escapeHtml(cust.phone)})` : Utils.escapeHtml(inv.customerName || 'Walk-in Customer');
                        return `
                          <tr>
                            <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(inv.invoiceNumber)}</strong></td>
                            <td>${customerDisplay}</td>
                            <td>${Utils.formatDate(inv.createdAt || inv.invoiceDate)}</td>
                            <td><strong style="color: var(--text-primary);">${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                            <td>
                              <span class="badge badge-info">${inv.paymentMethod || 'Cash'}</span>
                            </td>
                            <td>
                              <button class="btn btn-ghost btn-sm" onclick="POS.showReceiptModalById('${inv.id}')" title="Print Receipt">
                                <i data-lucide="printer"></i>
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="empty-state">
                  <i data-lucide="shopping-bag"></i>
                  <h3>No Sales Completed Yet</h3>
                  <p>Open POS to complete your first checkout</p>
                  <button class="btn btn-primary" onclick="App.navigate('pos')">
                    <i data-lucide="scan-line"></i> Open Point of Sale
                  </button>
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Right Side Panel (Quick Actions Moved Right) -->
        <div class="dashboard-side-panel">
          <div class="quick-actions-panel">
            <div class="quick-actions-panel-title">
              <span>Quick Actions</span>
              <i data-lucide="sparkles" style="color: var(--accent);"></i>
            </div>
            <div class="quick-actions-vertical">
              <div class="quick-action-row" onclick="App.navigate('pos')">
                <div class="quick-action-row-icon">
                  <i data-lucide="scan-line"></i>
                </div>
                <div class="quick-action-row-text">
                  <strong>Point of Sale</strong>
                  <span>Fast barcode & mobile billing</span>
                </div>
              </div>

              <div class="quick-action-row" onclick="App.navigate('customers')">
                <div class="quick-action-row-icon">
                  <i data-lucide="user-plus"></i>
                </div>
                <div class="quick-action-row-text">
                  <strong>Add Customer</strong>
                  <span>Register customer mobile no.</span>
                </div>
              </div>

              <div class="quick-action-row" onclick="App.navigate('products')">
                <div class="quick-action-row-icon">
                  <i data-lucide="package-plus"></i>
                </div>
                <div class="quick-action-row-text">
                  <strong>Add Product</strong>
                  <span>Set price, cost & barcode</span>
                </div>
              </div>

              <div class="quick-action-row" onclick="App.navigate('reports')">
                <div class="quick-action-row-icon">
                  <i data-lucide="bar-chart-3"></i>
                </div>
                <div class="quick-action-row-text">
                  <strong>Net Profit & Reports</strong>
                  <span>Analytics & expense tracker</span>
                </div>
              </div>

              <div class="quick-action-row" onclick="App.navigate('settings')">
                <div class="quick-action-row-icon">
                  <i data-lucide="settings"></i>
                </div>
                <div class="quick-action-row-text">
                  <strong>Settings & Backup</strong>
                  <span>Store profile & data export</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Tip Card -->
          <div class="card" style="padding: 16px; background: linear-gradient(135deg, rgba(89, 107, 34, 0.07), rgba(130, 146, 62, 0.03)); border-color: rgba(89, 107, 34, 0.18);">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <i data-lucide="lightbulb" style="color: var(--accent); flex-shrink: 0; margin-top: 2px;"></i>
              <div>
                <strong style="font-size: 13px; color: var(--text-primary); display: block;">POS Keyboard Pro Tip</strong>
                <span style="font-size: 12px; color: var(--text-secondary);">
                  Press <kbd>F2</kbd> in POS to quickly search customer mobile no. Press <kbd>F4</kbd> to complete sale!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    Icons.renderAll();
  }
};
