/* ============================================
   EASYBILL — Financial Reports & Net Profit Analytics
   ============================================ */

const Reports = {
  periodType: 'month',
  periodValue: '',

  render() {
    const invoices = Storage.getAll('invoices');
    const expenses = Storage.getAll('expenses');
    const products = Storage.getAll('products');

    const filteredInvoices = this.filterByDate(invoices);
    const filteredExpenses = this.filterByDate(expenses);

    // Compute Metrics
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalGst) || 0), 0);
    const totalDiscount = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalDiscount) || 0), 0);
    
    // Calculate COGS (Cost of Goods Sold)
    const totalCogs = this.calculateCogs(filteredInvoices, products);

    const totalExpensesAmount = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpensesAmount;
    const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const avgOrderValue = filteredInvoices.length > 0 ? (totalRevenue / filteredInvoices.length) : 0;
    const periodLabel = this.getPeriodLabel();
    const periodValue = this.getPeriodValue();

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in">
        <!-- Date Range Filter Bar -->
        <div class="filters-bar" style="justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div class="btn-group" role="group" aria-label="Report period">
              <button class="btn ${this.periodType === 'week' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="Reports.setPeriodType('week')">Weekly</button>
              <button class="btn ${this.periodType === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="Reports.setPeriodType('month')">Monthly</button>
              <button class="btn ${this.periodType === 'year' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="Reports.setPeriodType('year')">Yearly</button>
            </div>
            <label class="form-label" for="report-period" style="margin: 0;">${this.periodType === 'week' ? 'Week' : this.periodType === 'month' ? 'Month' : 'Year'}</label>
            <input class="form-control" id="report-period" type="${this.periodType === 'week' ? 'week' : this.periodType === 'month' ? 'month' : 'number'}"
              ${this.periodType === 'year' ? 'min="1" max="9999"' : ''}
              value="${Utils.escapeHtml(periodValue)}" onchange="Reports.setPeriodValue(this.value)"
              style="width: ${this.periodType === 'year' ? '100px' : 'auto'};">
            <strong style="color: var(--text-secondary);">${Utils.escapeHtml(periodLabel)}</strong>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="Reports.openAddExpenseModal()">
              <i data-lucide="receipt"></i> Log Expense
            </button>
            <button class="btn btn-primary btn-sm" type="button" onclick="Reports.downloadExcel()">
              <i data-lucide="file-spreadsheet"></i> Download Excel
            </button>
          </div>
        </div>

        <!-- KPI Cards Grid -->
        <div class="reports-kpi-grid">
          <div class="report-card">
            <div class="report-card-title">
              <span>Sales Revenue</span>
              <i data-lucide="trending-up" style="color: var(--accent);"></i>
            </div>
            <div class="report-card-value">${Utils.formatCurrency(totalRevenue)}</div>
            <div class="report-card-sub">${filteredInvoices.length} transactions completed</div>
          </div>

          <div class="report-card">
            <div class="report-card-title">
              <span>Cost of Goods (COGS)</span>
              <i data-lucide="package" style="color: var(--text-muted);"></i>
            </div>
            <div class="report-card-value">${Utils.formatCurrency(totalCogs)}</div>
            <div class="report-card-sub">Product sourcing & stock cost</div>
          </div>

          <div class="report-card" style="border-left: 4px solid ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
            <div class="report-card-title">
              <span>${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
              <i data-lucide="coins" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};"></i>
            </div>
            <div class="report-card-value profit" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${Utils.formatCurrency(netProfit)}
            </div>
            <div class="report-card-sub">
              <strong>${netMarginPercent}%</strong> net ${netProfit >= 0 ? 'profit' : 'loss'} margin
            </div>
          </div>

          <div class="report-card">
            <div class="report-card-title">
              <span>Operating Expenses</span>
              <i data-lucide="receipt" style="color: #f59e0b;"></i>
            </div>
            <div class="report-card-value">${Utils.formatCurrency(totalExpensesAmount)}</div>
            <div class="report-card-sub">${filteredExpenses.length} expense entries recorded</div>
          </div>
        </div>

        <!-- Secondary Metrics Row -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="padding: 16px;">
            <div class="stat-card-label" style="font-size: 12px;">Tax Collected (GST)</div>
            <div class="stat-card-value" style="font-size: 20px;">${Utils.formatCurrency(totalTax)}</div>
          </div>
          <div class="stat-card" style="padding: 16px;">
            <div class="stat-card-label" style="font-size: 12px;">Total Discounts</div>
            <div class="stat-card-value" style="font-size: 20px;">${Utils.formatCurrency(totalDiscount)}</div>
          </div>
          <div class="stat-card" style="padding: 16px;">
            <div class="stat-card-label" style="font-size: 12px;">Avg Ticket Size</div>
            <div class="stat-card-value" style="font-size: 20px;">${Utils.formatCurrency(avgOrderValue)}</div>
          </div>
          <div class="stat-card" style="padding: 16px;">
            <div class="stat-card-label" style="font-size: 12px;">Gross Margin</div>
            <div class="stat-card-value" style="font-size: 20px;">${totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 class="card-title">Sales for ${Utils.escapeHtml(periodLabel)}</h3>
            <span style="color: var(--text-muted); font-size: 13px;">${filteredInvoices.length} completed transactions</span>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Sale / Receipt</th><th>Customer</th><th>Items</th><th>Payment</th><th>Sales</th><th>COGS</th><th>Gross profit</th></tr></thead>
              <tbody>
                ${filteredInvoices.length ? filteredInvoices.map(invoice => {
                  const invoiceCogs = this.calculateCogs([invoice], products);
                  const customer = invoice.customerId ? Storage.getById('customers', invoice.customerId) : null;
                  const quantity = (invoice.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  return `<tr>
                    <td>${Utils.formatDate(invoice.invoiceDate || invoice.createdAt)}</td>
                    <td><strong>${Utils.escapeHtml(invoice.invoiceNumber || 'Sale')}</strong></td>
                    <td>${Utils.escapeHtml(customer ? customer.name : invoice.customerName || 'Walk-in customer')}</td>
                    <td>${quantity}</td>
                    <td>${Utils.escapeHtml(invoice.paymentMethod || 'Cash')}</td>
                    <td><strong>${Utils.formatCurrency(Number(invoice.grandTotal) || 0)}</strong></td>
                    <td>${Utils.formatCurrency(invoiceCogs)}</td>
                    <td style="color: ${Number(invoice.grandTotal || 0) - invoiceCogs >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency((Number(invoice.grandTotal) || 0) - invoiceCogs)}</td>
                  </tr>`;
                }).join('') : '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No sales recorded for this period.</td></tr>'}
              </tbody>
              ${filteredInvoices.length ? `<tfoot><tr>
                <th colspan="5">Period totals</th>
                <th>${Utils.formatCurrency(totalRevenue)}</th>
                <th>${Utils.formatCurrency(totalCogs)}</th>
                <th>${Utils.formatCurrency(grossProfit)}</th>
              </tr></tfoot>` : ''}
            </table>
          </div>
        </div>

        <!-- Interactive Charts Grid -->
        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Revenue vs COGS vs Net Profit</h3>
              <span style="font-size: 12px; color: var(--text-muted);">Financial Breakdown</span>
            </div>
            <div class="chart-container" id="financial-bar-chart">
              ${this.renderFinancialBarChart(totalRevenue, totalCogs, totalExpensesAmount, netProfit)}
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Payment Methods Breakdown</h3>
              <span style="font-size: 12px; color: var(--text-muted);">Includes split payments</span>
            </div>
            <div class="chart-container" id="payment-methods-chart">
              ${this.renderPaymentMethodsChart(filteredInvoices)}
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Sales Trend</h3>
              <span style="font-size: 12px; color: var(--text-muted);">${this.periodType === 'week' ? 'By day' : this.periodType === 'month' ? 'By week' : 'By month'}</span>
            </div>
            <div class="chart-container chart-container-tall" id="sales-trend-chart">
              ${this.renderSalesTrendChart(filteredInvoices)}
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Top Products</h3>
              <span style="font-size: 12px; color: var(--text-muted);">Ranked by sales</span>
            </div>
            <div class="chart-container chart-container-tall" id="product-performance-chart">
              ${this.renderTopProductsChart(filteredInvoices)}
            </div>
          </div>
        </div>

        <!-- Expenses & Profit Breakdown Tables -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <!-- Operating Expenses List -->
          <div class="card">
            <div class="card-header" style="justify-content: space-between;">
              <h3 class="card-title">Recorded Business Expenses</h3>
              <button class="btn btn-ghost btn-sm" onclick="Reports.openAddExpenseModal()">
                <i data-lucide="plus"></i> Add Expense
              </button>
            </div>
            <div class="card-body" style="padding: 0;">
              ${filteredExpenses.length > 0 ? `
                <div class="table-wrapper" style="border: none; border-radius: 0;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Note</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredExpenses.map(exp => `
                        <tr>
                          <td><span class="badge badge-warning">${Utils.escapeHtml(exp.category || 'Expense')}</span></td>
                          <td>${Utils.escapeHtml(exp.note || '-')}</td>
                          <td>${Utils.formatDate(exp.createdAt)}</td>
                          <td><strong style="color: var(--danger);">${Utils.formatCurrency(exp.amount)}</strong></td>
                          <td>
                            <button class="btn btn-ghost btn-sm" onclick="Reports.deleteExpense('${exp.id}')" style="color: var(--danger);">
                              <i data-lucide="trash-2"></i>
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="empty-state" style="padding: 24px;">
                  <i data-lucide="receipt"></i>
                  <p>No operational expenses recorded for this period.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Top Profitable Products -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Top Products Insights</h3>
            </div>
            <div class="card-body" style="padding: 0;">
              ${this.renderTopProductsList(filteredInvoices, products)}
            </div>
          </div>
        </div>
      </div>
    `;

    Icons.renderAll();
  },

  setPeriodType(type) {
    if (!['week', 'month', 'year'].includes(type)) return;
    this.periodType = type;
    this.periodValue = '';
    this.render();
  },

  setPeriodValue(value) {
    const valid = this.periodType === 'week'
      ? /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value)
      : this.periodType === 'month'
        ? /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
        : /^\d{1,4}$/.test(value) && Number(value) > 0;
    if (!valid) {
      Utils.toast('Choose a valid report period', 'error');
      this.render();
      return;
    }
    this.periodValue = value;
    this.render();
  },

  getPeriodValue() {
    if (this.periodValue) return this.periodValue;
    const today = new Date();
    if (this.periodType === 'year') return String(today.getFullYear());
    if (this.periodType === 'month') {
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    const thursday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    thursday.setDate(thursday.getDate() + 4 - (thursday.getDay() || 7));
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
    return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
  },

  getPeriodBounds() {
    const value = this.getPeriodValue();
    if (this.periodType === 'year') {
      const year = Number(value);
      return [new Date(year, 0, 1), new Date(year + 1, 0, 1)];
    }
    if (this.periodType === 'month') {
      const [year, month] = value.split('-').map(Number);
      return [new Date(year, month - 1, 1), new Date(year, month, 1)];
    }
    const [year, week] = value.split('-W').map(Number);
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return [monday, nextMonday];
  },

  formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  getPeriodLabel() {
    const value = this.getPeriodValue();
    if (this.periodType === 'year') return value;
    if (this.periodType === 'month') {
      const [year, month] = value.split('-').map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const [start, endExclusive] = this.getPeriodBounds();
    const end = new Date(endExclusive);
    end.setDate(end.getDate() - 1);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  },

  filterByDate(items) {
    const [start, endExclusive] = this.getPeriodBounds();
    const startDate = this.formatLocalDate(start);
    const endDate = this.formatLocalDate(endExclusive);
    return items.filter(item => {
      const source = item.invoiceDate || item.createdAt || item.date;
      if (!source) return false;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(source))
        ? String(source)
        : (() => {
          const parsed = new Date(source);
          return Number.isNaN(parsed.getTime()) ? '' : this.formatLocalDate(parsed);
        })();
      return date >= startDate && date < endDate;
    });
  },

  calculateCogs(invoices, products) {
    return invoices.reduce((total, invoice) => total + (Array.isArray(invoice.items)
      ? invoice.items.reduce((invoiceTotal, item) => {
        const product = products.find(candidate => candidate.id === item.productId);
        const cost = product && product.costPrice !== undefined && product.costPrice !== null && product.costPrice !== ''
          ? Number(product.costPrice)
          : Number(item.rate) * 0.7;
        return invoiceTotal + (Number.isFinite(cost) ? cost : 0) * (Number(item.quantity) || 1);
      }, 0)
      : 0), 0);
  },

  downloadExcel() {
    const invoices = this.filterByDate(Storage.getAll('invoices'));
    const expenses = this.filterByDate(Storage.getAll('expenses'));
    const products = Storage.getAll('products');
    const customers = Storage.getAll('customers');
    const revenue = invoices.reduce((sum, invoice) => sum + (Number(invoice.grandTotal) || 0), 0);
    const cogs = this.calculateCogs(invoices, products);
    const expenseTotal = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenseTotal;
    const tax = invoices.reduce((sum, invoice) => sum + (Number(invoice.totalGst) || 0), 0);
    const discounts = invoices.reduce((sum, invoice) => sum + (Number(invoice.totalDiscount) || 0), 0);
    const label = this.getPeriodLabel();
    const escape = value => String(value ?? '').replace(/[&<>"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    })[character]);
    const cell = (value, numeric = false) => numeric
      ? `<td class="number" x:num="${Number(value) || 0}">${Number(value) || 0}</td>`
      : `<td>${escape(value)}</td>`;

    const salesRows = invoices.map(invoice => {
      const customer = customers.find(entry => entry.id === invoice.customerId);
      const invoiceCogs = this.calculateCogs([invoice], products);
      const quantity = (invoice.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return `<tr>${[
        cell(invoice.invoiceDate || invoice.createdAt || ''),
        cell(invoice.invoiceNumber || 'Sale'),
        cell(customer ? customer.name : invoice.customerName || 'Walk-in customer'),
        cell(quantity, true),
        cell(invoice.paymentMethod || 'Cash'),
        cell(Number(invoice.grandTotal) || 0, true),
        cell(invoiceCogs, true),
        cell((Number(invoice.grandTotal) || 0) - invoiceCogs, true),
        cell(Number(invoice.totalGst) || 0, true),
        cell(Number(invoice.totalDiscount) || 0, true)
      ].join('')}</tr>`;
    }).join('');

    const productTotals = new Map();
    invoices.forEach(invoice => (invoice.items || []).forEach(item => {
      const name = item.name || 'Product';
      const current = productTotals.get(name) || { quantity: 0, sales: 0 };
      current.quantity += Number(item.quantity) || 0;
      current.sales += Number(item.amount) || 0;
      productTotals.set(name, current);
    }));
    const productRows = [...productTotals.entries()].sort((a, b) => b[1].sales - a[1].sales)
      .map(([name, total]) => `<tr>${cell(name)}${cell(total.quantity, true)}${cell(total.sales, true)}</tr>`).join('');
    const expenseRows = expenses.map(expense => `<tr>${cell(expense.date || expense.createdAt || '')}${cell(expense.category || 'Other')}${cell(expense.note || '')}${cell(Number(expense.amount) || 0, true)}</tr>`).join('');
    const generatedAt = new Date().toLocaleString();
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>
      body{font-family:Calibri,Arial,sans-serif;color:#1f2937}table{border-collapse:collapse;margin-bottom:22px;width:100%}
      td,th{border:1px solid #d1d8c3;padding:8px 10px}th{background:#596b22;color:#fff;font-weight:bold;text-align:left}
      .title{background:#344214;color:#fff;font-size:20px;font-weight:bold;padding:14px}
      .subtitle{background:#eff3e5;color:#344214;font-weight:bold;padding:9px}
      .metric{background:#f0fdfa;font-weight:bold}.number{text-align:right;mso-number-format:"\\#\\,\\#\\#0\\.00"}
      .total{background:#e2e8f0;font-weight:bold}.profit{color:#047857;font-weight:bold}.loss{color:#b91c1c;font-weight:bold}
      </style></head><body><table>
      <tr><td colspan="4" class="title">EASYBILL | SALES &amp; PROFIT REPORT</td></tr>
      <tr><td class="metric">Reporting period</td><td colspan="3">${escape(label)}</td></tr>
      <tr><td class="metric">Generated</td><td colspan="3">${escape(generatedAt)}</td></tr>
      <tr><td colspan="4" class="subtitle">Financial summary</td></tr>
      <tr><th>Metric</th><th>Value (INR)</th><th>Metric</th><th>Value</th></tr>
      <tr><td>Sales revenue</td>${cell(revenue, true)}<td>Transactions</td>${cell(invoices.length, true)}</tr>
      <tr><td>Cost of goods sold</td>${cell(cogs, true)}<td>Units sold</td>${cell(invoices.reduce((sum, invoice) => sum + (invoice.items || []).reduce((qty, item) => qty + (Number(item.quantity) || 0), 0), 0), true)}</tr>
      <tr><td>Gross profit</td>${cell(grossProfit, true)}<td>Average sale</td>${cell(invoices.length ? revenue / invoices.length : 0, true)}</tr>
      <tr><td>Operating expenses</td>${cell(expenseTotal, true)}<td>GST collected</td>${cell(tax, true)}</tr>
      <tr><td class="${netProfit >= 0 ? 'profit' : 'loss'}">Net ${netProfit >= 0 ? 'profit' : 'loss'}</td>${cell(netProfit, true)}<td>Total discounts</td>${cell(discounts, true)}</tr>
      <tr><td colspan="10" class="subtitle">Sales transactions</td></tr>
      <tr><th>Date</th><th>Sale / receipt</th><th>Customer</th><th>Units</th><th>Payment</th><th>Sales (INR)</th><th>COGS (INR)</th><th>Gross profit (INR)</th><th>GST (INR)</th><th>Discount (INR)</th></tr>
      ${salesRows || '<tr><td colspan="10">No sales recorded for this period.</td></tr>'}
      <tr><td colspan="10" class="subtitle">Product sales summary</td></tr>
      <tr><th>Product</th><th colspan="2">Units sold</th><th colspan="2">Sales (INR)</th></tr>
      ${productRows || '<tr><td colspan="5">No product sales recorded for this period.</td></tr>'}
      <tr><td colspan="4" class="subtitle">Operating expenses</td></tr>
      <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount (INR)</th></tr>
      ${expenseRows || '<tr><td colspan="4">No expenses recorded for this period.</td></tr>'}
      </table></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `easybill-sales-report-${this.periodType}-${this.getPeriodValue()}.xls`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Utils.toast('Excel report downloaded', 'success');
  },

  renderFinancialBarChart(revenue, cogs, expenses, netProfit) {
    const max = Math.max(revenue, cogs + expenses, Math.abs(netProfit), 1);
    const revPct = Math.min(100, Math.round((revenue / max) * 100));
    const cogsPct = Math.min(100, Math.round((cogs / max) * 100));
    const expPct = Math.min(100, Math.round((expenses / max) * 100));
    const profitPct = Math.min(100, Math.round((Math.max(0, netProfit) / max) * 100));

    return `
      <div style="display: flex; flex-direction: column; gap: 16px; height: 100%; justify-content: center; padding: 10px 0;">
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            <span>Gross Revenue</span>
            <span>${Utils.formatCurrency(revenue)}</span>
          </div>
          <div style="background: var(--border); height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="width: ${revPct}%; background: var(--accent-gradient); height: 100%; border-radius: 6px; transition: width 0.6s ease;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            <span>Cost of Goods (COGS)</span>
            <span>${Utils.formatCurrency(cogs)}</span>
          </div>
          <div style="background: var(--border); height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="width: ${cogsPct}%; background: #64748b; height: 100%; border-radius: 6px; transition: width 0.6s ease;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            <span>Expenses</span>
            <span>${Utils.formatCurrency(expenses)}</span>
          </div>
          <div style="background: var(--border); height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="width: ${expPct}%; background: #f59e0b; height: 100%; border-radius: 6px; transition: width 0.6s ease;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            <span>Net Profit</span>
            <span style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 800;">${Utils.formatCurrency(netProfit)}</span>
          </div>
          <div style="background: var(--border); height: 12px; border-radius: 6px; overflow: hidden;">
            <div style="width: ${profitPct}%; background: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; height: 100%; border-radius: 6px; transition: width 0.6s ease;"></div>
          </div>
        </div>
      </div>
    `;
  },

  renderSalesTrendChart(invoices) {
    const [start] = this.getPeriodBounds();
    const buckets = this.periodType === 'week' ? 7 : this.periodType === 'month' ? 5 : 12;
    const labels = this.periodType === 'week'
      ? Array.from({ length: buckets }, (_, index) => {
        const day = new Date(start);
        day.setDate(day.getDate() + index);
        return day.toLocaleDateString(undefined, { weekday: 'short' });
      })
      : this.periodType === 'month'
        ? Array.from({ length: buckets }, (_, index) => `W${index + 1}`)
        : Array.from({ length: buckets }, (_, index) => new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'short' }));
    const totals = Array(buckets).fill(0);
    invoices.forEach(invoice => {
      const source = invoice.invoiceDate || invoice.createdAt || invoice.date;
      if (!source) return;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(source))
        ? new Date(`${source}T00:00:00`)
        : new Date(source);
      if (Number.isNaN(date.getTime())) return;
      const index = this.periodType === 'week'
        ? Math.floor((date - start) / 86400000)
        : this.periodType === 'month'
          ? Math.floor((date.getDate() - 1) / 7)
          : date.getMonth();
      if (index >= 0 && index < buckets) totals[index] += Number(invoice.grandTotal) || 0;
    });
    const max = Math.max(...totals, 1);
    return `<div class="trend-chart" role="img" aria-label="Sales trend for selected period">${totals.map((total, index) => `<div class="trend-column" title="${Utils.escapeHtml(labels[index])}: ${Utils.escapeHtml(Utils.formatCurrency(total))}"><span class="trend-value">${total ? Utils.formatCurrency(total) : ''}</span><div class="trend-track"><span class="trend-bar" style="height:${Math.max(total ? 4 : 0, Math.round((total / max) * 100))}%"></span></div><small>${Utils.escapeHtml(labels[index])}</small></div>`).join('')}</div>`;
  },

  renderTopProductsChart(invoices) {
    const totals = new Map();
    invoices.forEach(invoice => (invoice.items || []).forEach(item => {
      const name = item.name || 'Product';
      totals.set(name, (totals.get(name) || 0) + (Number(item.amount) || 0));
    }));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!ranked.length) return '<div class="chart-empty">No product sales recorded for this period.</div>';
    const max = Math.max(...ranked.map(([, amount]) => amount), 1);
    return `<div class="product-chart" role="img" aria-label="Top products ranked by sales">${ranked.map(([name, amount]) => `<div class="product-chart-row"><div class="product-chart-label"><span>${Utils.escapeHtml(name)}</span><strong>${Utils.formatCurrency(amount)}</strong></div><div class="product-chart-track"><span style="width:${Math.max(amount ? 2 : 0, Math.round((amount / max) * 100))}%"></span></div></div>`).join('')}</div>`;
  },

  renderPaymentMethodsChart(invoices) {
    const methods = { Cash: 0, UPI: 0, Card: 0, 'Bank transfer': 0, 'Store credit': 0, Other: 0 };
    const methodNames = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', 'bank transfer': 'Bank transfer', store_credit: 'Store credit', 'store credit': 'Store credit', other: 'Other' };
    let total = 0;
    invoices.forEach(inv => {
      const payments = Array.isArray(inv.payments) && inv.payments.length
        ? inv.payments
        : [{ method: inv.paymentMethod || 'Cash', amount: inv.grandTotal }];
      payments.forEach(payment => {
        const rawMethod = String(payment.method || 'Other').toLowerCase();
        const label = methodNames[rawMethod] || rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);
        const method = Object.hasOwn(methods, label) ? label : 'Other';
        const amount = Number(payment.amount) || 0;
        methods[method] += amount;
        total += amount;
      });
    });

    if (total === 0) {
      return `<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted);">No transaction data available yet</div>`;
    }

    const colors = { Cash: 'var(--accent)', UPI: 'var(--accent-light)', Card: '#e79b2d', 'Bank transfer': '#168b8b', 'Store credit': '#607d8b', Other: '#89959b' };
    const entries = Object.entries(methods).filter(([, amount]) => amount > 0);

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; height: 100%; justify-content: center;">
        <div class="payment-stack" role="img" aria-label="Payment methods breakdown">${entries.map(([method, amount]) => `<span style="width:${(amount / total) * 100}%;background:${colors[method]}" title="${Utils.escapeHtml(method)}: ${Math.round((amount / total) * 100)}%"></span>`).join('')}</div>
        <div class="payment-legend">${entries.map(([method, amount]) => `<div class="payment-legend-item"><span style="--payment-color:${colors[method]}"></span><span>${Utils.escapeHtml(method)} <strong>${Utils.formatCurrency(amount)} (${Math.round((amount / total) * 100)}%)</strong></span></div>`).join('')}</div>
      </div>
    `;
  },

  renderTopProductsList(invoices, products) {
    const productStats = {};
    invoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const name = item.name || 'Product';
          if (!productStats[name]) productStats[name] = { qty: 0, revenue: 0 };
          productStats[name].qty += parseFloat(item.quantity) || 1;
          productStats[name].revenue += parseFloat(item.amount) || 0;
        });
      }
    });

    const sorted = Object.entries(productStats)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    if (!sorted.length) {
      return `<div class="empty-state" style="padding: 24px;"><p>No product sales recorded yet.</p></div>`;
    }

    return `
      <div class="table-wrapper" style="border: none; border-radius: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Qty Sold</th>
              <th>Total Sales</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => `
              <tr>
                <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(p.name)}</strong></td>
                <td>${p.qty} pcs</td>
                <td><strong style="color: var(--accent);">${Utils.formatCurrency(p.revenue)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openAddExpenseModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Log Business Expense</h3>
          <button class="modal-close" onclick="Reports.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="expense-form" onsubmit="Reports.saveExpense(event)">
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <select class="form-control" name="category" required>
                <option value="Rent">Shop Rent</option>
                <option value="Utilities">Electricity / Internet / Utilities</option>
                <option value="Salaries">Staff Salary</option>
                <option value="Supplies">Office / Packaging Supplies</option>
                <option value="Transport">Transport / Delivery</option>
                <option value="Other">Other Expense</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Amount (₹) <span class="required">*</span></label>
              <input type="number" class="form-control" name="amount" required min="0.01" step="0.01" placeholder="e.g. 5000">
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <input type="text" class="form-control" name="note" placeholder="e.g. September electricity bill">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Reports.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="document.getElementById('expense-form').requestSubmit()">
            <i data-lucide="check"></i> Save Expense
          </button>
        </div>
      </div>
    `;
    overlay.classList.add('active');
    Icons.renderAll();
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  saveExpense(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      category: form.category.value,
      amount: parseFloat(form.amount.value) || 0,
      note: form.note.value.trim()
    };
    Storage.add('expenses', data);
    Utils.toast('Expense recorded', 'success');
    this.closeModal();
    this.render();
  },

  deleteExpense(id) {
    Storage.delete('expenses', id);
    Utils.toast('Expense deleted', 'success');
    this.render();
  }
};
