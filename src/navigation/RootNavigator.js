import React, { useMemo } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import AppShell from './AppShell';
import { navigationRef } from './navigationRef';
import { linking } from '../seo/linking';
import { Colors } from '../theme/colors';

export default function RootNavigator() {
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
     */
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <AppShell />
    </NavigationContainer>
  );
}