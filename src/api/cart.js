import { frappeCall } from './client';

export const CartAPI = {
  /**
   * Get current cart data
   */
  getCart() {
    return frappeCall('ecommerce.api.cart', {}, 'GET');
  },

  /**
   * Add item to cart
   */
  addToCart(itemCode, qty = 1, uom = null) {
    const args = {
      item_code: itemCode,
      qty: parseFloat(qty) || 1,
    };
    if (uom) args.uom = uom;
    return frappeCall('ecommerce.api.cart', args, 'POST');
  },

  /**
   * Update quantity or UOM for cart line
   */
  updateCartLine(itemCode, qty, uom = null, previousUom = null) {
    const args = {
      item_code: itemCode,
      qty: parseFloat(qty),
    };
    if (uom) args.uom = uom;
    if (previousUom) args.previous_uom = previousUom;
    return frappeCall('ecommerce.api.update_cart_line', args, 'POST');
  },

  /**
   * Remove item from cart
   */
  removeFromCart(itemCode) {
    return frappeCall('ecommerce.api.remove_from_cart', { item_code: itemCode }, 'POST');
  },

  /**
   * Place Cash on Delivery order
   */
  submitOrder({ addressName, phone, notes } = {}) {
    const args = {
      address: addressName,
      phone: phone || '',
      notes: notes || 'Cash on delivery',
    };
    return frappeCall('ecommerce.api.submit_order', args, 'POST');
  },
};

export default CartAPI;