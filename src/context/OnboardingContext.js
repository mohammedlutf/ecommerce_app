import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_STORAGE_KEY } from '../api/sessionKeys';
import { useAuth } from './AuthContext';

const OnboardingContext = createContext(null);

/**
 * First-launch gate for the two-page welcome / registration flow (native only).
 *
 * ## Why both a stored flag and the auth state matter
 *
 * The flag alone is not enough: the very first launch after a successful
 * registration writes the flag, so the second launch skips straight to the
 * store. But a fresh install that restores an existing session (and therefore
 * has no flag yet) must NOT be offered a registration form — the shopper is
 * already signed in. So "seen" is really "the flow was completed" OR "the user
 * is already authenticated".
 *
 * The web build never participates: the site has to land on the store for every
 * visitor (it is the SEO surface), so it is always reported as done. Nothing on
 * the web reads or writes the stored key.
 */
export function OnboardingProvider({ children }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [done, setDone] = useState(Platform.OS === 'web');
  const [loading, setLoading] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    // Wait for the session bootstrap so a restored login is visible before we
    // decide whether to show the flow.
    if (authLoading) return undefined;

    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        const seenBefore = stored === '1';
        const nextDone = seenBefore || isAuthenticated;
        if (alive) setDone(nextDone);
        if (!nextDone) await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      } catch {
        // A storage failure must not trap the shopper behind the flow.
        if (alive) setDone(isAuthenticated);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, isAuthenticated]);

  const complete = useCallback(() => {
    setDone(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1').catch(() => {});
  }, []);

  const skip = useCallback(() => {
    setDone(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1').catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ done, loading, complete, skip }),
    [done, loading, complete, skip]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
}

export default OnboardingContext;