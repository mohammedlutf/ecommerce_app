import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import QuantityStepper from '../../components/QuantityStepper';
import UOMSelector from '../../components/UOMSelector';
import AddressCard from '../../components/AddressCard';
import EmptyState from '../../components/EmptyState';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import CartAPI from '../../api/cart';
import AddressAPI from '../../api/address';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency } from '../../utils/format';
import { getImageUrl } from '../../api/client';

export default function CartScreen({ navigation }) {
  const { items, total, currency, loading, updateQuantity, updateUOM, removeItem, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [notes, setNotes] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('مأرب');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadAddresses();
    }
  }, [isAuthenticated]);

  async function loadAddresses() {
    try {
      const data = await AddressAPI.getAddresses();
      if (Array.isArray(data) && data.length > 0) {
        setAddresses(data);
        const primary = data.find((a) => a.is_primary_address) || data[0];
        setSelectedAddress(primary);
      }
    } catch (err) {
      console.warn('Could not load addresses:', err);
    }
  }

  async function handleAddAddress() {
    if (!newAddressLine.trim()) {
      toast.error('يرجى إدخال عنوان التوصيل');
      return;
    }
    setSavingAddress(true);
    try {
      await AddressAPI.addAddress({
        addressLine1: newAddressLine,
        city: newAddressCity,
        phone: newAddressPhone || (user && user.email),
        addressTitle: 'عنوان التوصيل',
      });
      setShowAddAddressModal(false);
      setNewAddressLine('');
      setNewAddressPhone('');
      toast.success('تم إضافة العنوان بنجاح');
      await loadAddresses();
    } catch (err) {
      toast.error(err?.message || 'تعذر إضافة العنوان');
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleRemoveItem(itemCode) {
    try {
      await removeItem(itemCode);
      toast.info('تم حذف المنتج من السلة');
    } catch (err) {
      toast.error(err?.message || 'تعذر حذف المنتج');
    }
  }

  async function handleCheckout() {
    if (!isAuthenticated) {
      Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول لمتابعة عملية الشراء.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الدخول', onPress: () => navigation.navigate('AccountTab') },
      ]);
      return;
    }

    if (items.length === 0) {
      toast.info('سلتك فارغة');
      return;
    }

    if (!selectedAddress && addresses.length > 0) {
      toast.error('يرجى اختيار عنوان التوصيل');
      return;
    }

    setCheckingOut(true);
    try {
      const order = await CartAPI.submitOrder({
        addressName: selectedAddress ? selectedAddress.name : null,
        phone: selectedAddress ? selectedAddress.phone : null,
        notes,
      });

      clearCart();
      navigation.navigate('OrderConfirmation', {
        orderId: order.name,
        orderData: order,
      });
    } catch (err) {
      toast.error(err?.message || 'تعذر إتمام الطلب، يرجى المحاولة مرة أخرى');
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل السلة...</Text>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          icon="basket-outline"
          title="سلة التسوق فارغة"
          description="لم تقم بإضافة أي منتجات إلى سلتك بعد. تصفح أحدث عروضنا وأضف ما يعجبك!"
          actionLabel="تصفح المنتجات الآن"
          onAction={() => navigation.navigate('HomeTab')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>سلة المشتريات ({items.length})</Text>
          <Text style={styles.liveHint}>
            <View style={styles.liveDot} /> تُحدَّث السلة تلقائياً
          </Text>
        </View>

        {/* Line items */}
        <View style={styles.itemsList}>
          {items.map((line, idx) => {
            const imageUrl = getImageUrl(line.image);
            return (
              <View key={`${line.item_code}-${line.uom || idx}`} style={styles.cartItemCard}>
                <View style={styles.itemImageWrapper}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="contain" />
                  ) : (
                    <Icon name="bag-handle-outline" size={26} color={Colors.textMuted} />
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {line.item_name || line.item_code}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(line.item_code)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={styles.deleteBtn}
                    >
                      <Icon name="trash-outline" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {line.uoms && line.uoms.length > 1 && (
                    <UOMSelector
                      uoms={line.uoms}
                      selectedUom={line.uom}
                      onSelectUom={(newUom) => updateUOM(line.item_code, newUom, line.uom)}
                      size="sm"
                    />
                  )}

                  <View style={styles.itemBottomRow}>
                    <View>
                      <Text style={styles.itemUnitPrice}>
                        {formatCurrency(line.rate)} / {line.uom}
                      </Text>
                      <Text style={styles.itemTotal}>
                        المجموع: {formatCurrency(line.amount)}
                      </Text>
                    </View>

                    <QuantityStepper
                      quantity={line.qty}
                      onIncrement={() => updateQuantity(line.item_code, line.qty + 1, line.uom)}
                      onDecrement={() => {
                        if (line.qty <= 1) handleRemoveItem(line.item_code);
                        else updateQuantity(line.item_code, line.qty - 1, line.uom);
                      }}
                      size="sm"
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="location-outline" size={17} color={Colors.primary} />
              <Text style={styles.sectionTitle}>عنوان التوصيل</Text>
            </View>
            {isAuthenticated && (
              <TouchableOpacity onPress={() => setShowAddAddressModal(true)} activeOpacity={0.8}>
                <Text style={styles.addAddressText}>+ إضافة عنوان</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isAuthenticated ? (
            <View style={styles.authNotice}>
              <Icon name="lock-closed-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.authNoticeText}>يرجى تسجيل الدخول لتحديد عنوان التوصيل</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AccountTab')}
                style={styles.authNoticeBtn}
              >
                <Text style={styles.authNoticeBtnText}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          ) : addresses.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowAddAddressModal(true)}
              style={styles.noAddressBox}
              activeOpacity={0.8}
            >
              <Icon name="add-circle-outline" size={22} color={Colors.primary} />
              <Text style={styles.noAddressText}>لم تقم بإضافة عنوان توصيل بعد. انقر لإضافة عنوان جديد.</Text>
            </TouchableOpacity>
          ) : (
            addresses.map((addr) => (
              <AddressCard
                key={addr.name}
                address={addr}
                isSelected={selectedAddress && selectedAddress.name === addr.name}
                onSelect={(selected) => setSelectedAddress(selected)}
              />
            ))
          )}
        </View>

        {/* Notes */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Icon name="create-outline" size={17} color={Colors.primary} />
            <Text style={styles.sectionTitle}>ملاحظات أو تعليمات خاصة للتوصيل</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="مثال: يرجى الاتصال عند الوصول، الاتصال على رقم آخر..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={2}
            style={styles.notesInput}
            textAlign="right"
          />
        </View>

        {/* Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Icon name="receipt-outline" size={17} color={Colors.primary} />
            <Text style={styles.sectionTitle}>تفاصيل الفاتورة</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المنتجات</Text>
            <Text style={styles.summaryValue}>{formatCurrency(total, currency)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم التوصيل</Text>
            <Text style={[styles.summaryValue, { color: Colors.success, fontFamily: Typography.fontFamilyBold }]}>
              مجاني
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>طريقة الدفع</Text>
            <View style={styles.paymentBadge}>
              <Icon name="cash-outline" size={15} color={Colors.primary} />
              <Text style={[styles.summaryValue, { color: Colors.primary, fontFamily: Typography.fontFamilyBold }]}>
                الدفع عند الاستلام (نقد)
              </Text>
            </View>
          </View>

          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>المجموع الكلي المطلوب</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(total, currency)}</Text>
          </View>
        </View>

        {/* Checkout */}
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={checkingOut}
          onPress={handleCheckout}
          style={styles.checkoutBtn}
        >
          {checkingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Icon name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.checkoutBtnText}>تأكيد الطلب — الدفع عند الاستلام</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Add Address Modal */}
      <Modal visible={showAddAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إضافة عنوان توصيل جديد</Text>
              <TouchableOpacity onPress={() => setShowAddAddressModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>المدينة / المنطقة</Text>
              <TextInput
                value={newAddressCity}
                onChangeText={setNewAddressCity}
                placeholder="مأرب، حي الروضة، إلخ..."
                placeholderTextColor={Colors.textMuted}
                style={styles.modalInput}
                textAlign="right"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>العنوان بالتفصيل (الشارع، المعلم القريب)</Text>
              <TextInput
                value={newAddressLine}
                onChangeText={setNewAddressLine}
                placeholder="الشارع العام، بجوار مسجد..."
                placeholderTextColor={Colors.textMuted}
                style={styles.modalInput}
                textAlign="right"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>رقم هاتف المستلم</Text>
              <TextInput
                value={newAddressPhone}
                onChangeText={setNewAddressPhone}
                placeholder="77XXXXXXX"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                style={styles.modalInput}
                textAlign="right"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowAddAddressModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddAddress}
                disabled={savingAddress}
                style={styles.modalSaveBtn}
              >
                {savingAddress ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>حفظ العنوان</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cartHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  liveHint: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  itemsList: {
    gap: 12,
    marginBottom: 20,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
    ...Shadows.sm,
  },
  itemImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '90%',
    height: '90%',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
    flex: 1,
    textAlign: 'left',
  },
  deleteBtn: {
    padding: 4,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  itemUnitPrice: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'left',
  },
  itemTotal: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
    marginTop: 2,
    textAlign: 'left',
  },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  addAddressText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  authNotice: {
    padding: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  authNoticeText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
    flex: 1,
  },
  authNoticeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  authNoticeBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  noAddressBox: {
    padding: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  noAddressText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 10,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },
  summaryValue: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyMedium,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 12,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  grandTotalValue: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    ...Shadows.md,
  },
  checkoutBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.scrim,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  modalInputGroup: { gap: 6 },
  modalLabel: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  modalInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    height: 46,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  modalCancelText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilySemiBold,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  modalSaveText: {
    fontSize: Typography.sizes.labelMd,
    color: '#ffffff',
    fontFamily: Typography.fontFamilyBold,
  },
});