import { FrappeApp } from 'frappe-js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { USER_STORAGE_KEY as USER_KEY } from './sessionKeys';

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
 *
 * Set `EXPO_PUBLIC_API_URL` (e.g. in `.env`) to point at a real deployment.
 * The LAN fallback below only exists so `expo start` works on a dev machine
 * without extra setup — it is not a production value.
 */
const CONFIGURED_API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim();
const DEV_LAN_FALLBACK = 'http://192.168.1.33:8000';

export const BASE_URL =
  Platform.OS === 'web'
    ? CONFIGURED_API_URL
    : CONFIGURED_API_URL || DEV_LAN_FALLBACK;

// Shipping a non-HTTPS origin puts the session cookie and cart contents on the
// wire in clear text. Surface it loudly rather than silently downgrading.
if (
  !CONFIGURED_API_URL &&
  typeof __DEV__ !== 'undefined' &&
  !__DEV__
) {
  console.warn(
    '[frappe] EXPO_PUBLIC_API_URL is not set; falling back to the development ' +
      'LAN address. Set it to your HTTPS deployment before shipping.'
  );
} else if (BASE_URL && !BASE_URL.startsWith('https://') && typeof __DEV__ !== 'undefined' && !__DEV__) {
  console.warn(
    '[frappe] API base URL is not HTTPS in a production build; session data ' +
      'will be sent unencrypted: ' +
      BASE_URL
  );
}

const COOKIE_KEY = '@ecommerce_session_cookie';

let currentCookie = null;

/**
 * Read every `Set-Cookie` from a response.
 *
 * `headers.get('set-cookie')` is unreliable for a multi-valued header: the
 * whatwg-fetch polyfill React Native uses folds repeats into ONE string joined
 * with ", ", which is lossy and impossible to split correctly because cookie
 * attributes such as `Expires=Sun, 04 Oct 2026 ...` contain commas themselves.
 * `getSetCookie()` is the spec-compliant accessor and keeps them separate, so
 * prefer it and fall back for older runtimes.
 */
function readSetCookies(headers) {
  if (!headers) return [];

  if (typeof headers.getSetCookie === 'function') {
    try {
      const list = headers.getSetCookie();
      if (Array.isArray(list) && list.length) return list;
    } catch {
      // fall through to the legacy accessor
    }
  }

  if (typeof headers.get === 'function') {
    const raw = headers.get('set-cookie');
    if (raw) return Array.isArray(raw) ? raw : [raw];
  }

  return [];
}

/**
 * Find the `sid` cookie across every `Set-Cookie` header.
 *
 * `sid` is NOT guaranteed to be the first cookie Frappe sends — it is first for
 * anonymous requests, but its position for an authenticated response is a server
 * implementation detail we must not depend on. So the value is matched at any
 * cookie boundary (start of string, `,`, `;` or whitespace) rather than only at
 * the start or directly after a comma.
 *
 * Distinguishes four outcomes, because they mean different things:
 *   - `session` — a real signed-in sid
 *   - `guest`   — only `sid=Guest`: this one request went out anonymously
 *   - `cleared` — `sid=` with a past `Expires`: the server invalidated our sid
 *   - `none`    — no sid at all
 */
function parseSid(setCookies) {
  const list = Array.isArray(setCookies) ? setCookies : [setCookies];
  const text = list.filter(Boolean).join(',');
  if (!text) return { status: 'none', cookie: null };

  // `sid=` with an empty value is a deletion, so the value is allowed to be empty.
  const pattern = /(?:^|[,;\s])sid=([^;,\s]*)/gi;
  let guest = null;
  let cleared = false;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[1];
    if (!value) {
      cleared = true;
    } else if (/^guest$/i.test(value)) {
      if (!guest) guest = `sid=${value}`;
    } else {
      // A genuine session id always wins, wherever it appears in the list.
      return { status: 'session', cookie: `sid=${value}` };
    }
  }

  // The server sends `sid=Guest` *and* a deletion together when a session has
  // expired, so a deletion outranks the guest marker.
  if (cleared) return { status: 'cleared', cookie: null };
  if (guest) return { status: 'guest', cookie: guest };
  return { status: 'none', cookie: null };
}

export async function initSession() {
  try {
    const savedCookie = await AsyncStorage.getItem(COOKIE_KEY);
    if (savedCookie) currentCookie = savedCookie;
  } catch (err) {
    console.warn('Failed to load session cookie:', err);
  }
}

/** True when a real (non-Guest) session cookie is loaded. */
export function hasSessionCookie() {
  return !!currentCookie && !/^sid=guest/i.test(currentCookie);
}

export async function saveSessionCookie(setCookies) {
  const { status, cookie } = parseSid(setCookies);

  // Nothing to learn from this response.
  if (status === 'none') return;

  // `sid=Guest` only means THIS request went out unauthenticated — it says
  // nothing about the stored session. Public catalogue calls land while the
  // session is still being restored at startup, and treating that as a sign-out
  // is what logged people out on every app restart.
  if (status === 'guest') return;

  // The server expired our sid (`sid=` with a past Expires). Drop it so we stop
  // sending a dead cookie — which would otherwise make every later request
  // return `session_expired` — and let the next login start from a clean slate.
  if (status === 'cleared') {
    await clearSession();
    return;
  }

  // Always persist, even when the value is unchanged. Skipping the write when
  // `currentCookie` already matches lets the in-memory cookie and the stored
  // one drift apart — after a failed write, or if the OS clears app storage
  // while the process is still alive — and the session then cannot be restored.
  currentCookie = cookie;
  await AsyncStorage.setItem(COOKIE_KEY, cookie);
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

  // Capture the session cookie from every response, not just the login one:
  // Frappe re-sends the session cookies on all of them, so a successful capture
  // can still be recovered on a later request.
  const setCookies = readSetCookies(response.headers);
  if (setCookies.length) {
    try {
      await saveSessionCookie(setCookies);
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