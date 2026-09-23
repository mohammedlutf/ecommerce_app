import { frappeCall } from './client';

export const OrdersAPI = {
  /**
   * Fetch order history for current customer
   */
  getOrders() {
    return frappeCall('ecommerce.api.orders', {}, 'GET');
  },

  /**
   * Cancel open sales order
   */
  cancelOrder(orderName) {
    return frappeCall('ecommerce.api.cancel_order', { order_name: orderName }, 'POST');
  },

  /**
   * Reorder items from past sales order into cart
   */
  reorderOrder(orderName) {
    return frappeCall('ecommerce.api.reorder_order', { order_name: orderName }, 'POST');
  },
};

export default OrdersAPI;