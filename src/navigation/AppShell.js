import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import SiteHeader from '../components/layout/SiteHeader';
import AppTabs from './AppTabs';
import { useSiteChrome } from '../hooks/useResponsive';
import { navigationRef } from './navigationRef';
import { openProducts } from '../seo/linking';
import { SiteHeaderVisibilityContext } from '../context/SiteHeaderVisibilityContext';
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
   * The desktop header is a flex sibling, so it normally stays pinned while
   * each screen's own scroller moves underneath it. Products asks the shell to
   * collapse it while the shopper reads down the grid; this value drives that
   * animation.
   *
   * The height is measured rather than hard-coded: the header has a utility
   * strip, a main row and a category nav, and those heights must not be
   * duplicated here where they could drift out of sync with `SiteHeader`.
   */
  const [headerHidden, setHeaderHiddenState] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerCollapse = useRef(new Animated.Value(0)).current;

  const setHeaderHidden = useCallback((hidden) => {
    setHeaderHiddenState(Boolean(hidden));
  }, []);

  const handleHeaderLayout = useCallback((event) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    // Measure once. The header's height is driven by fixed rows, and
    // re-measuring while the collapse animation is running would feed
    // intermediate heights back into the interpolation.
    setHeaderHeight((previous) => (previous > 0 ? previous : height));
  }, []);

  useEffect(() => {
    if (!showDesktopChrome) {
      setHeaderHiddenState(false);
      headerCollapse.setValue(0);
      return undefined;
    }

    const animation = Animated.timing(headerCollapse, {
      toValue: headerHidden ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // Height is a layout property, so this cannot run on the native driver.
      // It only runs on the desktop web header, never on a phone.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [headerCollapse, headerHidden, headerHeight, showDesktopChrome]);

  const headerVisibility = useMemo(
    () => ({ setHeaderHidden }),
    [setHeaderHidden]
  );

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
    <SiteHeaderVisibilityContext.Provider value={headerVisibility}>
      <View style={styles.root}>
        {showDesktopChrome ? (
          <Animated.View
            pointerEvents={headerHidden ? 'none' : 'auto'}
            style={[
              styles.headerShell,
              headerHeight > 0 && {
                height: headerCollapse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [headerHeight, 0],
                }),
              },
            ]}
          >
            <Animated.View
              onLayout={handleHeaderLayout}
              style={
                headerHeight > 0
                  ? {
                      transform: [
                        {
                          translateY: headerCollapse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -headerHeight],
                          }),
                        },
                      ],
                    }
                  : undefined
              }
            >
              <SiteHeader onSearchSubmit={handleSearchSubmit} />
            </Animated.View>
          </Animated.View>
        ) : null}
        <View style={styles.body}>
          <AppTabs hideTabBar={!showTabBar} />
        </View>
      </View>
    </SiteHeaderVisibilityContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerShell: {
    zIndex: 30,
  },
  body: {
    flex: 1,
  },
});