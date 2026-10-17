/* ============================================
   EASYBILL — Customer Management Module
   Primary Focus: Mobile Number (Mandatory)
   ============================================ */

const Customers = {
  searchQuery: '',

  render() {
    const customers = this.getFilteredCustomers();
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="animate-fade-in">
        <!-- Toolbar -->
        <div class="filters-bar">
          <div class="search-bar" style="flex: 1; max-width: 400px;">
            <i data-lucide="search"></i>
            <input type="text" id="customer-search" placeholder="Search by mobile no. or name..." 
              value="${Utils.escapeHtml(this.searchQuery)}" oninput="Customers.onSearch(this.value)">
          </div>
          <button class="btn btn-primary" onclick="Customers.openModal()">
            <i data-lucide="user-plus"></i> Add Customer (by Mobile)
          </button>
        </div>

        <!-- Customers Table -->
        ${customers.length > 0 ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mobile Number</th>
                  <th>Customer Name</th>
                  <th>Email</th>
                  <th>GSTIN</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${customers.map(c => `
                  <tr>
                    <td>
                      <strong style="color: var(--accent); font-size: 15px;"><i data-lucide="phone" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> ${Utils.escapeHtml(c.phone)}</strong>
                    </td>
                    <td>
                      <strong style="color: var(--text-primary);">${Utils.escapeHtml(c.name || 'Customer')}</strong>
                      ${c.address ? `<br><small style="color: var(--text-muted);">${Utils.escapeHtml(c.address)}</small>` : ''}
                    </td>
                    <td>${Utils.escapeHtml(c.email || '-')}</td>
                    <td><code style="font-size: 12px; color: var(--text-muted);">${Utils.escapeHtml(c.gstin || '-')}</code></td>
                    <td>${Utils.formatDate(c.createdAt)}</td>
                    <td>
                      <div class="table-actions">
                        ${(!Cloud.user || ['owner','manager'].includes(Cloud.role)) ? `<button class="btn btn-secondary btn-sm" onclick="Customers.openModal('${c.id}')" title="Edit Customer Details"><i data-lucide="pencil"></i> <span>Edit</span></button><button class="btn btn-ghost btn-sm" onclick="Customers.deleteCustomer('${c.id}')" title="Delete" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>` : '<span class="text-muted">View only</span>'}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card">
            <div class="empty-state">
              <i data-lucide="users"></i>
              <h3>No Customers Found</h3>
              <p>${this.searchQuery ? 'No customers match your search' : 'Add your first customer by mobile number'}</p>
              ${!this.searchQuery ? `
                <button class="btn btn-primary" onclick="Customers.openModal()">
                  <i data-lucide="user-plus"></i> Add Customer
                </button>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    `;

    Icons.renderAll();
  },

  getFilteredCustomers() {
    let customers = Storage.getAll('customers');
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      customers = customers.filter(c =>
        (c.phone && c.phone.includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    }
    return customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  onSearch: Utils.debounce(function (val) {
    Customers.searchQuery = val;
    Customers.render();
  }, 250),

  openModal(id = null, defaultPhone = '') {
    if (id && Cloud.user && !['owner','manager'].includes(Cloud.role)) { Utils.toast('Cashiers can add customers but cannot edit existing records.','error'); return; }
    const customer = id ? Storage.getById('customers', id) : null;
    const isEdit = !!customer;

    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Edit Customer' : 'Add New Customer'}</h3>
          <button class="modal-close" onclick="Customers.closeModal()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="customer-form" onsubmit="Customers.saveCustomer(event, '${id || ''}')">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Mobile Number <span class="required">* (Mandatory)</span></label>
                <input type="tel" class="form-control" name="phone" required
                  placeholder="e.g. 9876543210" value="${isEdit ? Utils.escapeHtml(customer.phone || '') : Utils.escapeHtml(defaultPhone)}">
                <span class="form-hint">Used as primary unique key to identify customers.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Customer Name <span class="pos-optional">(Optional)</span></label>
                <input type="text" class="form-control" name="name"
                  placeholder="e.g. Rajesh Kumar" value="${isEdit ? Utils.escapeHtml(customer.name || '') : ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" name="email"
                  placeholder="e.g. customer@email.com" value="${isEdit ? Utils.escapeHtml(customer.email || '') : ''}">
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" class="form-control" name="gstin"
                  placeholder="e.g. 29ABCDE1234F1Z5" value="${isEdit ? Utils.escapeHtml(customer.gstin || '') : ''}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <textarea class="form-control" name="address" rows="2"
                placeholder="Full address">${isEdit ? Utils.escapeHtml(customer.address || '') : ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Customers.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="document.getElementById('customer-form').requestSubmit()">
            <i data-lucide="check"></i> ${isEdit ? 'Update' : 'Save'} Customer
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

  async saveCustomer(e, id) {
    e.preventDefault();
    if (id && Cloud.user && !['owner','manager'].includes(Cloud.role)) { Utils.toast('Cashiers cannot edit existing customer records.','error'); return; }
    const form = e.target;
    const phone = form.phone.value.trim();
    const name = form.name.value.trim() || 'Customer';
    const email = form.email.value.trim();
    const gstin = form.gstin.value.trim();
    const address = form.address.value.trim();

    if (!phone) {
      Utils.toast('Mobile number is mandatory', 'error');
      return;
    }

    // Check duplicate phone number
    const existing = Storage.getAll('customers').find(c => c.phone === phone && c.id !== id);
    if (existing) {
      Utils.toast(`A customer with mobile number ${phone} already exists (${existing.name || 'Customer'})`, 'warning');
      return;
    }

    const data = { name, phone, email, gstin, address };

    const button = document.querySelector('#modal-overlay .modal-footer .btn-primary');
    if (button) button.disabled = true;
    try {
      if (Cloud.user) {
        await Cloud.saveCustomer(data, id || null);
      } else if (id) {
        Storage.update('customers', id, data);
      } else {
        Storage.add('customers', data);
      }
      Utils.toast(`Customer ${id ? 'updated' : 'added'} successfully`, 'success');
    } catch (error) {
      console.error('Customer save error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
      return;
    } finally {
      if (button) button.disabled = false;
    }

    this.closeModal();
    this.render();
  },

  async deleteCustomer(id) {
    if (Cloud.user && !['owner','manager'].includes(Cloud.role)) { Utils.toast('Cashiers cannot delete customers.','error'); return; }
    const customer = Storage.getById('customers', id);
    const label = customer ? `${customer.phone} (${customer.name || 'Customer'})` : 'this customer';
    const confirmed = await Utils.confirm(
      'Delete Customer',
      `Are you sure you want to delete "${label}"? This action cannot be undone.`
    );
    if (confirmed) {
      try {
        if (Cloud.user) await Cloud.deleteCustomer(id);
        else Storage.delete('customers', id);
        Utils.toast('Customer deleted', 'success');
        this.render();
      } catch (error) {
        console.error('Customer delete error:', error);
        Utils.toast(Cloud.friendlyError(error), 'error');
      }
    }
  }
};
