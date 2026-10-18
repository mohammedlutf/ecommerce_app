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
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import PageFooter from '../../components/layout/PageFooter';
import useConfirm from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useSiteChrome } from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import useDocumentHead from '../../seo/useDocumentHead';
import OrdersAPI, { ORDERS_PAGE_SIZE } from '../../api/orders';
import LoginScreen from '../auth/LoginScreen';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

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

/**
 * My orders — the shopper's full order history, on its own screen.
 *
 * Split out of the account hub so the hub stays a directory of destinations
 * (orders, addresses, vendor dashboard) instead of also being a list. The list
 * behaviour is unchanged from when it lived there: newest first, paged, with a
 * cancel/reorder action on each card.
 */
export default function MyOrdersScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();
  useDocumentHead({ title: 'طلباتي', path: '/account/orders', noindex: true });

  const { user, isAuthenticated } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const { fetchCart } = useCart();
  const toast = useToast();

  // Scope everything to the signed-in customer. Keying on the email (not just
  // "is logged in") is what makes a logout → login as somebody else start from
  // a clean slate instead of the previous user's orders.
  const userKey = (user && user.email) || null;

  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  // The endpoint only started reporting a real total once it supported paging.
  // Until we have loaded a page successfully, fall back to what we hold.
  const [totalKnown, setTotalKnown] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bumped on every request; a response whose id is stale (user switched, a
  // newer request started) is dropped instead of overwriting state.
  const requestRef = useRef(0);
  // Latest values readable from callbacks without becoming effect dependencies.
  const userKeyRef = useRef(userKey);
  userKeyRef.current = userKey;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
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

  // A different user (or a logout) must never see the previous customer's
  // orders. Clear the cached list and invalidate any in-flight request before
  // the reload below runs.
  useEffect(() => {
    ++requestRef.current;
    hasLoadedRef.current = false;
    setOrders([]);
    setOrdersTotal(0);
    setTotalKnown(false);
    setHasMoreOrders(false);
    // A request dropped by the bump above will never reach its own `finally`,
    // so clear its spinners here or they spin forever.
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [userKey]);

  // Auto-refresh whenever the screen regains focus — this is what makes a newly
  // placed order show up the moment you tap "show my orders" on the
  // confirmation screen, instead of the stale list you previously had to
  // pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (!userKeyRef.current) return undefined;
      // Spinner only when there is nothing to show yet, so a background refresh
      // never blanks out a list the user is already reading.
      const showSpinner = !hasLoadedRef.current || ordersRef.current.length === 0;
      hasLoadedRef.current = true;
      loadOrders({ showSpinner });
      return undefined;
    }, [loadOrders])
  );

  // …and again when the app comes back to the foreground.
  useLiveRefresh(
    useCallback(() => loadOrders({ showSpinner: false }), [loadOrders]),
    { intervalMs: 0, isEnabled: !!userKey }
  );

  function handleLoadMore() {
    if (loadingMore) return;
    loadOrders({ start: ordersRef.current.length, append: true, showSpinner: false });
  }

  function handleRefresh() {
    setRefreshing(true);
    loadOrders({ showSpinner: false });
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

  if (!isAuthenticated) {
    return <LoginScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
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
        <View style={[styles.column, showDesktopChrome && styles.columnWide]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, textStart]}>
              طلباتي ({totalKnown ? ordersTotal : orders.length})
            </Text>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="large" color={Colors.primaryContainer} />
            </View>
          ) : orders.length === 0 ? (
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
          )}
        </View>

        {/* Desktop-only site footer; must live inside the ScrollView. */}
        <PageFooter />
      </ScrollView>

      {/* Web confirm dialog for order cancellation. */}
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
  headerRow: {
    marginBottom: 14,
  },
  title: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  // `cardGridCellFull` is the plain mobile case: a plain block so the vertical
  // `gap` on each card still applies. `cardGridCell` is only used on wide
  // screens, where the row gap takes over.
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
});
