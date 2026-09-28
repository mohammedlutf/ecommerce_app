import { frappeCall, clearSession } from './client';

/** Frappe user accounts for this app are local-part + this domain. */
const LOCAL_DOMAIN = 'yemen.local';

function digitsOnly(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

/**
 * Identity strings to try, most specific first.
 *
 * The app now sends the combined number (dialling code + national number), but
 * the accounts that already exist were created under the legacy keys, so a
 * single identity string is not enough:
 *
 *   1. combined  — `967771234567`  matches once the server keys on the full
 *                  number (the format we now register with).
 *   2. national  — `771234567`     matches every pre-existing Yemeni account.
 *   3. last 9    — `771234567`     matches accounts the unpatched server
 *                  created for a non-Yemeni number, because
 *                  `register_user_by_phone` does `phone[-9:]` server-side.
 *
 * Duplicates are removed so Yemen (where 2 and 3 are identical) costs two
 * requests rather than three.
 */
export function buildLoginCandidates(combinedNumber, nationalNumber) {
  const national = digitsOnly(nationalNumber);
  const candidates = [];
  const push = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  push(digitsOnly(combinedNumber));
  push(national);
  push(national.slice(-9));

  return candidates.map((value) => `${value}@${LOCAL_DOMAIN}`);
}

/**
 * Connection-level failures must abort immediately rather than being retried
 * against the other candidates, otherwise a dropped connection turns into three
 * sequential timeouts and a misleading "wrong password".
 */
function isConnectionFailure(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('network') ||
    text.includes('econnrefused') ||
    text.includes('socket') ||
    text.includes('failed to fetch') ||
    text.includes('اتصال')
  );
}

/**
 * Assemble the app's profile shape from an identity string plus, when we have
 * one, the Frappe `User` document it came from.
 *
 * `email` is the identity key the cart and wishlist caches are filed under, so
 * it must always be the real account address — never a value reconstructed
 * from what the user typed.
 */
function buildProfile(value, doc) {
  const source = doc && typeof doc === 'object' ? doc : {};

  if (typeof value !== 'string') return null;

  const email = value.trim();
  if (!email || email.toLowerCase() === 'guest') return null;

  const clean = (part) => (typeof part === 'string' ? part.trim() : '');
  // `full_name` is authoritative and already contains the first name, so it is
  // used on its own — concatenating it with `first_name` would repeat the name
  // on every Frappe `User` document.
  const fullName =
    clean(source.full_name) ||
    [clean(source.first_name), clean(source.last_name)].filter(Boolean).join(' ') ||
    email.split('@')[0];

  return { email, name: fullName, fullName };
}

/**
 * Normalise whatever `ecommerce.api.get_current_user` answers with.
 *
 * The endpoint replies with the full Frappe `User` document for an active
 * session, but three other shapes are still in the wild:
 *   - `"Guest"` (and `{ message: 'Guest' }`) when nobody is signed in
 *   - a bare email string, from older builds of the endpoint
 *   - a document for some other DocType, if the method name is ever reused
 *
 * The previous code tested `typeof raw === 'string'`, which never matched the
 * real object response — so every cold start classified a perfectly valid
 * session as a sign-out, deleted the cached profile and asked for a new login.
 * This function is the single place that decides "is somebody signed in".
 *
 * Returns `null` only when the server positively reports that nobody is.
 */
export function normalizeUserProfile(raw) {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'string') return buildProfile(raw, {});

  if (typeof raw !== 'object') return null;

  if (typeof raw.message === 'string') return buildProfile(raw.message, {});

  if (raw.doctype && raw.doctype !== 'User') return null;

  return buildProfile(raw.email || raw.name || raw.id, raw);
}

/**
 * Profile to use before the server has told us which login candidate matched.
 *
 * Only a last resort: `AuthAPI.login` may have succeeded against the national
 * or last-9 identity, and guessing the combined number here would file the
 * signed-in customer's cart and wishlist under the wrong key.
 */
export function fallbackProfile(combinedNumber) {
  return normalizeUserProfile(`${digitsOnly(combinedNumber)}@${LOCAL_DOMAIN}`);
}

/**
 * Frappe signals "you are not signed in" through the response body rather than
 * a distinct status code, so match on the wording it uses.
 */
const SIGNED_OUT_PATTERN =
  /guest|not permitted|permission ?error|session (?:expired|does not exist)|login required|unauthor/i;

export function isSignedOutError(message) {
  return SIGNED_OUT_PATTERN.test(String(message || ''));
}

export const AuthAPI = {
  /**
   * Log in with a phone number.
   *
   * @param {string} combinedNumber dialling code + national number, digits only
   * @param {string} nationalNumber national number on its own, digits only
   * @param {string} password
   */
  async login(combinedNumber, nationalNumber, password) {
    const candidates = buildLoginCandidates(combinedNumber, nationalNumber);
    if (candidates.length === 0) {
      throw new Error('يرجى إدخال رقم الهاتف');
    }

    let firstError = null;
    for (const usr of candidates) {
      try {
        return await frappeCall('login', { usr, pwd: password });
      } catch (err) {
        if (!firstError) firstError = err;
        if (isConnectionFailure(err && err.message)) throw err;
      }
    }
    // Every candidate failed. The first error is the most relevant one to show
    // (it is a real "invalid credentials" from the canonical combined attempt).
    throw firstError || new Error('فشل تسجيل الدخول، تحقق من البيانات');
  },

  /**
   * Register a new user with the combined phone number.
   *
   * `phone` carries the dialling code and the national number together
   * (`967771234567`). The combined value is sent unmodified — any truncation to
   * a national number is the server's decision, and doing it here would discard
   * the country and make two different countries collide on one account.
   */
  async register(combinedNumber, fullName, newPassword) {
    return frappeCall('ecommerce.www.login.register_user_by_phone', {
      phone: digitsOnly(combinedNumber),
      full_name: fullName,
      new_password: newPassword,
    });
  },

  /**
   * Log out current user
   */
  async logout() {
    try {
      await frappeCall('logout');
    } finally {
      await clearSession();
    }
  },

  /**
   * Resolve the signed-in profile from the server.
   *
   * Returns `null` when the server states that nobody is signed in, but
   * *throws* when the request never reached it. The caller has to be able to
   * tell those apart: a dropped connection or a 5xx is not a sign-out, and
   * reporting it as one silently drops a valid session and sends the user back
   * to the login screen every time the network hiccups at startup.
   */
  async getSessionProfile() {
    let raw;
    try {
      raw = await frappeCall('ecommerce.api.get_current_user', {}, 'GET');
    } catch (err) {
      if (isSignedOutError(err && err.message)) return null;
      throw err;
    }
    return normalizeUserProfile(raw);
  },
};

export default AuthAPI;