import {
  getCall,
  initSession,
  saveSessionCookie,
  clearSession as clearSdkSession,
  BASE_URL,
} from './frappe';

/**
 * Compat layer over frappe-js-sdk.
 *
 * Every request in the app is now executed by the official Frappe SDK
 * (`FrappeCall`) — see src/api/frappe.js for the RN-safe adapter and session
 * cookie handling. This module keeps the previous `frappeCall(...)` surface
 * and unwraps Frappe's `{ message }` envelope so the rest of the app (API
 * modules, contexts) keeps working without touching every call site.
 */

/**
 * Initialize the Frappe session cookie from AsyncStorage.
 */
export async function initClientSession() {
  await initSession();
}

/**
 * Persist (or clear) a Frappe session cookie.
 */
export async function setSessionCookie(cookie) {
  await saveSessionCookie(cookie);
}

/**
 * Clear the current session.
 */
export async function clearSession() {
  await clearSdkSession();
}

/**
 * Call a Frappe whitelisted method through the SDK.
 * Methods hang off `ecommerce.api.*` / ERPNext standard endpoints.
 */
export async function frappeCall(method, args = {}, httpMethod = 'POST') {
  const call = getCall();

  try {
    const result =
      httpMethod.toUpperCase() === 'GET'
        ? await call.get(method, args || {})
        : await call.post(method, args || {});

    return result && result.message !== undefined ? result.message : result;
  } catch (err) {
    const serverMessages = err && err._server_messages;
    const msg = serverMessages
      ? parseServerMessages(serverMessages)
      : (err && err.message) || 'حدث خطأ في الاتصال بالخادم';
    throw new Error(msg);
  }
}

/**
 * Parse Frappe server messages.
 */
function parseServerMessages(rawMessages) {
  try {
    const parsed = JSON.parse(rawMessages);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = JSON.parse(parsed[0]);
      return first.message || parsed[0];
    }
  } catch {
    // fallback
  }
  return 'حدث خطأ غير متوقع';
}

/**
 * Get image URL.
 */
export function getImageUrl(imagePath) {
  if (!imagePath) return null;

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  return `${BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

export { BASE_URL };