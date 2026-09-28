/* ============================================
   EASYBILL — Product/Service Catalog Module
   ============================================ */

const Products = {
  searchQuery: '',
  pendingImage: '',
  imageRequest: 0,

  render() {
    const products = this.getFilteredProducts();
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="animate-fade-in">
        <!-- Toolbar -->
        <div class="filters-bar">
          <div class="search-bar" style="flex: 1; max-width: 400px;">
            <i data-lucide="search"></i>
            <input type="text" id="product-search" placeholder="Search products or services..." 
              value="${Utils.escapeHtml(this.searchQuery)}" oninput="Products.onSearch(this.value)">
          </div>
          <button class="btn btn-primary" onclick="Products.openModal()">
            <i data-lucide="package-plus"></i> Add Product
          </button>
        </div>

        <!-- Products Table -->
        ${products.length > 0 ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Product / Service</th>
                  <th>HSN/SAC</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>GST %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(p => `
                  <tr>
                    <td>
                      ${p.barcode ? `<small style="color: var(--text-muted);">Barcode: ${Utils.escapeHtml(p.barcode)}</small><br>` : ''}
                      <strong style="color: var(--text-primary);">${Utils.escapeHtml(p.name)}</strong>
                      ${p.description ? `<br><small style="color: var(--text-muted);">${Utils.escapeHtml(p.description)}</small>` : ''}
                    </td>
                    <td><code style="font-size: 12px; color: var(--text-muted);">${Utils.escapeHtml(p.hsn || '-')}</code></td>
                    <td>${Utils.escapeHtml(p.unit || 'Pcs')}</td>
                    <td><strong style="color: var(--text-primary);">${Utils.formatCurrency(p.price)}</strong></td>
                    <td><span class="badge badge-info">${p.gstRate || 0}%</span></td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-ghost btn-sm" onclick="Products.openModal('${p.id}')" title="Edit">
                          <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="Products.deleteProduct('${p.id}')" title="Delete" style="color: var(--danger);">
                          <i data-lucide="trash-2"></i>
                        </button>
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
              <i data-lucide="package"></i>
              <h3>No Products Found</h3>
              <p>${this.searchQuery ? 'No products match your search' : 'Add your products or services to the catalog'}</p>
              ${!this.searchQuery ? `
                <button class="btn btn-primary product-empty-add" onclick="Products.openModal()">
                  <i data-lucide="package-plus"></i><span>Add Product</span>
                </button>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  getFilteredProducts() {
    let products = Storage.getAll('products');
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      products = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.hsn && p.hsn.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  onSearch: Utils.debounce(function (val) {
    Products.searchQuery = val;
    Products.render();
  }, 250),

  openModal(id = null) {
    const product = id ? Storage.getById('products', id) : null;
    const isEdit = !!product;
    this.pendingImage = product ? product.image || '' : '';
    this.imageRequest++;

    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button class="modal-close" onclick="Products.closeModal()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="product-form" onsubmit="Products.saveProduct(event, '${id || ''}')">
            <div class="form-group">
              <label class="form-label">Product / Service Name <span class="required">*</span></label>
              <input type="text" class="form-control" name="name" required
                placeholder="e.g. Web Development Service" value="${isEdit ? Utils.escapeHtml(product.name) : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input type="text" class="form-control" name="description"
                placeholder="Short description" value="${isEdit ? Utils.escapeHtml(product.description || '') : ''}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Product Image</label>
                <div class="product-image-upload">
                  <div class="product-image-preview" id="product-image-preview">
                    ${this.pendingImage ? `<img src="${Utils.escapeHtml(Cloud.productImageUrl(this.pendingImage))}" alt="Product preview">` : '<i data-lucide="image"></i><span>No image selected</span>'}
                  </div>
                  <div class="product-image-controls">
                    <input type="file" class="form-control" accept="image/*" onchange="Products.previewImage(this)">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="Products.removeImage()">Remove image</button>
                    <span class="form-hint">Images are resized before saving to local storage.</span>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Barcode</label>
                <input type="text" class="form-control" name="barcode" inputmode="numeric" autocomplete="off"
                  placeholder="Scan or enter barcode" value="${isEdit ? Utils.escapeHtml(product.barcode || '') : ''}">
                <span class="form-hint">Use a USB barcode scanner or type the code.</span>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">HSN / SAC Code</label>
                <input type="text" class="form-control" name="hsn"
                  placeholder="e.g. 998311" value="${isEdit ? Utils.escapeHtml(product.hsn || '') : ''}">
                <span class="form-hint">HSN for goods, SAC for services</span>
              </div>
              <div class="form-group">
                <label class="form-label">Unit</label>
                <select class="form-control" name="unit">
                  ${['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Hrs', 'Days', 'Nos', 'Pair'].map(u =>
                    `<option value="${u}" ${isEdit && product.unit === u ? 'selected' : ''}>${u}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Unit Price (₹) <span class="required">*</span></label>
                <input type="number" class="form-control" name="price" required min="0" step="0.01"
                  placeholder="0.00" value="${isEdit ? product.price : ''}">
              </div>
              <div class="form-group">
                <label class="form-label">GST Rate (%)</label>
                <select class="form-control" name="gstRate">
                  ${[0, 5, 12, 18, 28].map(r =>
                    `<option value="${r}" ${isEdit && parseInt(product.gstRate) === r ? 'selected' : ''}>${r}%</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Current Stock</label>
                <input type="number" class="form-control" name="stock" min="0" step="any" required
                  value="${isEdit ? (product.stock ?? 0) : 0}">
              </div>
              <div class="form-group">
                <label class="form-label">Low Stock Alert At</label>
                <input type="number" class="form-control" name="lowStockThreshold" min="0" step="any" required
                  value="${isEdit ? (product.lowStockThreshold ?? 5) : 5}">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Products.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="document.getElementById('product-form').requestSubmit()">
            <i data-lucide="check"></i> ${isEdit ? 'Update' : 'Save'} Product
          </button>
        </div>
      </div>
    `;

    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  async previewImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Utils.toast('Choose a valid image file', 'error');
      input.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      Utils.toast('Choose an image smaller than 8 MB', 'warning');
      input.value = '';
      return;
    }

    const request = ++this.imageRequest;
    try {
      const imageData = await this.compressImage(file);
      if (request !== this.imageRequest) return;
      this.pendingImage = imageData;
      this.updateImagePreview();
    } catch (error) {
      Utils.toast('Could not read that image', 'error');
    }
  },

  compressImage(file) {
    return new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(imageUrl);
        const scale = Math.min(1, 640 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Canvas unavailable'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Image could not be loaded'));
      };
      image.src = imageUrl;
    });
  },

  updateImagePreview() {
    const preview = document.getElementById('product-image-preview');
    if (!preview) return;
    preview.innerHTML = this.pendingImage
      ? `<img src="${Utils.escapeHtml(Cloud.productImageUrl(this.pendingImage))}" alt="Product preview">`
      : '<i data-lucide="image"></i><span>No image selected</span>';
    if (window.lucide) lucide.createIcons();
  },

  removeImage() {
    this.pendingImage = '';
    this.imageRequest++;
    this.updateImagePreview();
    const input = document.querySelector('#product-form input[type="file"]');
    if (input) input.value = '';
  },

  async saveProduct(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      barcode: form.barcode.value.trim(),
      hsn: form.hsn.value.trim(),
      unit: form.unit.value,
      price: parseFloat(form.price.value) || 0,
      gstRate: parseInt(form.gstRate.value) || 0,
      stock: parseFloat(form.stock.value) || 0,
      lowStockThreshold: parseFloat(form.lowStockThreshold.value) || 0
    };

    const productId = id || Utils.generateId();
    const existingProduct = id ? Storage.getById('products', id) : null;
    data.trackStock = Boolean(existingProduct?.trackStock || data.stock > 0);
    data.image = this.pendingImage;

    if (!data.name) {
      Utils.toast('Product name is required', 'error');
      return;
    }

    const duplicateBarcode = data.barcode && Storage.getAll('products').some(product =>
      product.barcode === data.barcode && product.id !== id);
    if (duplicateBarcode) {
      Utils.toast('That barcode is already assigned to another product', 'error');
      return;
    }

    let savedProduct;
    const saveButton = document.querySelector('#modal-overlay .modal-footer .btn-primary');
    if (saveButton) saveButton.disabled = true;
    try {
      if (Cloud.user) savedProduct = await Cloud.saveProduct(data, id || null);
      else if (id) savedProduct = Storage.update('products', id, data);
      else savedProduct = Storage.add('products', data);
    } catch (error) {
      console.error('Product save error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
      if (saveButton) saveButton.disabled = false;
      return;
    }

    if (!savedProduct) {
      Utils.toast('Could not save product. Storage may be full.', 'error');
      if (saveButton) saveButton.disabled = false;
      return;
    }

    Utils.toast(`Product ${id ? 'updated' : 'added'} successfully`, 'success');

    this.closeModal();
    if (App.currentView === 'stocks') {
      Stocks.render();
    } else {
      this.render();
    }
  },

  async deleteProduct(id) {
    const product = Storage.getById('products', id);
    const confirmed = await Utils.confirm(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      try {
        if (Cloud.user) await Cloud.deleteProduct(id);
        else Storage.delete('products', id);
        Utils.toast('Product deleted', 'success');
        this.render();
      } catch (error) {
        console.error('Product delete error:', error);
        Utils.toast(Cloud.friendlyError(error), 'error');
      }
    }
  }
};
