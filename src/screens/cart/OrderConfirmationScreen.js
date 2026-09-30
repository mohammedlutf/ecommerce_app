import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency } from '../../utils/format';

export default function OrderConfirmationScreen({ route, navigation }) {
  const { orderId, orderData } = route.params || {};

  // The amounts charged are the ones the server put on the Sales Order, not the
  // cart screen's running estimate. The two can differ — the estimate is a
  // preview, the order is the record — and showing the estimate here would
  // quote the customer a number that may not be what they are actually paying.
  const deliveryCharges = Number((orderData && orderData.delivery_charges) || 0);
  const grandTotal = Number((orderData && orderData.grand_total) || 0);
  const hasTotals = grandTotal > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
            <Text style={styles.infoLabel}>رقم الطلب</Text>
            <View style={styles.orderNumberWrap}>
              <Icon name="receipt-outline" size={15} color={Colors.primary} />
              <Text style={styles.orderNumber}>#{orderId || 'طلب جديد'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>طريقة الدفع</Text>
            <View style={styles.infoValueRow}>
              <Icon name="cash-outline" size={15} color={Colors.onSurface} />
              <Text style={styles.infoValue}>
                {(orderData && orderData.payment_method) || 'نقداً عند الاستلام'}
              </Text>
            </View>
          </View>

          {/* Amounts come from the saved order. Rendered only when the server
              actually returned a total, so a missing figure reads as absent
              rather than as a confidently wrong zero. */}
          {hasTotals ? (
            <>
              {deliveryCharges > 0 ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>رسوم التوصيل</Text>
                  <Text style={styles.infoValue}>{formatCurrency(deliveryCharges)}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>المبلغ المطلوب عند الاستلام</Text>
                <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>حالة الطلب</Text>
            <View style={styles.infoValueRow}>
              <Icon name="time" size={15} color={Colors.primary} />
              <Text style={[styles.infoValue, { color: Colors.primary, fontFamily: Typography.fontFamilyBold }]}>
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
            <Text style={styles.primaryBtnText}>عرض طلباتي ومتابعة الحالة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              navigation.popToTop();
              navigation.navigate('HomeTab');
            }}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>العودة للرئيسية ومواصلة التسوق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    borderRadius: Radius.lg,
    padding: 18,
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
    textAlign: 'left',
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
  // Separated from the rows above so the amount due reads as the summary of the
  // order rather than just another field in the list.
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 14,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
    flex: 1,
  },
  totalValue: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 15,
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
    borderRadius: Radius.lg,
    paddingVertical: 15,
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