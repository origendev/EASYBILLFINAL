/* ============================================
   EASYBILL — Product Barcode Generator
   ============================================ */

const BarcodeGenerator = {
  patterns: {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', A: '100001001', B: '001001001',
    C: '101001000', D: '000011001', E: '100011000', F: '001011000',
    G: '000001101', H: '100001100', I: '001001100', J: '000011100',
    K: '100000011', L: '001000011', M: '101000010', N: '000010011',
    O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
    S: '001000110', T: '000010110', U: '110000001', V: '011000001',
    W: '111000000', X: '010010001', Y: '110010000', Z: '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
  },

  normalize(value) {
    return value.trim().toUpperCase();
  },

  isValid(value) {
    const code = this.normalize(value);
    return code.length > 0 && code.length <= 40 &&
      [...code].every(character => character !== '*' && this.patterns[character]);
  },

  makeSvg(name, value) {
    const code = this.normalize(value);
    if (!this.isValid(code)) throw new Error('Enter up to 40 characters using A-Z, 0-9, spaces, or - . $ / + %.');
    const symbols = `*${code}*`;
    const moduleSize = 2;
    const quietZone = 10;
    const moduleCount = [...symbols].reduce((total, character) => {
      const pattern = this.patterns[character];
      return total + [...pattern].reduce((sum, width) => sum + (width === '1' ? 3 : 1), 0);
    }, 0) + symbols.length - 1;
    const width = (moduleCount + quietZone * 2) * moduleSize;
    let x = quietZone * moduleSize;
    let bars = '';

    [...symbols].forEach((character, symbolIndex) => {
      [...this.patterns[character]].forEach((isWide, elementIndex) => {
        const elementWidth = (isWide === '1' ? 3 : 1) * moduleSize;
        if (elementIndex % 2 === 0) {
          bars += `<rect x="${x}" y="30" width="${elementWidth}" height="72"/>`;
        }
        x += elementWidth;
      });
      if (symbolIndex < symbols.length - 1) x += moduleSize;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="140" viewBox="0 0 ${width} 140" role="img" aria-label="Code 39 barcode for ${Utils.escapeHtml(name)}">
      <rect width="100%" height="100%" fill="#fff"/>
      <text x="${width / 2}" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#111">${Utils.escapeHtml(name)}</text>
      <g fill="#111">${bars}</g>
      <text x="${width / 2}" y="126" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="2" fill="#111">${Utils.escapeHtml(code)}</text>
    </svg>`;
  },

  render() {
    const products = Storage.getAll('products');
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in barcode-generator-page">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Create a product barcode</h3>
              <p class="modal-kicker">Create a print-ready Code 39 product label</p>
            </div>
          </div>
          <div class="card-body barcode-generator-body">
            <div class="form-group">
              <label class="form-label" for="barcode-product">Catalog product</label>
              <select id="barcode-product" class="form-control" onchange="BarcodeGenerator.selectProduct(this.value)">
                <option value="">Custom label (not linked to a product)</option>
                ${products.map(product => `<option value="${Utils.escapeHtml(product.id)}">${Utils.escapeHtml(product.name)}</option>`).join('')}
              </select>
              <span class="form-hint">Choose a product to save its barcode to the catalog, or create a standalone label.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="barcode-product-name">Product name</label>
              <input id="barcode-product-name" class="form-control" type="text" maxlength="80" placeholder="e.g. Olive Oil 500 ml" oninput="BarcodeGenerator.preview()">
            </div>
            <div class="form-group">
              <label class="form-label" for="barcode-value">Barcode value</label>
              <div class="barcode-value-row">
                <input id="barcode-value" class="form-control" type="text" maxlength="40" autocomplete="off" placeholder="Enter a code or generate one" oninput="BarcodeGenerator.preview()">
                <button class="btn btn-secondary" type="button" onclick="BarcodeGenerator.generateCode()">
                  <i data-lucide="wand-sparkles"></i> Generate code
                </button>
              </div>
              <span class="form-hint">Code 39 supports A–Z, 0–9, spaces, and - . $ / + %. Lowercase is converted to uppercase.</span>
            </div>
            <div id="barcode-preview" class="barcode-preview" aria-live="polite">
              <span>Enter a product name and barcode value to preview the label.</span>
            </div>
            <div id="barcode-message" class="form-hint barcode-message" aria-live="polite"></div>
          </div>
          <div class="card-footer barcode-footer">
            <button id="barcode-save" class="btn btn-secondary" type="button" onclick="BarcodeGenerator.saveToProduct()" disabled>
              <i data-lucide="save"></i> Save to product
            </button>
            <button id="barcode-print" class="btn btn-secondary" type="button" onclick="BarcodeGenerator.print()" disabled>
              <i data-lucide="printer"></i> Print
            </button>
            <button id="barcode-download" class="btn btn-primary" type="button" onclick="BarcodeGenerator.download()" disabled>
              <i data-lucide="download"></i> Download SVG
            </button>
          </div>
        </div>
      </div>
    `;
    Icons.renderAll();
  },

  selectProduct(id) {
    const product = id ? Storage.getById('products', id) : null;
    document.getElementById('barcode-product-name').value = product?.name || '';
    document.getElementById('barcode-value').value = product?.barcode || '';
    this.preview();
  },

  generateCode() {
    const existing = new Set(Storage.getAll('products').map(product => this.normalize(product.barcode || '')));
    let sequence = Date.now();
    let code;
    do {
      code = `EB${(sequence++).toString(36).toUpperCase()}`;
    } while (existing.has(code));
    document.getElementById('barcode-value').value = code;
    this.preview();
  },

  getCurrentLabel() {
    const name = document.getElementById('barcode-product-name').value.trim();
    const value = this.normalize(document.getElementById('barcode-value').value);
    if (!name) throw new Error('Enter a product name for the label.');
    if (!this.isValid(value)) throw new Error('Enter a valid Code 39 value or generate a unique code.');
    const duplicate = Storage.getAll('products').find(product =>
      this.normalize(product.barcode || '') === value &&
      product.id !== document.getElementById('barcode-product').value);
    if (duplicate) throw new Error(`This barcode is already assigned to ${duplicate.name}.`);
    return { name, value };
  },

  preview() {
    const preview = document.getElementById('barcode-preview');
    const message = document.getElementById('barcode-message');
    const name = document.getElementById('barcode-product-name').value.trim();
    const value = document.getElementById('barcode-value').value;
    const selectedProductId = document.getElementById('barcode-product').value;
    const actions = ['barcode-download', 'barcode-print', 'barcode-save'];
    actions.forEach(id => { document.getElementById(id).disabled = true; });
    message.textContent = '';
    preview.innerHTML = '<span>Enter a product name and barcode value to preview the label.</span>';
    if (!name || !value) return;

    try {
      const label = this.getCurrentLabel();
      preview.innerHTML = this.makeSvg(label.name, label.value);
      document.getElementById('barcode-download').disabled = false;
      document.getElementById('barcode-print').disabled = false;
      document.getElementById('barcode-save').disabled = !selectedProductId;
    } catch (error) {
      message.textContent = error.message;
    }
  },

  download() {
    let label;
    try {
      label = this.getCurrentLabel();
    } catch (error) {
      Utils.toast(error.message, 'error');
      return;
    }
    const blob = new Blob([this.makeSvg(label.name, label.value)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.fileName(label.name)}-barcode.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Utils.toast('Print-ready barcode downloaded', 'success');
  },

  print() {
    let label;
    try {
      label = this.getCurrentLabel();
    } catch (error) {
      Utils.toast(error.message, 'error');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=640,height=480');
    if (!printWindow) {
      Utils.toast('Allow pop-ups to print the barcode label.', 'warning');
      return;
    }
    const svg = this.makeSvg(label.name, label.value);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>${Utils.escapeHtml(label.name)} barcode</title>
      <style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center;align-items:flex-start;font-family:Arial,sans-serif}svg{max-width:100%;height:auto;margin-top:8mm}@media print{svg{width:80mm}}</style>
      </head><body>${svg}<script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
    printWindow.document.close();
  },

  async saveToProduct() {
    const id = document.getElementById('barcode-product').value;
    const product = Storage.getById('products', id);
    if (!product) {
      Utils.toast('Choose a catalog product before saving its barcode.', 'error');
      return;
    }
    let label;
    try {
      label = this.getCurrentLabel();
    } catch (error) {
      Utils.toast(error.message, 'error');
      return;
    }

    const saveButton = document.getElementById('barcode-save');
    saveButton.disabled = true;
    try {
      if (Cloud.user) await Cloud.saveProduct({ ...product, barcode: label.value }, product.id);
      else if (!Storage.update('products', product.id, { barcode: label.value })) {
        throw new Error('Could not update this product in local storage.');
      }
      Utils.toast(`Barcode saved to ${product.name}`, 'success');
      if (App.currentView === 'stocks') Stocks.render();
      else this.preview();
    } catch (error) {
      console.error('Barcode save error:', error);
      Utils.toast(Cloud.user ? Cloud.friendlyError(error) : error.message, 'error');
      saveButton.disabled = false;
    }
  },

  fileName(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  }
};
