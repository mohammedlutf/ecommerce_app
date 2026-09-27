import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthAPI from '../api/auth';
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
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.email === 'string' && parsed.email) {
          setUser(parsed);
        } else {
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
        }
      }

      // Check active session with server
      const currentUser = await AuthAPI.getCurrentUser();

      // Ensure currentUser is a valid string/email and not an empty object or Guest
      if (currentUser && typeof currentUser === 'string' && currentUser !== 'Guest') {
        const profile = { email: currentUser, name: currentUser.split('@')[0] };
        setUser(profile);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      } else {
        // The server does not consider us signed in. That is either a genuinely
        // expired session or a cookie that was never captured, so drop the
        // cached profile too — otherwise the app renders the previous
        // customer's account, cart and orders while every request runs as Guest.
        setUser(null);
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Session bootstrap warning:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(combinedNumber, nationalNumber, password) {
    const res = await AuthAPI.login(combinedNumber, nationalNumber, password);
    const currentUser = await AuthAPI.getCurrentUser();
    const fallbackId = `${String(combinedNumber).replace(/[^0-9]/g, '')}@yemen.local`;
    const identifierStr = typeof currentUser === 'string' ? currentUser : fallbackId;

    // A login that did not yield a capturable session cookie looks like it
    // works, then silently signs the user out on the next app start. Surface it
    // instead of letting it fail invisibly a restart later.
    if (!hasSessionCookie()) {
      console.warn(
        'Login succeeded but no session cookie was captured. The session will not survive a restart.'
      );
    }

    const profile = {
      email: identifierStr,
      name: identifierStr.split('@')[0],
    };
    setUser(profile);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
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
