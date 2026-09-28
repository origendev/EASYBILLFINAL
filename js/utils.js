/* ============================================
   EASYBILL — Utility Helpers
   ============================================ */

const Utils = {
  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // Generate sequential invoice number
  generateInvoiceNumber() {
    const settings = Storage.get('settings') || {};
    const prefix = settings.invoicePrefix || 'EB';
    const lastNum = Storage.getInvoiceCounter();
    const nextNum = lastNum + 1;
    Storage.setInvoiceCounter(nextNum);
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  },

  // Format currency (Indian Rupees)
  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // Format date
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  // Format date for input
  formatDateForInput(dateStr) {
    if (!dateStr) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
    return new Date(dateStr).toISOString().split('T')[0];
  },

  // Get today's date string
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Debounce function
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Escape HTML
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Show toast notification
  toast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '<i data-lucide="check-circle"></i>',
      error: '<i data-lucide="x-circle"></i>',
      warning: '<i data-lucide="alert-triangle"></i>',
      info: '<i data-lucide="info"></i>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type} animate-slide-down`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Re-initialize lucide icons for the new toast
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Show confirm dialog
  confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-dialog');
      overlay.querySelector('.confirm-title').textContent = title;
      overlay.querySelector('.confirm-message').textContent = message;
      overlay.classList.add('active');

      const confirmBtn = overlay.querySelector('.confirm-yes');
      const cancelBtn = overlay.querySelector('.confirm-no');

      const cleanup = () => {
        overlay.classList.remove('active');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  },

  // Number to words for invoice (Indian system)
  numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const intPart = Math.floor(num);
    if (intPart === 0) return 'Zero';

    let words = '';
    if (intPart >= 10000000) {
      words += this.numberToWords(Math.floor(intPart / 10000000)) + ' Crore ';
      num = intPart % 10000000;
    } else { num = intPart; }
    if (num >= 100000) {
      words += this.numberToWords(Math.floor(num / 100000)) + ' Lakh ';
      num = num % 100000;
    }
    if (num >= 1000) {
      words += this.numberToWords(Math.floor(num / 1000)) + ' Thousand ';
      num = num % 1000;
    }
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + ' Hundred ';
      num = num % 100;
    }
    if (num >= 20) {
      words += tens[Math.floor(num / 10)] + ' ';
      num = num % 10;
    }
    if (num > 0) {
      words += ones[num] + ' ';
    }
    return words.trim();
  }
};
