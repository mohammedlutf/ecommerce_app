import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, detectInitialLocale } from './src/i18n/I18nContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AdminProvider } from './src/context/AdminContext';
import { WishlistProvider } from './src/context/WishlistContext';
import { ToastProvider } from './src/context/ToastContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import AnimatedSplash from './src/components/AnimatedSplash';
import { applyLayoutDirection, restartOnceForDirection, RESTART_FLAG_KEY } from './src/utils/rtl';
import { isRTLLocale, isSupportedLocale } from './src/i18n/locales';
import { LOCALE_STORAGE_KEY } from './src/i18n/I18nContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import { injectWebStyles } from './src/utils/webStyles';
import { Colors } from './src/theme/colors';

/**
 * ★ Synchronous RTL initialisation — runs at import time, before React mounts.
 *
 * Android reads `I18nManager.isRTL` when the native view hierarchy is first
 * created. If `forceRTL` is only called inside a `useEffect` (which fires
 * *after* the first render) the views are already built LTR and the flag has no
 * effect until a full restart — which is the "Arabic text on the left" bug.
 *
 * By calling `allowRTL` + `forceRTL` here, at the module scope, the flag is set
 * before `AppRegistry.registerComponent` hands control to React, so the very
 * first layout pass uses the correct direction.
 *
 * The default locale is Arabic (RTL). If the user previously chose English, the
 * stored preference will flip this later via `applyLayoutDirection` in the
 * effect below — but starting RTL is the safe default because it matches the
 * store's primary language.
 */
if (Platform.OS !== 'web') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

/**
 * Android 12+ will only draw a centred icon on a flat colour for the launch
 * splash, so a full-bleed image is physically impossible to show there — the OS
 * crops it into `splashscreen_logo.png`. The full-screen artwork is therefore
 * rendered by us instead, layered over the native splash, which we hold open
 * until we are ready to show real content.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_ANIMATION = require('./assets/lottie/splash.json');

/**
 * Rendered only once BOTH the fonts and the session bootstrap are done.
 *
 * Nothing below this point may issue a request before the persisted `sid` has
 * been read back out of AsyncStorage: an unauthenticated request sent during
 * that window gets a `sid=Guest` response, and the app used to react to that by
 * treating the restore as a sign-out — which is what made every cold start ask
 * for a fresh login.
 */
