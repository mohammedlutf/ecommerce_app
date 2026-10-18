import { frappeCall } from './client';

/**
 * Vendor (shop-owner) API.
 *
 * Every endpoint here is scoped server-side to the signed-in user's own
 * `Marketplace Shop`. No call in this file sends a shop name, because the
 * backend resolves ownership from the session — the app never gets to say
 * "operate on shop X". Hiding a screen is a convenience; the server is the
 * control.
 *
 * Complex arguments (UOM rows, recommended items, the logo payload) are
 * `JSON.stringify`d for the same reason as in `admin_api`: Frappe invokes
 * whitelisted methods as `fn(**frappe.form_dict)`, so a nested structure's shape
 * depends on the parser in front of it. A string is one value and cannot arrive
 * half-parsed.
 */

function normalizePaged(data, key, fallbackLength) {
  if (Array.isArray(data)) {
    return { [key]: data, total: data.length, hasMore: false };
  }
  const rows = Array.isArray(data?.[key]) ? data[key] : [];
  const reportedTotal = Number(data?.total);
  const total = Number.isFinite(reportedTotal) && reportedTotal >= 0 ? reportedTotal : rows.length;
  const hasMore =
    typeof data?.has_more === 'boolean'
      ? data.has_more
      : rows.length > 0 && rows.length + (Number(data?.start) || 0) < total;
  return { [key]: rows, total, hasMore, start: Number(data?.start) || 0, pageLength: fallbackLength };
}

