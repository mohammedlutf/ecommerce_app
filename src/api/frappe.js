import { FrappeApp } from 'frappe-js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Frappe SDK bootstrap for React Native.
 *
 * frappe-js-sdk runs on axios. React Native never lets JS read the network
 * stack's cookies, so we supply a custom axios adapter built on the same
 * fetch semantics the rest of the app already relies on:
 *   - `sid` cookie is persisted in AsyncStorage and re-attached to requests
 *   - `Set-Cookie` from responses is captured and stored/cleared
 *
 * Every API route in the app flows through `FrappeApp` -> `FrappeCall`
 * (`frappe.call().get/post/...`), so the whole data layer rides the official
 * SDK while staying fully authenticated on device.
 */

/**
 * API base URL.
 *
 * Native: the Frappe benchmark directly; the browser enforces the
 * Same-Origin Policy, so on web we use a relative URL and let the Metro dev
 * server proxy `/api` & `/files` to the benchmark (see metro.config.js).
 * This sidesteps CORS completely when testing in a browser.
 */
export const BASE_URL = Platform.OS === 'web' ? '' : 'http://192.168.1.36:8000';

const COOKIE_KEY = '@ecommerce_session_cookie';
const USER_KEY = '@ecommerce_logged_user';

let currentCookie = null;

/**
 * Extract only: sid=xxxxxxxx from Set-Cookie header.
 */
function extractCookie(setCookie) {
  if (!setCookie) return null;

  const cookieString = Array.isArray(setCookie)
    ? setCookie.join(',')
    : setCookie;

  const sidMatch = cookieString.match(/(?:^|,\s*)sid=([^;,\s]+)/);
  if (!sidMatch) return null;

  return `sid=${sidMatch[1]}`;
}

export async function initSession() {
  try {
    const savedCookie = await AsyncStorage.getItem(COOKIE_KEY);
    if (savedCookie) currentCookie = savedCookie;
  } catch (err) {
    console.warn('Failed to load session cookie:', err);
  }
}

export async function saveSessionCookie(cookie) {
  if (!cookie) {
    currentCookie = null;
    await AsyncStorage.removeItem(COOKIE_KEY);
    return;
  }

  if (/sid=Guest(?:;|,|$)/i.test(cookie)) {
    currentCookie = null;
    await AsyncStorage.removeItem(COOKIE_KEY);
    return;
  }

  const cleanCookie = extractCookie(cookie);
  if (!cleanCookie || cleanCookie.toLowerCase() === 'sid=guest') {
    currentCookie = null;
    await AsyncStorage.removeItem(COOKIE_KEY);
    return;
  }

  currentCookie = cleanCookie;
  await AsyncStorage.setItem(COOKIE_KEY, cleanCookie);
}

export async function clearSession() {
  currentCookie = null;
  await AsyncStorage.multiRemove([COOKIE_KEY, USER_KEY]);
}

/**
 * axios adapter for React Native: builds the request on `fetch` so that
 * `Set-Cookie`/Cookie behaviour stays identical to the previously working
 * transport, while presenting an axios-shaped response to the SDK.
 */
async function rnFetchAdapter(config) {
  const method = (config.method || 'get').toUpperCase();
  let finalUrl = config.url;
  if (config.baseURL && !finalUrl.startsWith('http')) {
    finalUrl = `${config.baseURL}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
  }

  // FrappeCall.get passes a URLSearchParams instance; support both shapes.
  let queryString = '';
  const params = config.params;
  if (params) {
    if (typeof params === 'string') {
      queryString = params;
    } else if (typeof params.toString === 'function' && params.toString() !== '[object Object]') {
      queryString = params.toString();
    } else {
      queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    }
  }
  if (queryString) finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${queryString}`;

  const headers = {};
  if (config.headers) {
    const flat =
      typeof config.headers.toJSON === 'function'
        ? config.headers.toJSON()
        : config.headers;
    Object.keys(flat).forEach((k) => {
      const v = flat[k];
      if (v !== undefined && v !== null) {
        headers[k] = Array.isArray(v) ? v.join(', ') : v;
      }
    });
  }
  headers.Accept = headers.Accept || 'application/json';
  // Browsers refuse to let JS set the `Cookie` header directly; the browser
  // cookie jar handles it (needs `credentials: 'include'` below). On native
  // there is no cookie jar, so we re-attach the persisted `sid` manually.
  const isWeb = Platform.OS === 'web';
  if (currentCookie && !isWeb) headers.Cookie = currentCookie;

  let body;
  if (method !== 'GET' && method !== 'HEAD' && config.data !== undefined) {
    if (typeof config.data === 'string') {
      body = config.data;
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(config.data);
    }
  }

  const response = await fetch(finalUrl, {
    method,
    headers,
    body,
    ...(isWeb ? { credentials: 'include' } : {}),
  });

  const setCookieHeader = response.headers && response.headers.get
    ? response.headers.get('set-cookie')
    : null;
  if (setCookieHeader) {
    try {
      await saveSessionCookie(setCookieHeader);
    } catch (err) {
      console.warn('Failed to persist session cookie:', err);
    }
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  const axiosResponse = {
    data,
    status: response.status,
    statusText: response.statusText || '',
    headers: response.headers,
    config,
  };

  if (!response.ok) {
    const error = new Error(
      (data && data.message) || `Request failed with status code ${response.status}`
    );
    error.response = axiosResponse;
    error.config = config;
    error.code = 'ERR_BAD_RESPONSE';
    throw error;
  }

  return axiosResponse;
}

/**
 * The Frappe SDK instance for the whole app.
 */
export const frappe = new FrappeApp(BASE_URL);

frappe.axios.defaults.adapter = rnFetchAdapter;

frappe.axios.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error && error.response) {
      error.response.data ||= {};
    }
    return Promise.reject(error);
  }
);

export function getCall() {
  return frappe.call();
}

export function getAuth() {
  return frappe.auth();
}

export function getDB() {
  return frappe.db();
}

export function getFrappe() {
  return frappe;
}

export default frappe;