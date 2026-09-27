/**
 * Single source of truth for AsyncStorage keys that more than one module needs.
 *
 * The session cookie (owned by src/api/frappe.js) and the cached profile (owned
 * by src/context/AuthContext.js) must be cleared together, so their keys live
 * here rather than being spelled out twice.
 */
export const USER_STORAGE_KEY = '@ecommerce_user_profile';
