import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
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
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
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

const SPLASH_IMAGE = require('./assets/splash.png');
const SPLASH_MIN_VISIBLE_MS = 700;
const SPLASH_FADE_MS = 380;

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
  const ready = fontsReady && !authLoading;

  /*
   * The overlay only exists to be revealed by `SplashScreen.hideAsync()` once
   * the native splash is dismissed — on Android 12+ the OS crops the artwork
   * down to an icon, so the full-bleed image has to be painted by us.
   *
   * Web has no native splash to cover and `hideAsync()` is a no-op there, so the
   * overlay buys nothing and only carries risk: it is `absoluteFill` at full
   * opacity, and it only lifts once `ready` flips. If that never happens (a font
   * or session read that stalls) the overlay stays on top of a perfectly good
   * app, and if the image asset fails to load the result is a blank white page.
   * That was the intermittent web-only blank screen.
   */
  const isWeb = Platform.OS === 'web';

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [splashMounted, setSplashMounted] = useState(!isWeb);

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

  useEffect(() => {
    if (!ready || isWeb) return undefined;

    let cancelled = false;
    const fade = setTimeout(() => {
      if (cancelled) return;
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        // react-native-web has no native animated module and silently falls back
        // to the JS driver, so asking for the native one there only produces a
        // console warning.
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!cancelled && finished) setSplashMounted(false);
      });
    }, SPLASH_MIN_VISIBLE_MS);

    // The artwork is already mounted underneath the native splash, so dropping
    // the native splash reveals a fully painted image rather than a blank frame.
    SplashScreen.hideAsync().catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(fade);
    };
  }, [ready, splashOpacity, isWeb]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <RootNavigator />

      {splashMounted ? (
        <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}>
          <Image source={SPLASH_IMAGE} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </Animated.View>
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
                    <AppContent fontsReady={fontsLoaded} />
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
});