export const VendorAPI = {
  /**
   * Capability probe: what is this account on the marketplace?
   *
   * Never throws. A reachable-but-empty answer and an unreachable server both
   * mean "not a vendor", which is the safe default — the worst case is that the
   * vendor entry stays hidden until the next refresh.
   */
  async getState() {
    try {
      const res = await frappeCall('webshop.my_api.vendor_api.vendor_state', {}, 'GET');
      return (
        res || {
          is_vendor: false,
          status: null,
          shop: null,
          application: null,
        }
      );
    } catch {
      return { is_vendor: false, status: null, shop: null, application: null };
    }
  },

  // --- Onboarding ---------------------------------------------------------

  applyForShop({ shopName, phone, description }) {
    return frappeCall(
      'webshop.my_api.vendor_api.apply_for_shop',
      {
        shop_name: shopName,
        phone,
        description: description || '',
      },
      'POST'
    );
  },

  cancelApplication() {
    return frappeCall('webshop.my_api.vendor_api.cancel_application', {}, 'POST');
  },

  // --- Shop profile -------------------------------------------------------

  /**
   * Edit the shop's own presentation and payout details.
   *
   * Only keys present in `changes` are sent; the backend treats each as
   * optional. Commission rate, status, supplier and owner are deliberately not
   * editable here, so there is nothing to pass for them.
   */
  updateShop(changes = {}) {
    const args = {};
    const passthrough = [
      'description',
      'delivery_rate',
      'bank_name',
      'account_holder',
      'account_number',
      'shop_name',
    ];
    for (const field of passthrough) {
      if (Object.prototype.hasOwnProperty.call(changes, field)) args[field] = changes[field];
    }
    if (changes.logoBase64) {
      args.logo_base64 = changes.logoBase64;
      args.logo_name = changes.logoName || 'shop-logo.jpg';
    }
    return frappeCall('webshop.my_api.vendor_api.shop_update', args, 'POST');
  },

  // --- Orders -------------------------------------------------------------

  async getOrders({ start = 0, pageSize = 12, vendorStatus = null } = {}) {
    const args = { start: Math.max(0, parseInt(start, 10) || 0), page_length: parseInt(pageSize, 10) || 12 };
    if (vendorStatus && vendorStatus !== 'All') args.vendor_status = vendorStatus;
    const data = await frappeCall('webshop.my_api.vendor_api.vendor_orders', args, 'GET');
    return normalizePaged(data, 'orders', pageSize);
  },

  getOrder(orderName) {
    return frappeCall('webshop.my_api.vendor_api.vendor_order', { order_name: orderName }, 'GET');
  },

  updateOrderStatus(orderName, vendorStatus) {
    return frappeCall(
      'webshop.my_api.vendor_api.vendor_update_order_status',
      { order_name: orderName, vendor_status: vendorStatus },
      'POST'
    );
  },

  // --- Dashboard ----------------------------------------------------------

  getDashboard(days = 30) {
    return frappeCall('webshop.my_api.vendor_api.vendor_dashboard', { days }, 'GET');
  },

  // --- Products -----------------------------------------------------------

  getReferenceData() {
    return frappeCall('webshop.my_api.vendor_api.vendor_reference_data', {}, 'GET');
  },

  async getProducts({ start = 0, pageSize = 20, search = null } = {}) {
    const args = {
      start: Math.max(0, parseInt(start, 10) || 0),
      page_length: parseInt(pageSize, 10) || 20,
    };
    const term = String(search || '').trim();
    if (term) args.search = term;
    const data = await frappeCall('webshop.my_api.vendor_api.vendor_products', args, 'GET');
    return normalizePaged(data, 'items', pageSize);
  },

  getProductPayload(itemCode) {
    return frappeCall(
      'webshop.my_api.vendor_api.vendor_product_payload',
      { item_code: itemCode },
      'GET'
    );
  },

  createProduct(data = {}) {
    const args = {
      item_code: data.itemCode,
      item_name: data.itemName,
      item_group: data.itemGroup,
      stock_uom: data.stockUom,
      short_description: data.shortDescription || '',
      web_long_description: data.webLongDescription || '',
      ranking: data.ranking || 0,
      price_list_rate: data.priceListRate,
      website_warehouse: data.websiteWarehouse || '',
      published: data.published === false ? 0 : 1,
    };
    if (data.uoms) args.uoms_json = JSON.stringify(data.uoms);
    if (data.recommended) args.recommended_json = JSON.stringify(data.recommended);
    if (data.imageBase64) {
      args.image_base64 = data.imageBase64;
      args.image_name = data.imageName || 'product.jpg';
    }
    return frappeCall('webshop.my_api.vendor_api.vendor_create_product', args, 'POST');
  },

  updateProduct(itemCode, changes = {}) {
    const args = { item_code: itemCode };
    if (Object.prototype.hasOwnProperty.call(changes, 'item_name')) args.item_name = changes.item_name;
    if (Object.prototype.hasOwnProperty.call(changes, 'item_group')) args.item_group = changes.item_group;
    if (Object.prototype.hasOwnProperty.call(changes, 'short_description')) args.short_description = changes.short_description;
    if (Object.prototype.hasOwnProperty.call(changes, 'web_long_description')) args.web_long_description = changes.web_long_description;
    if (Object.prototype.hasOwnProperty.call(changes, 'ranking')) args.ranking = changes.ranking;
    if (Object.prototype.hasOwnProperty.call(changes, 'published')) args.published = changes.published;
    if (Object.prototype.hasOwnProperty.call(changes, 'uoms')) args.uoms_json = JSON.stringify(changes.uoms);
    if (Object.prototype.hasOwnProperty.call(changes, 'recommended')) args.recommended_json = JSON.stringify(changes.recommended);
    if (changes.imageBase64) {
      args.image_base64 = changes.imageBase64;
      args.image_name = changes.imageName || 'product.jpg';
    }
    return frappeCall('webshop.my_api.vendor_api.vendor_update_product', args, 'POST');
  },

  // --- Payouts ------------------------------------------------------------

  async getPayouts({ start = 0, pageSize = 12 } = {}) {
    const data = await frappeCall(
      'webshop.my_api.vendor_api.vendor_payouts',
      { start: Math.max(0, parseInt(start, 10) || 0), page_length: parseInt(pageSize, 10) || 12 },
      'GET'
    );
    return normalizePaged(data, 'payouts', pageSize);
  },

  getPayoutPayload(name) {
    return frappeCall('webshop.my_api.vendor_api.vendor_payout_payload', { name }, 'GET');
  },
};

export default VendorAPI;
