import { frappeCall } from './client';

export const CartAPI = {
  /**
   * Get current cart data
   */
  async getCart() {
    try {
      return await frappeCall('ecommerce.api.cart', {}, 'GET');
    } catch {
      return await frappeCall('ecommerce.api.cart', {}, 'GET');
    }
  },

  /**
   * Add item to cart
   */
  async addToCart(itemCode, qty = 1, uom = null) {
    const args = {
      item_code: itemCode,
      qty: parseFloat(qty) || 1,
    };
    if (uom) args.uom = uom;

    try {
      return await frappeCall('ecommerce.api.cart', args, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.cart', args, 'POST');
    }
  },

  /**
   * Update quantity or UOM for cart line
   */
  async updateCartLine(itemCode, qty, uom = null, previousUom = null) {
    const args = {
      item_code: itemCode,
      qty: parseFloat(qty),
    };
    if (uom) args.uom = uom;
    if (previousUom) args.previous_uom = previousUom;

    try {
      return await frappeCall('ecommerce.api.update_cart_line', args, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.update_cart_line', args, 'POST');
    }
  },

  /**
   * Remove item from cart
   */
  async removeFromCart(itemCode) {
    try {
      return await frappeCall('ecommerce.api.remove_from_cart', { item_code: itemCode }, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.remove_from_cart', { item_code: itemCode }, 'POST');
    }
  },

  /**
   * Place Cash on Delivery order
   */
  async submitOrder({ addressName, phone, notes } = {}) {
    const args = {
      address: addressName,
      phone: phone || '',
      notes: notes || 'Cash on delivery',
    };
    try {
      return await frappeCall('ecommerce.api.submit_order', args, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.submit_order', args, 'POST');
    }
  },
};

export default CartAPI;
