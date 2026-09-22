import { frappeCall } from './client';

export const OrdersAPI = {
  /**
   * Fetch order history for current customer
   */
  async getOrders() {
    try {
      return await frappeCall('ecommerce.api.orders', {}, 'GET');
    } catch {
      return await frappeCall('ecommerce.api.orders', {}, 'GET');
    }
  },

  /**
   * Cancel open sales order
   */
  async cancelOrder(orderName) {
    try {
      return await frappeCall('ecommerce.api.cancel_order', { order_name: orderName }, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.cancel_order', { order_name: orderName }, 'POST');
    }
  },

  /**
   * Reorder items from past sales order into cart
   */
  async reorderOrder(orderName) {
    try {
      return await frappeCall('ecommerce.api.reorder_order', { order_name: orderName }, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.reorder_order', { order_name: orderName }, 'POST');
    }
  },
};

export default OrdersAPI;
