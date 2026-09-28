/* ============================================
   EASYBILL — Main App Controller
   ============================================ */

const App = {
  currentView: 'dashboard',

  init() {
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash, null, false);
    });

    window.addEventListener('focus', async () => {
      if (!Cloud.user || !Cloud.businessId || !Cloud.ready) return;
      try {
        await Cloud.loadBusinessData();
        this.navigate(this.currentView, null, false);
      } catch (error) {
        console.error('Could not refresh business data:', error);
        Cloud.setStatus('error');
        Utils.toast(Cloud.friendlyError(error), 'error');
      }
    });

    // Mobile menu toggle
    const toggle = document.getElementById('mobile-menu-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('mobile-menu-toggle');
      if (sidebar && sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Close modal on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('active');
      }
    });

    document.getElementById('command-center').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeCommandCenter();
    });

    // Close confirm dialog on overlay click
    document.getElementById('confirm-dialog').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('active');
        const cancelBtn = e.currentTarget.querySelector('.confirm-no');
        if (cancelBtn) cancelBtn.click();
      }
    });

    // Keyboard shortcuts keep frequent actions close at hand.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCommandCenter();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.showCommandCenter();
      }
    });

    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();

    Cloud.initialize().then(authenticated => {
      Cloud.updateAccountAction();
      if (Cloud.configured && !authenticated) {
        Cloud.showAuth();
        return;
      }
      if (Cloud.configured && Cloud.needsBusiness) {
        Cloud.showBusinessSetup();
        return;
      }
      this.startApplication();
    }).catch(error => {
      console.error('EasyBill cloud startup error:', error);
      Cloud.updateAccountAction();
      Cloud.showAuth(Cloud.friendlyError(error));
    });
  },

  startApplication() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);
    this.updateStorageStatus();
  },

  updateStorageStatus() {
    const status = document.getElementById('storage-status');
    if (!status) return;
    const ready = Storage.isAvailable();
    const labels = {
      syncing: 'Syncing cloud data...',
      synced: 'Cloud data synced',
      error: 'Cloud sync issue',
      'signed-out': 'Sign-in required'
    };
    const label = Cloud.configured ? (labels[Cloud.status] || 'Cloud data ready') : 'Local data ready';
    status.classList.toggle('is-warning', !ready || (Cloud.configured && Cloud.status === 'error'));
    status.querySelector('span:last-child').textContent = ready ? label : 'Storage unavailable';
  },

  showCommandCenter() {
    const overlay = document.getElementById('command-center');
    if (!overlay) return;
    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();
  },

  closeCommandCenter() {
    const overlay = document.getElementById('command-center');
    if (overlay) overlay.classList.remove('active');
  },

  command(view) {
    this.closeCommandCenter();
    this.navigate(view);
  },

  navigate(view, param = null, updateHash = true) {
    // Parse view:param from hash if needed (e.g. "new-invoice:abc123")
    if (view.includes(':')) {
      const parts = view.split(':');
      view = parts[0];
      param = parts[1];
    }

    if (this.currentView === 'pos' && view !== 'pos' && window.POS) POS.stopScanner();
    this.currentView = view;

    // Update hash
    if (updateHash) {
      const hash = param ? `${view}:${param}` : view;
      window.location.hash = hash;
    }

    // Update page header
    this.updateHeader(view);

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Render view
    switch (view) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'customers':
        Customers.render();
        break;
      case 'products':
        Products.render();
        break;
      case 'pos':
        POS.render();
        break;
      case 'stocks':
        Stocks.render();
        break;
      case 'new-invoice':
        Invoices.currentItems = [];
        Invoices.render(param || null);
        break;
      case 'invoices':
        InvoiceList.render();
        break;
      case 'settings':
        Settings.render();
        break;
      default:
        Dashboard.render();
    }
    this.updateStorageStatus();
  },

  updateHeader(view) {
    const titles = {
      'dashboard': { title: 'Dashboard', subtitle: 'Overview of your business' },
      'pos': { title: 'Point of Sale', subtitle: 'Scan products and complete a sale' },
      'customers': { title: 'Customers', subtitle: 'Manage your customer database' },
      'products': { title: 'Products & Services', subtitle: 'Manage your product catalog' },
      'stocks': { title: 'Stocks', subtitle: 'Monitor product quantities and low-stock alerts' },
      'new-invoice': { title: 'Create Invoice', subtitle: 'Create a new invoice for your customer' },
      'invoices': { title: 'Invoice History', subtitle: 'View and manage all your invoices' },
      'settings': { title: 'Settings', subtitle: 'Configure your business profile and preferences' }
    };

    const info = titles[view] || titles['dashboard'];
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    if (titleEl) titleEl.textContent = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;
  }
};

// Boot up when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
