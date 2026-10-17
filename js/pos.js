/* ============================================
   EASYBILL — Point of Sale Module
   ============================================ */

const POS = {
  cart: [],
  searchQuery: '',
  customerId: '',
  paymentMethod: 'Cash',
  paymentAllocations: [],
  checkoutInProgress: false,
  loyaltyBalance: 0,
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
            <button class="btn btn-secondary pos-camera-button" type="button" onclick="POS.openScanner()" title="Scan barcode with camera" aria-label="Scan with camera">
              <i data-lucide="camera" style="width: 16px; height: 16px; color: var(--accent);"></i>
              <span style="font-weight: 600; font-size: 13px; color: var(--accent); margin-left: 4px;">Camera</span>
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
            <div id="pos-loyalty-redemption"></div>

            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 11px;" onclick="Customers.openModal()" title="Add New Customer">
                <i data-lucide="user-plus"></i> + Customer
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="pos-edit-customer-btn" style="flex: 1; font-size: 11px;" onclick="POS.editCurrentCustomer()" title="Edit Customer Details" ${!this.customerId ? 'disabled' : ''}>
                <i data-lucide="pencil"></i> Edit Customer
              </button>
            </div>

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
              ${['Cash', 'UPI', 'Card', 'Bank transfer', 'Split payment'].map(method => `<option value="${method}" ${this.paymentMethod === method ? 'selected' : ''}>${method}</option>`).join('')}
            </select>
            <div id="pos-split-payment-fields"></div>
          </div>
          <button class="btn btn-primary btn-lg pos-checkout" id="pos-checkout" type="button" onclick="POS.completeSale()" ${this.cart.length ? '' : 'disabled'}>
            <i data-lucide="receipt-text"></i> Complete sale <span id="pos-checkout-total"></span>
          </button>
        </aside>
      </div>
    `;

    this.renderCart();
    Icons.renderAll();
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) barcodeInput.focus({ preventScroll: true });
    this.refreshLoyaltyInfo();
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
      const initial = (product.name || 'P').charAt(0).toUpperCase();
      return `<button class="pos-product-tile" type="button" onclick="POS.addProduct('${Utils.escapeHtml(product.id)}')" aria-label="Add ${Utils.escapeHtml(product.name)} to sale">
        <span class="pos-product-image">
          ${product.image 
            ? `<img src="${Utils.escapeHtml(Cloud.productImageUrl(product.image))}" alt="${Utils.escapeHtml(product.name)}" loading="lazy">` 
            : `<div class="pos-initial-badge">${initial}</div>`
          }
          ${quantityInCart ? `<span class="pos-quantity-badge">${quantityInCart} in sale</span>` : ''}
          ${(!Cloud.user || ['owner','manager'].includes(Cloud.role)) ? `<span class="pos-tile-edit-btn" onclick="event.stopPropagation(); Products.openModal('${Utils.escapeHtml(product.id)}')" title="Edit product details"><i data-lucide="pencil"></i></span>` : ''}
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
      Icons.renderAll();
    }
    if (count) count.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
  },

  async setCustomer(value) {
    this.customerId = value;
    this.loyaltyBalance = 0;
    this.loyaltyPointsToRedeem = 0;
    const oldLoyaltyInput=document.getElementById('pos-loyalty-points');if(oldLoyaltyInput)oldLoyaltyInput.value='0';
    const editBtn = document.getElementById('pos-edit-customer-btn');
    if (editBtn) editBtn.disabled = !value;
    await this.refreshLoyaltyInfo();
  },

  async refreshLoyaltyInfo() {
    const host = document.getElementById('pos-loyalty-redemption');
    if (!host) return;
    const selectedPoints = Math.max(0,Math.floor(Number(document.getElementById('pos-loyalty-points')?.value)||0));
    if (!this.customerId) { host.innerHTML = ''; return; }
    try {
      if (Cloud.user && Cloud.client && Cloud.businessId) {
        const {data,error}=await Cloud.client.rpc('get_customer_loyalty_balance',{p_business_id:Cloud.businessId,p_customer_id:this.customerId});
        if(error) throw error;
        this.loyaltyBalance=Number(data)||0;
      } else {
        this.loyaltyBalance=Storage.getAll('loyalty').filter(x=>x.customerId===this.customerId).reduce((sum,x)=>sum+Number(x.points||0),0);
      }
    } catch(error) { this.loyaltyBalance=0; console.warn('Loyalty balance unavailable:',error.message); }
    const settings=Storage.get('loyaltySettings')||{pointValue:0.5,minimumRedemptionPoints:10};
    const reserved=Storage.getAll('offline_outbox').filter(x=>x.kind==='invoice'&&x.status!=='synced'&&x.invoice?.customerId===this.customerId).reduce((sum,x)=>sum+Number(x.invoice.loyaltyPointsRedeemed||0),0);
    const available=Math.max(0,this.loyaltyBalance-reserved);
    host.innerHTML=`<div class="pos-loyalty"><small>Available loyalty points: <strong>${available}</strong> · ₹${Number(settings.pointValue||0.5).toFixed(2)} per point</small><label class="form-label" for="pos-loyalty-points">Redeem points (optional)</label><input class="form-control" id="pos-loyalty-points" type="number" min="0" max="${available}" step="1" value="${Math.min(selectedPoints,available)}" oninput="POS.updateLoyaltyRedemption()"><small>Minimum ${Number(settings.minimumRedemptionPoints||10)} points. Redemption is recorded as store credit.</small></div>`;
  },

  updateLoyaltyRedemption() {
    const total=this.getTotals().total;
    const points=Math.max(0,Math.floor(Number(document.getElementById('pos-loyalty-points')?.value)||0));
    const settings=Storage.get('loyaltySettings')||{pointValue:0.5};
    const value=Math.round(points*Number(settings.pointValue||0.5)*100)/100;
    if(this.paymentMethod==='Split payment') { const upi=document.getElementById('split-upi'); if(upi) upi.value=Math.max(0,total-value).toFixed(2); }
  },

  editCurrentCustomer() {
    if (this.customerId) {
      Customers.openModal(this.customerId);
    } else {
      Utils.toast('Please select a registered customer to edit', 'warning');
    }
  },

  setPaymentMethod(value) {
    this.paymentMethod = value;
    const host = document.getElementById('pos-split-payment-fields');
    if (!host) return;
    if (value !== 'Split payment') { host.innerHTML = ''; return; }
    const total = this.getTotals().total;
    host.innerHTML = `<div class="ops-form" style="margin-top:10px"><label>Cash amount<input id="split-cash" type="number" min="0" step="0.01" value="0.00"></label><label>UPI amount<input id="split-upi" type="number" min="0" step="0.01" value="${total.toFixed(2)}"></label><label>Card amount<input id="split-card" type="number" min="0" step="0.01" value="0.00"></label><label>Bank transfer amount<input id="split-bank" type="number" min="0" step="0.01" value="0.00"></label><p id="split-payment-total">Allocations must equal ${Utils.formatCurrency(total)}.</p></div>`;
    this.updateLoyaltyRedemption();
  },

  getPaymentAllocations(total) {
    const settings=Storage.get('loyaltySettings')||{pointValue:0.5,minimumRedemptionPoints:10};
    const points=Math.max(0,Math.floor(Number(document.getElementById('pos-loyalty-points')?.value)||0));
    const redemptionValue=Math.round(points*Number(settings.pointValue||0.5)*100)/100;
    const reserved=Storage.getAll('offline_outbox').filter(x=>x.kind==='invoice'&&x.status!=='synced'&&x.invoice?.customerId===this.customerId).reduce((sum,x)=>sum+Number(x.invoice.loyaltyPointsRedeemed||0),0);
    const available=Math.max(0,this.loyaltyBalance-reserved);
    if(points>0 && !this.customerId) throw new Error('Select a customer before redeeming loyalty points.');
    const redemption=EasyBillDomain.validateLoyaltyRedemption(points,available,Number(settings.pointValue||0.5),Number(settings.minimumRedemptionPoints||10),total);
    if(!redemption.valid) throw new Error(redemption.message);
    this.loyaltyPointsToRedeem=points;
    let payments;
    if(this.paymentMethod !== 'Split payment') {
      payments=[];
      if(redemptionValue>0) payments.push({method:'store_credit',amount:redemptionValue});
      const remaining=Math.round((total-redemptionValue)*100)/100;
      if(remaining>0) payments.push({method:this.paymentMethod.toLowerCase().replace(' ','_'),amount:remaining});
    } else {
      const fields=[['cash','split-cash'],['upi','split-upi'],['card','split-card'],['bank_transfer','split-bank']];
      payments=fields.map(([method,id])=>({method,amount:Number(document.getElementById(id)?.value)}));
      if(payments.some(p=>!Number.isFinite(p.amount)||p.amount<0)) throw new Error('Enter valid non-negative amounts for each payment method.');
      const target=Math.round((total-redemptionValue)*100)/100;
      const validation=EasyBillDomain.validatePayments(payments,target,0.01);
      if(!validation.valid) throw new Error(validation.message);
      payments=payments.filter(p=>p.amount>0);
      if(redemptionValue>0) payments.push({method:'store_credit',amount:redemptionValue});
    }
    if(payments.length===0) payments.push({method:this.paymentMethod==='Split payment'?'other':this.paymentMethod.toLowerCase().replace(' ','_'),amount:0});
    const validation=EasyBillDomain.validatePayments(payments,total,0.01);
    if(!validation.valid) throw new Error(validation.message);
    return payments;
  },

  addProduct(productId) {
    const product = Storage.getById('products', productId);
    if (!product) return;
    const existing = this.cart.find(item => item.productId === productId);
    const nextQuantity = (existing ? existing.quantity : 0) + 1;
    const availableStock = Number(product.stock) || 0;
    if (EasyBillDomain.isStockTracked(product) && nextQuantity > availableStock) {
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
    if (change > 0 && product && EasyBillDomain.isStockTracked(product) && nextQuantity > availableStock) {
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
      Icons.renderAll();
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
    if (this.paymentMethod === 'Split payment' && document.getElementById('split-upi')) this.updateLoyaltyRedemption();
    Icons.renderAll();
  },

  async completeSale() {
    if (!this.cart.length || this.checkoutInProgress) return;
    const validation = EasyBillDomain.validateCart(this.cart, id => Storage.getById('products', id));
    if (!validation.valid) {
      Utils.toast(validation.message, 'error');
      return;
    }
    const items = this.cart.map(entry => ({ product: Storage.getById('products', entry.productId), quantity: Number(entry.quantity) }));

    let invoiceItems;
    let totals;
    try {
      invoiceItems = EasyBillDomain.buildInvoiceItems(items);
      totals = EasyBillDomain.calculateTotals(invoiceItems);
    } catch (error) {
      Utils.toast(error.message || 'Please check the sale items and try again.', 'error');
      return;
    }
    const customer = this.customerId ? Storage.getById('customers', this.customerId) : null;
    let payments;
    try { if(this.customerId) await this.refreshLoyaltyInfo(); payments = this.getPaymentAllocations(totals.grandTotal); } catch (error) { Utils.toast(error.message, 'error'); return; }
    const transactionId = globalThis.crypto?.randomUUID?.() || `easybill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let activeShift = Storage.getAll('shifts').find(shift=>shift.status==='open');
    if (Cloud.user && Cloud.client && Cloud.businessId) { try { const {data,error}=await Cloud.client.from('cashier_shifts').select('id,opened_at,terminal_id').eq('business_id',Cloud.businessId).eq('cashier_id',Cloud.user.id).eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle(); if(error) throw error; if(data) activeShift={id:data.id,status:'open',openedAt:data.opened_at,terminal:data.terminal_id}; } catch(error) { Utils.toast(`Could not verify cashier shift: ${error.message}`,'error'); return; } }
    const invoice = {
      id: transactionId, clientTransactionId: transactionId, shiftId: activeShift?.id || '', payments, loyaltyPointsRedeemed:Number(this.loyaltyPointsToRedeem)||0,
      invoiceNumber: Utils.generateInvoiceNumber(),
      invoiceDate: Utils.today(),
      dueDate: null,
      customerId: customer ? customer.id : '',
      customerName: customer ? customer.name : 'Walk-in Customer',
      paymentMethod: payments.length>1 ? 'Split payment' : ({cash:'Cash',upi:'UPI',card:'Card',bank_transfer:'Bank transfer',store_credit:'Store credit',other:'Other'}[payments[0]?.method] || this.paymentMethod),
      status: 'paid',
      items: invoiceItems,
      subtotal: totals.subtotal,
      totalDiscount: 0,
      totalTaxable: totals.subtotal,
      totalGst: totals.tax,
      grandTotal: totals.grandTotal,
      notes: `Point of sale - Paid by ${this.paymentMethod}${Number(this.loyaltyPointsToRedeem)>0 ? `; redeemed ${this.loyaltyPointsToRedeem} loyalty points` : ''}`, 
      terms: ''
    };

    const checkout = document.getElementById('pos-checkout');
    this.checkoutInProgress = true;
    if (checkout) {
      checkout.disabled = true;
      checkout.setAttribute('aria-busy', 'true');
    }
    let savedInvoice;
    let pendingOffline = false;
    try {
      savedInvoice = Cloud.user ? await Cloud.saveInvoice(invoice) : Storage.add('invoices', invoice);
      if (!savedInvoice) throw new Error('Sale could not be saved');
      if (!Cloud.user) {
        items.forEach(({ product, quantity }) => {
          const stock = Number(product.stock) || 0;
          if (EasyBillDomain.isStockTracked(product)) Storage.update('products', product.id, { stock: Math.max(0, stock - quantity) });
        });
      }
    } catch (error) {
      console.error('POS checkout error:', error);
      if (Cloud.user && Storage.isAvailable()) {
        // Keep a durable pending copy with a stable transaction UUID. A retry must reuse this ID.
        const pending = { ...invoice, status: 'offline-pending', syncStatus: 'pending', createdAt: new Date().toISOString(), syncError: String(error.message || 'Network unavailable') };
        const existing = Storage.getAll('invoices');
        if (!existing.some(row => row.id === transactionId)) existing.unshift(pending);
        Storage.replaceLocal('invoices', existing);
        const outbox = Storage.getAll('offline_outbox');
        outbox.push({ id: transactionId, kind: 'invoice', status: 'pending', createdAt: pending.createdAt, message: 'Offline sale awaiting server confirmation', invoice: pending });
        Storage.replaceLocal('offline_outbox', outbox);
        items.forEach(({ product, quantity }) => { if (EasyBillDomain.isStockTracked(product)) Storage.update('products', product.id, { stock: Math.max(0, (Number(product.stock)||0)-quantity) }); });
        savedInvoice = pending;
        pendingOffline = true;
      } else {
        Utils.toast(Cloud.user ? Cloud.friendlyError(error) : 'Sale could not be saved. Check available storage.', 'error');
        return;
      }
    } finally {
      this.checkoutInProgress = false;
      if (checkout) {
        checkout.removeAttribute('aria-busy');
        checkout.disabled = this.cart.length === 0;
      }
    }

    if (!Cloud.user && window.Operations && customer) { Operations.recordLocalLoyaltyRedemption(savedInvoice); Operations.awardLocalLoyalty(savedInvoice); }
    this.loyaltyPointsToRedeem=0;
    const redeemedInput=document.getElementById('pos-loyalty-points');if(redeemedInput)redeemedInput.value='0';
    this.cart = [];
    this.renderCart();
    this.refreshCatalog();
    Utils.toast(pendingOffline ? `Sale ${savedInvoice.invoiceNumber} saved offline; awaiting server confirmation.` : `Sale ${savedInvoice.invoiceNumber} completed`, pendingOffline ? 'warning' : 'success');
    this.refreshLoyaltyInfo();
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
    Icons.renderAll();

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
  },

  showReceiptModalById(id) {
    const invoice = Storage.getById('invoices', id);
    if (!invoice) {
      Utils.toast('Receipt record not found', 'error');
      return;
    }
    const settings = Storage.get('settings') || {};
    const customer = invoice.customerId ? Storage.getById('customers', invoice.customerId) : null;
    const overlay = document.getElementById('modal-overlay');
    
    overlay.innerHTML = `
      <div class="modal receipt-modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Thermal Receipt Preview</h3>
          <button class="modal-close" onclick="POS.closeScanner()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body receipt-print-area">
          <div class="receipt-paper">
            <div class="receipt-header">
              <div class="receipt-title">${Utils.escapeHtml(settings.companyName || 'EASYBILL STORE')}</div>
              ${settings.address ? `<div style="font-size: 11px;">${Utils.escapeHtml(settings.address)}</div>` : ''}
              ${settings.phone ? `<div style="font-size: 11px;">Ph: ${Utils.escapeHtml(settings.phone)}</div>` : ''}
              ${settings.gstin ? `<div style="font-size: 11px;">GSTIN: ${Utils.escapeHtml(settings.gstin)}</div>` : ''}
            </div>

            <div style="font-size: 12px; margin-bottom: 8px;">
              <div><strong>Receipt #:</strong> ${Utils.escapeHtml(invoice.invoiceNumber)}</div>
              <div><strong>Date:</strong> ${Utils.formatDate(invoice.createdAt || invoice.invoiceDate)}</div>
              <div><strong>Customer:</strong> ${customer ? `${Utils.escapeHtml(customer.name || 'Customer')} (${Utils.escapeHtml(customer.phone)})` : Utils.escapeHtml(invoice.customerName || 'Walk-in Customer')}</div>
              <div><strong>Payment:</strong> ${Utils.escapeHtml(invoice.paymentMethod || 'Cash')}</div>
            </div>

            <div class="receipt-divider"></div>

            <table class="receipt-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="num">Qty</th>
                  <th class="num">Price</th>
                  <th class="num">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice.items || []).map(item => `
                  <tr>
                    <td>${Utils.escapeHtml(item.name)}</td>
                    <td class="num">${item.quantity}</td>
                    <td class="num">${item.rate}</td>
                    <td class="num">${item.amount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="receipt-divider"></div>

            <div class="receipt-totals">
              <div class="receipt-totals-row"><span>Subtotal:</span><span>${Utils.formatCurrency(invoice.subtotal || invoice.grandTotal)}</span></div>
              ${invoice.totalGst ? `<div class="receipt-totals-row"><span>GST:</span><span>${Utils.formatCurrency(invoice.totalGst)}</span></div>` : ''}
              <div class="receipt-totals-row grand"><span>GRAND TOTAL:</span><span>${Utils.formatCurrency(invoice.grandTotal)}</span></div>
            </div>

            <div class="receipt-footer">
              <p>*** Thank You for Shopping! ***</p>
              <p>Visit Again</p>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="justify-content: space-between;">
          <button class="btn btn-secondary" onclick="POS.closeScanner()">Close</button>
          <button class="btn btn-primary" onclick="window.print()">
            <i data-lucide="printer"></i> Print Receipt
          </button>
        </div>
      </div>
    `;

    overlay.classList.add('active');
    Icons.renderAll();
  }
};

// Handle Keyboard Shortcuts for POS
document.addEventListener('keydown', (e) => {
  if (App.currentView !== 'pos') return;
  
  if (e.key === 'F2') {
    e.preventDefault();
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) barcodeInput.focus();
  } else if (e.key === 'F4') {
    e.preventDefault();
    if (POS.cart.length > 0) POS.completeSale();
  } else if (e.key === 'F8') {
    e.preventDefault();
    POS.clearCart();
  } else if (e.key === 'F9') {
    e.preventDefault();
    const custSelect = document.getElementById('pos-customer');
    if (custSelect) {
      custSelect.value = '';
      POS.setCustomer('');
      Utils.toast('Set to Walk-in customer', 'info');
    }
  }
});
