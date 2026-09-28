/* ============================================
   EASYBILL — Local Storage Manager
   ============================================ */

const Storage = {
  PREFIX: 'easybill_',

  // Get a collection or single value
  get(key) {
    try {
      const data = localStorage.getItem(this.PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  // Set a value
  set(key, value) {
    return this.writeLocal(key, value);
  },

  writeLocal(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  // Remove a key
  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  replaceLocal(collection, items) {
    return this.writeLocal(collection, items);
  },

  upsertLocal(collection, item) {
    const items = this.getAll(collection);
    const index = items.findIndex(existing => existing.id === item.id);
    if (index === -1) items.push(item);
    else items[index] = item;
    return this.writeLocal(collection, items);
  },

  removeLocal(collection, id) {
    const items = this.getAll(collection);
    return this.writeLocal(collection, items.filter(item => item.id !== id));
  },

  // ---- Collection helpers ----

  // Get all items in a collection
  getAll(collection) {
    const value = this.get(collection);
    return Array.isArray(value) ? value : [];
  },

  // Get a single item by ID
  getById(collection, id) {
    const items = this.getAll(collection);
    return items.find(item => item.id === id) || null;
  },

  // Add an item to a collection
  add(collection, item) {
    const items = this.getAll(collection);
    item.id = item.id || Utils.generateId();
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    items.push(item);
    if (!this.writeLocal(collection, items)) return null;
    return item;
  },

  // Update an item in a collection
  update(collection, id, updates) {
    const items = this.getAll(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    if (!this.writeLocal(collection, items)) return null;
    return items[index];
  },

  // Delete an item from a collection
  delete(collection, id) {
    const items = this.getAll(collection);
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length < items.length) this.writeLocal(collection, filtered);
    return filtered.length < items.length;
  },

  getInvoiceCounter() {
    return Cloud.configured && Cloud.user
      ? Cloud.getInvoiceCounter()
      : Number(localStorage.getItem('eb_last_invoice_num')) || 0;
  },

  setInvoiceCounter(value) {
    if (Cloud.configured && Cloud.user) {
      Cloud.setInvoiceCounter(value);
    } else {
      localStorage.setItem('eb_last_invoice_num', String(Number(value) || 0));
    }
  },

  // ---- Backup & Restore ----

  // Export all data as JSON
  async exportData() {
    const data = {};
    const keys = ['customers', 'products', 'invoices', 'settings'];
    keys.forEach(key => {
      data[key] = this.get(key);
    });
    if (Cloud.user && Array.isArray(data.products)) {
      for (const product of data.products) {
        product.image = await Cloud.exportProductImage(product.image || '');
      }
    }
    if (Cloud.user && data.settings?.logo) {
      data.settings.logo = await Cloud.exportProductImage(data.settings.logo);
    }
    data.lastInvoiceNum = String(this.getInvoiceCounter());
    data.exportedAt = new Date().toISOString();
    data.version = '1.0';
    return JSON.stringify(data, null, 2);
  },

  // Import data from JSON
  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version) throw new Error('Invalid backup file');
      const collections = ['customers', 'products', 'invoices'];
      if (collections.some(key => data[key] !== undefined && !Array.isArray(data[key]))) {
        throw new Error('Invalid collection in backup file');
      }

      if (Cloud.user) return await Cloud.importBackup(data);

      const keys = ['customers', 'products', 'invoices', 'settings'];
      keys.forEach(key => {
        if (data[key] !== undefined) {
          this.set(key, data[key]);
        }
      });
      if (data.lastInvoiceNum !== undefined) this.setInvoiceCounter(data.lastInvoiceNum);
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  },

  // Get storage size info
  getStorageInfo() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16
      }
    }
    return {
      usedBytes: total,
      usedMB: (total / 1024 / 1024).toFixed(2),
      maxMB: '5-10' // typical localStorage limit
    };
  },

  isAvailable() {
    try {
      const key = this.PREFIX + '__healthcheck';
      localStorage.setItem(key, 'ok');
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
};
