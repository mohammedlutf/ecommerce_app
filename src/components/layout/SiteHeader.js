import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, TextInput, ActivityIndicator, Platform } from 'react-native';
import Icon from '../Icon';
import Container from './Container';
import CatalogAPI from '../../api/catalog';
import useResponsive from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import { useI18n } from '../../i18n/I18nContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { SUBHEADER_HEIGHT } from '../../theme/responsive';
import { navigate, navigationRef } from '../../navigation/navigationRef';
import { openProducts } from '../../seo/linking';

const LOGO = require('../../../assets/rec_logo.png');

/**
 * How long the header stays open after the pointer leaves it.
 *
 * Menus close on `mouseleave`, but the pointer has to cross the gap between the
 * trigger and the panel to reach it. Without a short grace period that gap
 * becomes a dead zone and the menu snaps shut as you move toward it.
 */
const CLOSE_GRACE_MS = 220;

/**
 * Desktop site header: utility strip, search-led main row, category nav with a
 * mega menu.
 *
 * Rendered as a flex sibling *above* the scrolling content by `AppShell`, so it
 * stays put without `position: sticky` — which would not work anyway, because
 * the scroller is each screen's `ScrollView`, not the document.
 *
 * On phone widths the bottom tab bar already provides navigation, so this
 * collapses to logo + compact search + cart and drops the category strip.
 */
