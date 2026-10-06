import { frappeCall } from './client';

export const ORDERS_PAGE_SIZE = 7;

/**
 * Normalize the orders response so callers always get
 * `{ orders, total, hasMore }`.
 *
 * The endpoint used to return a bare array of orders with a hard-coded cap of
 * 50 and no way to know the real total. The paginated version returns
 * `{ orders, total, start, page_length, has_more }`. Supporting both shapes lets
 * the app ship before the backend change lands (and keep working if the backend
 * is rolled back) — pagination then simply degrades to "everything loaded".
 */
function normalizeOrdersResponse(data) {
  if (Array.isArray(data)) {
    return { orders: data, total: data.length, hasMore: false };
  }

  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const reportedTotal = Number(data?.total);
  const total =
    Number.isFinite(reportedTotal) && reportedTotal >= 0 ? reportedTotal : orders.length;

  // Trust the server's `has_more` when present, otherwise infer it from the
  // total so an older paginated response without the flag still pages correctly.
  const hasMore =
    typeof data?.has_more === 'boolean'
      ? data.has_more
      : orders.length > 0 && orders.length + (Number(data?.start) || 0) < total;

  return { orders, total, hasMore };
}

export const OrdersAPI = {
  /**
   * Fetch one page of order history for the current customer, newest first.
   *
   * @param {object}  options
   * @param {number}  options.start    Offset of the first order to return.
   * @param {number}  options.pageSize Orders per page.
   * @returns {Promise<{orders: Array, total: number, hasMore: boolean}>}
   */
  getOrders({ start = 0, pageSize = ORDERS_PAGE_SIZE } = {}) {
    return frappeCall(
      'webshop.my_api.api.orders',
      { start: Math.max(0, parseInt(start, 10) || 0), page_length: parseInt(pageSize, 10) || ORDERS_PAGE_SIZE },
      'GET'
    ).then(normalizeOrdersResponse);
  },

  /**
   * Cancel open sales order
   */
  cancelOrder(orderName) {
    return frappeCall('webshop.my_api.api.cancel_order', { order_name: orderName }, 'POST');
  },

  /**
   * Reorder items from past sales order into cart
   */
  reorderOrder(orderName) {
    return frappeCall('webshop.my_api.api.reorder_order', { order_name: orderName }, 'POST');
  },
};

export default OrdersAPI;
