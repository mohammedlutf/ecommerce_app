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
   * Register a new user using Yemeni phone number
   */
  async register(phone, fullName, newPassword) {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-9);

    try {
      const res = await frappeCall('ecommerce.www.login.register_user_by_phone', {
        phone: cleanPhone,
        full_name: fullName,
        new_password: newPassword,
      });
      return res;
    } catch {
      return await frappeCall('ecommerce.www.login.register_user_by_phone', {
        phone: cleanPhone,
        full_name: fullName,
        new_password: newPassword,
      });
    }
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
      console.log('CURRENT USER:', currentUser);
      return currentUser;
    } catch (error) {
      // If user is a guest or not logged in, just return null safely
      console.log('User is not logged in or session is guest.');
      return null;
    }
  },
};

export default AuthAPI;