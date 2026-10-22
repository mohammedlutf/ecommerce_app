import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useConfirm from '../../components/ConfirmDialog';
import PageFooter from '../../components/layout/PageFooter';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useNotifications } from '../../context/NotificationContext';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { useSiteChrome } from '../../hooks/useResponsive';
import LoginScreen from '../auth/LoginScreen';
import useDirectional from '../../hooks/useDirectional';

/**
 * The account hub.
 *
 * A directory of destinations rather than a place that also lists things: the
 * order history and the address book each have their own screen now, reached
 * from the rows below. Keeping the lists here as tabs meant the hub had to load
 * — and page, and refresh — data the shopper had not asked for yet.
 */
export default function AccountScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  const { showDesktopChrome } = useSiteChrome();
  useDocumentHead({ title: t('seo.accountTitle'), path: '/account', noindex: true });
  useResetOnTabPress(navigation, 'AccountTab');

  const { user, isAuthenticated, logout } = useAuth();
  const { isAdmin } = useAdmin();
  const { confirm, confirmDialog } = useConfirm();
  const { unreadCount } = useNotifications();

  function handleLogout() {
    confirm({
      title: 'تسجيل الخروج',
      message: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      confirmLabel: 'تسجيل الخروج',
      cancelLabel: 'إلغاء',
      tone: 'destructive',
      onConfirm: logout,
    });
  }

  if (!isAuthenticated) {
    return <LoginScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, showDesktopChrome && styles.scrollContentWide]} showsVerticalScrollIndicator={false}>
        {/*
         * Capped, centred content column. Without it the profile card and every
         * link row stretch the full window width on a desktop monitor, which
         * leaves very long line lengths and pushes the icons to the far edge.
         * The footer stays a direct child of the ScrollView so it remains
         * full-bleed.
         */}
        <View style={[styles.column, showDesktopChrome && styles.columnWide]}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, textStart]}>
                {(user?.name || user?.email || 'ع')[0].toUpperCase()}
              </Text>
            </View>
            <View style={[styles.profileInfo, textStart]}>
              <Text style={[styles.profileName, textStart]}>{user?.fullName || 'مستخدم زاد'}</Text>
              <Text style={[styles.profileEmail, textStart]}>{user?.mobileNo}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.notifIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="الإشعارات"
            >
              <Icon name="notifications-outline" size={22} color={Colors.onSurfaceVariant} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={[styles.notifBadgeText, textStart]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="log-out-outline" size={22} color={Colors.error} />
            </TouchableOpacity>
          </View>

          {/*
           * Destinations, listed the same way as the vendor entry below them.
           *
           * Orders and addresses are their own screens rather than tabs on this
           * one, so tapping through is a deliberate act and the hub itself needs
           * no data fetch. The vendor dashboard is offered to every signed-in
           * customer because its landing screen handles the "not a vendor yet"
           * case by showing the application form. The marketplace desk is
           * reserved for platform admins, so it is simply not rendered for
           * anyone else — hiding the row is friendlier than showing a locked
           * door, and the server still refuses the calls.
           */}
          <View style={styles.linkSection}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MyOrders')}
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel="طلباتي"
            >
              <View style={styles.linkIcon}>
                <Icon name="receipt-outline" size={20} color={Colors.primary} />
              </View>
              <View style={[styles.linkText, textStart]}>
                <Text style={[styles.linkTitle, textStart]}>طلباتي</Text>
                <Text style={[styles.linkSubtitle, textStart]}>
                  تابع طلباتك الحالية، وأعد طلب ما أعجبك، أو ألغِ طلباً.
                </Text>
              </View>
              <Icon name="chevron-back" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MyAddresses')}
              style={[styles.linkRow, styles.linkRowBordered]}
              accessibilityRole="button"
              accessibilityLabel="عناويني"
            >
              <View style={styles.linkIcon}>
                <Icon name="location-outline" size={20} color={Colors.primary} />
              </View>
              <View style={[styles.linkText, textStart]}>
                <Text style={[styles.linkTitle, textStart]}>عناويني</Text>
                <Text style={[styles.linkSubtitle, textStart]}>
                  أضف عناوين التوصيل وعدّلها، وحدّد العنوان الأساسي.
                </Text>
              </View>
              <Icon name="chevron-back" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('VendorHome')}
              style={[styles.linkRow, styles.linkRowBordered]}
              accessibilityRole="button"
              accessibilityLabel="متجري"
            >
              <View style={styles.linkIcon}>
                <Icon name="storefront-outline" size={20} color={Colors.primary} />
              </View>
              <View style={[styles.linkText, textStart]}>
                <Text style={[styles.linkTitle, textStart]}>متجري</Text>
                <Text style={[styles.linkSubtitle, textStart]}>
                  افتح متجرك، وأدِر منتجاتك وطلباتك ومستحقاتك.
                </Text>
              </View>
              <Icon name="chevron-back" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('MarketplaceAdmin')}
                style={[styles.linkRow, styles.linkRowBordered]}
                accessibilityRole="button"
                accessibilityLabel="إدارة السوق"
              >
                <View style={styles.linkIcon}>
                  <Icon name="shield-checkmark-outline" size={20} color={Colors.primary} />
                </View>
                <View style={[styles.linkText, textStart]}>
                  <Text style={[styles.linkTitle, textStart]}>إدارة السوق</Text>
                  <Text style={[styles.linkSubtitle, textStart]}>
                    اعتماد المتاجر، وضبط العمولات، وتسوية المستحقات.
                  </Text>
                </View>
                <Icon name="chevron-back" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Logout Bottom Button */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleLogout} style={styles.logoutBtn}>
            <Icon name="log-out-outline" size={16} color={Colors.error} />
            <Text style={[styles.logoutBtnText, textStart]}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>

        {/* Desktop-only site footer; must live inside the ScrollView. */}
        <PageFooter />
      </ScrollView>

      {/* Web confirm dialog for logout. */}
      {confirmDialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentWide: {
    maxWidth: 1080,
    alignSelf: 'center',
    width: '100%',
  },
  column: {
    width: '100%',
  },
  columnWide: {
    maxWidth: 1080,
    alignSelf: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: 20,
    ...Shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: Typography.sizes.titleSm,
    fontWeight: '800',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
  },
  logoutIconBtn: {
    padding: 8,
  },
  notifIconBtn: {
    padding: 8,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLowest,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: Typography.fontFamilyExtraBold,
  },
  linkSection: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: 20,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkRowBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    flex: 1,
  },
  linkTitle: {
    fontSize: Typography.sizes.labelLg,
    fontWeight: '800',
    color: Colors.onSurface,
  },
  linkSubtitle: {
    marginTop: 2,
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: Colors.error,
    fontSize: Typography.sizes.labelLg,
    fontWeight: '700',
  },
});
