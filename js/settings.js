/* ============================================
   EASYBILL — Settings Module
   ============================================ */

const Settings = {
  render() {
    const settings = Storage.get('settings') || {};
    const storageInfo = Storage.getStorageInfo();

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="animate-fade-in">
        <form id="settings-form" onsubmit="Settings.saveSettings(event)">
          <!-- Business Profile -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <h3 class="card-title">Business Profile</h3>
            </div>
            <div class="card-body">
              <div style="display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;">
                <div>
                  <label class="form-label">Business Logo</label>
                  <div class="logo-upload-area" onclick="document.getElementById('logo-input').click()">
                    ${settings.logo
                      ? `<img src="${Utils.escapeHtml(Cloud.assetUrl(settings.logo))}" alt="Logo">`
                      : `<div class="upload-placeholder">
                          <i data-lucide="image-plus"></i>
                          <span>Upload Logo</span>
                        </div>`
                    }
                  </div>
                  <input type="file" id="logo-input" accept="image/*" style="display: none;"
                    onchange="Settings.handleLogoUpload(this)">
                  ${settings.logo ? `
                    <button type="button" class="btn btn-ghost btn-sm" style="margin-top: 8px; color: var(--danger);"
                      onclick="Settings.removeLogo()">
                      <i data-lucide="trash-2"></i> Remove
                    </button>
                  ` : ''}
                </div>
                <div style="flex: 1; min-width: 300px;">
                  <div class="form-group">
                    <label class="form-label">Business Name <span class="required">*</span></label>
                    <input type="text" class="form-control" name="businessName"
                      placeholder="e.g. ABC Enterprises" value="${Utils.escapeHtml(settings.businessName || '')}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">GSTIN</label>
                    <input type="text" class="form-control" name="gstin"
                      placeholder="e.g. 29ABCDE1234F1Z5" value="${Utils.escapeHtml(settings.gstin || '')}">
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input type="tel" class="form-control" name="phone"
                    placeholder="e.g. +91 9876543210" value="${Utils.escapeHtml(settings.phone || '')}">
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" name="email"
                    placeholder="e.g. info@business.com" value="${Utils.escapeHtml(settings.email || '')}">
                </div>
                <div class="form-group">
                  <label class="form-label">Website</label>
                  <input type="text" class="form-control" name="website"
                    placeholder="e.g. www.business.com" value="${Utils.escapeHtml(settings.website || '')}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Business Address</label>
                <textarea class="form-control" name="address" rows="3"
                  placeholder="Full business address">${Utils.escapeHtml(settings.address || '')}</textarea>
              </div>
            </div>
          </div>

          <!-- Invoice Settings -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <h3 class="card-title">Invoice Settings</h3>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Invoice Prefix</label>
                  <input type="text" class="form-control" name="invoicePrefix"
                    placeholder="e.g. EB" value="${Utils.escapeHtml(settings.invoicePrefix || 'EB')}">
                  <span class="form-hint">Used in invoice numbers like EB-0001</span>
                </div>
                <div class="form-group">
                  <label class="form-label">Next Invoice Number</label>
                  <input type="number" class="form-control" name="nextInvoiceNum" min="1"
                    value="${Storage.getInvoiceCounter() + 1}">
                  <span class="form-hint">The next invoice will use this number</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Default Terms & Conditions</label>
                <textarea class="form-control" name="defaultTerms" rows="3"
                  placeholder="Default terms that appear on every invoice">${Utils.escapeHtml(settings.defaultTerms || 'Payment is due within 30 days of invoice date.')}</textarea>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; margin-bottom: 32px;">
            <button type="submit" class="btn btn-primary btn-lg">
              <i data-lucide="save"></i> Save Settings
            </button>
          </div>
        </form>

        <!-- Data Management -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 class="card-title">Data Management</h3>
          </div>
          <div class="card-body">
            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">
              ${Cloud.user ? 'Local cache used' : 'Storage used'}: <strong>${storageInfo.usedMB} MB</strong>${Cloud.user ? '' : ` (max ~${storageInfo.maxMB} MB)`}
            </p>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
              ${Cloud.user ? 'Business records sync with Supabase. Export a backup regularly to keep an offline copy.' : 'Data is stored locally in this browser. Export a backup regularly to avoid data loss.'}
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button class="btn btn-secondary" onclick="Settings.exportBackup()">
                <i data-lucide="download"></i> Export Backup (JSON)
              </button>
              <button class="btn btn-secondary" onclick="document.getElementById('import-input').click()">
                <i data-lucide="upload"></i> Import Backup
              </button>
              <input type="file" id="import-input" accept=".json" style="display: none;"
                onchange="Settings.importBackup(this)">
              <button class="btn btn-danger" onclick="Settings.clearAllData()">
                <i data-lucide="trash-2"></i> Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  async saveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const currentSettings = Storage.get('settings') || {};

    const data = {
      ...currentSettings,
      businessName: form.businessName.value.trim(),
      gstin: form.gstin.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      website: form.website.value.trim(),
      address: form.address.value.trim(),
      invoicePrefix: form.invoicePrefix.value.trim() || 'EB',
      defaultTerms: form.defaultTerms.value.trim()
    };

    // Update next invoice number
    const nextNum = parseInt(form.nextInvoiceNum.value) || 1;
    Storage.setInvoiceCounter(nextNum - 1);

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      if (Cloud.user) {
        const saved = await Cloud.saveBusinessSettings(data);
        Storage.writeLocal('settings', saved);
      } else {
        Storage.set('settings', data);
      }
      Utils.toast('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Business settings save error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
    } finally {
      if (button) button.disabled = false;
    }
  },

  async handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Utils.toast('Please select an image file', 'error');
      return;
    }

    if (file.size > 500 * 1024) {
      Utils.toast('Image must be less than 500KB', 'warning');
      return;
    }

    const button = document.querySelector('.logo-upload-area');
    if (button) button.setAttribute('aria-busy', 'true');
    try {
      const logo = Cloud.user
        ? await Products.compressImage(file)
        : await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = event => resolve(event.target.result);
          reader.onerror = () => reject(new Error('Could not read the logo image'));
          reader.readAsDataURL(file);
        });
      const settings = { ...(Storage.get('settings') || {}), logo };
      if (Cloud.user) {
        const saved = await Cloud.saveBusinessSettings(settings);
        Storage.writeLocal('settings', saved);
      } else {
        Storage.set('settings', settings);
      }
      Utils.toast('Logo uploaded!', 'success');
      this.render();
    } catch (error) {
      console.error('Business logo upload error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
    } finally {
      if (button) button.removeAttribute('aria-busy');
    }
  },

  async removeLogo() {
    const settings = Storage.get('settings') || {};
    delete settings.logo;
    try {
      if (Cloud.user) await Cloud.saveBusinessSettings(settings);
      else Storage.set('settings', settings);
      Utils.toast('Logo removed', 'success');
      this.render();
    } catch (error) {
      console.error('Business logo removal error:', error);
      Utils.toast(Cloud.friendlyError(error), 'error');
    }
  },

  async exportBackup() {
    try {
      const data = await Storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `easybill-backup-${Utils.today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Utils.toast('Backup exported successfully!', 'success');
    } catch (error) {
      Utils.toast(error.message || 'Could not create the backup.', 'error');
    }
  },

  importBackup(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const confirmed = await Utils.confirm(
        'Import Backup',
        'This will import data into the current business. Continue?'
      );
      if (!confirmed) return;

      const success = await Storage.importData(e.target.result);
      if (success) {
        Utils.toast('Data imported successfully! Refreshing...', 'success');
        setTimeout(() => {
          App.navigate('dashboard');
          this.render();
        }, 500);
      } else {
        Utils.toast('Failed to import data. Invalid file format.', 'error');
      }
    };
    reader.readAsText(file);
  },

  async clearAllData() {
    const confirmed = await Utils.confirm(
      'Clear All Data',
      'This will permanently delete ALL your data (customers, products, invoices, settings). This cannot be undone!'
    );
    if (confirmed) {
      const confirmAgain = await Utils.confirm(
        'Are you absolutely sure?',
        'All your business data will be lost forever. Export a backup first if needed.'
      );
      if (confirmAgain) {
        try {
          if (Cloud.user) {
            await Cloud.clearBusinessData();
          } else {
            ['customers', 'products', 'invoices', 'settings'].forEach(key => Storage.remove(key));
            Storage.setInvoiceCounter(0);
          }
          Utils.toast('All data cleared', 'info');
          App.navigate('dashboard');
        } catch (error) {
          console.error('Clear business data error:', error);
          Utils.toast(Cloud.friendlyError(error), 'error');
        }
      }
    }
  }
};
