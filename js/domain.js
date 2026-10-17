/* ============================================
   EASYBILL — Shared business rules
   Kept dependency-free so the same rules can be tested in Node and used in the UI.
   ============================================ */
(function (root) {
  'use strict';

  const Domain = {
    isStockTracked(product) {
      // Explicitly tracked zero-stock items must be blocked; positive-stock legacy items stay tracked.
      return Boolean(product && (product.trackStock === true || Number(product.stock) > 0));
    },

    validateCart(cart, getProduct) {
      if (!Array.isArray(cart) || cart.length === 0) return { valid: false, message: 'Add at least one item before checkout.' };
      for (const entry of cart) {
        const product = getProduct(entry?.productId);
        if (!product) return { valid: false, message: 'A product in this sale is no longer in your catalog.' };
        const quantity = Number(entry.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return { valid: false, message: `Invalid quantity for ${product.name || 'a product'}.` };
        if (this.isStockTracked(product) && quantity > Number(product.stock || 0)) {
          return { valid: false, message: `${product.name || 'Product'} has only ${Number(product.stock || 0)} ${product.unit || 'units'} left.` };
        }
      }
      return { valid: true, message: '' };
    },

    buildInvoiceItems(items) {
      if (!Array.isArray(items)) throw new TypeError('Invoice items must be a list.');
      return items.map(({ product, quantity }) => {
        const qty = Number(quantity);
        const rate = Number(product?.price);
        const gstRate = Number(product?.gstRate) || 0;
        if (!product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
          throw new Error(`Invalid price, quantity, or GST rate for ${product?.name || 'a product'}.`);
        }
        const taxableAmount = Math.round((rate * qty + Number.EPSILON) * 100) / 100;
        const gstAmount = Math.round((taxableAmount * gstRate / 100 + Number.EPSILON) * 100) / 100;
        return {
          productId: product.id, name: product.name, hsn: product.hsn || '', quantity: qty,
          rate, discount: 0, discountType: 'percent', gstRate, taxableAmount, gstAmount,
          discountAmount: 0, amount: Math.round((taxableAmount + gstAmount + Number.EPSILON) * 100) / 100
        };
      });
    },

    calculateTotals(items) {
      const totals = items.reduce((result, item) => {
        result.subtotal += Number(item.taxableAmount) || 0;
        result.tax += Number(item.gstAmount) || 0;
        result.grandTotal += Number(item.amount) || 0;
        return result;
      }, { subtotal: 0, tax: 0, grandTotal: 0 });
      for (const key of Object.keys(totals)) totals[key] = Math.round((totals[key] + Number.EPSILON) * 100) / 100;
      return totals;
    },

    validatePayments(payments, total, tolerance = 0.01) {
      if (!Array.isArray(payments) || payments.length === 0) return { valid: false, message: 'At least one payment allocation is required.' };
      const allowed = new Set(['cash', 'upi', 'card', 'bank_transfer', 'store_credit', 'other']);
      let sum = 0;
      for (const payment of payments) {
        const amount = Number(payment?.amount);
        if (!allowed.has(String(payment?.method || '').toLowerCase()) || !Number.isFinite(amount) || amount < 0) {
          return { valid: false, message: 'Payment methods and amounts must be valid and non-negative.' };
        }
        sum += Math.round((amount + Number.EPSILON) * 100) / 100;
      }
      const expected = Math.round((Number(total) + Number.EPSILON) * 100) / 100;
      const allocated = Math.round((sum + Number.EPSILON) * 100) / 100;
      return Math.abs(allocated - expected) <= tolerance
        ? { valid: true, total: allocated, message: '' }
        : { valid: false, total: allocated, message: `Payment allocations (${allocated.toFixed(2)}) must equal the bill total (${expected.toFixed(2)}).` };
    },

    validateLoyaltyRedemption(points, balance, pointValue, minimumPoints, billTotal) {
      const requested = Number(points), available = Number(balance), value = Number(pointValue), minimum = Number(minimumPoints), total = Number(billTotal);
      if (![requested, available, value, minimum, total].every(Number.isFinite) || requested < 0 || !Number.isInteger(requested) || available < 0 || value < 0 || minimum < 0 || total < 0) {
        return { valid: false, value: 0, message: 'Loyalty redemption values are invalid.' };
      }
      const redemptionValue = Math.round((requested * value + Number.EPSILON) * 100) / 100;
      if (requested === 0) return { valid: true, value: 0, message: '' };
      if (requested < minimum) return { valid: false, value: redemptionValue, message: `Redeem at least ${minimum} points.` };
      if (requested > available) return { valid: false, value: redemptionValue, message: `Only ${available} loyalty points are available.` };
      if (redemptionValue > total + 0.01) return { valid: false, value: redemptionValue, message: 'Loyalty redemption cannot exceed the bill total.' };
      return { valid: true, value: redemptionValue, message: '' };
    },

    validateReturnQuantity(soldQuantity, previouslyReturned, requestedQuantity) {
      const sold = Number(soldQuantity), previous = Number(previouslyReturned), requested = Number(requestedQuantity);
      if (![sold, previous, requested].every(Number.isFinite) || sold <= 0 || previous < 0 || requested <= 0) return { valid: false, remaining: Math.max(0, sold - previous), message: 'Return quantity must be greater than zero and valid.' };
      const remaining = Math.max(0, sold - previous);
      if (requested > remaining + 1e-9) return { valid: false, remaining, message: `Only ${remaining} unit(s) remain eligible for return.` };
      return { valid: true, remaining: remaining - requested, message: '' };
    },

    validateBackup(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.version) return { valid: false, message: 'Invalid backup file: version metadata is missing.' };
      for (const key of ['customers', 'products', 'invoices']) {
        if (data[key] !== undefined && !Array.isArray(data[key])) return { valid: false, message: `Invalid backup file: ${key} must be a list.` };
      }
      if (data.settings !== undefined && (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))) {
        return { valid: false, message: 'Invalid backup file: settings must be an object.' };
      }
      if (data.lastInvoiceNum !== undefined && (!Number.isFinite(Number(data.lastInvoiceNum)) || Number(data.lastInvoiceNum) < 0)) {
        return { valid: false, message: 'Invalid backup file: invoice counter must be a non-negative number.' };
      }
      return { valid: true, message: '' };
    }
  };

  root.EasyBillDomain = Domain;
  if (typeof module !== 'undefined' && module.exports) module.exports = Domain;
})(typeof globalThis !== 'undefined' ? globalThis : this);
