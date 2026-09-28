import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthAPI, { fallbackProfile } from '../api/auth';
import { initClientSession, clearSession, hasSessionCookie } from '../api/client';
import { USER_STORAGE_KEY } from '../api/sessionKeys';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapSession();
  }, []);

  async function bootstrapSession() {
    try {
      await initClientSession();
      const cached = await AsyncStorage.getItem(USER_STORAGE_KEY);

      // Show the cached profile immediately so the app does not flash the
      // login screen while the network check runs. It is revoked below if the
      // server says the session is gone.
      let cachedProfile = null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // `email` is the identity key the cart and wishlist caches are filed
          // under, so it is the only field that has to survive the round trip.
          cachedProfile =
            parsed && typeof parsed.email === 'string' && parsed.email.trim()
              ? {
                  ...parsed,
                  fullName: parsed.fullName || parsed.name || parsed.email,
                }
              : null;
        } catch {
          cachedProfile = null;
        }
        if (!cachedProfile) await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }

      if (cachedProfile) setUser(cachedProfile);

      // Confirm the restored `sid` is still accepted. This normalises the full
      // Frappe `User` document the endpoint returns, so the check must not be
      // written against any single response shape.
      const profile = await AuthAPI.getSessionProfile();

      if (profile) {
        setUser(profile);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        return;
      }

      // The server does not consider us signed in. That is either a genuinely
      // expired session or a cookie that was never captured, so drop the
      // cached profile too — otherwise the app renders the previous
      // customer's account, cart and orders while every request runs as Guest.
      setUser(null);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch (err) {
      // The check never reached the server. Whatever was restored from storage
      // stays in place: an unreachable server is not a sign-out, and clearing
      // here is what turned a flaky connection into a fresh login form.
      console.warn('Session bootstrap warning:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(combinedNumber, nationalNumber, password) {
    const res = await AuthAPI.login(combinedNumber, nationalNumber, password);

    // A login that did not yield a capturable session cookie looks like it
    // works, then silently signs the user out on the next app start. Surface it
    // instead of letting it fail invisibly a restart later.
    if (!hasSessionCookie()) {
      console.warn(
        'Login succeeded but no session cookie was captured. The session will not survive a restart.'
      );
    }

    // Read the identity back from the server rather than rebuilding it from
    // what was typed. `AuthAPI.login` tries several candidates, so the account
    // that actually won is not necessarily the combined number, and `email` is
    // the key the cart and wishlist caches are filed under — guessing here
    // orphans a signed-in customer's saved state.
    let profile = null;
    try {
      profile = await AuthAPI.getSessionProfile();
    } catch (err) {
      console.warn('Could not read the profile back after login:', err);
    }
    if (!profile) profile = fallbackProfile(combinedNumber);

    if (profile) {
      setUser(profile);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    }
    return res;
  }

  async function register(combinedNumber, fullName, password) {
    const res = await AuthAPI.register(combinedNumber, fullName, password);
    return res;
  }

  async function logout() {
    try {
      await AuthAPI.logout();
    } finally {
      await clearSession();
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        bootstrapSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
export default AuthContext;
