/* ============================================
   EASYBILL — Stock Overview Module
   ============================================ */

const Stocks = {
  searchQuery: '',
  filter: 'all',

  render() {
    const products = Storage.getAll('products');
    const matchingProducts = products.filter(product => {
      const query = this.searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        (product.name || '').toLowerCase().includes(query) ||
        (product.hsn || '').toLowerCase().includes(query);
      const stock = this.getStock(product);
      const threshold = this.getThreshold(product);
      const matchesFilter = this.filter === 'all' ||
        (this.filter === 'low' && stock > 0 && stock <= threshold) ||
        (this.filter === 'out' && stock <= 0);
      return matchesSearch && matchesFilter;
    }).sort((a, b) => this.getStock(a) - this.getStock(b));
    const lowStockCount = products.filter(product => {
      const stock = this.getStock(product);
      return stock > 0 && stock <= this.getThreshold(product);
    }).length;
    const outOfStockCount = products.filter(product => this.getStock(product) <= 0).length;
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
        </div>

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
          </select>
          <button class="btn btn-primary" type="button" onclick="App.navigate('products')">
            <i data-lucide="package-plus"></i> Add Product
          </button>
        </div>

        ${matchingProducts.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Product</th><th>SKU / HSN</th><th>Available</th><th>Alert At</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                ${matchingProducts.map(product => {
                  const stock = this.getStock(product);
                  const threshold = this.getThreshold(product);
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= threshold;
                  const status = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock';
                  const badge = isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success';
                  return `
                    <tr>
                      <td><strong style="color: var(--text-primary);">${Utils.escapeHtml(product.name)}</strong></td>
                      <td><code style="font-size: 12px; color: var(--text-muted);">${Utils.escapeHtml(product.hsn || '-')}</code></td>
                      <td><strong style="color: var(--text-primary);">${this.formatQuantity(stock)}</strong> ${Utils.escapeHtml(product.unit || 'Pcs')}</td>
                      <td>${this.formatQuantity(threshold)} ${Utils.escapeHtml(product.unit || 'Pcs')}</td>
                      <td><span class="badge ${badge}">${status}</span></td>
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
              <p>${products.length ? 'Try a different search or stock filter.' : 'Add a product to start tracking stock.'}</p>
              ${!products.length ? '<button class="btn btn-primary" type="button" onclick="App.navigate(\'products\')"><i data-lucide="package-plus"></i> Add Product</button>' : ''}
            </div>
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
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