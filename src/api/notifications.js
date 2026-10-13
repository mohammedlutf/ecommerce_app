import { frappeCall } from './client';
import { Platform } from 'react-native';

/**
 * Push notification integration with the `webshop` Frappe app.
 *
 * Only one backend round trip is needed from the device: register the Expo
 * push token. Delivery itself is performed server-side from the "App Push
 * Notification" campaign doctype — the app never talks to Expo directly.
 */

// Module path of the token doctype inside the `webshop` app. The backend
// resolves the logged-in session itself, so the request does not (and must
// not) send a user identity.
const REGISTER_TOKEN_METHOD =
  'webshop.webshop.doctype.app_device_token.app_device_token.register_token';
const LEGACY_GUEST_TOKEN_METHOD =
  'webshop.webshop.doctype.app_device_token.app_device_token.save_guest_token';

/** "Android" | "iOS" | "Web" — must match the backend select field. */
export function platformName() {
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'web') return 'Web';
  return 'Android';
}

/**
 * Register (or refresh) the device's Expo push token with the backend.
 *
 * The server reads `frappe.session.user` from the request itself: when the app
 * is signed in the token gets bound to the account, otherwise it is registered
 * as a guest token. The app therefore re-calls this every time the auth state
 * changes — that is what makes a guest -> login transition a re-bind of the
 * same device row instead of a second registration.
 *
 * @param {string} expoToken
 * @returns {Promise<{bound_user?: string, is_guest?: number}>}
 */
export async function registerDeviceToken(expoToken) {
  const args = { token: expoToken, platform: platformName() };
  try {
    return await frappeCall(REGISTER_TOKEN_METHOD, args, 'POST');
  } catch (err) {
    // Old backend builds only ship `save_guest_token`. Fall back so the app
    // keeps working until the updated doctype file is deployed.
    // eslint-disable-next-line no-console
    console.warn('[push] register_token unavailable, trying save_guest_token:', err?.message);
    return frappeCall(LEGACY_GUEST_TOKEN_METHOD, { token: expoToken, platform: platformName() });
  }
}

const NotificationsAPI = { registerDeviceToken, platformName };

export default NotificationsAPI;