export default function SiteHeader({ onSearchSubmit }) {
  const { textStart } = useDirectional();
  const { t, locale, setLocale, isRTL } = useI18n();
  const { isDesktop, isMobile } = useResponsive();
  // Logical-only props (marginStart/end, start/end) compile to nothing on web
  // unless RNW's preprocessor is registered, which it is not in this app.
  const { insetEnd, marginStart, paddingStart, paddingEnd } = useDirectional();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user } = useAuth();

  const [term, setTerm] = useState('');
  const [hierarchy, setHierarchy] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const closeTimer = useRef(null);

  // The nav only exists at desktop widths, so the category tree is not fetched
  // on a phone. It is cached for five minutes at the API layer, so the desktop
  // and mobile shells do not refetch it between each other.
  useEffect(() => {
    if (!isDesktop || hierarchy) return undefined;
    let cancelled = false;
    CatalogAPI.getItemGroupHierarchy().then((data) => {
      if (!cancelled) setHierarchy(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isDesktop, hierarchy]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openMenu = useCallback((name) => {
    clearTimeout(closeTimer.current);
    setOpenGroup(name);
  }, []);

  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenGroup(null), CLOSE_GRACE_MS);
  }, []);

  /*
   * Called by the panel as the pointer enters it.
   *
   * This deliberately does *not* reuse `openMenu`. The panel used to receive
   * `onHover={openMenu}` and wired it straight to `onMouseEnter`, so the DOM
   * synthetic event was passed as the group name, `setOpenGroup(event)` replaced
   * the `'__all__'` sentinel, and the panel unmounted the instant the pointer
   * crossed its top edge. Cancelling the timer on its own keeps the menu open
   * without touching the open-state identity.
   */
  const keepOpen = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  const submitSearch = useCallback(() => {
    const query = term.trim();
    if (query && onSearchSubmit) onSearchSubmit(query);
  }, [term, onSearchSubmit]);

  const goToProducts = useCallback((group) => {
    setOpenGroup(null);
    openProducts(navigationRef.current, { itemGroup: group });
  }, []);

  const go = useCallback((tab, screen) => {
    setOpenGroup(null);
    navigate(tab, screen ? { screen } : undefined);
  }, []);

  const groups = Array.isArray(hierarchy) ? hierarchy : [];

  return (
    <View style={styles.root}>
      {/* ---- Utility strip ---------------------------------------------- */}
      {isDesktop ? (
        <View style={styles.utility}>
          <Container>
            <View style={styles.utilityRow}>
              <View style={styles.utilityCluster}>
                <View style={styles.utilityItem}>
                  <Icon name="time-outline" size={13} color={Colors.onPrimary} />
                  <Text style={[styles.utilityText, textStart]} numberOfLines={1}>
                    {t('footer.workingHoursValue')}
                  </Text>
                </View>
                <View style={styles.utilityDot} />
                <View style={styles.utilityItem}>
                  <Icon name="car-outline" size={13} color={Colors.onPrimary} />
                  <Text style={[styles.utilityText, textStart]} numberOfLines={1}>
                    {t('footer.deliveryNote')}
                  </Text>
                </View>
              </View>

              <LocaleSwitcher locale={locale} setLocale={setLocale} isRTL={isRTL} />
            </View>
          </Container>
        </View>
      ) : null}

      {/* ---- Main row ---------------------------------------------------- */}
      <View style={styles.main}>
        <Container>
          <View style={styles.mainRow}>
            <Pressable
              onPress={() => go('HomeTab', 'Home')}
              style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
              accessibilityRole="link"
            >
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </Pressable>

            {/* Search leads on desktop — it is the primary way in. */}
            <View style={[styles.searchWrap, paddingStart(14), paddingEnd(4)]}>
              <Icon name="search" size={18} color={Colors.textMuted} />
              <TextInput
                value={term}
                onChangeText={setTerm}
                onSubmitEditing={submitSearch}
                placeholder={t('header.searchPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                accessibilityLabel={t('header.searchLabel')}
              />
              {term.length > 0 ? (
                <Pressable
                  onPress={() => setTerm('')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('search.clearSearch')}
                >
                  <Icon name="close-circle" size={18} color={Colors.textMuted} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={submitSearch}
                style={({ pressed }) => [styles.searchGo, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={[styles.searchGoText, textStart]}>{t('header.searchLabel')}</Text>
              </Pressable>
            </View>

            <View style={styles.actions}>
              <HeaderAction
                icon={wishlistCount > 0 ? 'heart' : 'heart-outline'}
                label={t('nav.wishlist')}
                badge={wishlistCount}
                onPress={() => navigate('WishlistTab')}
              />
              <HeaderAction
                icon="person-outline"
                label={user ? t('header.myAccount') : t('header.signIn')}
                onPress={() => go('AccountTab', user ? 'Account' : 'Login')}
              />
              <Pressable
                onPress={() => go('CartTab', 'Cart')}
                style={({ pressed }) => [styles.cartButton, marginStart(4), pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('nav.cart')}
              >
                <Icon name="cart-outline" size={22} color={Colors.primary} />
                {cartCount > 0 ? (
                  <View style={[styles.cartBadge, insetEnd(-5)]}>
                    <Text style={[styles.cartBadgeText, textStart]}>{cartCount > 99 ? '99+' : cartCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
        </Container>
      </View>

      {/* ---- Category nav ------------------------------------------------ */}
      {isDesktop ? (
        <View style={styles.navBar}>
          <Container>
            <View style={styles.navRow}>
              <NavLink
                label={t('nav.home')}
                active={false}
                onPress={() => go('HomeTab', 'Home')}
              />

              <View
                style={styles.navItem}
                onMouseEnter={() => openMenu('__all__')}
                onMouseLeave={scheduleClose}
              >
                <Pressable
                  onPress={() => goToProducts(null)}
                  style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}
                >
                  <Text style={[styles.navLinkText, textStart]}>{t('nav.products')}</Text>
                  <Icon name="chevron-down" size={14} color={Colors.onSurfaceVariant} />
                </Pressable>

                {openGroup === '__all__' ? (
                  <MegaPanel groups={groups} onStayOpen={keepOpen} onLeave={scheduleClose} onPick={goToProducts} />
                ) : null}
              </View>

              <NavLink label={t('nav.categories')} onPress={() => { if (Platform.OS === 'web') { try { navigate('HomeTab', { screen: 'Categories' }); return; } catch {} } go('ProductsTab', 'Products'); }} />
                        <NavLink label={t('nav.offers')} onPress={() => { try { const groups = Array.isArray(hierarchy) ? hierarchy : []; const findGroup = (arr) => { for (let i = 0; i < arr.length; i += 1) { const p = arr[i]; const n = String(p.name || '').toLowerCase(); if (n === 'العروض' || n === 'offers' || n.includes('عرض') || n.includes('offer')) return p.name; if (Array.isArray(p.children)) { for (let j = 0; j < p.children.length; j += 1) { const c = p.children[j]; const cn = String(c.name || '').toLowerCase(); if (cn === 'العروض' || cn === 'offers' || cn.includes('عرض') || cn.includes('offer')) return c.name; } } } return null; }; const offerGroup = findGroup(groups); if (offerGroup) { openProducts(navigationRef.current, { itemGroup: offerGroup }); setOpenGroup(null); return; } } catch {} if (Platform.OS === 'web') { openProducts(navigationRef.current, {}); setOpenGroup(null); return; } go('ProductsTab', 'Products'); }} />
              <NavLink label={t('nav.help')} onPress={() => go('AccountTab', 'Account')} />
              <NavLink label={t('nav.contact')} onPress={() => go('AccountTab', 'Account')} />
            </View>
          </Container>
        </View>
      ) : null}
    </View>
  );
}

function NavLink({ label, onPress, active = false }) {
  const { textStart } = useDirectional();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navLink, active && styles.navLinkActive, pressed && styles.pressed]}
      accessibilityRole="link"
    >
      <Text style={[styles.navLinkText, textStart, active && styles.navLinkTextActive]}>{label}</Text>
    </Pressable>
  );
}

function HeaderAction({ icon, label, badge = 0, onPress }) {
  const { textStart } = useDirectional();
  const { insetEnd } = useDirectional();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View>
        <Icon name={icon} size={22} color={Colors.onSurfaceVariant} />
        {badge > 0 ? (
          <View style={[styles.actionBadge, insetEnd(6)]}>
            <Text style={[styles.actionBadgeText, textStart]}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.actionLabel, textStart]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Category dropdown.
 *
 * Laid out as a multi-column panel rather than a single long list: a supermarket
 * can have hundreds of leaf groups, and a 300-row menu is unusable. Parents run
 * down the first column with their children beside them, which keeps the whole
 * thing inside two or three screen heights.
 */
function MegaPanel({ groups, onStayOpen, onLeave, onPick }) {
  const { textStart } = useDirectional();
  /*
   * Read the translator here rather than taking it as a prop.
   *
   * `t` is only bound inside `SiteHeader`, so referencing it from this sibling
   * component threw `t is not defined` while the panel rendered, which took the
   * whole screen down rather than just the menu. `LocaleSwitcher` below does the
   * same thing; both must call the hook themselves.
   *
   * The direction drives horizontal anchoring explicitly rather than logically.
   * `start: 0` looks like the right abstraction, but react-native-web 0.21
   * compiles it to a literal `start: 0px` declaration, which is not a real CSS
   * property and is silently dropped. The browser then falls back to the panel's
   * static position inside the flex row, so it appeared to the *right* of the
   * trigger in Arabic instead of opening toward the reading direction.
   *
   * `left`/`right` are real properties and are never flipped by `dir`, which is
   * what is wanted here: the panel is pinned to the trigger's own edges.
   */
  const { t, isRTL } = useI18n();

  const anchor = isRTL ? styles.megaRTL : styles.megaLTR;

  if (!groups.length) {
    return (
      <View style={[styles.mega, anchor]} onMouseEnter={onStayOpen} onMouseLeave={onLeave}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.mega, anchor]} onMouseEnter={onStayOpen} onMouseLeave={onLeave}>
      {/*
        The panel is capped to the viewport and the grid inside it scrolls.

        A supermarket can have hundreds of leaf groups; an uncapped panel simply
        ran off the bottom of the screen with no way to reach the rest of the
        catalogue. `maxHeight` is relative to the viewport so the panel always
        fits, and the "all categories" button stays pinned underneath it — it is
        the way out of the menu and must never be the thing that scrolls away.
      */}
      <View style={styles.megaScroll} className="scrollbar-thin">
        <View style={styles.megaGrid}>
          {groups.map((group) => (
            <View key={group.name} style={styles.megaColumn}>
              <Pressable onPress={() => onPick(group.name)} className="hover-tint" style={styles.megaParent}>
                <Text style={[styles.megaParentText, textStart]} numberOfLines={1}>
                  {group.name}
                </Text>
                <Icon name="chevron-forward" size={13} color={Colors.primary} style={styles.megaChevron} />
              </Pressable>
              {(group.children || []).map((child) => (
                <Pressable
                  key={child.name}
                  onPress={() => onPick(child.name)}
                  className="hover-tint"
                  style={styles.megaChild}
                >
                  <Text style={[styles.megaChildText, textStart]} numberOfLines={1}>
                    {child.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={() => onPick(null)} className="hover-tint" style={styles.megaAll}>
        <Text style={[styles.megaAllText, textStart]}>{t('nav.allCategories')}</Text>
        <Icon name="arrow-forward" size={14} color={Colors.onPrimary} />
      </Pressable>
    </View>
  );
}

/**
 * Language switcher.
 *
 * Shows both endonyms rather than a flag or "AR/EN": a visitor who cannot read
 * the current language's label is exactly the visitor who needs the switcher,
 * so the alternatives have to be legible to them.
 */
function LocaleSwitcher({ locale, setLocale, isRTL }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  const options = [
    { code: 'ar', label: 'العربية' },
    { code: 'en', label: 'English' },
  ];
  return (
    <View style={styles.localeSwitch} accessibilityRole="radiogroup" accessibilityLabel={t('header.changeLanguage')}>
      {options.map((option) => {
        const active = option.code === locale;
        return (
          <Pressable
            key={option.code}
            onPress={() => setLocale(option.code)}
            style={[styles.localeOption, active && styles.localeOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.localeText, textStart, active && styles.localeTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.surface,
    // Sits above the screen scroller; the border is what separates it from
    // scrolling content passing underneath.
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    zIndex: 30,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0 } : {}),
  },
  pressed: { opacity: 0.6 },

  utility: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  utilityCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  utilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  utilityText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyMedium,
  },
  utilityDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  localeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    padding: 2,
  },
  localeOption: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  localeOptionActive: {
    backgroundColor: Colors.surface,
  },
  localeText: {
    fontSize: Typography.sizes.labelSm,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: Typography.fontFamilySemiBold,
  },
  localeTextActive: {
    color: Colors.primary,
  },

  main: {
    paddingVertical: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  brand: {
    height: 44,
    justifyContent: 'center',
  },
  logo: {
    height: 40,
    width: 'auto',
    maxWidth: 160,
  },

  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyRegular,
    // Removes the 1px inner border react-native-web adds to TextInput.
    outlineStyle: 'none',
  },
  searchGo: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGoText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    minWidth: 62,
  },
  actionLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    maxWidth: 72,
  },
  actionBadge: {
    position: 'absolute',
    top: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    color: Colors.onError,
    fontSize: 10,
    fontFamily: Typography.fontFamilyExtraBold,
  },

  cartButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: Colors.onSecondary,
    fontSize: 11,
    fontFamily: Typography.fontFamilyExtraBold,
  },

  navBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: SUBHEADER_HEIGHT,
  },
  navItem: {
    position: 'relative',
    height: '100%',
    justifyContent: 'center',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  navLinkActive: {
    backgroundColor: Colors.primaryContainer,
  },
  navLinkText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilySemiBold,
  },
  navLinkTextActive: {
    color: Colors.primary,
  },

  mega: {
    position: 'absolute',
    top: '100%',
    width: 760,
    maxWidth: '86vw',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 18,
    zIndex: 40,
    ...Shadows.lg,
  },
  // The scrolling body of the panel. Capped against the viewport so the panel
  // can never be taller than the window, and the grid inside it scrolls when
  // the catalogue is long enough to overflow.
  megaScroll: {
    maxHeight: '70vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  // No `marginTop` gap here on purpose. A gap between the trigger and the panel
  // is a dead zone: the pointer crosses it, `onMouseLeave` on the trigger fires
  // and schedules a close, and if the pointer has not reached the panel before
  // the timer expires the menu vanishes mid-reach. Abutting edges mean the
  // panel's own `onMouseEnter` cancels the timer.
  megaLTR: {
    left: 0,
    right: 'auto',
  },
  megaRTL: {
    right: 0,
    left: 'auto',
  },
  megaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  megaColumn: {
    width: 168,
    gap: 1,
  },
  megaParent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
  },
  megaParentText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  megaChevron: {
    opacity: 0.5,
  },
  megaChild: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  megaChildText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },
  megaAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  megaAllText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
});
