import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';
import { Colors } from '../../theme/colors';
import { Radius, Shadows, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

/**
 * DashboardShell — the frame a back-office screen sits in on the web.
 *
 * ## The problem it solves
 *
 * The vendor dashboard and the marketplace console are the two places in this
 * app where a shopper is actually *working* rather than browsing: reading
 * orders, editing products, settling payouts. On a phone that is a stack of
 * screens; on a desktop it should be an application — a persistent navigation
 * rail beside the content, so moving between sections does not mean going
 * back to a hub and choosing again.
 *
 * Without this, each of those screens rendered a column of cards with a
 * heading and nothing else, which on a 1440px monitor is a mobile layout
 * stretched across a wide window.
 *
 * ## How it stays out of the phone build
 *
 * `useSiteChrome()` is the gate: the shell only appears on the web at desktop
 * width. A phone gets the same content with the same padding and nothing else,
 * so no mobile screen changes shape.
 *
 * @param {Array<{route: string, label: string, icon: string, badge?: number}>} navItems
 * @param {string} activeRoute The route currently on screen.
 * @param {Function} onNavigate Called with a route when a nav item is chosen.
 * @param {string} brand Title shown at the top of the rail.
 * @param {string} [brandSub] One line under the title.
 * @param {React.ReactNode} footer Rendered after the content — the site footer.
 * @param {object} [refreshControl] Passed to the scroll view.
 * @param {object} [contentStyle] Extra style for the scroll content.
 * @param {number} [maxWidth] Cap for the content column.
 */
export default function DashboardShell({
  navItems = [],
  activeRoute,
  onNavigate,
  brand,
  brandSub,
  footer,
  refreshControl,
  contentStyle,
  maxWidth = 1080,
  children,
}) {
  const { textStart, borderEnd } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();

  if (!showDesktopChrome) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.mobileContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.root}>
        {/* The rail sits on the inline-start edge, which in this RTL app is the
            right-hand side of the window — the same place the mobile tab bar
            occupies, so the layout reads the same way in both. */}
        <View style={[styles.sidebar, borderEnd(1)]}>
          <View style={styles.brand}>
            <Text style={[styles.brandTitle, textStart]} numberOfLines={1}>
              {brand}
            </Text>
            {brandSub ? (
              <Text style={[styles.brandSub, textStart]} numberOfLines={1}>
                {brandSub}
              </Text>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.navList}
            showsVerticalScrollIndicator={false}
            className="scrollbar-thin"
          >
            {navItems.map((item) => {
              const active = item.route === activeRoute;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => onNavigate && onNavigate(item.route)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={active ? undefined : 'hover-tint'}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    color={active ? Colors.onPrimary : Colors.onSurfaceVariant}
                  />
                  <Text
                    style={[styles.navLabel, textStart, active && styles.navLabelActive]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.badge ? (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {/* `flexGrow` on the content plus a `flex: 1` body is the
              `min-h-screen flex flex-col` shape: on a short page the body
              takes the slack and the footer is pushed to the bottom of the
              window instead of floating halfway up it. */}
          <View style={[styles.body, { maxWidth }]}>
            <View style={styles.bodyInner}>{children}</View>
            {footer}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
    flexDirection: 'row',
  },

  // --- Rail ----------------------------------------------------------------
  sidebar: {
    width: 258,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderColor: Colors.borderSubtle,
  },
  brand: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  brandTitle: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  brandSub: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
  },
  navList: {
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: Colors.primary,
    ...Shadows.xs,
  },
  navLabel: {
    flex: 1,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  navLabelActive: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  navBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyExtraBold,
  },

  // --- Content -------------------------------------------------------------
  main: {
    flex: 1,
  },
  mainContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  bodyInner: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  mobileContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
});
