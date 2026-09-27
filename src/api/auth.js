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
   * Get current logged-in user safely (avoids crashing on guest/permission errors)
   */
  async getCurrentUser() {
    try {
      const currentUser = await frappeCall(
        'ecommerce.api.get_current_user',
        {},
        'GET'
      );
      return currentUser;
    } catch (error) {
      // If user is a guest or not logged in, just return null safely
      console.warn('User is not logged in or session is guest.');
      return null;
    }
  },
};

export default AuthAPI;