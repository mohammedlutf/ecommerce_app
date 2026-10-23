import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import useConfirm from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useVendor } from '../../context/VendorContext';
import VendorAPI from '../../api/vendor';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';
import DashboardShell from '../../components/layout/DashboardShell';
import vendorStyles from '../../components/vendor/vendorStyles';

const STATUS_LABEL = {
  Pending: 'قيد المراجعة',
  Approved: 'معتمد',
  Suspended: 'موقوف',
  Rejected: 'مرفوض',
  Cancelled: 'ملغى',
};

const STATUS_TONE = {
  Pending: { bg: Colors.warningContainer, fg: Colors.warning, icon: 'time-outline' },
  Approved: { bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Suspended: { bg: Colors.errorContainer, fg: Colors.error, icon: 'ban-outline' },
  Rejected: { bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
  Cancelled: { bg: Colors.surfaceContainer, fg: Colors.onSurfaceVariant, icon: 'close-circle' },
};

const TABS = [
  { route: 'VendorOrders', label: 'الطلبات', icon: 'receipt-outline' },
  { route: 'VendorProducts', label: 'المنتجات', icon: 'cube-outline' },
  { route: 'VendorPayouts', label: 'المستحقات', icon: 'wallet-outline' },
  { route: 'VendorShop', label: 'إعدادات المتجر', icon: 'settings-outline' },
];

/*
 * The navigation rail of the desktop dashboard.
 *
 * The same four destinations as the phone's quick links, plus an overview
 * entry for the page the rail is drawn on. On the web this list becomes a
 * permanent sidebar, so a vendor moving between orders and products does not
 * have to come back here first.
 */
const RAIL = [{ route: 'VendorHome', label: 'نظرة عامة', icon: 'grid-outline' }, ...TABS];

/**
 * VendorHomeScreen — the vendor's landing page.
 *
 * It is deliberately one screen rather than two: what an account sees here is
 * decided entirely by its marketplace state, and splitting "apply" and
 * "dashboard" into separate routes would mean every entry point had to know
 * which one to push. `vendor_state` answers once and this screen renders the
 * matching face — applicant, applicant-in-review, suspended shop, or dashboard.
 */
export default function VendorHomeScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const { isAuthenticated } = useAuth();
  const { checked, isVendor, isApproved, status, shop, application, refresh } = useVendor();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mirrors `dashboard` so the focus effect can ask "do we already have figures
  // on screen?" without taking `dashboard` itself as a dependency.
  const dashboardRef = useRef(null);

  const loadDashboard = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await VendorAPI.getDashboard(30);
      dashboardRef.current = data;
      setDashboard(data);
    } catch (err) {
      console.warn('Could not load the vendor dashboard:', err.message);
      dashboardRef.current = null;
      setDashboard(null);
    } finally {
      if (showSpinner) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh on focus, not on a timer: the figures only move when an order does,
  // so an idle vendor should not be issuing a request every few seconds. The
  // callback has to stay referentially stable — `useFocusEffect` re-runs it
  // whenever its identity changes, and depending on `dashboard` here meant each
  // response scheduled the next request, hammering the server in a loop.
  useFocusEffect(
    useCallback(() => {
      if (isApproved) loadDashboard({ showSpinner: !dashboardRef.current });
      return undefined;
    }, [isApproved, loadDashboard])
  );

  function handleRefresh() {
    setRefreshing(true);
    refresh().finally(() => {
      if (isApproved) loadDashboard({ showSpinner: false });
      else setRefreshing(false);
    });
  }

  function handleCancelApplication() {
    confirm({
      title: 'سحب الطلب',
      message: 'سيتم سحب طلب فتح المتجر. يمكنك التقديم مرة أخرى في أي وقت.',
      confirmLabel: 'نعم، اسحب الطلب',
      cancelLabel: 'تراجع',
      tone: 'destructive',
      onConfirm: async () => {
        try {
          await VendorAPI.cancelApplication();
          toast.success('تم سحب الطلب');
          await refresh();
        } catch (err) {
          toast.error(err?.message || 'تعذر سحب الطلب');
        }
      },
    });
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <EmptyState
          icon="lock-closed-outline"
          title="تسجيل الدخول مطلوب"
          description="سجّل الدخول بحسابك لإدارة متجرك على المنصة."
          actionLabel="تسجيل الدخول"
          onAction={() => navigation.navigate('Login')}
        />
      </SafeAreaView>
    );
  }

  if (!checked) {
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <View style={vendorStyles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={vendorStyles.centreText}>جاري تحميل حالة المتجر...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Not (yet) a vendor -------------------------------------------------
  if (!isVendor) {
    const inReview = status === 'Pending';
    const wasRejected = status === 'Rejected' || status === 'Cancelled';
    const tone = STATUS_TONE[status] || STATUS_TONE.Pending;

    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={vendorStyles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
        >
          <View style={vendorStyles.column}>
            <Text style={[vendorStyles.pageTitle, textStart]}>انضم كبائع</Text>
            <Text style={[vendorStyles.pageSubtitle, textStart]}>
              اعرض منتجاتك على المنصة وأدر طلباتك ومستحقاتك من مكان واحد.
            </Text>

            {inReview || wasRejected ? (
              <View style={vendorStyles.card}>
                <View style={[vendorStyles.rowBetween, { marginBottom: 12 }]}>
                  <Text style={[vendorStyles.cardTitle, textStart, { marginBottom: 0 }]}>طلب فتح متجر</Text>
                  <View style={[vendorStyles.badge, { backgroundColor: tone.bg }]}>
                    <Icon name={tone.icon} size={13} color={tone.fg} />
                    <Text style={[vendorStyles.badgeText, textStart, { color: tone.fg }]}>
                      {STATUS_LABEL[status] || status}
                    </Text>
                  </View>
                </View>

                <Text style={[vendorStyles.value, textStart]}>
                  {application?.shop_name || ''}
                </Text>
                {application?.phone ? (
                  <Text style={[vendorStyles.muted, textStart, { marginTop: 4 }]}>
                    هاتف التواصل: {application.phone}
                  </Text>
                ) : null}
                {application?.review_note ? (
                  <View style={styles.noteBox}>
                    <Text style={[vendorStyles.muted, textStart]}>ملاحظة المراجعة: {application.review_note}</Text>
                  </View>
                ) : null}

                {inReview ? (
                  <>
                    <Text style={[vendorStyles.muted, textStart, { marginTop: 12 }]}>
                      طلبك قيد المراجعة. سنُعلمك بمجرد اعتماده، ويمكنك سحبه الآن إن غيّرت رأيك.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleCancelApplication}
                      style={[vendorStyles.dangerBtn, { marginTop: 16 }]}
                    >
                      <Icon name="close-outline" size={18} color={Colors.error} />
                      <Text style={[vendorStyles.dangerBtnText, textStart]}>سحب الطلب</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('VendorApply')}
                    style={[vendorStyles.primaryBtn, { marginTop: 16 }]}
                  >
                    <Icon name="add-circle-outline" size={20} color={Colors.onPrimary} />
                    <Text style={[vendorStyles.primaryBtnText, textStart]}>تقديم طلب جديد</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={vendorStyles.card}>
                <View style={styles.featureRow}>
                  <Icon name="storefront-outline" size={22} color={Colors.primary} />
                  <Text style={[vendorStyles.value, textStart, vendorStyles.flex1]}>
                    متجر خاص بمنتجاتك داخل المنصة
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Icon name="receipt-outline" size={22} color={Colors.primary} />
                  <Text style={[vendorStyles.value, textStart, vendorStyles.flex1]}>
                    إدارة الطلبات ومتابعة حالات التوصيل
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Icon name="wallet-outline" size={22} color={Colors.primary} />
                  <Text style={[vendorStyles.value, textStart, vendorStyles.flex1]}>
                    كشف مستحقات واضح لكل فترة
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('VendorApply')}
                  style={[vendorStyles.primaryBtn, { marginTop: 8 }]}
                >
                  <Icon name="storefront-outline" size={20} color={Colors.onPrimary} />
                  <Text style={[vendorStyles.primaryBtnText, textStart]}>تقديم طلب فتح متجر</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
        {confirmDialog}
      </SafeAreaView>
    );
  }

  // --- A vendor, but not currently approved -------------------------------
  if (!isApproved) {
    const tone = STATUS_TONE[status] || STATUS_TONE.Pending;
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={vendorStyles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
        >
          <View style={vendorStyles.column}>
            <View style={vendorStyles.card}>
              <View style={[vendorStyles.badge, { backgroundColor: tone.bg, marginBottom: 12 }]}>
                <Icon name={tone.icon} size={14} color={tone.fg} />
                <Text style={[vendorStyles.badgeText, textStart, { color: tone.fg }]}>
                  {STATUS_LABEL[status] || status}
                </Text>
              </View>
              <Text style={[vendorStyles.strong, textStart]}>{shop?.shop_name || 'متجرك'}</Text>
              <Text style={[vendorStyles.muted, textStart, { marginTop: 8 }]}>
                {status === 'Suspended'
                  ? 'متجرك موقوف حالياً. منتجاتك غير ظاهرة للعملاء. تواصل مع إدارة المنصة لإعادة تفعيله.'
                  : 'متجرك غير مفعّل بعد. سيظهر للعملاء بعد اعتماده من إدارة المنصة.'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRefresh}
                style={[vendorStyles.secondaryBtn, { marginTop: 16 }]}
              >
                <Icon name="refresh-outline" size={18} color={Colors.primary} />
                <Text style={[vendorStyles.secondaryBtnText, textStart]}>تحديث الحالة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Approved vendor: dashboard -----------------------------------------
  const stats = [
    { label: 'المبيعات', value: formatCurrency(dashboard?.sales || 0), icon: 'trending-up-outline', tone: Colors.primary },
    { label: 'صافي المستحقات', value: formatCurrency(dashboard?.net || 0), icon: 'wallet-outline', tone: Colors.success },
    { label: 'الطلبات', value: String(dashboard?.order_count ?? '—'), icon: 'receipt-outline', tone: Colors.info },
    { label: 'قيد المعالجة', value: String(dashboard?.to_process ?? '—'), icon: 'time-outline', tone: Colors.warning },
  ];

  return (
    <DashboardShell
      navItems={RAIL}
      activeRoute="VendorHome"
      onNavigate={(route) => navigation.navigate(route)}
      brand={shop?.shop_name || 'متجري'}
      brandSub="لوحة البائع"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
      }
      contentStyle={vendorStyles.scrollContent}
    >
      {/* Shop header */}
      <View style={styles.shopHeader}>
        <View style={styles.shopLogo}>
          {shop?.logo ? (
            <Icon name="storefront" size={26} color={Colors.onPrimary} />
          ) : (
            <Icon name="storefront-outline" size={26} color={Colors.onPrimary} />
          )}
        </View>
        <View style={vendorStyles.flex1}>
          <Text style={[vendorStyles.pageTitle, textStart]}>{shop?.shop_name || 'متجرك'}</Text>
          <View style={[vendorStyles.row, { gap: 6, marginTop: 4 }]}>
            <Icon name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={[vendorStyles.muted, textStart]}>متجر معتمد</Text>
          </View>
        </View>
      </View>

      {/* Quick links. On the web the sidebar is the navigation, so the grid
          would be the same four destinations twice. */}
      {showDesktopChrome ? null : (
        <View style={styles.quickGrid}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.route}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(tab.route)}
              style={styles.quickCell}
            >
              <View style={styles.quickIcon}>
                <Icon name={tab.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={[styles.quickLabel, textStart]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Stats */}
      <Text style={[vendorStyles.sectionTitle, textStart, { marginBottom: 12 }]}>
        آخر {dashboard?.period_days || 30} يوماً
      </Text>
      {loading && !dashboard ? (
        <View style={vendorStyles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.statGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.tone + '1A' }]}>
                <Icon name={stat.icon} size={18} color={stat.tone} />
              </View>
              <Text style={[styles.statValue, textStart]}>{stat.value}</Text>
              <Text style={[styles.statLabel, textStart]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top products */}
      {dashboard?.top_products?.length ? (
        <View style={[vendorStyles.card, { marginTop: 16 }]}>
          <Text style={[vendorStyles.cardTitle, textStart]}>الأكثر مبيعاً</Text>
          {dashboard.top_products.map((row, idx) => (
            <View key={`${row.item_name}-${idx}`} style={styles.topRow}>
              <Text style={[vendorStyles.value, textStart, vendorStyles.flex1]} numberOfLines={1}>
                {row.item_name}
              </Text>
              <Text style={[vendorStyles.muted, textStart]}>
                {row.qty} × {formatCurrency(row.amount)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Recent orders */}
      <View style={vendorStyles.card}>
        <View style={vendorStyles.rowBetween}>
          <Text style={[vendorStyles.cardTitle, textStart, { marginBottom: 0 }]}>أحدث الطلبات</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VendorOrders')}>
            <Text style={styles.link}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {dashboard?.recent_orders?.length ? (
          dashboard.recent_orders.map((order) => (
            <TouchableOpacity
              key={order.name}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('VendorOrderDetail', { orderName: order.name })}
              style={styles.recentRow}
            >
              <View style={vendorStyles.flex1}>
                <Text style={[vendorStyles.value, textStart]}>#{order.name}</Text>
                <Text style={[vendorStyles.muted, textStart]}>{formatDate(order.transaction_date)}</Text>
              </View>
              <Text style={[styles.recentTotal, textStart]}>
                {formatCurrency(order.grand_total, order.currency)}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[vendorStyles.muted, textStart, { marginTop: 8 }]}>
            لا توجد طلبات بعد. ستظهر طلباتك هنا بمجرد وصولها.
          </Text>
        )}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  shopLogo: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickCell: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    ...Shadows.xs,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    flexShrink: 1,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    ...Shadows.xs,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  statLabel: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    marginTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  recentTotal: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  link: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
});
