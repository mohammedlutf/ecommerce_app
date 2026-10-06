import { frappeCall } from './client';

export const CartAPI = {
  /**
   * Get current cart data
   */
  getCart() {
    return frappeCall('webshop.my_api.api.cart', {}, 'GET');
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
    return frappeCall('webshop.my_api.api.cart', args, 'POST');
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
    return frappeCall('webshop.my_api.api.update_cart_line', args, 'POST');
  },

  /**
   * Remove a single cart line. The same item_code can appear as multiple lines
   * under different UOMs, so uom is required to target exactly one line.
   */
  removeFromCart(itemCode, uom = null) {
    const args = { item_code: itemCode };
    if (uom) args.uom = uom;
    return frappeCall('webshop.my_api.api.remove_from_cart', args, 'POST');
  },

  /**
   * Delivery charge for an address, resolved by the server.
   *
   * The price lives in two places — `Address.delivery_rate_charges` per address,
   * and `Webshop Settings.default_delivery_rate` as the fallback — and the rule
   * for which one wins must not be duplicated on the client, or the price shown
   * at checkout can drift from the price actually charged. The server owns the
   * resolution; the app only displays what it is told.
   *
   * @param {string|null} addressName the selected Address, or null for none
   */
  getDeliveryEstimate(addressName) {
    const args = addressName ? { address: addressName } : {};
    return frappeCall('webshop.my_api.api.delivery_estimate', args, 'GET');
  },

  /**
   * Place Cash on Delivery order
   *
   * The delivery figures are sent so the order payload is explicit and the
   * confirmation screen can show what the shopper was quoted. They are advisory
   * only: `submit_order` recomputes them server-side, because a client-supplied
   * amount is not evidence of what the customer owes.
   */
  submitOrder({ addressName, phone, notes, deliveryCharges, shippingAccount } = {}) {
    const args = {
      address: addressName,
      phone: phone || '',
      notes: notes || 'Cash on delivery',
      delivery_charges: deliveryCharges === undefined || deliveryCharges === null ? 0 : deliveryCharges,
      shipping_account: shippingAccount || '',
    };
    return frappeCall('webshop.my_api.api.submit_order', args, 'POST');
  },
};

export default CartAPI;