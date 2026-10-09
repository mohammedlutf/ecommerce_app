import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import AppShell from './AppShell';
import OnboardingStack from './stacks/OnboardingStack';
import { navigationRef } from './navigationRef';
import { linking } from '../seo/linking';
import { Colors } from '../theme/colors';

export default function RootNavigator({ onboardingDone }) {
  /**
   * Navigation theme.
   *
   * Without an explicit theme the navigator uses `DefaultTheme`'s dark
   * background, which flashes a dark frame on mount before the first screen
   * paints — much more visible on web than on device.
   *
   * Deliberately *not* keyed on direction: on web the `dir` attribute on `<html>`
   * reflows the whole tree by itself, and remounting the navigator would throw
   * the shopper back to the home tab every time they changed language.
   */
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: false,
      colors: {
        ...DefaultTheme.colors,
        primary: Colors.primary,
        background: Colors.background,
        card: Colors.surface,
        text: Colors.onSurface,
        border: Colors.borderSubtle,
        notification: Colors.error,
      },
    }),
    []
  );

  return (
    /*
     * `linking` is passed unconditionally rather than gated on web.
     *
     * React Navigation ignores it where there is no URL scheme to integrate
     * with, and supplying it unconditionally means the same navigator object is
     * used in the browser and in a deep link on a device — one route table, not
     * two that can disagree.
     *
     * On the first native launch the onboarding stack replaces the app shell
     * until the shopper registers (or skips). The web build always renders the
     * shell: `OnboardingProvider` reports `done` unconditionally there, and the
     * extra web guard below keeps the store reachable even if that contract
     * were ever broken.
     */
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      {Platform.OS !== 'web' && !onboardingDone ? <OnboardingStack /> : <AppShell />}
    </NavigationContainer>
  );
}