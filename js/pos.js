/* ============================================
   EASYBILL — Point of Sale Module
   ============================================ */

const POS = {
  cart: [],
  searchQuery: '',
  customerId: '',
  paymentMethod: 'Cash',
  scannerStream: null,
  scannerFrame: null,
  scannerDetector: null,

  render() {
    const products = this.getFilteredProducts();
    const customers = Storage.getAll('customers').sort((a, b) => a.name.localeCompare(b.name));
    const content = document.getElementById('page-content');
    const now = new Date();

    content.innerHTML = `
      <div class="pos-workspace animate-fade-in">
        <section class="pos-catalog-panel" aria-label="Product catalog">
          <div class="pos-toolbar">
            <div>
              <div class="pos-eyebrow">Sales terminal</div>
              <h2>Product catalog</h2>
              <p>${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <button class="btn btn-secondary" type="button" onclick="App.navigate('products')">
              <i data-lucide="package-plus"></i> Manage products
            </button>
          </div>

          <form class="pos-scanbar" onsubmit="POS.handleBarcode(event)">
            <i data-lucide="scan-barcode"></i>
            <input id="pos-barcode-input" class="form-control" type="search" autocomplete="off" inputmode="numeric"
              placeholder="Scan barcode or enter product code" aria-label="Scan or enter product barcode">
            <button class="btn btn-primary" type="submit">Add code</button>
            <button class="btn btn-secondary pos-camera-button" type="button" onclick="POS.openScanner()" title="Scan with camera" aria-label="Scan with camera">
              <i data-lucide="camera"></i>
            </button>
          </form>

          <div class="pos-catalog-heading">
            <label class="pos-search">
              <i data-lucide="search"></i>
              <input class="form-control" type="search" value="${Utils.escapeHtml(this.searchQuery)}"
                oninput="POS.setSearch(this.value)" placeholder="Search products by name or barcode" aria-label="Search products">
            </label>
            <span id="pos-product-count">${products.length} ${products.length === 1 ? 'product' : 'products'}</span>
          </div>

          <div class="pos-product-grid" id="pos-product-grid">
            ${this.renderProducts(products)}
          </div>
        </section>

        <aside class="pos-bill-panel" aria-label="Current sale">
          <div class="pos-bill-heading">
            <div>
              <div class="pos-eyebrow">Checkout</div>
              <h2>Current sale <span id="pos-item-count"></span></h2>
            </div>
            <button class="btn btn-ghost btn-icon" type="button" onclick="POS.clearCart()" title="Clear sale" aria-label="Clear sale">
              <i data-lucide="trash-2"></i>
            </button>
          </div>

          <div class="pos-bill-details">
            <label class="form-label" for="pos-customer">Customer <span class="pos-optional">Optional</span></label>
            <select class="form-control" id="pos-customer" onchange="POS.setCustomer(this.value)">
              <option value="" ${!this.customerId ? 'selected' : ''}>Walk-in customer</option>
              ${customers.map(customer => `<option value="${Utils.escapeHtml(customer.id)}" ${this.customerId === customer.id ? 'selected' : ''}>${Utils.escapeHtml(customer.name)}${customer.phone ? ` · ${Utils.escapeHtml(customer.phone)}` : ''}</option>`).join('')}
            </select>
            <div class="pos-meta-grid">
              <div><span>Invoice no.</span><strong>Generated at checkout</strong></div>
              <div><span>Date</span><strong>${Utils.formatDate(Utils.today())}</strong></div>
            </div>
          </div>

          <div class="pos-cart-items" id="pos-cart-items"></div>

          <div class="pos-totals" id="pos-totals"></div>
          <div class="pos-payment-row">
            <label class="form-label" for="pos-payment-method">Payment method</label>
            <select class="form-control" id="pos-payment-method" onchange="POS.setPaymentMethod(this.value)">
              ${['Cash', 'UPI', 'Card', 'Bank transfer'].map(method => `<option value="${method}" ${this.paymentMethod === method ? 'selected' : ''}>${method}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-lg pos-checkout" id="pos-checkout" type="button" onclick="POS.completeSale()" ${this.cart.length ? '' : 'disabled'}>
            <i data-lucide="receipt-text"></i> Complete sale <span id="pos-checkout-total"></span>
          </button>
        </aside>
      </div>
    `;

    this.renderCart();
    if (window.lucide) lucide.createIcons();
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) barcodeInput.focus({ preventScroll: true });
  },

  getFilteredProducts() {
    const query = this.searchQuery.trim().toLowerCase();
    return Storage.getAll('products').filter(product => !query ||
      (product.name || '').toLowerCase().includes(query) ||
      (product.barcode || '').toLowerCase().includes(query) ||
      (product.hsn || '').toLowerCase().includes(query));
  },

  renderProducts(products) {
    if (!products.length) {
      const hasProducts = Storage.getAll('products').length > 0;
      return `<div class="pos-empty-catalog">
        <span class="pos-empty-icon"><i data-lucide="${hasProducts ? 'search-x' : 'package-open'}"></i></span>
        <h3>${hasProducts ? 'No matching products' : 'Your catalog is empty'}</h3>
        <p>${hasProducts ? 'Try a different name or barcode.' : 'Add products with prices and barcodes to start a sale.'}</p>
        ${!hasProducts ? '<button class="btn btn-primary" type="button" onclick="App.navigate(\'products\')"><i data-lucide="plus"></i> Add your first product</button>' : ''}
      </div>`;
    }
    return products.map(product => {
      const quantityInCart = this.cart.find(item => item.productId === product.id)?.quantity || 0;
      const stock = Number(product.stock) || 0;
      return `<button class="pos-product-tile" type="button" onclick="POS.addProduct('${Utils.escapeHtml(product.id)}')" aria-label="Add ${Utils.escapeHtml(product.name)} to sale">
        <span class="pos-product-image">
          ${product.image ? `<img src="${Utils.escapeHtml(Cloud.productImageUrl(product.image))}" alt="${Utils.escapeHtml(product.name)}" loading="lazy">` : '<i data-lucide="package"></i>'}
          ${quantityInCart ? `<span class="pos-quantity-badge">${quantityInCart} in sale</span>` : ''}
        </span>
        <span class="pos-product-info">
          <strong title="${Utils.escapeHtml(product.name)}">${Utils.escapeHtml(product.name)}</strong>
          <span class="pos-product-meta">${product.barcode ? Utils.escapeHtml(product.barcode) : `Stock: ${stock.toLocaleString()}`}</span>
          <span class="pos-product-price">${Utils.formatCurrency(product.price)}</span>
        </span>
      </button>`;
    }).join('');
  },

  setSearch(value) {
    this.searchQuery = value;
    const products = this.getFilteredProducts();
    const grid = document.getElementById('pos-product-grid');
    const count = document.getElementById('pos-product-count');
    if (grid) {
      grid.innerHTML = this.renderProducts(products);
      if (window.lucide) lucide.createIcons();
    }
    if (count) count.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
  },

  setCustomer(value) {
    this.customerId = value;
  },

  setPaymentMethod(value) {
    this.paymentMethod = value;
  },

  addProduct(productId) {
    const product = Storage.getById('products', productId);
    if (!product) return;
    const existing = this.cart.find(item => item.productId === productId);
    const nextQuantity = (existing ? existing.quantity : 0) + 1;
    const availableStock = Number(product.stock) || 0;
    if (availableStock > 0 && nextQuantity > availableStock) {
      Utils.toast(`Only ${availableStock} ${product.unit || 'units'} of ${product.name} in stock`, 'warning');
      return;
    }
    if (existing) existing.quantity = nextQuantity;
    else this.cart.push({ productId, quantity: 1 });
    this.renderCart();
    this.refreshCatalog();
  },

  addByBarcode(value) {
    const barcode = value.trim();
    if (!barcode) return;
    const product = Storage.getAll('products').find(item => item.barcode === barcode);
    if (!product) {
      Utils.toast(`No product found for barcode ${barcode}`, 'error');
      return;
    }
    this.addProduct(product.id);
  },

  handleBarcode(event) {
    event.preventDefault();
    const input = document.getElementById('pos-barcode-input');
    if (!input) return;
    this.addByBarcode(input.value);
    input.value = '';
    input.focus({ preventScroll: true });
  },

  changeQuantity(productId, change) {
    const item = this.cart.find(entry => entry.productId === productId);
    if (!item) return;
    const nextQuantity = item.quantity + change;
    const product = Storage.getById('products', productId);
    const availableStock = Number(product && product.stock) || 0;
    if (change > 0 && availableStock > 0 && nextQuantity > availableStock) {
      Utils.toast(`Only ${availableStock} ${product.unit || 'units'} in stock`, 'warning');
      return;
    }
    if (nextQuantity <= 0) this.cart = this.cart.filter(entry => entry.productId !== productId);
    else item.quantity = nextQuantity;
    this.renderCart();
    this.refreshCatalog();
  },

  clearCart() {
    if (!this.cart.length) return;
    this.cart = [];
    this.renderCart();
    this.refreshCatalog();
  },

  refreshCatalog() {
    const grid = document.getElementById('pos-product-grid');
    if (grid) {
      grid.innerHTML = this.renderProducts(this.getFilteredProducts());
      if (window.lucide) lucide.createIcons();
    }
  },

  getTotals() {
    return this.cart.reduce((totals, entry) => {
      const product = Storage.getById('products', entry.productId);
      if (!product) return totals;
      const subtotal = Number(product.price) * entry.quantity;
      const tax = subtotal * (Number(product.gstRate) || 0) / 100;
      totals.subtotal += subtotal;
      totals.tax += tax;
      totals.total += subtotal + tax;
      return totals;
    }, { subtotal: 0, tax: 0, total: 0 });
  },

  renderCart() {
    const list = document.getElementById('pos-cart-items');
    const totalsElement = document.getElementById('pos-totals');
    if (!list || !totalsElement) return;
    const validItems = this.cart.map(entry => ({ entry, product: Storage.getById('products', entry.productId) }))
      .filter(item => item.product);
    list.innerHTML = validItems.length ? validItems.map(({ entry, product }) => `
      <div class="pos-cart-item">
        <div class="pos-cart-item-info">
          <strong>${Utils.escapeHtml(product.name)}</strong>
          <span>${Utils.formatCurrency(product.price)} each · GST ${Number(product.gstRate) || 0}%</span>
        </div>
        <div class="pos-quantity-control">
          <button type="button" onclick="POS.changeQuantity('${Utils.escapeHtml(product.id)}', -1)" aria-label="Remove one ${Utils.escapeHtml(product.name)}"><i data-lucide="minus"></i></button>
          <span>${entry.quantity}</span>
          <button type="button" onclick="POS.changeQuantity('${Utils.escapeHtml(product.id)}', 1)" aria-label="Add one ${Utils.escapeHtml(product.name)}"><i data-lucide="plus"></i></button>
        </div>
        <strong class="pos-line-total">${Utils.formatCurrency(Number(product.price) * entry.quantity)}</strong>
      </div>`).join('') : `<div class="pos-empty-cart"><i data-lucide="shopping-bag"></i><strong>No items added yet</strong><span>Scan a barcode or choose a product.</span></div>`;

    const totals = this.getTotals();
    totalsElement.innerHTML = `
      <div><span>Subtotal</span><strong>${Utils.formatCurrency(totals.subtotal)}</strong></div>
      <div><span>GST</span><strong>${Utils.formatCurrency(totals.tax)}</strong></div>
      <div class="pos-grand-total"><span>Grand total</span><strong>${Utils.formatCurrency(totals.total)}</strong></div>
    `;
    const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const countElement = document.getElementById('pos-item-count');
    const checkout = document.getElementById('pos-checkout');
    const checkoutTotal = document.getElementById('pos-checkout-total');
    if (countElement) countElement.textContent = count ? `(${count})` : '';
    if (checkout) checkout.disabled = count === 0;
    if (checkoutTotal) checkoutTotal.textContent = Utils.formatCurrency(totals.total);
    if (window.lucide) lucide.createIcons();
  },

  async completeSale() {
    if (!this.cart.length) return;
    const items = this.cart.map(entry => {
      const product = Storage.getById('products', entry.productId);
      return product ? { product, quantity: entry.quantity } : null;
    }).filter(Boolean);
    if (!items.length || items.length !== this.cart.length) {
      Utils.toast('A product in this sale is no longer in your catalog', 'error');
      return;
    }

    for (const { product, quantity } of items) {
      const stock = Number(product.stock) || 0;
      if (stock > 0 && quantity > stock) {
        Utils.toast(`${product.name} has only ${stock} ${product.unit || 'units'} left`, 'error');
        return;
      }
    }

    const invoiceItems = items.map(({ product, quantity }) => {
      const rate = Number(product.price) || 0;
      const gstRate = Number(product.gstRate) || 0;
      const taxableAmount = rate * quantity;
      const gstAmount = taxableAmount * gstRate / 100;
      return {
        productId: product.id,
        name: product.name,
        hsn: product.hsn || '',
        quantity,
        rate,
        discount: 0,
        discountType: 'percent',
        gstRate,
        taxableAmount,
        gstAmount,
        discountAmount: 0,
        amount: taxableAmount + gstAmount
      };
    });
    const totals = invoiceItems.reduce((result, item) => {
      result.subtotal += item.rate * item.quantity;
      result.tax += item.gstAmount;
      result.grandTotal += item.amount;
      return result;
    }, { subtotal: 0, tax: 0, grandTotal: 0 });
    const customer = this.customerId ? Storage.getById('customers', this.customerId) : null;
    const invoice = {
      invoiceNumber: Utils.generateInvoiceNumber(),
      invoiceDate: Utils.today(),
      dueDate: null,
      customerId: customer ? customer.id : '',
      customerName: customer ? customer.name : 'Walk-in Customer',
      paymentMethod: this.paymentMethod,
      status: 'paid',
      items: invoiceItems,
      subtotal: totals.subtotal,
      totalDiscount: 0,
      totalTaxable: totals.subtotal,
      totalGst: totals.tax,
      grandTotal: totals.grandTotal,
      notes: `Point of sale - Paid by ${this.paymentMethod}`,
      terms: ''
    };

    const checkout = document.getElementById('pos-checkout');
    if (checkout) {
      checkout.disabled = true;
      checkout.setAttribute('aria-busy', 'true');
    }
    let savedInvoice;
    try {
      savedInvoice = Cloud.user ? await Cloud.saveInvoice(invoice) : Storage.add('invoices', invoice);
      if (!savedInvoice) throw new Error('Sale could not be saved');
      if (!Cloud.user) {
        items.forEach(({ product, quantity }) => {
          const stock = Number(product.stock) || 0;
          if (stock > 0) Storage.update('products', product.id, { stock: Math.max(0, stock - quantity) });
        });
      }
    } catch (error) {
      console.error('POS checkout error:', error);
      Utils.toast(Cloud.user ? Cloud.friendlyError(error) : 'Sale could not be saved. Check available storage.', 'error');
      return;
    } finally {
      if (checkout) {
        checkout.removeAttribute('aria-busy');
        checkout.disabled = this.cart.length === 0;
      }
    }

    this.cart = [];
    this.renderCart();
    this.refreshCatalog();
    Utils.toast(`Sale ${savedInvoice.invoiceNumber} completed`, 'success');
    ExportModule.showPreview(savedInvoice, customer, Storage.get('settings') || {});
  },

  async openScanner() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      Utils.toast('Camera scanning is not available in this browser. Use a USB scanner in the barcode field.', 'warning');
      return;
    }
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal pos-scanner-modal">
      <div class="modal-header">
        <div><h3 class="modal-title">Scan barcode</h3><p class="pos-scanner-hint" id="pos-scanner-hint">Position a barcode inside the frame.</p></div>
        <button class="modal-close" type="button" onclick="POS.closeScanner()" aria-label="Close scanner"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body"><div class="pos-camera-frame"><video id="pos-camera-video" autoplay muted playsinline></video><span></span></div></div>
      <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="POS.closeScanner()">Cancel</button></div>
    </div>`;
    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();

    try {
      try {
        this.scannerDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
      } catch (error) {
        this.scannerDetector = new BarcodeDetector();
      }
      this.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const video = document.getElementById('pos-camera-video');
      if (!video) return this.stopScanner();
      video.srcObject = this.scannerStream;
      await video.play();
      this.scanFrame();
    } catch (error) {
      const hint = document.getElementById('pos-scanner-hint');
      if (hint) hint.textContent = 'Camera access failed. Check browser permissions or use a USB scanner.';
      this.stopScanner();
    }
  },

  async scanFrame() {
    const video = document.getElementById('pos-camera-video');
    if (!video || !this.scannerStream || !this.scannerDetector) return;
    try {
      const codes = await this.scannerDetector.detect(video);
      if (codes.length && codes[0].rawValue) {
        const barcode = codes[0].rawValue;
        this.closeScanner();
        this.addByBarcode(barcode);
        return;
      }
    } catch (error) {
      this.closeScanner();
      Utils.toast('Could not read this barcode. Try a USB scanner.', 'error');
      return;
    }
    this.scannerFrame = requestAnimationFrame(() => this.scanFrame());
  },

  stopScanner() {
    if (this.scannerFrame) cancelAnimationFrame(this.scannerFrame);
    this.scannerFrame = null;
    if (this.scannerStream) this.scannerStream.getTracks().forEach(track => track.stop());
    this.scannerStream = null;
    this.scannerDetector = null;
  },

  closeScanner() {
    this.stopScanner();
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
  }
};