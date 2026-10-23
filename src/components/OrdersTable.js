import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from './Icon';
import { statusFor } from './OrderCard';
import useDirectional from '../hooks/useDirectional';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import { formatCurrency, formatDate } from '../utils/format';

/**
 * OrdersTable — the order history as a desktop table.
 *
 * ## Why a table and not the cards
 *
 * `OrderCard` is a good card: it stacks the reference, the date, the badge,
 * the items and the actions, and on a phone that is exactly the right shape.
 * On a desktop it is not. A card is a vertical band with a lot of air in it,
 * and twenty of them in two columns means the reference numbers and the dates
 * are stacked rather than lined up — the reader has to hunt down the column
 * they want. A table puts every field on the same baseline, which is what
 * makes a list of forty orders scannable in one pass.
 *
 * The card stays on the phone: this component is only rendered by the web
 * build, and the mobile list is unchanged.
 *
 * ## The columns
 *
 *   الطلب | التاريخ | المتاجر | الإجمالي | الحالة | إجراءات
 *
 * "المتاجر" carries the per-vendor breakdown for a multi-shop checkout and
 * the item count for a single-shop one — the same information the card shows,
 * flattened into one cell so the row height stays constant.
 */

/* Column widths as a percentage of the table, so the row lines up at any
   window width without a single hard-coded pixel. */
const COL = {
  ref: '20%',
  date: '15%',
  shops: '21%',
  total: '14%',
  status: '16%',
  actions: '14%',
};

export default function OrdersTable({
  orders,
  total = 0,
  page = 0,
  pageSize = 10,
  pageCount = 1,
  onPageChange,
  onCancelOrder,
  onReorder,
  actionLoading = false,
  loading = false,
}) {
  const { textStart } = useDirectional();

  const from = total > 0 ? page * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize + orders.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.table}>
        {/* ---- Head ---- */}
        <View style={styles.headRow}>
          <Text style={[styles.headCell, styles.colRef, textStart]}>الطلب</Text>
          <Text style={[styles.headCell, styles.colDate, textStart]}>التاريخ</Text>
          <Text style={[styles.headCell, styles.colShops, textStart]}>المتاجر / المنتجات</Text>
          <Text style={[styles.headCell, styles.colTotal, textStart]}>الإجمالي</Text>
          <Text style={[styles.headCell, styles.colStatus, textStart]}>الحالة</Text>
          <Text style={[styles.headCell, styles.colActions, textStart]}>إجراءات</Text>
        </View>

        {/* ---- Body ---- */}
        {loading ? (
          /*
           * A line, not a replacement.
           *
           * Turning the whole table into a spinner for the moment a page takes
           * to arrive throws away the rows the reader was looking at and makes
           * the page feel like it loaded from scratch. The rows stay; a thin
           * busy line says a new page is on its way.
           */
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={[styles.loadingText, textStart]}>جارٍ تحميل الصفحة…</Text>
          </View>
        ) : null}

        {orders.map((order) => {
            const statusInfo = statusFor(order.status);
            const vendorOrders = Array.isArray(order.orders) ? order.orders : [];
            const grouped = !!order.is_group && vendorOrders.length > 0;

            const canCancel =
              order.docstatus === 1 &&
              order.status !== 'Completed' &&
              order.status !== 'Cancelled' &&
              order.status !== 'Delivered';

            return (
              <View key={order.name} style={styles.row}>
                <View style={[styles.cell, styles.colRef]}>
                  <Text style={[styles.refText, textStart]}>#{order.name}</Text>
                  <Text style={[styles.refSub, textStart]}>
                    {order.currency || ''}
                  </Text>
                </View>

                <View style={[styles.cell, styles.colDate]}>
                  <Text style={[styles.bodyText, textStart]}>
                    {formatDate(order.transaction_date)}
                  </Text>
                </View>

                <View style={[styles.cell, styles.colShops]}>
                  {grouped ? (
                    <Text style={[styles.bodyText, textStart]} numberOfLines={2}>
                      {vendorOrders.map((v) => v.shop_name || 'متجر').join('، ')}
                    </Text>
                  ) : (
                    <Text style={[styles.bodyText, textStart]} numberOfLines={1}>
                      {(order.items || []).length
                        ? `${order.items.length} منتج — ${order.items[0].item_name || ''}`
                        : '—'}
                    </Text>
                  )}
                </View>

                <View style={[styles.cell, styles.colTotal]}>
                  <Text style={[styles.totalText, textStart]}>
                    {formatCurrency(order.grand_total, order.currency)}
                  </Text>
                </View>

                <View style={[styles.cell, styles.colStatus]}>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Icon name={statusInfo.icon} size={12} color={statusInfo.text} />
                    <Text style={[styles.statusText, textStart, { color: statusInfo.text }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cell, styles.colActions, styles.actionsRow]}>
                  {canCancel ? (
                    <Pressable
                      onPress={() => onCancelOrder && onCancelOrder(order.name)}
                      disabled={actionLoading}
                      accessibilityRole="button"
                      className="hover-tint"
                      style={styles.actionBtn}
                    >
                      <Text style={[styles.actionText, textStart]}>إلغاء</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => onReorder && onReorder(order.name)}
                    disabled={actionLoading}
                    accessibilityRole="button"
                    className="hover-tint"
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={Colors.onPrimary} />
                    ) : (
                      <Text style={[styles.actionText, textStart, styles.actionTextPrimary]}>
                        إعادة الطلب
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
      </View>

      {/* ---- Pager ---- */}
      {pageCount > 1 ? (
        <View style={styles.pager}>
          <Pressable
            onPress={() => onPageChange && onPageChange(page - 1)}
            disabled={page <= 0 || loading}
            accessibilityRole="button"
            accessibilityLabel="الصفحة السابقة"
            className="hover-tint"
            style={[styles.pageBtn, (page <= 0 || loading) && styles.pageBtnDisabled]}
          >
            <Icon name="chevron-forward" size={15} color={Colors.onSurfaceVariant} />
            <Text style={[styles.pageBtnText, textStart]}>السابق</Text>
          </Pressable>

          <Text style={[styles.pageInfo, textStart]}>
            صفحة {page + 1} من {pageCount}
          </Text>

          <Pressable
            onPress={() => onPageChange && onPageChange(page + 1)}
            disabled={page >= pageCount - 1 || loading}
            accessibilityRole="button"
            accessibilityLabel="الصفحة التالية"
            className="hover-tint"
            style={[
              styles.pageBtn,
              (page >= pageCount - 1 || loading) && styles.pageBtnDisabled,
            ]}
          >
            <Text style={[styles.pageBtnText, textStart]}>التالي</Text>
            <Icon name="chevron-back" size={15} color={Colors.onSurfaceVariant} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.pager}>
          <Text style={[styles.pageInfo, textStart]}>
            {total > 0 ? `عرض ${from}–${to} من ${total} طلب` : `${orders.length} طلب`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  table: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headCell: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  cell: {
    paddingHorizontal: 6,
  },
  colRef: { width: COL.ref },
  colDate: { width: COL.date },
  colShops: { width: COL.shops },
  colTotal: { width: COL.total },
  colStatus: { width: COL.status },
  colActions: { width: COL.actions },

  refText: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  refSub: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
  },
  bodyText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
  },
  totalText: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  actionTextPrimary: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  loadingText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  pageInfo: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.textMuted,
  },
});
