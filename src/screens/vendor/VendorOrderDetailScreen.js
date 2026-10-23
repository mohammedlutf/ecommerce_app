import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import useConfirm from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import VendorAPI from '../../api/vendor';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';
import PageFooter from '../../components/layout/PageFooter';
import { vendorOrderStatus, VENDOR_SETTABLE_STATUSES } from '../../components/vendor/vendorStatus';

/**
 * VendorOrderDetailScreen — one order, and the fulfilment controls for it.
 *
 * The backend refuses status regressions out of "Delivered" and refuses any
 * change once "Cancelled", so those two states render the order read-only. The
 * buttons that would be rejected never appear, which keeps the one path that
 * *does* fail (a race with another device) to a real error message instead of a
 * wall of dead controls.
 */
export default function VendorOrderDetailScreen({ route, navigation }) {
  const orderName = route?.params?.orderName;
  const { textStart } = useDirectional();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderName) return;
    setLoading(true);
    setError('');
    try {
      const data = await VendorAPI.getOrder(orderName);
      setOrder(data);
    } catch (err) {
      setError(err?.message || 'تعذر تحميل الطلب');
    } finally {
      setLoading(false);
    }
  }, [orderName]);

  useEffect(() => {
    load();
  }, [load]);

  async function applyStatus(next) {
    setBusy(true);
    try {
      await VendorAPI.updateOrderStatus(orderName, next);
      toast.success('تم تحديث حالة الطلب');
      await load();
    } catch (err) {
      toast.error(err?.message || 'تعذر تحديث حالة الطلب');
    } finally {
      setBusy(false);
    }
  }

  function handleSetStatus(next) {
    if (next === 'Cancelled') {
      confirm({
        title: 'إلغاء الطلب',
        message: `سيتم إلغاء الطلب #${orderName} نهائياً وإرجاع الكميات إلى المخزون.`,
        confirmLabel: 'نعم، إلغاء الطلب',
        cancelLabel: 'تراجع',
        tone: 'destructive',
        onConfirm: () => applyStatus(next),
      });
      return;
    }
    applyStatus(next);
  }

  function callCustomer(phone) {
    if (!phone) return;
    const url = `tel:${String(phone).replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => toast.error('تعذر فتح تطبيق الاتصال'));
  }

  if (loading) {
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <View style={vendorStyles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={vendorStyles.centreText}>جاري تحميل الطلب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <View style={vendorStyles.centre}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={vendorStyles.centreText}>{error || 'الطلب غير متاح'}</Text>
          <TouchableOpacity onPress={load} style={vendorStyles.secondaryBtn}>
            <Text style={[vendorStyles.secondaryBtnText, textStart]}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const info = vendorOrderStatus(order.status);
  const closed = order.status === 'Delivered' || order.status === 'Cancelled';
  const customer = order.customer || {};
  const itemsTotal = (order.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={vendorStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={vendorStyles.column}>
          {/* Header */}
          <View style={vendorStyles.card}>
            <View style={vendorStyles.rowBetween}>
              <View style={vendorStyles.flex1}>
                <Text style={[vendorStyles.strong, textStart]}>#{order.name}</Text>
                <Text style={[vendorStyles.muted, textStart]}>{formatDate(order.transaction_date)}</Text>
              </View>
              <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                <Icon name={info.icon} size={13} color={info.fg} />
                <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
              </View>
            </View>
          </View>

          {/* Customer */}
          <View style={vendorStyles.card}>
            <View style={vendorStyles.sectionHeader}>
              <Icon name="person-outline" size={17} color={Colors.primary} />
              <Text style={[vendorStyles.sectionTitle, textStart]}>بيانات العميل والتوصيل</Text>
            </View>

            <Text style={[vendorStyles.value, textStart]}>{customer.name || '—'}</Text>
            {customer.city ? (
              <Text style={[vendorStyles.muted, textStart, { marginTop: 4 }]}>
                المدينة: {customer.city}
              </Text>
            ) : null}
            {customer.address ? (
              <Text style={[vendorStyles.muted, textStart, { marginTop: 2 }]}>
                العنوان: {customer.address}
              </Text>
            ) : null}
            {customer.note ? (
              <Text style={[vendorStyles.muted, textStart, { marginTop: 2 }]}>
                ملاحظة: {customer.note}
              </Text>
            ) : null}

            {customer.phone ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => callCustomer(customer.phone)}
                style={[vendorStyles.secondaryBtn, { marginTop: 14, alignSelf: 'flex-start' }]}
              >
                <Icon name="call-outline" size={17} color={Colors.primary} />
                <Text style={[vendorStyles.secondaryBtnText, textStart]}>{customer.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Items */}
          <View style={vendorStyles.card}>
            <View style={vendorStyles.sectionHeader}>
              <Icon name="cube-outline" size={17} color={Colors.primary} />
              <Text style={[vendorStyles.sectionTitle, textStart]}>منتجات الطلب</Text>
            </View>

            {(order.items || []).map((item, idx) => (
              <View key={`${item.item_code || item.item_name}-${idx}`} style={styles.itemRow}>
                <View style={vendorStyles.flex1}>
                  <Text style={[vendorStyles.value, textStart]} numberOfLines={2}>
                    {item.item_name || item.item_code}
                  </Text>
                  <Text style={[vendorStyles.muted, textStart]}>
                    {item.qty} {item.uom} × {formatCurrency(item.rate)}
                  </Text>
                </View>
                <Text style={[styles.itemAmount, textStart]}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={vendorStyles.card}>
            <View style={styles.totalRow}>
              <Text style={[vendorStyles.muted, textStart]}>إجمالي المنتجات</Text>
              <Text style={[vendorStyles.value, textStart]}>{formatCurrency(itemsTotal, order.currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[vendorStyles.muted, textStart]}>رسوم التوصيل</Text>
              <Text style={[vendorStyles.value, textStart]}>
                {formatCurrency(order.delivery_charges || 0, order.currency)}
              </Text>
            </View>
            {Number(order.commission_amount) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={[vendorStyles.muted, textStart]}>عمولة المنصة</Text>
                <Text style={[styles.commission, textStart]}>
                  - {formatCurrency(order.commission_amount, order.currency)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={[vendorStyles.strong, textStart]}>الإجمالي</Text>
              <Text style={[vendorStyles.money, textStart]}>
                {formatCurrency(order.grand_total, order.currency)}
              </Text>
            </View>
          </View>

          {/* Fulfilment controls */}
          <View style={vendorStyles.card}>
            <View style={vendorStyles.sectionHeader}>
              <Icon name="swap-horizontal-outline" size={17} color={Colors.primary} />
              <Text style={[vendorStyles.sectionTitle, textStart]}>تحديث حالة الطلب</Text>
            </View>

            {closed ? (
              <Text style={[vendorStyles.muted, textStart]}>
                {order.status === 'Delivered'
                  ? 'تم تسليم هذا الطلب، ولا يمكن تغيير حالته.'
                  : 'تم إلغاء هذا الطلب.'}
              </Text>
            ) : (
              <>
                <Text style={[vendorStyles.hint, textStart]}>
                  اختر الحالة التي وصل إليها الطلب. لا يمكن الرجوع عن «تم التسليم».
                </Text>
                <View style={vendorStyles.rowWrap}>
                  {VENDOR_SETTABLE_STATUSES.map((status) => {
                    const meta = vendorOrderStatus(status);
                    const isCurrent = order.status === status;
                    const isDanger = status === 'Cancelled';
                    return (
                      <TouchableOpacity
                        key={status}
                        activeOpacity={0.85}
                        disabled={busy || isCurrent}
                        onPress={() => handleSetStatus(status)}
                        style={[
                          styles.statusBtn,
                          isCurrent && styles.statusBtnCurrent,
                          isDanger && styles.statusBtnDanger,
                          (busy || isCurrent) && vendorStyles.disabled,
                        ]}
                      >
                        {busy && !isCurrent ? null : (
                          <Icon
                            name={meta.icon}
                            size={15}
                            color={isDanger ? Colors.error : isCurrent ? Colors.onPrimary : Colors.primary}
                          />
                        )}
                        <Text
                          style={[
                            styles.statusBtnText,
                            textStart,
                            isCurrent && styles.statusBtnTextCurrent,
                            isDanger && styles.statusBtnTextDanger,
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Desktop-only site footer; it rides inside the scroll content because
            the app shell has no document-level flow for it to sit at the end
            of. */}
        <PageFooter />
      </ScrollView>
      {confirmDialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  itemAmount: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
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
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  statusBtnCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBtnDanger: {
    borderColor: Colors.errorContainer,
  },
  statusBtnText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  statusBtnTextCurrent: {
    color: Colors.onPrimary,
  },
  statusBtnTextDanger: {
    color: Colors.error,
  },
});
