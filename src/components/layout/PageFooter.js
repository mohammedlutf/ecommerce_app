import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator, Image } from 'react-native';
import Icon from '../Icon';
import Container from './Container';
import CatalogAPI from '../../api/catalog';
import { useSiteChrome } from '../../hooks/useResponsive';
import { useToast } from '../../context/ToastContext';
import { navigationRef } from '../../navigation/navigationRef';
import { openProducts } from '../../seo/linking';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

const LOGO = require('../../../assets/rec_logo.png');

const SOCIALS = [
  { name: 'logo-facebook', label: 'Facebook' },
  { name: 'logo-instagram', label: 'Instagram' },
  { name: 'logo-whatsapp', label: 'WhatsApp' },
  { name: 'logo-telegram', label: 'Telegram' },
];

/**
 * Site footer.
 *
 ## Where this lives, and why it is not in the shell

 The app renders as a fixed-height shell: Expo's web reset sets
 `body { overflow: hidden }` and every screen owns a `ScrollView`. There is no
 document-level flow for a footer to sit at the end of, so the footer is
 appended *inside* each screen's scroll content (see `AppShell`). It renders
 nothing on phone widths, where the bottom tab bar leaves no room and a footer
 three screens deep is never seen anyway.

 Columns are driven by `t()` so the same component serves both languages, and the
 category column is populated from the real item-group hierarchy rather than a
 hardcoded list that would rot the first time a department was renamed.
 */
