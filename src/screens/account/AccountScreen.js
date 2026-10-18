import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import OrderCard from '../../components/OrderCard';
import AddressCard from '../../components/AddressCard';
import AddressFormModal from '../../components/AddressFormModal';
import EmptyState from '../../components/EmptyState';
import useConfirm from '../../components/ConfirmDialog';
import PageFooter from '../../components/layout/PageFooter';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useSiteChrome } from '../../hooks/useResponsive';
import OrdersAPI, { ORDERS_PAGE_SIZE } from '../../api/orders';
import AddressAPI from '../../api/address';
import LoginScreen from '../auth/LoginScreen';
import useDirectional from '../../hooks/useDirectional';

// `transaction_date` is date-only, so several orders placed on the same day come
// back from the server in an arbitrary order. Sorting again on the client with
// `creation`/`modified` as a tiebreaker guarantees the newest order is always
// the first card, which is what "recent order on top" needs.
const ORDER_DATE_FIELDS = ['transaction_date', 'creation', 'modified', 'posting_date'];

function orderTimestamp(order) {
  for (let i = 0; i < ORDER_DATE_FIELDS.length; i += 1) {
    const value = order && order[ORDER_DATE_FIELDS[i]];
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function sortByNewest(list) {
  return list.slice().sort((a, b) => {
    const diff = orderTimestamp(b) - orderTimestamp(a);
    if (diff !== 0) return diff;
    return String((b && b.name) || '').localeCompare(String((a && a.name) || ''));
  });
}

// An order can legitimately appear on two pages: placing a new order shifts the
// list by one, so the last order of page 1 reappears at the top of page 2.
function dedupeOrders(list) {
  const seen = new Set();
  return list.filter((order) => {
    const key = order && order.name;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function AccountScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  const { showDesktopChrome } = useSiteChrome();
  useDocumentHead({ title: t('seo.accountTitle'), path: '/account', noindex: true });
  useResetOnTabPress(navigation, 'AccountTab');

  const { user, isAuthenticated, logout } = useAuth();
  const { isAdmin } = useAdmin();
  const { confirm, confirmDialog } = useConfirm();
  const { fetchCart } = useCart();
  const toast = useToast();
  const { unreadCount } = useNotifications();

  // Scope everything to the signed-in customer. Keying on the email (not just
  // "is logged in") is what makes a logout → login as somebody else start from
  // a clean slate instead of the previous user's data.
  const userKey = (user && user.email) || null;

  // The address form offers the customer's own number as the default recipient
  // phone. These accounts are registered by phone number, so the local part of
  // the login address is used when `mobile_no` was never filled in on the User
  // document — the same fallback the server applies.
  const defaultPhone =
    (user && user.mobileNo) || (userKey ? userKey.split('@')[0].replace(/[^\d]/g, '') : '');

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'addresses'
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  // The endpoint only started reporting a real total once it supported paging.
  // Until we have loaded a page successfully, fall back to what we hold.
  const [totalKnown, setTotalKnown] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bumped on every request; a response whose id is stale (user switched, tab
  // switched, a newer request started) is dropped instead of overwriting state.
  const requestRef = useRef(0);
  // Latest values readable from callbacks without becoming effect dependencies.
  const userKeyRef = useRef(userKey);
  userKeyRef.current = userKey;
  const dataRef = useRef({ orders: [], addresses: [] });
  dataRef.current = { orders, addresses };
  const hasLoadedRef = useRef(false);

  const loadOrders = useCallback(
    async ({ start = 0, append = false, showSpinner = true } = {}) => {
      const requestId = ++requestRef.current;
      const requestedUser = userKeyRef.current;
      if (!requestedUser) return;

      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await OrdersAPI.getOrders({ start, pageSize: ORDERS_PAGE_SIZE });
        if (requestId !== requestRef.current) return;
        if (requestedUser !== userKeyRef.current) return;

        const page = sortByNewest(data.orders);
        if (append) {
          setOrders((prev) => sortByNewest(dedupeOrders([...prev, ...page])));
        } else {
          setOrders(page);
        }
        setOrdersTotal(data.total);
        setTotalKnown(true);
        setHasMoreOrders(data.hasMore);
      } catch (err) {
        console.warn('Error loading orders:', err);
      } finally {
        if (requestId === requestRef.current) {
          if (append) setLoadingMore(false);
          else if (showSpinner) setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  const loadAddresses = useCallback(async ({ showSpinner = true } = {}) => {
    const requestId = ++requestRef.current;
    const requestedUser = userKeyRef.current;
    if (!requestedUser) return;

    if (showSpinner) setLoading(true);
    try {
      const data = await AddressAPI.getAddresses();
      if (requestId !== requestRef.current) return;
      if (requestedUser !== userKeyRef.current) return;
      setAddresses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Error loading addresses:', err);
    } finally {
      if (requestId === requestRef.current) {
        if (showSpinner) setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadAccountData = useCallback(
    (options = {}) => {
      if (activeTab === 'orders') return loadOrders(options);
      return loadAddresses(options);
    },
    [activeTab, loadOrders, loadAddresses]
  );

  // A different user (or a logout) must never see the previous customer's
  // orders or addresses. Clear the cached lists and invalidate any in-flight
  // request before the reload below runs.
  useEffect(() => {
    ++requestRef.current;
    hasLoadedRef.current = false;
    setOrders([]);
    setOrdersTotal(0);
    setTotalKnown(false);
    setHasMoreOrders(false);
    setAddresses([]);
    // A request dropped by the bump above will never reach its own `finally`,
    // so clear its spinners here or they spin forever.
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [userKey]);

  // Auto-refresh whenever this tab regains focus, and whenever the user or the
  // active tab changes. This is what makes a newly placed order show up the
  // moment you tap "show my orders" on the confirmation screen, instead of the
  // stale list you previously had to pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (!userKeyRef.current) return undefined;
      const currentList =
        activeTab === 'orders' ? dataRef.current.orders : dataRef.current.addresses;
      // Spinner only when there is nothing to show yet, so a background
      // refresh never blanks out a list the user is already reading.
      const showSpinner = !hasLoadedRef.current || currentList.length === 0;
      hasLoadedRef.current = true;
      loadAccountData({ showSpinner });
      return undefined;
    }, [activeTab, userKey, loadAccountData])
  );

  // …and again when the app comes back to the foreground.
  useLiveRefresh(
    useCallback(() => loadAccountData({ showSpinner: false }), [loadAccountData]),
    { intervalMs: 0, isEnabled: !!userKey }
  );

  function handleLoadMore() {
    if (loadingMore) return;
    const start = dataRef.current.orders.length;
    loadOrders({ start, append: true, showSpinner: false });
  }

  function handleRefresh() {
    setRefreshing(true);
    loadAccountData({ showSpinner: false });
  }

  async function handleCancelOrder(orderName) {
    confirm({
      title: 'تأكيد الإلغاء',
      message: `هل أنت متأكد من رغبتك في إلغاء الطلب #${orderName}؟`,
      confirmLabel: 'نعم، إلغاء',
      cancelLabel: 'تراجع',
      tone: 'destructive',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await OrdersAPI.cancelOrder(orderName);
          toast.success('تم إلغاء الطلب بنجاح');
          // Reload the first page so a cancelled order drops out of the list
          // (and the total updates) without blanking the screen.
          await loadOrders({ showSpinner: false });
        } catch (err) {
          toast.error(err.message || 'تعذر إلغاء الطلب');
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  async function handleReorder(orderName) {
    setActionLoading(true);
    try {
      await OrdersAPI.reorderOrder(orderName);
      await fetchCart();
      toast.success('تمت إضافة منتجات هذا الطلب إلى سلتك بنجاح!');
    } catch (err) {
      toast.error(err.message || 'تعذر إعادة الطلب');
    } finally {
      setActionLoading(false);
    }
  }

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

  // --- Addresses ------------------------------------------------------------
  // `formMode` drives one modal for both create and edit; keeping them separate
  // meant the two forms could validate and send different payloads.
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);

  function handleAddAddressPress() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function handleEditAddress(address) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  function handleCloseForm() {
    if (savingAddress) return;
    setFormOpen(false);
    setEditingAddress(null);
  }

  async function handleSubmitAddress(values) {
    setSavingAddress(true);
    try {
      if (editingAddress) {
        await AddressAPI.updateAddress({
          addressName: editingAddress.name,
          ...values,
        });
        toast.success('تم تحديث العنوان');
      } else {
        await AddressAPI.addAddress(values);
        toast.success('تم إضافة العنوان');
      }
      setFormOpen(false);
      setEditingAddress(null);
      // Reload without a spinner: the list is already on screen, and blanking it
      // for a fraction of a second reads as a glitch.
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || (editingAddress ? 'تعذر تحديث العنوان' : 'تعذر إضافة العنوان'));
    } finally {
      setSavingAddress(false);
    }
  }

  function handleDeleteAddress(address) {
    confirm({
      title: 'حذف العنوان',
      message: `سيتم حذف "${address.address_title || 'عنوان التوصيل'}" نهائياً. هل أنت متأكد؟`,
      confirmLabel: 'نعم، احذف',
      cancelLabel: 'تراجع',
      tone: 'destructive',
      onConfirm: () => deleteAddress(address),
    });
  }

  async function deleteAddress(address) {
    setAddressBusy(true);
    try {
      await AddressAPI.deleteAddress(address.name);
      toast.success('تم حذف العنوان');
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر حذف العنوان');
    } finally {
      setAddressBusy(false);
    }
  }

  async function handleSetDefaultAddress(address) {
    setAddressBusy(true);
    try {
      await AddressAPI.setDefaultAddress(address.name);
      toast.success('تم تعيين العنوان الأساسي');
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر تعيين العنوان الأساسي');
    } finally {
      setAddressBusy(false);
    }
  }

  if (!isAuthenticated) {
    return <LoginScreen navigation={navigation} />;
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primaryContainer]}
          />
        }
>
        {/*
         * Capped, centred content column. Without it the profile card, the tab
         * switcher and every order row stretch the full window width on a
         * desktop monitor, which leaves very long line lengths and pushes the
         * action buttons to the far edge. The footer stays a direct child of the
         * ScrollView so it remains full-bleed.
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
         * Platform services. The vendor dashboard is offered to every signed-in
         * customer because the landing screen itself handles the "not a vendor
         * yet" case by showing the application form. The marketplace desk is
         * reserved for platform admins, so it is simply not rendered for anyone
         * else — hiding the row is friendlier than showing a locked door, and
         * the server still refuses the calls.
         */}
        <View style={styles.linkSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VendorHome')}
            style={styles.linkRow}
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

        {/* Segmented Section Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('orders')}
            style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, textStart, activeTab === 'orders' && styles.tabButtonTextActive]}>
              طلباتي ({totalKnown ? ordersTotal : orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('addresses')}
            style={[styles.tabButton, activeTab === 'addresses' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, textStart, activeTab === 'addresses' && styles.tabButtonTextActive]}>
              عناويني المسجلة ({addresses.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content according to tab */}
        {loading && !refreshing ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={Colors.primaryContainer} />
          </View>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="لا توجد طلبات سابقة"
              description="لم تقم بإجراء أي طلبات حتى الآن. استمتع بتصفح المنتجات وأكمل طلبك الأول!"
              actionLabel="تسوق الآن"
              onAction={() => navigation.navigate('HomeTab')}
            />
          ) : (
<>
              {/*
               * On a desktop window a single full-width column of order cards
               * turns each order into a sparse band with a name at one end and
               * buttons at the other. Wrapping to two columns keeps the card
               * internals untouched and only changes how many sit per row.
               */}
              <View style={[styles.cardGrid, showDesktopChrome && styles.cardGridWide]}>
                {orders.map((order) => (
                  <View
                    key={order.name}
                    style={showDesktopChrome ? styles.cardGridCell : styles.cardGridCellFull}
                  >
                    <OrderCard
                      order={order}
                      actionLoading={actionLoading}
                      onCancelOrder={handleCancelOrder}
                      onReorder={handleReorder}
                    />
                  </View>
                ))}
              </View>

              {hasMoreOrders && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={[styles.loadMoreBtn, loadingMore && styles.loadMoreBtnDisabled]}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Text style={[styles.loadMoreText, textStart]}>عرض المزيد من الطلبات</Text>
                      <Text style={[styles.loadMoreCount, textStart]}>
                        {`تم عرض ${orders.length} من ${ordersTotal}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )
        ) : (
          <>
            {/* The add button is always reachable, including when the list is
                empty — an empty state that only points at the cart is a dead
                end for someone who came here to manage their addresses. */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAddAddressPress}
              style={({ pressed }) => [styles.addAddressBtn, pressed && styles.addAddressBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="إضافة عنوان جديد"
            >
              <Icon name="add" size={20} color={Colors.onPrimary} />
              <Text style={[styles.addAddressBtnText, textStart]}>إضافة عنوان جديد</Text>
            </TouchableOpacity>

            {addresses.length === 0 ? (
              <View style={styles.addressesEmpty}>
                <EmptyState
                  icon="location-outline"
                  title="لا توجد عناوين مسجلة"
                  description="أضف عنوان التسليم الخاص بك لتوصيل طلباتك بسهولة، أو حدّد موقعك على الخريطة."
                  actionLabel="إضافة عنوان"
                  onAction={handleAddAddressPress}
                />
              </View>
) : (
              <View style={[styles.cardGrid, showDesktopChrome && styles.cardGridWide]}>
                {addresses.map((addr) => (
                  <View
                    key={addr.name}
                    style={showDesktopChrome ? styles.cardGridCell : styles.cardGridCellFull}
                  >
                    <AddressCard
                      address={addr}
                      isSelected={false}
                      onEdit={handleEditAddress}
                      onDelete={handleDeleteAddress}
                      onSetDefault={handleSetDefaultAddress}
                      busy={addressBusy || savingAddress}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

{/* Logout Bottom Button */}
        <TouchableOpacity activeOpacity={0.8} onPress={handleLogout} style={styles.logoutBtn}>
          <Icon name="log-out-outline" size={16} color={Colors.error} />
          <Text style={[styles.logoutBtnText, textStart]}>تسجيل الخروج</Text>
        </TouchableOpacity>

</View>

        {/* Desktop-only site footer; must live inside the ScrollView. */}
        <PageFooter />
      </ScrollView>

      <AddressFormModal
        visible={formOpen}
        initial={editingAddress}
        defaultPhone={defaultPhone}
        saving={savingAddress}
        onClose={handleCloseForm}
onSubmit={handleSubmitAddress}
      />

      {/* Web confirm dialog for logout, order cancellation and address deletion. */}
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
  column: {
    width: '100%',
  },
  columnWide: {
    maxWidth: 1080,
    alignSelf: 'center',
  },
  // `cardGridCellFull` is the plain mobile case: a plain block so the existing
  // vertical `gap` on each card still applies. `cardGridCell` is only used on
  // wide screens, where the row gap takes over.
  cardGrid: {
    width: '100%',
  },
  cardGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardGridCellFull: {
    width: '100%',
  },
  cardGridCell: {
    // Just under 50% so two cells plus the row gap always fit without wrapping
    // a third, at any width in the capped column.
    flexBasis: '48.5%',
    flexGrow: 1,
    maxWidth: '100%',
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabButtonActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.sm,
  },
  tabButtonText: {
    fontSize: Typography.sizes.labelMd,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  loadingWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    gap: 2,
  },
  loadMoreBtnDisabled: {
    opacity: 0.7,
  },
  loadMoreText: {
    color: Colors.primary,
    fontSize: Typography.sizes.labelLg,
    fontWeight: '800',
  },
  loadMoreCount: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.bodySm,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    marginBottom: 14,
  },
  addAddressBtnPressed: {
    backgroundColor: Colors.primaryPress,
  },
  addAddressBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
  },
  addressesEmpty: {
    marginBottom: 8,
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
