import { frappeCall, clearSession } from './client';

export const AuthAPI = {
  /**
   * Log in user using phone number or email
   */
  async login(identifier, password) {
    const cleanId = (identifier || '').trim();
    const isEmail = cleanId.includes('@');
    const usr = isEmail ? cleanId : `${cleanId.replace(/[^0-9]/g, '')}@yemen.local`;

    const res = await frappeCall('login', {
      usr,
      pwd: password,
    });
    return res;
  },

  /**
   * Register a new user by phone number.
   *
   * `phone` is the NATIONAL number (no dialling code) and is still truncated to
   * 9 digits, which is what `register_user_by_phone` expects and what existing
   * accounts are keyed by. `countryCode` / `fullPhone` are forwarded as extra
   * fields so the backend can start storing E.164 numbers; Frappe drops keyword
   * arguments a whitelisted method does not declare, so the current endpoint
   * keeps working unchanged.
   */
  async register(phone, fullName, newPassword, options = {}) {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-9);
    return frappeCall('ecommerce.www.login.register_user_by_phone', {
      phone: cleanPhone,
      full_name: fullName,
      new_password: newPassword,
      country_code: options.countryCode || null,
      full_phone: options.fullPhone || null,
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