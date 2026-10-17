/* ============================================
   EASYBILL — Stock Overview Module
   ============================================ */

const Stocks = {
  searchQuery: '',
  filter: 'all',

  render() {
    const products = Storage.getAll('products');
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntilExpiry = product => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(product.expiryDate || '')) return null;
      const [year, month, day] = product.expiryDate.split('-').map(Number);
      const expiryUtc = Date.UTC(year, month - 1, day);
      const expiryDate = new Date(expiryUtc);
      if (expiryDate.getUTCFullYear() !== year || expiryDate.getUTCMonth() !== month - 1 || expiryDate.getUTCDate() !== day) {
        return null;
      }
      return Math.round((expiryUtc - todayUtc) / 86400000);
    };
    const isExpired = product => {
      const days = daysUntilExpiry(product);
      return days !== null && days <= 0;
    };
    const isExpiringSoon = product => {
      const days = daysUntilExpiry(product);
      return days !== null && days > 0 && days <= 2;
    };
    const matchingProducts = products.filter(product => {
      const query = this.searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        (product.name || '').toLowerCase().includes(query) ||
        (product.hsn || '').toLowerCase().includes(query);
      const stock = this.getStock(product);
      const threshold = this.getThreshold(product);
      const matchesFilter = this.filter === 'all' ||
        (this.filter === 'low' && stock > 0 && stock <= threshold) ||
        (this.filter === 'out' && stock <= 0) ||
        (this.filter === 'expired' && isExpired(product)) ||
        (this.filter === 'expiring' && isExpiringSoon(product));
      return matchesSearch && matchesFilter;
    }).sort((a, b) => this.getStock(a) - this.getStock(b));
    const lowStockCount = products.filter(product => {
      const stock = this.getStock(product);
      return stock > 0 && stock <= this.getThreshold(product);
    }).length;
    const outOfStockCount = products.filter(product => this.getStock(product) <= 0).length;
    const expiredProducts = products.filter(isExpired);
    const expiringSoonProducts = products.filter(isExpiringSoon);
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="animate-fade-in">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Products tracked</span>
              <span class="stat-card-icon teal"><i data-lucide="package"></i></span>
            </div>
            <div class="stat-card-value">${products.length}</div>
            <div class="stat-card-sub">Products and services in your catalog</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Low stock</span>
              <span class="stat-card-icon orange"><i data-lucide="alert-triangle"></i></span>
            </div>
            <div class="stat-card-value">${lowStockCount}</div>
            <div class="stat-card-sub">At or below their alert level</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Out of stock</span>
              <span class="stat-card-icon red"><i data-lucide="x-circle"></i></span>
            </div>
            <div class="stat-card-value">${outOfStockCount}</div>
            <div class="stat-card-sub">Products with no units available</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Expired products</span>
              <span class="stat-card-icon red"><i data-lucide="calendar-x"></i></span>
            </div>
            <div class="stat-card-value">${expiredProducts.length}</div>
            <div class="stat-card-sub">Expiry date reached or passed</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Expiring soon</span>
              <span class="stat-card-icon orange"><i data-lucide="calendar-clock"></i></span>
            </div>
            <div class="stat-card-value">${expiringSoonProducts.length}</div>
            <div class="stat-card-sub">Expiry within the next 2 days</div>
          </div>
        </div>

        ${expiringSoonProducts.length ? `
          <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--warning);">
            <div class="card-header" style="border: none; padding-bottom: 8px;">
              <h3 class="card-title" style="color: var(--warning); display: flex; align-items: center; gap: 8px;">
                <i data-lucide="calendar-clock"></i> Products expiring soon
              </h3>
              <span class="badge badge-warning">${expiringSoonProducts.length} expiring within 2 days</span>
            </div>
            <div class="card-body" style="padding-top: 0; color: var(--text-secondary);">
              ${expiringSoonProducts.map(product => {
                const days = daysUntilExpiry(product);
                return `<strong>${Utils.escapeHtml(product.name)}</strong> (expires ${days === 1 ? 'tomorrow' : 'in 2 days'} — ${Utils.formatDate(product.expiryDate)})`;
              }).join(' · ')}
            </div>
          </div>
        ` : ''}

        ${expiredProducts.length ? `
          <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--danger);">
            <div class="card-header" style="border: none; padding-bottom: 8px;">
              <h3 class="card-title" style="color: var(--danger); display: flex; align-items: center; gap: 8px;">
                <i data-lucide="triangle-alert"></i> Expired product alert
              </h3>
              <span class="badge badge-danger">${expiredProducts.length} expired</span>
            </div>
            <div class="card-body" style="padding-top: 0; color: var(--text-secondary);">
              ${expiredProducts.map(product => `<strong>${Utils.escapeHtml(product.name)}</strong> (expired ${Utils.formatDate(product.expiryDate)})`).join(' · ')}
            </div>
          </div>
        ` : ''}

        <div class="filters-bar">
          <div class="search-bar" style="flex: 1; max-width: 400px;">
            <i data-lucide="search"></i>
            <input type="search" placeholder="Search products..." value="${Utils.escapeHtml(this.searchQuery)}"
              oninput="Stocks.onSearch(this.value)">
          </div>
          <select class="form-control" style="width: auto; min-width: 160px;" aria-label="Filter stock status"
            onchange="Stocks.onFilter(this.value)">
            <option value="all" ${this.filter === 'all' ? 'selected' : ''}>All stock levels</option>
            <option value="low" ${this.filter === 'low' ? 'selected' : ''}>Low stock</option>
            <option value="out" ${this.filter === 'out' ? 'selected' : ''}>Out of stock</option>
            <option value="expiring" ${this.filter === 'expiring' ? 'selected' : ''}>Expiring within 2 days</option>
            <option value="expired" ${this.filter === 'expired' ? 'selected' : ''}>Expired products</option>
          </select>
        </div>

        ${matchingProducts.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Product</th><th>SKU / HSN</th><th>Available</th><th>Alert At</th><th>Manufactured</th><th>Expires</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                ${matchingProducts.map(product => {
                  const stock = this.getStock(product);
                  const threshold = this.getThreshold(product);
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= threshold;
                  const status = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock';
                  const badge = isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success';
                  const expired = isExpired(product);
                  const expiringSoon = isExpiringSoon(product);
                  const daysToExpiry = daysUntilExpiry(product);
                  return `
                    <tr>
                      <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(product.name)}</strong></td>
                      <td><code style="font-size: 12px; color: var(--text-muted);">${Utils.escapeHtml(product.hsn || '-')}</code></td>
                      <td><strong style="color: var(--text-primary);">${this.formatQuantity(stock)}</strong> ${Utils.escapeHtml(product.unit || 'Pcs')}</td>
                      <td>${this.formatQuantity(threshold)} ${Utils.escapeHtml(product.unit || 'Pcs')}</td>
                      <td>${product.manufacturingDate ? Utils.formatDate(product.manufacturingDate) : '-'}</td>
                      <td>${product.expiryDate ? Utils.formatDate(product.expiryDate) : '-'}</td>
                      <td><span class="badge ${badge}">${status}</span>${expired ? ' <span class="badge badge-danger">Expired</span>' : expiringSoon ? ` <span class="badge badge-warning">Expires in ${daysToExpiry} ${daysToExpiry === 1 ? 'day' : 'days'}</span>` : ''}</td>
                      <td><button class="btn btn-ghost btn-sm" type="button" onclick="Products.openModal('${product.id}')" title="Edit stock" aria-label="Edit stock for ${Utils.escapeHtml(product.name)}"><i data-lucide="pencil"></i></button></td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card">
            <div class="empty-state">
              <i data-lucide="package"></i>
              <h3>${products.length ? 'No matching products' : 'No products to track'}</h3>
              <p>${products.length ? 'Try a different search or stock filter.' : 'Products added in Products & Services will appear here.'}</p>
            </div>
          </div>
        `}
      </div>
    `;

    Icons.renderAll();
  },

  getStock(product) {
    const stock = Number(product.stock ?? 0);
    return Number.isFinite(stock) ? Math.max(0, stock) : 0;
  },

  getThreshold(product) {
    const threshold = Number(product.lowStockThreshold ?? 5);
    return Number.isFinite(threshold) ? Math.max(0, threshold) : 5;
  },

  formatQuantity(quantity) {
    return quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
  },

  onSearch(value) {
    this.searchQuery = value;
    this.render();
  },

  onFilter(value) {
    this.filter = value;
    this.render();
  }
};