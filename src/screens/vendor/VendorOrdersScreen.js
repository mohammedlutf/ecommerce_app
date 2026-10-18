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
import { useVendor } from '../../context/VendorContext';
import VendorAPI from '../../api/vendor';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';
import { vendorOrderStatus, VENDOR_FILTER_STATUSES } from '../../components/vendor/vendorStatus';

const PAGE_SIZE = 12;

/**
 * VendorOrdersScreen — this shop's orders, newest first.
 *
 * Requests are stamped with a counter so a slow response for a filter the vendor
 * has already left cannot overwrite the list for the filter they are looking at
 * now — the race that makes "Cancelled" briefly show delivered orders.
 */
export default function VendorOrdersScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { isApproved } = useVendor();

  const [filter, setFilter] = useState('All');
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const requestRef = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const countRef = useRef(0);
  countRef.current = orders.length;

  const load = useCallback(
    async ({ start = 0, append = false, showSpinner = true, status = filterRef.current } = {}) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await VendorAPI.getOrders({ start, pageSize: PAGE_SIZE, vendorStatus: status });
        if (requestId !== requestRef.current) return;
        // A response for a filter the vendor has since left is discarded.
        if (status !== filterRef.current) return;

        setOrders((prev) => (append ? [...prev, ...data.orders] : data.orders));
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (err) {
        if (requestId === requestRef.current) console.warn('Could not load vendor orders:', err.message);
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

  useFocusEffect(
    useCallback(() => {
      if (!isApproved) return undefined;
      load({ showSpinner: orders.length === 0 });
      return undefined;
      // `orders.length` is read at focus time on purpose; re-running on every
      // list change would loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isApproved, load])
  );

  function handleFilterChange(next) {
    setFilter(next);
    filterRef.current = next;
    setOrders([]);
    setHasMore(false);
    load({ start: 0, showSpinner: true, status: next });
  }

  function handleRefresh() {
    setRefreshing(true);
    load({ showSpinner: false });
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    load({ start: countRef.current, append: true, showSpinner: false });
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'left', 'right']}>
      {/* Filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {VENDOR_FILTER_STATUSES.map((status) => {
            const active = filter === status;
            const label = status === 'All' ? 'الكل' : vendorOrderStatus(status).label;
            return (
              <TouchableOpacity
                key={status}
                activeOpacity={0.8}
                onPress={() => handleFilterChange(status)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, textStart, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={vendorStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={vendorStyles.column}>
          {loading && orders.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل الطلبات...</Text>
            </View>
          ) : orders.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="لا توجد طلبات"
              description={
                filter === 'All'
                  ? 'ستظهر طلبات عملائك هنا بمجرد وصولها.'
                  : 'لا توجد طلبات بهذه الحالة حالياً.'
              }
            />
          ) : (
            <>
              {orders.map((order) => {
                const info = vendorOrderStatus(order.status);
                return (
                  <TouchableOpacity
                    key={order.name}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('VendorOrderDetail', { orderName: order.name })}
                    style={vendorStyles.listItem}
                  >
                    <View style={vendorStyles.rowBetween}>
                      <View style={vendorStyles.flex1}>
                        <Text style={[vendorStyles.value, textStart]}>#{order.name}</Text>
                        <Text style={[vendorStyles.muted, textStart]}>{formatDate(order.transaction_date)}</Text>
                      </View>
                      <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                        <Icon name={info.icon} size={13} color={info.fg} />
                        <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                      </View>
                    </View>

                    <View style={[vendorStyles.rowBetween, { marginTop: 12 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>
                        {order.items?.length || 0} منتج
                      </Text>
                      <Text style={[styles.orderTotal, textStart]}>
                        {formatCurrency(order.grand_total, order.currency)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {hasMore ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={vendorStyles.loadMoreBtn}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={[vendorStyles.loadMoreText, textStart]}>
                      عرض المزيد ({orders.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  orderTotal: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
});
