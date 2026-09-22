import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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
};

export default function OrderCard({
  order,
  onCancelOrder,
  onReorder,
  actionLoading = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const statusInfo =
    STATUS_MAP[order.status] ||
    {
      bg: Colors.primaryContainer,
      text: Colors.primaryDark,
      label: order.status || 'قيد المعالجة',
      icon: 'sync',
    };

  const canCancel =
    order.docstatus === 1 &&
    order.status !== 'Completed' &&
    order.status !== 'Cancelled';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderId}>طلب #{order.name}</Text>
          <Text style={styles.orderDate}>{formatDate(order.transaction_date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Icon name={statusInfo.icon} size={13} color={statusInfo.text} />
          <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
        </View>
      </View>

      {/* Items preview */}
      {order.items && order.items.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSummary}>
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
                  <Text style={styles.itemName} numberOfLines={1}>
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
              <Text style={styles.toggleText}>
                {expanded ? 'إخفاء التفاصيل' : 'عرض كافة المنتجات'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>الإجمالي:</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.grand_total, order.currency)}</Text>
        </View>

        <View style={styles.actionsRow}>
          {canCancel && (
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={actionLoading}
              onPress={() => onCancelOrder && onCancelOrder(order.name)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>إلغاء الطلب</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={actionLoading}
            onPress={() => onReorder && onReorder(order.name)}
            style={styles.reorderBtn}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.reorderText}>إعادة الطلب</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
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
    textAlign: 'left',
  },
  orderDate: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    marginTop: 2,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  itemsSection: {
    paddingVertical: 10,
  },
  itemsSummary: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  expandedItems: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    gap: 6,
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
    textAlign: 'left',
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
    marginTop: 6,
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
    textAlign: 'left',
  },
  totalValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
    textAlign: 'left',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  reorderText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
});