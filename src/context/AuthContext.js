import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthAPI from '../api/auth';
import { initClientSession, clearSession } from '../api/client';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = '@ecommerce_user_profile';

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
        // The session is no longer valid on the server (expired sid, signed out
        // elsewhere, guest). The cached profile MUST be dropped, otherwise the
        // app keeps rendering the previous customer's account, cart and orders.
        setUser(null);
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Session bootstrap warning:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(identifier, password) {
    const res = await AuthAPI.login(identifier, password);
    const currentUser = await AuthAPI.getCurrentUser();
    const identifierStr = typeof currentUser === 'string' ? currentUser : identifier;

    const profile = {
      email: identifierStr,
      name: identifierStr.split('@')[0],
    };
    setUser(profile);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    return res;
  }

  async function register(phone, fullName, password) {
    const res = await AuthAPI.register(phone, fullName, password);
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
