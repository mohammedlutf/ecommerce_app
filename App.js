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
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import { ToastProvider } from './src/context/ToastContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initRTL } from './src/utils/rtl';
import { Colors } from './src/theme/colors';

/**
 * Android 12+ will only draw a centred icon on a flat colour for the launch
 * splash, so a full-bleed image is physically impossible to show there — the OS
 * crops it into `splashscreen_logo.png`. The full-screen artwork is therefore
 * rendered by us instead, layered over the native splash, which we hold open
 * until fonts are ready so there is never a flash of bare background.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_IMAGE = require('./assets/splash.png');
const SPLASH_MIN_VISIBLE_MS = 700;
const SPLASH_FADE_MS = 380;

export default function App() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    initRTL();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return undefined;

    let cancelled = false;
    const fade = setTimeout(() => {
      if (cancelled) return;
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
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
  }, [fontsLoaded, splashOpacity]);

  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <StatusBar style="dark" backgroundColor={Colors.background} />
                <RootNavigator />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>

      {splashMounted ? (
        <Animated.View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
        >
          <Image source={SPLASH_IMAGE} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
