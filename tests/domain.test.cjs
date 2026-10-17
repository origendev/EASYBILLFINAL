const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../js/domain.js');

test('tracked products cannot sell beyond zero stock; untracked services can sell', () => {
  const products = {
    tracked: { id: 'tracked', name: 'Milk', stock: 0, trackStock: true, unit: 'pcs' },
    service: { id: 'service', name: 'Service', stock: 0, trackStock: false, price: 100, gstRate: 0 },
    legacy: { id: 'legacy', name: 'Legacy item', stock: 2, trackStock: false }
  };
  assert.equal(Domain.validateCart([{ productId: 'tracked', quantity: 1 }], id => products[id]).valid, false);
  assert.equal(Domain.validateCart([{ productId: 'service', quantity: 1 }], id => products[id]).valid, true);
  assert.equal(Domain.validateCart([{ productId: 'legacy', quantity: 3 }], id => products[id]).valid, false);
});

test('cart rejects missing products and invalid quantities', () => {
  assert.equal(Domain.validateCart([{ productId: 'missing', quantity: 1 }], () => null).valid, false);
  assert.equal(Domain.validateCart([{ productId: 'p', quantity: 0 }], () => ({ id: 'p', name: 'Item' })).valid, false);
});

test('invoice math rounds line tax and totals to cents', () => {
  const items = Domain.buildInvoiceItems([
    { product: { id: 'a', name: 'A', price: 10.01, gstRate: 5 }, quantity: 3 },
    { product: { id: 'b', name: 'B', price: 20, gstRate: 0 }, quantity: 1 }
  ]);
  assert.equal(items[0].taxableAmount, 30.03);
  assert.equal(items[0].gstAmount, 1.5);
  assert.deepEqual(Domain.calculateTotals(items), { subtotal: 50.03, tax: 1.5, grandTotal: 51.53 });
});

test('invoice builder rejects invalid prices and GST rates', () => {
  assert.throws(() => Domain.buildInvoiceItems([{ product: { id: 'a', name: 'A', price: -1, gstRate: 0 }, quantity: 1 }]));
  assert.throws(() => Domain.buildInvoiceItems([{ product: { id: 'a', name: 'A', price: 1, gstRate: 101 }, quantity: 1 }]));
});

test('backup validator rejects malformed collections and accepts a valid backup', () => {
  assert.equal(Domain.validateBackup({ version: '1.0', products: {} }).valid, false);
  assert.equal(Domain.validateBackup({ version: '1.0', customers: [], products: [], invoices: [], settings: {}, lastInvoiceNum: 0 }).valid, true);
});

test('split payment allocations must equal total within one cent', () => {
  assert.equal(Domain.validatePayments([{method:'cash',amount:20},{method:'upi',amount:31.53}],51.53).valid, true);
  assert.equal(Domain.validatePayments([{method:'cash',amount:20},{method:'upi',amount:31}],51.53).valid, false);
  assert.equal(Domain.validatePayments([{method:'cash',amount:-1}],-1).valid, false);
  assert.equal(Domain.validatePayments([],10).valid, false);
});

test('return quantity cannot exceed remaining sold quantity', () => {
  assert.deepEqual(Domain.validateReturnQuantity(5,2,3), {valid:true,remaining:0,message:''});
  assert.equal(Domain.validateReturnQuantity(5,2,4).valid, false);
  assert.equal(Domain.validateReturnQuantity(5,0,0).valid, false);
});


test('loyalty redemption respects balance, minimum and bill value', () => {
  assert.deepEqual(Domain.validateLoyaltyRedemption(20,50,0.5,10,100), {valid:true,value:10,message:''});
  assert.equal(Domain.validateLoyaltyRedemption(5,50,0.5,10,100).valid, false);
  assert.equal(Domain.validateLoyaltyRedemption(60,50,0.5,10,100).valid, false);
  assert.equal(Domain.validateLoyaltyRedemption(30,50,1,10,20).valid, false);
});
