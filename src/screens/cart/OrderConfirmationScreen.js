import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';

export default function OrderConfirmationScreen({ route, navigation }) {
  const { orderId } = route.params || {};

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
          شكراً لتسوقك معنا في سوبرماركت حضرموت. نقوم الآن بتجهيز طلبيتك بعناية لتصلك في أسرع وقت.
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
              <Text style={styles.infoValue}>نقداً عند الاستلام</Text>
            </View>
          </View>
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
            onPress={() => navigation.navigate('AccountTab')}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>عرض طلباتي ومتابعة الحالة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('HomeTab')}
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