function AppContent({ fontsReady }) {
  const { loading: authLoading } = useAuth();
  const { done: onboardingDone, loading: onboardingLoading } = useOnboarding();
  const ready = fontsReady && !authLoading && !onboardingLoading;

  /*
   * The overlay only exists to be revealed by `SplashScreen.hideAsync()` — on
   * Android 12+ the OS crops the artwork down to a centred square on a flat
   * colour, so the full-bleed image has to be painted by us.
   *
   * Web has no native splash to cover and `hideAsync()` is a no-op there, so the
   * overlay buys nothing and only carries risk: it is `absoluteFill` at full
   * opacity, and it only lifts once `ready` flips. If that never happens (a font
   * or session read that stalls) the overlay stays on top of a perfectly good
   * app, and if the image asset fails to load the result is a blank white page.
   * That was the intermittent web-only blank screen.
   */
  const isWeb = Platform.OS === 'web';

  const [splashMounted, setSplashMounted] = useState(!isWeb);

  // True once the JS splash owns the screen (the OS splash has been dropped).
  const [splashRevealed, setSplashRevealed] = useState(false);
  const revealedRef = useRef(false);

  const revealSplash = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setSplashRevealed(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Stable identity: `AnimatedSplash`'s exit effect holds a timer whose deps
  // include this callback, so an inline function would reschedule that timer on
  // every render of this component.
  const handleSplashHidden = useCallback(() => setSplashMounted(false), []);

  useEffect(() => {
    if (isWeb) {
      injectWebStyles();
      return;
    }

    // Native. The synchronous `forceRTL(true)` at module scope already set the
    // correct direction for the default Arabic locale, so first-launch is RTL
    // from the very first frame. This effect only needs to handle the case
    // where the shopper previously chose English — read the stored preference
    // and flip to LTR if necessary.
    let cancelled = false;
    (async () => {
      let target = detectInitialLocale();
      try {
        const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (!cancelled && isSupportedLocale(stored)) target = stored;
      } catch {
        // keep the default
      }
      if (cancelled) return;

      const rtl = isRTLLocale(target);
      const alreadyCorrect = applyLayoutDirection(rtl);

      if (__DEV__) {
        console.log(
          `[i18n] locale=${target} desired=${rtl ? 'rtl' : 'ltr'} ` +
            `I18nManager.isRTL=${I18nManager.isRTL}`
        );
      }

      // If the user chose English but the module-level init forced RTL, a
      // restart is needed for the LTR direction to take effect on Android.
      if (alreadyCorrect) return;
      const reloaded = await restartOnceForDirection(
        async () => (await AsyncStorage.getItem(RESTART_FLAG_KEY)) === '1',
        (k) => AsyncStorage.setItem(k, '1')
      );
      if (!reloaded && __DEV__) {
        console.warn(
          '[i18n] layout direction needs a restart to apply; reopen the app.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Reveal as soon as the artwork has painted, not when `ready` flips.
   *
   * Android 12+ cannot draw a full-bleed splash: the OS shows a centred square
   * crop of the artwork on a flat white field for as long as we hold its splash
   * open. Holding that until fonts, session and onboarding have all resolved is
   * what put the square (the "background colour around a not-full image") on
   * screen for the whole launch. Dropping it at paint leaves the OS splash
   * bridging only JS boot, and the full-bleed artwork carries the rest.
   *
   * Revealing a frame early is still seamless: `AnimatedSplash` paints an opaque
   * backdrop in the artwork's own edge colours underneath the bitmap.
   */
  useEffect(() => {
    if (isWeb || !ready) return;
    // Fallback: the artwork never signalled paint (failed or very slow decode).
    // Reveal anyway — the OS splash must not outlive the app.
    revealSplash();
  }, [ready, isWeb, revealSplash]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" backgroundColor={Colors.background} />

      {/*
       * The navigator is mounted once the onboarding state has resolved (and only
       * then). On a returning install the first-frame state is
       * `onboardingDone = false`, and mounting the navigator at that moment
       * paints the welcome screen underneath the still-fading splash — the
       * sub-second flash of onboarding before the app appears. Waiting for the
       * storage read means the very first mount already renders the *correct*
       * root (shell or onboarding), and doing it a step before `ready` — while
       * the fonts and session finish loading under the opaque splash — means the
       * shell is fully painted by the time the fade reveals it. Web always mounts
       * immediately: it has no splash to cover the wait, and a blank page there
       * was the exact bug this file already fixed.
       */}
      {!onboardingLoading || isWeb ? (
        <RootNavigator onboardingDone={onboardingDone} />
      ) : (
        <View style={styles.launchBackdrop} />
      )}

      {splashMounted ? (
        <AnimatedSplash
          visible={ready}
          revealed={splashRevealed}
          artwork={SPLASH_ANIMATION}
          onPainted={revealSplash}
          onHidden={handleSplashHidden}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        {/* Outermost: direction and locale drive layout, text and formatting for
            every screen, so they have to be established before anything renders. */}
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  {/* Inside AuthProvider: the admin flag is keyed on the signed-in
                      user and must reset on sign-in/sign-out. */}
                  <AdminProvider>
                    <OnboardingProvider>
                      <AppContent fontsReady={fontsLoaded} />
                    </OnboardingProvider>
                  </AdminProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /**
   * Exactly the splash artwork's top-row colour, so during the entrance fade —
   * before `ready` mounts the navigator — the empty frame behind the animation
   * is indistinguishable from the artwork's own edge instead of showing app UI.
   */
  launchBackdrop: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