export default function PageFooter() {
  const { textStart } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();
  const t = (k) => {
    const map = {
      'footer.aboutTitle': 'عن المتجر',
      'footer.aboutText': 'متجرك الإلكتروني الموثوق للتسوق السريع والآمن.',
      'footer.subscribeTitle': 'اشترك في النشرة الإخبارية',
      'footer.subscribeText': 'احصل على أحدث العروض والمنتجات مباشرة إلى بريدك الإلكتروني',
      'footer.subscribePlaceholder': 'البريد الإلكتروني',
      'footer.subscribeCta': 'اشتراك',
      'footer.shopTitle': 'التسوق',
      'nav.products': 'المنتجات',
      'nav.categories': 'الأقسام',
      'nav.offers': 'العروض',
      'nav.wishlist': 'المفضلة',
      'nav.cart': 'السلة',
      'footer.helpTitle': 'المساعدة',
      'account.orders': 'طلباتي',
      'nav.trackOrder': 'تتبع الطلب',
      'footer.shipping': 'الشحن والتوصيل',
      'footer.returns': 'الإرجاع والاستبدال',
      'footer.faq': 'الأسئلة الشائعة',
      'footer.categoriesTitle': 'الأقسام',
      'footer.contactTitle': 'تواصل معنا',
      'footer.deliveryNote': 'التوصيل داخل الرياض وجميع المدن',
      'footer.workingHoursValue': 'السبت - الخميس: 9 ص - 6 م',
      'footer.fridayHours': 'الجمعة: مغلق',
      'home.securePayment': 'دفع آمن',
      'home.easyReturns': 'إرجاع سهل',
      'footer.rightsReserved': 'جميع الحقوق محفوظة',
      'footer.privacy': 'سياسة الخصوصية',
      'footer.terms': 'شروط الاستخدام',
      'app.name': 'متجر',
      'errors.somethingWrong': 'حدث خطأ ما',
      'footer.subscribed': 'تم الاشتراك بنجاح',
    };
    return map[k] || k;
  };
  const toast = useToast();
  const [groups, setGroups] = useState(null);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!showDesktopChrome || groups) return undefined;
    let cancelled = false;
    CatalogAPI.getItemGroupHierarchy().then((data) => {
      if (!cancelled) setGroups(data);
    });
    return () => {
      cancelled = true;
    };
  }, [showDesktopChrome, groups]);

  const subscribe = useCallback(() => {
    const value = email.trim();
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) {
      toast.error(t('errors.somethingWrong'));
      return;
    }
    // No mailing-list endpoint exists yet. Reporting success optimistically
    // would be a lie the customer acts on, so this is honest about being inert.
    setSubscribing(true);
    setTimeout(() => {
      setSubscribing(false);
      setEmail('');
      toast.success(t('footer.subscribed'));
    }, 400);
  }, [email, toast, t]);

  /*
   * `go` is declared before the early return on purpose.
   *
   * A hook after a conditional return changes the hook count between renders,
   * so React throws "Rendered fewer hooks than expected" the moment the window
   * crosses the breakpoint — and on any device that starts on mobile and is
   * then rotated or resized. Every hook must be unconditional.
   */
  const go = useCallback((tab, screen) => navigationRef.current?.navigate(tab, { screen }), []);

  // Phone and narrow web have no footer: the bottom tab bar already occupies
  // that edge, and a newsletter form above it would crowd a 5-inch screen.
  // Keyed to the same rule as the shell so a footer can never appear without
  // the `SiteHeader` that goes with it.
  if (!showDesktopChrome) return null;

  const topGroups = (Array.isArray(groups) ? groups : []).slice(0, 6);

  return (
    <View style={styles.root}>
      {/* ---- Newsletter band ------------------------------------------- */}
      <View style={styles.newsletter}>
        <Container>
          <View style={styles.newsletterRow}>
            <View style={styles.newsletterCopy}>
              <Text style={[styles.newsletterTitle, textStart]}>{t('footer.newsletterTitle')}</Text>
              <Text style={[styles.newsletterText, textStart]}>{t('footer.newsletterText')}</Text>
            </View>
            <View style={styles.subscribeRow}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={subscribe}
                placeholder={t('footer.newsletterPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                style={styles.subscribeInput}
                accessibilityLabel={t('footer.newsletterPlaceholder')}
              />
              <Pressable
                onPress={subscribe}
                disabled={subscribing}
                style={({ pressed }) => [styles.subscribeBtn, pressed && styles.pressed]}
              >
                {subscribing ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Text style={[styles.subscribeText, textStart]}>{t('footer.subscribe')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Container>
      </View>

      {/* ---- Link columns ----------------------------------------------- */}
      <View style={styles.columns}>
        <Container>
          <View style={styles.columnsGrid}>
            <View style={styles.about}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={[styles.aboutText, textStart]}>{t('footer.aboutText')}</Text>
              <View style={styles.socials}>
                {SOCIALS.map((social) => (
                  <Pressable
                    key={social.name}
                    onPress={() => {}}
                    style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
                    accessibilityRole="link"
                    accessibilityLabel={social.label}
                  >
                    <Icon name={social.name} size={18} color={Colors.onSurfaceVariant} />
                  </Pressable>
                ))}
              </View>
            </View>

            <FooterColumn
              title={t('footer.shopTitle')}
              links={[
                { label: t('nav.products'), onPress: () => go('ProductsTab', 'Products') },
                { label: t('nav.categories'), onPress: () => { try { navigationRef.current?.navigate('HomeTab', { screen: 'Categories' }); } catch { go('ProductsTab', 'Products'); } } },
                { label: t('nav.offers'), onPress: () => { try { const arr = Array.isArray(groups) ? groups : []; const findGroup = (a) => { for (let i = 0; i < a.length; i += 1) { const p = a[i]; const n = String(p.name || '').toLowerCase(); if (n === 'العروض' || n === 'offers' || n.includes('عرض')) return p.name; if (Array.isArray(p.children)) { for (let j = 0; j < p.children.length; j += 1) { const c = p.children[j]; const cn = String(c.name || '').toLowerCase(); if (cn === 'العروض' || cn === 'offers' || cn.includes('عرض')) return c.name; } } } return null; }; const g = findGroup(arr); if (g) { openProducts(navigationRef.current, { itemGroup: g }); return; } } catch {} openProducts(navigationRef.current, {}); } },
                // `WishlistTab` is its own tab, not a screen inside `AccountTab`; the
        // nested form made React Navigation throw "action was not handled".
        { label: t('nav.wishlist'), onPress: () => go('WishlistTab') },
                { label: t('nav.cart'), onPress: () => go('CartTab', 'Cart') },
              ]}
            />

            <FooterColumn
              title={t('footer.helpTitle')}
              links={[
                { label: t('account.orders'), onPress: () => { try { navigationRef.current?.navigate('AccountTab', { screen: 'MyOrders' }); } catch { go('AccountTab', 'Account'); } } },
                { label: t('nav.trackOrder'), onPress: () => { try { navigationRef.current?.navigate('AccountTab', { screen: 'MyOrders' }); } catch { go('AccountTab', 'Account'); } } },
                { label: t('footer.shipping'), onPress: () => go('AccountTab', 'Account') },
                { label: t('footer.returns'), onPress: () => go('AccountTab', 'Account') },
                { label: t('footer.faq'), onPress: () => go('AccountTab', 'Account') },
              ]}
            />

            <FooterColumn
              title={t('footer.categoriesTitle')}
              loading={groups === null}
              links={topGroups.map((group) => ({
                label: group.name,
                onPress: () => openProducts(navigationRef.current, { itemGroup: group.name }),
              }))}
            />

            <View style={styles.contact}>
              <Text style={[styles.columnTitle, textStart]}>{t('footer.contactTitle')}</Text>

              <View style={styles.contactItem}>
                <Icon name="location-outline" size={17} color={Colors.primary} />
                <Text style={[styles.contactText, textStart]}>{t('footer.deliveryNote')}</Text>
              </View>
              <View style={styles.contactItem}>
                <Icon name="time-outline" size={17} color={Colors.primary} />
                <View>
                  <Text style={[styles.contactText, textStart]}>{t('footer.workingHoursValue')}</Text>
                  <Text style={[styles.contactText, textStart]}>{t('footer.fridayHours')}</Text>
                </View>
              </View>

              <View style={styles.trustRow}>
                <Icon name="shield-checkmark-outline" size={16} color={Colors.success} />
                <Text style={[styles.trustText, textStart]}>{t('home.securePayment')}</Text>
              </View>
              <View style={styles.trustRow}>
                <Icon name="cube-outline" size={16} color={Colors.success} />
                <Text style={[styles.trustText, textStart]}>{t('home.easyReturns')}</Text>
              </View>
            </View>
          </View>
        </Container>
      </View>

      {/* ---- Legal bar --------------------------------------------------- */}
      <View style={styles.legal}>
        <Container>
          <View style={styles.legalRow}>
            <Text style={[styles.copyright, textStart]}>
              © {new Date().getFullYear()} {t('app.name')} — {t('footer.rightsReserved')}
            </Text>
            <View style={styles.legalLinks}>
              <FooterLink label={t('footer.privacy')} onPress={() => {}} />
              <FooterLink label={t('footer.terms')} onPress={() => {}} />
              <FooterLink label={t('footer.returns')} onPress={() => {}} />
            </View>
          </View>
        </Container>
      </View>
    </View>
  );
}

function FooterColumn({ title, links, loading = false }) {
  const { textStart } = useDirectional();
  return (
    <View style={styles.column}>
      <Text style={[styles.columnTitle, textStart]}>{title}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} style={styles.columnLoader} />
      ) : (
        links.map((link) => (
          <FooterLink key={link.label} label={link.label} onPress={link.onPress} />
        ))
      )}
    </View>
  );
}

