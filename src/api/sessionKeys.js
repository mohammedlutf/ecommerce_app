/**
 * Single source of truth for AsyncStorage keys that more than one module needs.
 *
 * The session cookie (owned by src/api/frappe.js) and the cached profile (owned
 * by src/context/AuthContext.js) must be cleared together, so their keys live
 * here rather than being spelled out twice.
 */
export const USER_STORAGE_KEY = '@ecommerce_user_profile';

/**
 * First-launch onboarding gate (native only).
 *
 * Written with `'1'` once the shopper has either registered or dismissed the
 * welcome flow, so it never reappears. The web build never reads it: the SEO
 * site must always land on the store, never a mobile-style onboarding.
 */
export const ONBOARDING_STORAGE_KEY = '@ecommerce_onboarding_seen';
