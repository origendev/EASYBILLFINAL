/* ============================================
   EASYBILL — Invoice List Module
   ============================================ */

const InvoiceList = {
  searchQuery: '',
  statusFilter: '',
  dateFrom: '',
  dateTo: '',

  render() {
    const invoices = this.getFilteredInvoices();
    const content = document.getElementById('page-content');
    const datePreset = this.getDatePreset();

    content.innerHTML = `
      <div class="animate-fade-in">
        <!-- Toolbar -->
        <div class="filters-bar">
          <div class="search-bar" style="flex: 1; max-width: 300px;">
            <i data-lucide="search"></i>
            <input type="text" id="invoice-search" placeholder="Search invoices..." 
              value="${Utils.escapeHtml(this.searchQuery)}" oninput="InvoiceList.onSearch(this.value)">
          </div>
          <div class="filter-group">
            <label>Status:</label>
            <select class="form-control" onchange="InvoiceList.filterStatus(this.value)">
              <option value="">All</option>
              <option value="paid" ${this.statusFilter === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="unpaid" ${this.statusFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="partial" ${this.statusFilter === 'partial' ? 'selected' : ''}>Partial</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Period:</label>
            <select class="form-control" onchange="InvoiceList.filterDatePreset(this.value)">
              <option value="" ${datePreset === '' ? 'selected' : ''}>Custom range</option>
              <option value="today" ${datePreset === 'today' ? 'selected' : ''}>Today</option>
              <option value="this-month" ${datePreset === 'this-month' ? 'selected' : ''}>This month</option>
              <option value="last-month" ${datePreset === 'last-month' ? 'selected' : ''}>Last month</option>
              <option value="this-year" ${datePreset === 'this-year' ? 'selected' : ''}>This year</option>
            </select>
          </div>
          <div class="filter-group">
            <label>From:</label>
            <input type="date" class="form-control" value="${this.dateFrom}"
              onchange="InvoiceList.filterDateFrom(this.value)">
          </div>
          <div class="filter-group">
            <label>To:</label>
            <input type="date" class="form-control" value="${this.dateTo}"
              onchange="InvoiceList.filterDateTo(this.value)">
          </div>
          <button class="btn btn-primary" onclick="App.navigate('new-invoice')">
            <i data-lucide="file-plus"></i> New Invoice
          </button>
        </div>

        <!-- Invoices Table -->
        ${invoices.length > 0 ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => {
                  const customer = Storage.getById('customers', inv.customerId);
                  return `
                    <tr>
                      <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(inv.invoiceNumber)}</strong></td>
                      <td>${customer ? Utils.escapeHtml(customer.name) : Utils.escapeHtml(inv.customerName || 'Deleted')}</td>
                      <td>${Utils.formatDate(inv.invoiceDate)}</td>
                      <td>${inv.dueDate ? Utils.formatDate(inv.dueDate) : '-'}</td>
                      <td><strong style="color: var(--text-primary);">${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                      <td>
                        <span class="badge badge-${inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'}">
                          ${inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td>
                        <div class="table-actions">
                          <button class="btn btn-ghost btn-sm" onclick="InvoiceList.viewInvoice('${inv.id}')" title="View & Export">
                            <i data-lucide="eye"></i>
                          </button>
                          <button class="btn btn-ghost btn-sm" onclick="InvoiceList.editInvoice('${inv.id}')" title="Edit">
                            <i data-lucide="pencil"></i>
                          </button>
                          <button class="btn btn-ghost btn-sm" onclick="InvoiceList.duplicateInvoice('${inv.id}')" title="Duplicate">
                            <i data-lucide="copy"></i>
                          </button>
                          <button class="btn btn-ghost btn-sm" onclick="InvoiceList.toggleStatus('${inv.id}')" title="Toggle Status">
                            <i data-lucide="${inv.status === 'paid' ? 'circle-x' : 'circle-check-big'}"></i>
                          </button>
                          <button class="btn btn-ghost btn-sm" onclick="InvoiceList.deleteInvoice('${inv.id}')" title="Delete" style="color: var(--danger);">
                            <i data-lucide="trash-2"></i>
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
          <div class="card">
            <div class="empty-state">
              <i data-lucide="file-text"></i>
              <h3>No Invoices Found</h3>
              <p>${this.searchQuery || this.statusFilter || this.dateFrom || this.dateTo
                ? 'No invoices match your filters'
                : 'Create your first invoice to get started'}</p>
              <button class="btn btn-primary" onclick="App.navigate('new-invoice')">
                <i data-lucide="file-plus"></i> Create Invoice
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  getFilteredInvoices() {
    let invoices = Storage.getAll('invoices');

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      invoices = invoices.filter(inv => {
        const customer = Storage.getById('customers', inv.customerId);
        return (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
          (customer && customer.name.toLowerCase().includes(q)) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q));
      });
    }

    // Status filter
    if (this.statusFilter) {
      invoices = invoices.filter(inv => inv.status === this.statusFilter);
    }

    // Date range
    if (this.dateFrom) {
      invoices = invoices.filter(inv => inv.invoiceDate >= this.dateFrom);
    }
    if (this.dateTo) {
      invoices = invoices.filter(inv => inv.invoiceDate <= this.dateTo);
    }

    return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  onSearch: Utils.debounce(function (val) {
    InvoiceList.searchQuery = val;
    InvoiceList.render();
  }, 250),

  filterStatus(val) {
    this.statusFilter = val;
    this.render();
  },

  filterDateFrom(val) {
    this.dateFrom = val;
    this.render();
  },

  filterDateTo(val) {
    this.dateTo = val;
    this.render();
  },

  getDatePreset() {
    const now = new Date();
    const toInputDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const ranges = {
      today: [toInputDate(now), toInputDate(now)],
      'this-month': [toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))],
      'last-month': [toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), toInputDate(new Date(now.getFullYear(), now.getMonth(), 0))],
      'this-year': [toInputDate(new Date(now.getFullYear(), 0, 1)), toInputDate(new Date(now.getFullYear(), 11, 31))]
    };
    return Object.keys(ranges).find(key => ranges[key][0] === this.dateFrom && ranges[key][1] === this.dateTo) || '';
  },

  filterDatePreset(preset) {
    const now = new Date();
    const toInputDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      this.dateFrom = toInputDate(now);
      this.dateTo = this.dateFrom;
    } else if (preset === 'this-month') {
      this.dateFrom = toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
      this.dateTo = toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (preset === 'last-month') {
      this.dateFrom = toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      this.dateTo = toInputDate(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (preset === 'this-year') {
      this.dateFrom = toInputDate(new Date(now.getFullYear(), 0, 1));
      this.dateTo = toInputDate(new Date(now.getFullYear(), 11, 31));
    } else {
      this.dateFrom = '';
      this.dateTo = '';
    }

    this.render();
  },

  viewInvoice(id) {
    const invoice = Storage.getById('invoices', id);
    if (!invoice) return;
    const customer = Storage.getById('customers', invoice.customerId);
    const settings = Storage.get('settings') || {};
    ExportModule.showPreview(invoice, customer, settings);
  },

  editInvoice(id) {
    App.navigate('new-invoice', id);
  },

  async duplicateInvoice(id) {
    const invoice = Storage.getById('invoices', id);
    if (!invoice) return;
    const newInvoice = {
      ...invoice,
      id: undefined,
      invoiceNumber: Utils.generateInvoiceNumber(),
      invoiceDate: Utils.today(),
      dueDate: null,
      status: 'unpaid',
      createdAt: undefined,
      updatedAt: undefined
    };
    try {
      if (Cloud.user) await Cloud.saveInvoice(newInvoice);
      else Storage.add('invoices', newInvoice);
      Utils.toast('Invoice duplicated successfully', 'success');
      this.render();
    } catch (error) {
      console.error('Invoice duplicate error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
    }
  },

  async toggleStatus(id) {
    const invoice = Storage.getById('invoices', id);
    if (!invoice) return;
    const newStatus = invoice.status === 'paid' ? 'unpaid' : 'paid';
    try {
      if (Cloud.user) await Cloud.updateInvoiceStatus(id, newStatus);
      else Storage.update('invoices', id, { status: newStatus });
      Utils.toast(`Invoice marked as ${newStatus}`, 'success');
      this.render();
    } catch (error) {
      console.error('Invoice status update error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
    }
  },

  async deleteInvoice(id) {
    const invoice = Storage.getById('invoices', id);
    const confirmed = await Utils.confirm(
      'Delete Invoice',
      `Are you sure you want to delete invoice "${invoice.invoiceNumber}"? This action cannot be undone.`
    );
    if (confirmed) {
      try {
        if (Cloud.user) await Cloud.deleteInvoice(id);
        else Storage.delete('invoices', id);
        Utils.toast('Invoice deleted', 'success');
        this.render();
      } catch (error) {
        console.error('Invoice delete error:', error);
        Utils.toast(Cloud.friendlyError(error), 'error');
      }
    }
  }
};
