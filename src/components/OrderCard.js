import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import useDirectional from '../hooks/useDirectional';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import { formatCurrency, formatDate } from '../utils/format';

const STATUS_MAP = {
  Completed: { bg: Colors.successContainer, text: Colors.success, label: 'مكتمل', icon: 'checkmark-circle' },
  'To Deliver and Bill': { bg: Colors.infoContainer, text: Colors.info, label: 'قيد التوصيل', icon: 'time' },
  'To Deliver': { bg: Colors.infoContainer, text: Colors.info, label: 'قيد التوصيل', icon: 'time' },
  Cancelled: { bg: Colors.errorContainer, text: Colors.error, label: 'ملغي', icon: 'close-circle' },
  // Marketplace statuses, resolved per vendor order on the server and summarised
  // for the whole checkout.
  New: { bg: Colors.primaryContainer, text: Colors.primaryDark, label: 'جديد', icon: 'time-outline' },
  Processing: { bg: Colors.warningContainer, text: Colors.warning, label: 'قيد التجهيز', icon: 'sync' },
  Ready: { bg: Colors.infoContainer, text: Colors.info, label: 'جاهز للتوصيل', icon: 'cube-outline' },
  Delivered: { bg: Colors.successContainer, text: Colors.success, label: 'تم التسليم', icon: 'checkmark-circle' },
};

/**
 * The badge colours and the Arabic label for an order status.
 *
 * Exported because the desktop order table draws the same badge in a table
 * cell, and two copies of this map would drift apart the first time a status
 * was added.
 */
export function statusFor(status) {
  return (
    STATUS_MAP[status] || {
      bg: Colors.primaryContainer,
      text: Colors.primaryDark,
      label: status || 'قيد المعالجة',
      icon: 'sync',
    }
  );
}

export default function OrderCard({
  order,
  onCancelOrder,
  onReorder,
  actionLoading = false,
}) {
  const { textStart } = useDirectional();
  const [expanded, setExpanded] = useState(false);

  const statusInfo = statusFor(order.status);
  // A checkout spanning several vendors arrives as one unit carrying a
  // per-vendor breakdown. The flat `items` still exist for a single-shop order
  // (and for legacy orders), so only the multi-vendor case changes shape.
  const vendorOrders = Array.isArray(order.orders) ? order.orders : [];
  const grouped = !!order.is_group && vendorOrders.length > 0;

  // `docstatus` is 1 on a submitted order. Delivered and cancelled units can no
  // longer be cancelled, whatever the vendor rows say.
  const canCancel =
    order.docstatus === 1 &&
    order.status !== 'Completed' &&
    order.status !== 'Cancelled' &&
    order.status !== 'Delivered';

  return (
    <View style={styles.card}>
      {/* Accent Indicator */}
      <View style={[styles.statusAccent, { backgroundColor: statusInfo.text }]} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.orderRef, textStart]}>
            <Text style={[styles.orderId, textStart]}>طلب #{order.name}</Text>
            <Text style={[styles.orderDate, textStart]}>{formatDate(order.transaction_date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Icon name={statusInfo.icon} size={13} color={statusInfo.text} />
            <Text style={[styles.statusText, textStart, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Per-vendor breakdown (multi-shop checkout) */}
        {grouped ? (
          <View style={styles.shopList}>
            {vendorOrders.map((vendorOrder) => {
              const shopStatus = statusFor(vendorOrder.status);
              return (
                <View key={vendorOrder.name} style={styles.shopRow}>
                  <View style={styles.shopIcon}>
                    <Icon name="storefront-outline" size={15} color={Colors.primary} />
                  </View>
                  <View style={styles.shopInfo}>
                    <Text style={[styles.shopName, textStart]} numberOfLines={1}>
                      {vendorOrder.shop_name || 'متجر'}
                    </Text>
                    <Text style={[styles.shopMeta, textStart]} numberOfLines={1}>
                      {(vendorOrder.items || []).length} منتج · {formatCurrency(vendorOrder.grand_total, order.currency)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: shopStatus.bg }]}>
                    <Icon name={shopStatus.icon} size={11} color={shopStatus.text} />
                    <Text style={[styles.shopStatusText, textStart, { color: shopStatus.text }]}>
                      {shopStatus.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* Items preview (single order) */
          order.items &&
          order.items.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={[styles.itemsSummary, textStart]}>
                {order.items.length} {order.items.length === 1 ? 'منتج' : 'منتجات'}:{' '}
                {order.items
                  .map((i) => `${i.item_name} (${i.qty} ${i.uom})`)
                  .slice(0, 2)
                  .join('، ')}
                {order.items.length > 2 ? ' ...' : ''}
              </Text>

              {expanded && (
                <View style={styles.expandedItems}>
                  {order.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={[styles.itemName, textStart]} numberOfLines={1}>
                        {item.item_name}
                      </Text>
                      <Text style={styles.itemQtyUom}>
                        {item.qty} × {formatCurrency(item.rate)}
                      </Text>
                      <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {order.items.length > 1 && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(!expanded)} style={styles.toggleBtn}>
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                  <Text style={[styles.toggleText, textStart]}>
                    {expanded ? 'إخفاء التفاصيل' : 'عرض كافة المنتجات'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={[styles.totalLabel, textStart]}>الإجمالي</Text>
            <Text style={[styles.totalValue, textStart]}>{formatCurrency(order.grand_total, order.currency)}</Text>
          </View>

          <View style={styles.actionsRow}>
            {canCancel && (
              <TouchableOpacity
                activeOpacity={0.72}
                disabled={actionLoading}
                onPress={() => onCancelOrder && onCancelOrder(order.name)}
                style={styles.cancelBtn}
              >
                <Text style={[styles.cancelText, textStart]}>إلغاء الطلب</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={() => onReorder && onReorder(order.name)}
              style={[styles.reorderBtn, Shadows.xs]}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon name="refresh-outline" size={15} color="#ffffff" />
                  <Text style={[styles.reorderText, textStart]}>إعادة الطلب</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadows.sm,
  },
  statusAccent: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderRef: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  orderId: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  orderDate: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    marginTop: 2,
    fontFamily: Typography.fontFamilyRegular,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  shopList: {
    paddingVertical: 12,
    gap: 10,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shopIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  shopMeta: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
    marginTop: 1,
  },
  shopStatusText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  itemsSection: {
    paddingVertical: 12,
  },
  itemsSummary: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    fontFamily: Typography.fontFamilyRegular,
  },
  expandedItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    flex: 2,
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyRegular,
  },
  itemQtyUom: {
    flex: 1,
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'center',
  },
  itemAmount: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    textAlign: 'right',
  },
  toggleBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  toggleText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  cancelText: {
    color: Colors.error,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  reorderText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
});