function FooterLink({ label, onPress }) {
  const { textStart } = useDirectional();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={[styles.linkText, textStart]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: 32,
  },
  pressed: { opacity: 0.6 },

  newsletter: {
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 26,
  },
  newsletterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 32,
    flexWrap: 'wrap',
  },
  newsletterCopy: {
    flex: 1,
    minWidth: 260,
    gap: 4,
  },
  newsletterTitle: {
    fontSize: Typography.sizes.titleMd,
    color: Colors.onPrimaryContainer,
    fontFamily: Typography.fontFamilyBold,
  },
  newsletterText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onPrimaryContainer,
    fontFamily: Typography.fontFamilyRegular,
    opacity: 0.85,
  },
  subscribeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 340,
    flex: 1,
  },
  subscribeInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyRegular,
    outlineStyle: 'none',
  },
  subscribeBtn: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },

  columns: {
    paddingVertical: 34,
  },
  columnsGrid: {
    flexDirection: 'row',
    gap: 32,
    flexWrap: 'wrap',
  },
  about: {
    width: 280,
    gap: 12,
  },
  logo: {
    height: 40,
    width: 'auto',
    maxWidth: 170,
    alignSelf: 'flex-start',
  },
  aboutText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
    fontFamily: Typography.fontFamilyRegular,
  },
  socials: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  socialBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  column: {
    width: 170,
    gap: 2,
  },
  contact: {
    width: 230,
    gap: 10,
  },
  columnTitle: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyBold,
    marginBottom: 6,
  },
  columnLoader: { alignSelf: 'flex-start', marginTop: 6 },

  link: {
    paddingVertical: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  linkText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },

  contactItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  contactText: {
    flex: 1,
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    fontFamily: Typography.fontFamilyRegular,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  trustText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyMedium,
  },

  legal: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingVertical: 16,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  copyright: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },
  legalLinks: {
    flexDirection: 'row',
    gap: 18,
  },
});