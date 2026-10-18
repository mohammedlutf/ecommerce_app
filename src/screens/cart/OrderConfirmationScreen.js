import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';

export default function OrderConfirmationScreen({ route, navigation }) {
  const { orderId, orderData } = route.params || {};
  const { textStart } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();

  // The amounts charged are the ones the server put on the Sales Order, not the
  // cart screen's running estimate. The two can differ — the estimate is a
  // preview, the order is the record — and showing the estimate here would
  // quote the customer a number that may not be what they are actually paying.
  const deliveryCharges = Number((orderData && orderData.delivery_charges) || 0);
  const grandTotal = Number((orderData && orderData.grand_total) || 0);
  const hasTotals = grandTotal > 0;

  // One Sales Order per vendor, all created by this checkout. Rendered only
  // when the basket actually spanned shops: a single-vendor order would show a
  // "breakdown" of one row, which says nothing the totals above do not.
  const vendorOrders = (orderData && Array.isArray(orderData.orders) && orderData.orders) || [];
  const multiShop = vendorOrders.length > 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/*
       * A ScrollView rather than a centred flex column.
       *
       * `justifyContent: 'center'` in a fixed-height column silently clips
       * anything taller than the viewport, and on web the page itself cannot
       * scroll because `body` is `overflow: hidden` — so on a short laptop
       * window the totals and the action buttons were simply unreachable.
       * `flexGrow` keeps the vertical centring when the content does fit.
       */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={[styles.container, showDesktopChrome && styles.containerWide]}>
          {/* Success Circle */}
          <LinearGradient
            colors={['#22C55E', '#16A34A', Colors.primaryDark]}
            style={styles.successCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="checkmark" size={52} color="#ffffff" />
          </LinearGradient>

          <Text style={styles.title}>تم استلام طلبك بنجاح!</Text>
          <Text style={styles.subtitle}>
            شكراً لتسوقك معنا في زاد ماركت. نقوم الآن بتجهيز طلبيتك بعناية لتصلك في أسرع وقت.
          </Text>

        {/* Order Details */}
          <View style={styles.orderCard}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, textStart]}>رقم الطلب</Text>
              <View style={styles.orderNumberWrap}>
                <Icon name="receipt-outline" size={15} color={Colors.primary} />
                <Text style={[styles.orderNumber, textStart]}>#{orderId || 'طلب جديد'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, textStart]}>طريقة الدفع</Text>
              <View style={styles.infoValueRow}>
                <Icon name="cash-outline" size={15} color={Colors.onSurface} />
                <Text style={[styles.infoValue, textStart]}>
                  {(orderData && orderData.payment_method) || 'نقداً عند الاستلام'}
                </Text>
              </View>
            </View>

            {/* Multi-vendor checkout: one Sales Order per shop, each with its
                own items and delivery. Showing them here is what explains to
                the customer why parcels may arrive separately. */}
            {multiShop ? (
              <View style={styles.breakdown}>
                <Text style={[styles.breakdownTitle, textStart]}>تفاصيل الطلب حسب المتجر</Text>
                {vendorOrders.map((row, idx) => (
                  <View key={row.name || row.shop || idx} style={styles.breakdownRow}>
                    <View style={styles.breakdownInfo}>
                      <Text style={[styles.breakdownShopName, textStart]} numberOfLines={1}>
                        {row.shop_name || (row.is_platform ? 'متجر زاد ماركت' : 'متجر')}
                      </Text>
                      <Text style={[styles.breakdownMeta, textStart]} numberOfLines={2}>
                        #{row.name} · منتجات {formatCurrency(row.items_total)}
                        {Number(row.delivery_charges || 0) > 0
                          ? ` · توصيل ${formatCurrency(row.delivery_charges)}`
                          : ' · توصيل مجاني'}
                      </Text>
                    </View>
                    <Text style={[styles.breakdownAmount, textStart]}>
                      {formatCurrency(row.grand_total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Amounts come from the saved order. Rendered only when the server
                actually returned a total, so a missing figure reads as absent
                rather than as a confidently wrong zero. */}
            {hasTotals ? (
              <>
                {deliveryCharges > 0 ? (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, textStart]}>رسوم التوصيل</Text>
                    <Text style={[styles.infoValue, textStart]}>{formatCurrency(deliveryCharges)}</Text>
                  </View>
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, textStart]}>المبلغ المطلوب عند الاستلام</Text>
                  <Text style={[styles.totalValue, textStart]}>{formatCurrency(grandTotal)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, textStart]}>حالة الطلب</Text>
              <View style={styles.infoValueRow}>
                <Icon name="time" size={15} color={Colors.primary} />
                <Text style={[styles.infoValue, textStart, { color: Colors.primary, fontFamily: Typography.fontFamilyBold }]}>
                  قيد التجهيز والتوصيل
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                // No popToTop() here: the Account tab is a sibling tab, so popping
                // the cart stack first only flashed the empty cart on the way out.
                // AccountScreen refetches on focus, so the order just placed is
                // already in the list by the time this screen unmounts.
                navigation.navigate('AccountTab');
              }}
              style={styles.primaryBtn}
            >
              <Text style={[styles.primaryBtnText, textStart]}>عرض طلباتي ومتابعة الحالة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                navigation.popToTop();
                navigation.navigate('HomeTab');
              }}
              style={styles.secondaryBtn}
            >
              <Text style={[styles.secondaryBtnText, textStart]}>العودة للرئيسية ومواصلة التسوق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  // The card and buttons are `width: '100%'`, which on a desktop window stretched
  // a receipt across 1900px. Capping the column keeps the line lengths readable
  // and stops the two buttons reading as a pair of page-wide banners.
  containerWide: {
    maxWidth: 560,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    ...Shadows.lg,
  },
  title: {
    fontSize: Typography.sizes.headlineLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    fontFamily: Typography.fontFamilyRegular,
  },
  orderCard: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 32,
    gap: 14,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },
  orderNumberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumber: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyMedium,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 12,
    gap: 10,
  },
  breakdownTitle: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurfaceVariant,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakdownInfo: {
    flex: 1,
    minWidth: 0,
  },
  breakdownShopName: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  breakdownMeta: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  breakdownAmount: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  // Separated from the rows above so the amount due reads as the summary of the
  // order rather than just another field in the list.
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 16,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    flex: 1,
  },
  totalValue: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.md,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
  secondaryBtn: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  secondaryBtnText: {
    color: Colors.onSurface,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilySemiBold,
  },
});