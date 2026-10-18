import { frappeCall } from './client';

/**
 * Guest storefront reads for the marketplace.
 *
 * Both endpoints are public: the directory of approved shops and one shop's
 * profile with a page of its products. Nothing here is authorized and nothing
 * here can mutate, so failure degrades to an empty list rather than an error —
 * a shopper browsing the storefront must not see a shop directory break the
 * page it is embedded in.
 */
export const MarketplaceAPI = {
  /** Approved vendor shops with live product counts. Never throws. */
  async getShops({ start = 0, limit = 24 } = {}) {
    try {
      const rows = await frappeCall(
        'webshop.my_api.marketplace.shops',
        { start: Math.max(0, parseInt(start, 10) || 0), limit: parseInt(limit, 10) || 24 },
        'GET'
      );
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  },

  /**
   * One shop's profile plus a page of its products.
   *
   * `search` narrows the page to this shop's own matches. The term is sent to
   * the server (rather than filtering the rows already downloaded) because a
   * shop's catalogue can be larger than one page — and because the shop filter
   * travels with it, so a term can never surface another vendor's products.
   * The response carries both counts: `total` (the shop's live product count)
   * and `count` (how many matched the term).
   */
  getShop(name, { start = 0, limit = 24, search = null } = {}) {
    const args = {
      name,
      start: Math.max(0, parseInt(start, 10) || 0),
      limit: parseInt(limit, 10) || 24,
    };
    const term = String(search || '').trim();
    if (term) args.search = term;
    return frappeCall('webshop.my_api.marketplace.shop', args, 'GET');
  },
};

/**
 * Marketplace administration: shops, applications and payouts.
 *
 * Every call is gated server-side by the same `admin_users` check as the
 * catalogue admin. `MarketplaceAdminAPI` is a separate export from
 * `AdminAPI` on purpose: the two are wired into different screens, and keeping
 * them apart means a vendor screen cannot accidentally import an admin call.
 *
 * List endpoints are schema-tolerant server-side and return empty results when
 * the marketplace tables have not been migrated in yet, so the panel shows an
 * empty list rather than a 500.
 */
export const MarketplaceAdminAPI = {
  // --- Shops --------------------------------------------------------------

  listShops({ status = null, search = null, start = 0, limit = 20 } = {}) {
    const args = { start: Math.max(0, parseInt(start, 10) || 0), limit: parseInt(limit, 10) || 20 };
    if (status && status !== 'All') args.status = status;
    if (search) args.search = search;
    return frappeCall('webshop.my_api.marketplace_admin.admin_list_shops', args, 'GET');
  },

  getShop(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_shop', { name }, 'GET');
  },

  updateShop(name, payload = {}) {
    return frappeCall(
      'webshop.my_api.marketplace_admin.admin_shop_update',
      { name, payload: JSON.stringify(payload) },
      'POST'
    );
  },

  approveShop(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_approve_shop', { name }, 'POST');
  },

  suspendShop(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_suspend_shop', { name }, 'POST');
  },

  reinstateShop(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_reinstate_shop', { name }, 'POST');
  },

  // --- Applications -------------------------------------------------------

  listApplications({ status = 'Pending', start = 0, limit = 20 } = {}) {
    const args = { start: Math.max(0, parseInt(start, 10) || 0), limit: parseInt(limit, 10) || 20 };
    if (status && status !== 'All') args.status = status;
    return frappeCall('webshop.my_api.marketplace_admin.admin_list_applications', args, 'GET');
  },

  getApplication(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_application', { name }, 'GET');
  },

  approveApplication(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_approve_application', { name }, 'POST');
  },

  rejectApplication(name, reason = null) {
    const args = { name };
    if (reason) args.reason = reason;
    return frappeCall('webshop.my_api.marketplace_admin.admin_reject_application', args, 'POST');
  },

  // --- Payouts ------------------------------------------------------------

  listPayouts({ status = null, shop = null, start = 0, limit = 20 } = {}) {
    const args = { start: Math.max(0, parseInt(start, 10) || 0), limit: parseInt(limit, 10) || 20 };
    if (status && status !== 'All') args.status = status;
    if (shop) args.shop = shop;
    return frappeCall('webshop.my_api.marketplace_admin.admin_list_payouts', args, 'GET');
  },

  getPayout(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_payout', { name }, 'GET');
  },

  getEligibleOrders(shop, fromDate, toDate) {
    return frappeCall(
      'webshop.my_api.marketplace_admin.admin_payout_eligible_orders',
      { shop, from_date: fromDate, to_date: toDate },
      'GET'
    );
  },

  createPayout(shop, fromDate, toDate, salesOrders = null) {
    const args = { shop, from_date: fromDate, to_date: toDate };
    if (salesOrders && salesOrders.length) args.sales_orders = JSON.stringify(salesOrders);
    return frappeCall('webshop.my_api.marketplace_admin.admin_create_payout', args, 'POST');
  },

  submitPayout(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_submit_payout', { name }, 'POST');
  },

  cancelPayout(name) {
    return frappeCall('webshop.my_api.marketplace_admin.admin_cancel_payout', { name }, 'POST');
  },

  markPayoutPaid(name, paymentReference = null) {
    const args = { name };
    if (paymentReference) args.payment_reference = paymentReference;
    return frappeCall('webshop.my_api.marketplace_admin.admin_mark_payout_paid', args, 'POST');
  },
};

export default MarketplaceAPI;
