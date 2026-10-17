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

/**
 * Cached native push token (1 per physical device).
 *
 * This is the platform token from `expo-notifications`'
 * `getDevicePushTokenAsync()` — an FCM registration token on Android, an APNs
 * device token on iOS. It is not an Expo push token, and is what the backend
 * sends through the FCM HTTP v1 API.
 *
 * Device tokens are stable for the app install, so caching avoids asking the OS
 * again on every launch and keeps the token available for a re-registration the
 * moment the user logs in, even without a network round trip at startup. The
 * key changed from the old Expo-token key so an upgraded install never reuses a
 * stale `ExponentPushToken[...]` value.
 */
export const DEVICE_TOKEN_STORAGE_KEY = '@ecommerce_device_push_token';

/**
 * In-app notifications inbox (received push history).
 *
 * Stored on-device: `App Push Notification` is a campaign record on the server,
 * there is no per-user read state for it, and the inbox has to work for guests
 * (no account to hang server-side state off of) as well as signed-in users.
 */
export const NOTIFICATIONS_INBOX_KEY = '@ecommerce_notifications_inbox';
