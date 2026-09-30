import { frappeCall } from './client';

/**
 * Catalogue administration API.
 *
 * Every call here is authorised server-side by `admin_users` in Webshop
 * Settings. Nothing in this file decides who is an admin, and no argument sent
 * from here influences permissions — the app hiding a button is a convenience,
 * not a control, and the backend enforces the real thing.
 *
 * Complex arguments are `JSON.stringify`d rather than sent as nested arrays:
 * Frappe invokes whitelisted methods as `fn(**frappe.form_dict)`, so a nested
 * payload's shape depends on the parser in front of it. A string is one value
 * and cannot arrive half-parsed.
 */
export const AdminAPI = {
  /** Capability probe. Never throws — the UI uses it to hide admin controls. */
  async isAdmin() {
    try {
      const res = await frappeCall('ecommerce.admin_api.admin_is_admin', {}, 'GET');
      return !!(res && res.is_admin);
    } catch {
      // An unreachable server must not strand a shopper on a broken screen; the
      // worst case is that admin buttons stay hidden until the next refresh.
      return false;
    }
  },

  /** Item groups, UOMs and warehouses, for the create-product form. */
  async getReferenceData() {
    return frappeCall('ecommerce.admin_api.admin_reference_data', {}, 'GET');
  },

  /** Everything the editor needs for one product. */
  async getItemPayload(itemCode) {
    return frappeCall(
      'ecommerce.admin_api.admin_item_payload',
      { item_code: itemCode },
      'GET'
    );
  },

  /**
   * Apply an edit.
   *
   * Only keys present in `changes` are sent, and the backend treats each one as
   * optional. Sending every field unconditionally would let a stale editor form
   * overwrite a value another admin changed in the meantime.
   */
  async updateItem(itemCode, changes = {}) {
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

    return frappeCall('ecommerce.admin_api.admin_update_item', args, 'POST');
  },

  /** Create a product across Item, Item Price and Website Item. */
  async createItem(data = {}) {
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
    return frappeCall('ecommerce.admin_api.admin_create_item', args, 'POST');
  },
};

export default AdminAPI;
