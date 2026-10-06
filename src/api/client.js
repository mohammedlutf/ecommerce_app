import {
  getCall,
  getDB,
  initSession,
  saveSessionCookie,
  clearSession as clearSdkSession,
  hasSessionCookie,
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
 * True when a real (non-Guest) session cookie is currently loaded. Used to
 * detect a login that succeeded without capturing a cookie, which would
 * otherwise only surface as a sign-out on the next app start.
 */
export { hasSessionCookie };

/**
 * Call a Frappe whitelisted method through the SDK.
 * Methods hang off `webshop.my_api.api.*` / ERPNext standard endpoints.
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
 * Query a DocType list directly through the frappe-js-sdk DB adapter.
 *
 * Use this instead of a custom RPC endpoint whenever a plain read of a
 * DocType (e.g. `Item`, `Item Group`, `Customer`) is all that is needed.
 * `args` maps to the SDK's `getDocList` options (fields, filters, limit,
 * orderBy, limit_start, ...) and results come back as an array of dicts.
 */
export async function frappeList(doctype, args = {}) {
  const list = await getDB().getDocList(doctype, args);
  return Array.isArray(list) ? list : [];
}

/**
 * Fetch a single document of a DocType directly through the frappe-js-sdk.
 */
export async function frappeGetDoc(doctype, docname) {
  return getDB().getDoc(doctype, docname);
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