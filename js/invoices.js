/* ============================================
   EASYBILL — Invoice Creation Module
   ============================================ */

const Invoices = {
  currentItems: [],
  editingId: null,

  render(editId = null) {
    this.editingId = editId;
    const isEdit = !!editId;
    let invoice = null;

    if (isEdit) {
      invoice = Storage.getById('invoices', editId);
      if (!invoice) {
        Utils.toast('Invoice not found', 'error');
        App.navigate('invoices');
        return;
      }
      this.currentItems = [...invoice.items];
    } else if (this.currentItems.length === 0) {
      this.currentItems = [this.emptyItem()];
    }

    const customers = Storage.getAll('customers');
    const products = Storage.getAll('products');
    const settings = Storage.get('settings') || {};

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in">
        <form id="invoice-form" onsubmit="Invoices.saveInvoice(event)">
          <!-- Invoice Meta -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <h3 class="card-title">${isEdit ? 'Edit Invoice' : 'Invoice Details'}</h3>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Invoice Number <span class="required">*</span></label>
                  <input type="text" class="form-control" name="invoiceNumber" required
                    value="${isEdit ? Utils.escapeHtml(invoice.invoiceNumber) : Utils.generateInvoiceNumber()}"
                    ${isEdit ? 'readonly style="opacity: 0.7;"' : ''}>
                </div>
                <div class="form-group">
                  <label class="form-label">Invoice Date <span class="required">*</span></label>
                  <input type="date" class="form-control" name="invoiceDate" required
                    value="${isEdit ? Utils.formatDateForInput(invoice.invoiceDate) : Utils.today()}">
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-control" name="dueDate"
                    value="${isEdit && invoice.dueDate ? Utils.formatDateForInput(invoice.dueDate) : ''}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Customer <span class="required">*</span></label>
                  <select class="form-control" name="customerId" required id="customer-select">
                    <option value="">Select a customer</option>
                    ${customers.map(c => `
                      <option value="${c.id}" ${isEdit && invoice.customerId === c.id ? 'selected' : ''}>
                        ${Utils.escapeHtml(c.name)}${c.phone ? ' — ' + c.phone : ''}
                      </option>
                    `).join('')}
                  </select>
                  <span class="form-hint">
                    Don't see your customer? 
                    <a href="#" onclick="Customers.openModal(); return false;" style="color: var(--accent-light);">Add new</a>
                  </span>
                </div>
                <div class="form-group">
                  <label class="form-label">Payment Status</label>
                  <select class="form-control" name="status">
                    <option value="unpaid" ${isEdit && invoice.status === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="paid" ${isEdit && invoice.status === 'paid' ? 'selected' : ''}>Paid</option>
                    <option value="partial" ${isEdit && invoice.status === 'partial' ? 'selected' : ''}>Partial</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Line Items -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <h3 class="card-title">Line Items</h3>
            </div>
            <div class="card-body" style="padding: 16px; overflow-x: auto;">
              <table class="line-items-table" id="line-items-table">
                <thead>
                  <tr>
                    <th style="min-width: 200px;">Item</th>
                    <th style="width: 80px;">Qty</th>
                    <th style="width: 120px;">Rate (₹)</th>
                    <th style="width: 100px;">Discount</th>
                    <th style="width: 90px;">GST %</th>
                    <th style="width: 120px; text-align: right;">Amount</th>
                    <th style="width: 50px;"></th>
                  </tr>
                </thead>
                <tbody id="line-items-body">
                  ${this.currentItems.map((item, i) => this.renderLineItem(item, i, products)).join('')}
                </tbody>
              </table>
              <button type="button" class="btn btn-secondary btn-sm add-line-item" onclick="Invoices.addLineItem()">
                <i data-lucide="plus"></i> Add Item
              </button>

              <!-- Totals -->
              <div class="invoice-summary" id="invoice-summary">
                ${this.renderSummary()}
              </div>
            </div>
          </div>

          <!-- Notes & Terms -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <h3 class="card-title">Additional Details</h3>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" name="notes" rows="3"
                    placeholder="Any notes for the customer...">${isEdit ? Utils.escapeHtml(invoice.notes || '') : ''}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Terms & Conditions</label>
                  <textarea class="form-control" name="terms" rows="3"
                    placeholder="Payment terms, return policy, etc.">${isEdit ? Utils.escapeHtml(invoice.terms || '') : (settings.defaultTerms || 'Payment is due within 30 days of invoice date.')}</textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" onclick="App.navigate('invoices')">
              <i data-lucide="x"></i> Cancel
            </button>
            <button type="button" class="btn btn-secondary" onclick="Invoices.previewInvoice()">
              <i data-lucide="eye"></i> Preview
            </button>
            <button type="submit" class="btn btn-primary btn-lg">
              <i data-lucide="save"></i> ${isEdit ? 'Update Invoice' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  emptyItem() {
    return {
      name: '',
      quantity: 1,
      rate: 0,
      discount: 0,
      discountType: 'percent',
      gstRate: 18,
      amount: 0
    };
  },

  renderLineItem(item, index, products) {
    const productOptions = (products || Storage.getAll('products'));
    return `
      <tr data-index="${index}">
        <td>
          <select class="form-control" onchange="Invoices.onProductSelect(${index}, this.value)" style="margin-bottom: 4px;">
            <option value="">Type or select product</option>
            ${productOptions.map(p => `
              <option value="${p.id}" ${item.productId === p.id ? 'selected' : ''}>
                ${Utils.escapeHtml(p.name)} — ${Utils.formatCurrency(p.price)}
              </option>
            `).join('')}
          </select>
          <input type="text" class="form-control" placeholder="Item description"
            value="${Utils.escapeHtml(item.name || '')}"
            onchange="Invoices.updateItem(${index}, 'name', this.value)">
        </td>
        <td>
          <input type="number" class="form-control" min="0" step="any" value="${item.quantity || 1}"
            onchange="Invoices.updateItem(${index}, 'quantity', this.value)">
        </td>
        <td>
          <input type="number" class="form-control" min="0" step="0.01" value="${item.rate || 0}"
            onchange="Invoices.updateItem(${index}, 'rate', this.value)">
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <input type="number" class="form-control" min="0" step="0.01" value="${item.discount || 0}"
              style="width: 60px;" onchange="Invoices.updateItem(${index}, 'discount', this.value)">
            <select class="form-control" style="width: 50px; padding: 6px 4px; font-size: 12px;"
              onchange="Invoices.updateItem(${index}, 'discountType', this.value)">
              <option value="percent" ${item.discountType === 'percent' ? 'selected' : ''}>%</option>
              <option value="flat" ${item.discountType === 'flat' ? 'selected' : ''}>₹</option>
            </select>
          </div>
        </td>
        <td>
          <select class="form-control" onchange="Invoices.updateItem(${index}, 'gstRate', this.value)">
            ${[0, 5, 12, 18, 28].map(r =>
              `<option value="${r}" ${parseInt(item.gstRate) === r ? 'selected' : ''}>${r}%</option>`
            ).join('')}
          </select>
        </td>
        <td class="item-total">${Utils.formatCurrency(item.amount || 0)}</td>
        <td>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="Invoices.removeItem(${index})"
            style="color: var(--danger);" title="Remove">
            <i data-lucide="x"></i>
          </button>
        </td>
      </tr>
    `;
  },

  onProductSelect(index, productId) {
    if (!productId) return;
    const product = Storage.getById('products', productId);
    if (product) {
      this.currentItems[index] = {
        ...this.currentItems[index],
        productId: product.id,
        name: product.name,
        rate: product.price,
        gstRate: product.gstRate || 18,
        hsn: product.hsn || ''
      };
      this.recalculate();
      this.refreshItems();
    }
  },

  updateItem(index, field, value) {
    if (['quantity', 'rate', 'discount', 'gstRate'].includes(field)) {
      value = parseFloat(value) || 0;
    }
    this.currentItems[index][field] = value;
    this.recalculate();
    this.refreshSummary();

    // Update the amount cell for this row
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
      const totalCell = row.querySelector('.item-total');
      if (totalCell) totalCell.textContent = Utils.formatCurrency(this.currentItems[index].amount);
    }
  },

  addLineItem() {
    this.currentItems.push(this.emptyItem());
    this.refreshItems();
  },

  removeItem(index) {
    if (this.currentItems.length <= 1) {
      Utils.toast('Invoice must have at least one item', 'warning');
      return;
    }
    this.currentItems.splice(index, 1);
    this.recalculate();
    this.refreshItems();
  },

  recalculate() {
    this.currentItems.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const subtotal = qty * rate;

      let discountAmount = 0;
      if (item.discountType === 'percent') {
        discountAmount = subtotal * (parseFloat(item.discount) || 0) / 100;
      } else {
        discountAmount = parseFloat(item.discount) || 0;
      }

      const afterDiscount = subtotal - discountAmount;
      const gstAmount = afterDiscount * (parseFloat(item.gstRate) || 0) / 100;
      item.amount = afterDiscount + gstAmount;
      item.taxableAmount = afterDiscount;
      item.gstAmount = gstAmount;
      item.discountAmount = discountAmount;
    });
  },

  refreshItems() {
    const products = Storage.getAll('products');
    const tbody = document.getElementById('line-items-body');
    if (tbody) {
      tbody.innerHTML = this.currentItems.map((item, i) => this.renderLineItem(item, i, products)).join('');
    }
    this.refreshSummary();
    if (window.lucide) lucide.createIcons();
  },

  refreshSummary() {
    const summaryDiv = document.getElementById('invoice-summary');
    if (summaryDiv) {
      summaryDiv.innerHTML = this.renderSummary();
    }
  },

  renderSummary() {
    this.recalculate();
    const subtotal = this.currentItems.reduce((sum, item) => {
      return sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0));
    }, 0);

    const totalDiscount = this.currentItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const totalTaxable = this.currentItems.reduce((sum, item) => sum + (item.taxableAmount || 0), 0);
    const totalGst = this.currentItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const grandTotal = this.currentItems.reduce((sum, item) => sum + (item.amount || 0), 0);

    return `
      <div class="invoice-summary-table">
        <div class="invoice-summary-row">
          <span>Subtotal</span>
          <span>${Utils.formatCurrency(subtotal)}</span>
        </div>
        ${totalDiscount > 0 ? `
          <div class="invoice-summary-row" style="color: var(--success);">
            <span>Discount</span>
            <span>-${Utils.formatCurrency(totalDiscount)}</span>
          </div>
        ` : ''}
        <div class="invoice-summary-row">
          <span>Taxable Amount</span>
          <span>${Utils.formatCurrency(totalTaxable)}</span>
        </div>
        <div class="invoice-summary-row">
          <span>GST</span>
          <span>${Utils.formatCurrency(totalGst)}</span>
        </div>
        <div class="invoice-summary-row grand-total">
          <span>Grand Total</span>
          <span>${Utils.formatCurrency(grandTotal)}</span>
        </div>
      </div>
    `;
  },

  getInvoiceTotals() {
    this.recalculate();
    const subtotal = this.currentItems.reduce((sum, item) =>
      sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)), 0);
    const totalDiscount = this.currentItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const totalTaxable = this.currentItems.reduce((sum, item) => sum + (item.taxableAmount || 0), 0);
    const totalGst = this.currentItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const grandTotal = this.currentItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    return { subtotal, totalDiscount, totalTaxable, totalGst, grandTotal };
  },

  async saveInvoice(e) {
    e.preventDefault();
    const form = e.target;

    const customerId = form.customerId.value;
    if (!customerId) {
      Utils.toast('Please select a customer', 'error');
      return;
    }

    // Validate items
    const validItems = this.currentItems.filter(item => item.name && item.rate > 0);
    if (validItems.length === 0) {
      Utils.toast('Please add at least one valid line item', 'error');
      return;
    }

    this.recalculate();
    const totals = this.getInvoiceTotals();

    const invoiceData = {
      invoiceNumber: form.invoiceNumber.value.trim(),
      invoiceDate: form.invoiceDate.value,
      dueDate: form.dueDate.value || null,
      customerId: customerId,
      status: form.status.value,
      items: this.currentItems,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTaxable: totals.totalTaxable,
      totalGst: totals.totalGst,
      grandTotal: totals.grandTotal,
      notes: form.notes.value.trim(),
      terms: form.terms.value.trim()
    };

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      if (Cloud.user) await Cloud.saveInvoice(invoiceData, this.editingId);
      else if (this.editingId) Storage.update('invoices', this.editingId, invoiceData);
      else Storage.add('invoices', invoiceData);
      Utils.toast(`Invoice ${this.editingId ? 'updated' : 'created'} successfully!`, 'success');
    } catch (error) {
      console.error('Invoice save error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
      return;
    } finally {
      if (button) button.disabled = false;
    }

    this.currentItems = [];
    this.editingId = null;
    App.navigate('invoices');
  },

  previewInvoice() {
    const form = document.getElementById('invoice-form');
    if (!form) return;

    const customerId = form.customerId.value;
    const customer = customerId ? Storage.getById('customers', customerId) : null;
    const settings = Storage.get('settings') || {};

    this.recalculate();
    const totals = this.getInvoiceTotals();

    const invoiceData = {
      invoiceNumber: form.invoiceNumber.value,
      invoiceDate: form.invoiceDate.value,
      dueDate: form.dueDate.value,
      status: form.status.value,
      items: this.currentItems.filter(item => item.name),
      notes: form.notes.value,
      terms: form.terms.value,
      ...totals
    };

    ExportModule.showPreview(invoiceData, customer, settings);
  }
};
