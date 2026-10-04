import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import SiteHeader from '../components/layout/SiteHeader';
import AppTabs from './AppTabs';
import { useSiteChrome } from '../hooks/useResponsive';
import { navigationRef } from './navigationRef';
import { openProducts } from '../seo/linking';
import { Colors } from '../theme/colors';

/**
 * The application shell.
 *
 * Exactly one navigation surface exists at a time:
 *
 * - Web at desktop width: `SiteHeader` on top, no bottom tab bar. A 5-item tab
 *   strip pinned to the bottom of a 1440px window wastes the bottom third of the
 *   screen and carries no information the header does not.
 * - Phone (native at any width) and narrow web: the bottom tab bar, no header.
 *
 * Which one applies is decided by `useSiteChrome`, not by width here, so a native
 * tablet or a landscape phone cannot end up with both. Previously `SiteHeader`
 * rendered unconditionally, which put the web nav above the tab bar on the
 * mobile app.
 *
 * The header is a flex *sibling* of the navigator, not an overlay. That is what
 * keeps it pinned: each screen scrolls inside its own `ScrollView`, so the
 * document never scrolls and `position: sticky` would have nothing to stick to.
 *
 * The footer is deliberately absent here. With no document-level flow there is
 * nowhere for a single shared footer to sit below all screen content, so
 * `PageFooter` is appended inside the scroll content of the screens that warrant
 * one.
 */
export default function AppShell() {
  const { showDesktopChrome, showTabBar } = useSiteChrome();

/*
   * Header search hands off to the Products screen, which owns the results
   * list.
   *
   * `seed: Date.now()` is not decoration: re-searching for a term the screen
   * already holds has to re-run the query, and a plain `{ search }` param would
   * compare equal and leave the stale results on screen. `openProducts` applies
   * both the locale prefix and the seed.
   */
  const handleSearchSubmit = useCallback((term) => {
    openProducts(navigationRef.current, { search: term });
  }, []);

  return (
    <View style={styles.root}>
      {showDesktopChrome && <SiteHeader onSearchSubmit={handleSearchSubmit} />}
      <View style={styles.body}>
        <AppTabs hideTabBar={!showTabBar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
  },
});