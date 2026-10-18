import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
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
import { Radius, Spacing } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';
import { payoutStatus } from '../../components/vendor/vendorStatus';

const PAGE_SIZE = 12;

/**
 * VendorPayoutsScreen — the shop's settlement statements.
 *
 * A list plus a detail sheet in one file because they are one feature: the rows
 * carry the summary (gross, commission, net) and the sheet answers the only
 * question a vendor asks about a statement — "which orders is this?" Keeping the
 * sheet next to the list that opens it means the row shape and the detail shape
 * are read side by side, which is where they are easiest to keep in step.
 */
export default function VendorPayoutsScreen() {
  const { textStart } = useDirectional();
  const { isApproved } = useVendor();

  const [payouts, setPayouts] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detailName, setDetailName] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const requestRef = useRef(0);
  const countRef = useRef(0);
  countRef.current = payouts.length;

  const load = useCallback(async ({ start = 0, append = false, showSpinner = true } = {}) => {
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true);
    else if (showSpinner) setLoading(true);

    try {
      const data = await VendorAPI.getPayouts({ start, pageSize: PAGE_SIZE });
      if (requestId !== requestRef.current) return;
      setPayouts((prev) => (append ? [...prev, ...data.payouts] : data.payouts));
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestId === requestRef.current) console.warn('Could not load vendor payouts:', err.message);
    } finally {
      if (requestId === requestRef.current) {
        if (append) setLoadingMore(false);
        else if (showSpinner) setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isApproved) return undefined;
      load({ showSpinner: payouts.length === 0 });
      return undefined;
      // `payouts.length` is read at focus time on purpose; re-running on each
      // list change would loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isApproved, load])
  );

  function handleRefresh() {
    setRefreshing(true);
    load({ showSpinner: false });
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    load({ start: countRef.current, append: true, showSpinner: false });
  }

  const openDetail = useCallback(async (name) => {
    setDetailName(name);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await VendorAPI.getPayoutPayload(name);
      setDetail(data);
    } catch (err) {
      setDetailError(err?.message || 'تعذر تحميل كشف المستحقات');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function closeDetail() {
    setDetailName(null);
    setDetail(null);
    setDetailError('');
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={vendorStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={vendorStyles.column}>
          <Text style={[vendorStyles.pageSubtitle, textStart]}>
            كشوف التسوية التي أعدّتها المنصة لمتجرك. اضغط على أي كشف لعرض الطلبات المشمولة.
          </Text>

          {loading && payouts.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل المستحقات...</Text>
            </View>
          ) : payouts.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="لا توجد مستحقات بعد"
              description="ستظهر كشوف التسوية هنا بعد اعتماد طلباتك وتسليمها."
            />
          ) : (
            <>
              {payouts.map((payout) => {
                const info = payoutStatus(payout.status);
                return (
                  <TouchableOpacity
                    key={payout.name}
                    activeOpacity={0.85}
                    onPress={() => openDetail(payout.name)}
                    style={vendorStyles.listItem}
                  >
                    <View style={vendorStyles.rowBetween}>
                      <View style={vendorStyles.flex1}>
                        <Text style={[vendorStyles.value, textStart]}>كشف #{payout.name}</Text>
                        <Text style={[vendorStyles.muted, textStart]}>
                          {formatDate(payout.from_date)} — {formatDate(payout.to_date)}
                        </Text>
                      </View>
                      <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                        <Icon name={info.icon} size={13} color={info.fg} />
                        <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>
                          {info.label}
                        </Text>
                      </View>
                    </View>

                    <View style={[vendorStyles.rowBetween, { marginTop: 12 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>
                        إجمالي {formatCurrency(payout.total_gross)}
                      </Text>
                      <Text style={[styles.netValue, textStart]}>
                        {formatCurrency(payout.total_net)}
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
                      عرض المزيد ({payouts.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!detailName}
        animationType="slide"
        onRequestClose={closeDetail}
        transparent={false}
      >
        <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.detailHeader}>
            <View style={vendorStyles.flex1}>
              <Text style={[styles.detailTitle, textStart]}>كشف المستحقات</Text>
              <Text style={[vendorStyles.muted, textStart]}>{detailName}</Text>
            </View>
            <TouchableOpacity onPress={closeDetail} style={styles.closeBtn} activeOpacity={0.8}>
              <Icon name="close" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={vendorStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={vendorStyles.column}>
              {detailLoading ? (
                <View style={vendorStyles.centre}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              ) : detailError ? (
                <View style={vendorStyles.centre}>
                  <Icon name="alert-circle-outline" size={40} color={Colors.error} />
                  <Text style={vendorStyles.centreText}>{detailError}</Text>
                  <TouchableOpacity onPress={() => openDetail(detailName)} style={vendorStyles.secondaryBtn}>
                    <Text style={[vendorStyles.secondaryBtnText, textStart]}>إعادة المحاولة</Text>
                  </TouchableOpacity>
                </View>
              ) : detail ? (
                <>
                  <View style={vendorStyles.card}>
                    <View style={vendorStyles.rowBetween}>
                      <Text style={[vendorStyles.muted, textStart]}>الحالة</Text>
                      <View
                        style={[
                          vendorStyles.badge,
                          { backgroundColor: payoutStatus(detail.status).bg },
                        ]}
                      >
                        <Text
                          style={[
                            vendorStyles.badgeText,
                            textStart,
                            { color: payoutStatus(detail.status).fg },
                          ]}
                        >
                          {payoutStatus(detail.status).label}
                        </Text>
                      </View>
                    </View>
                    <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>الفترة</Text>
                      <Text style={[vendorStyles.value, textStart]}>
                        {formatDate(detail.from_date)} — {formatDate(detail.to_date)}
                      </Text>
                    </View>
                    {detail.payment_reference ? (
                      <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                        <Text style={[vendorStyles.muted, textStart]}>مرجع الدفع</Text>
                        <Text style={[vendorStyles.value, textStart]}>{detail.payment_reference}</Text>
                      </View>
                    ) : null}
                    {detail.paid_on ? (
                      <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                        <Text style={[vendorStyles.muted, textStart]}>تاريخ الدفع</Text>
                        <Text style={[vendorStyles.value, textStart]}>{formatDate(detail.paid_on)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={vendorStyles.card}>
                    <Text style={[vendorStyles.cardTitle, textStart]}>الملخّص</Text>
                    <View style={styles.totalRow}>
                      <Text style={[vendorStyles.muted, textStart]}>إجمالي المبيعات</Text>
                      <Text style={[vendorStyles.value, textStart]}>
                        {formatCurrency(detail.total_gross)}
                      </Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={[vendorStyles.muted, textStart]}>عمولة المنصة</Text>
                      <Text style={[styles.commission, textStart]}>
                        - {formatCurrency(detail.total_commission)}
                      </Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandRow]}>
                      <Text style={[vendorStyles.strong, textStart]}>صافي المستحق</Text>
                      <Text style={[vendorStyles.money, textStart]}>
                        {formatCurrency(detail.total_net)}
                      </Text>
                    </View>
                  </View>

                  <View style={vendorStyles.card}>
                    <Text style={[vendorStyles.cardTitle, textStart]}>
                      الطلبات ({(detail.orders || []).length})
                    </Text>
                    {(detail.orders || []).length === 0 ? (
                      <Text style={[vendorStyles.muted, textStart]}>لا توجد طلبات في هذا الكشف.</Text>
                    ) : (
                      detail.orders.map((row, idx) => (
                        <View key={`${row.sales_order}-${idx}`} style={styles.orderRow}>
                          <View style={vendorStyles.flex1}>
                            <Text style={[vendorStyles.value, textStart]}>#{row.sales_order}</Text>
                            <Text style={[vendorStyles.muted, textStart]}>
                              {formatDate(row.order_date)}
                              {row.customer ? ` · ${row.customer}` : ''}
                            </Text>
                          </View>
                          <View style={styles.orderAmounts}>
                            <Text style={[styles.orderNet, textStart]}>
                              {formatCurrency(row.net_amount)}
                            </Text>
                            {Number(row.commission_amount) > 0 ? (
                              <Text style={[vendorStyles.muted, textStart, { textAlign: 'right' }]}>
                                عمولة {formatCurrency(row.commission_amount)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  netValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  detailTitle: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  grandRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: 6,
    paddingTop: 12,
  },
  commission: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.error,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  orderAmounts: { alignItems: 'flex-end' },
  orderNet: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
});
