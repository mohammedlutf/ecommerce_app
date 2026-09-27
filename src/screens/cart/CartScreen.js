import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import QuantityStepper from '../../components/QuantityStepper';
import UOMSelector from '../../components/UOMSelector';
import AddressCard from '../../components/AddressCard';
import EmptyState from '../../components/EmptyState';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import CartAPI from '../../api/cart';
import AddressAPI from '../../api/address';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency } from '../../utils/format';
import { getImageUrl } from '../../api/client';

export default function CartScreen({ navigation }) {
  useResetOnTabPress(navigation, 'CartTab');

  // Used to lift the add-address sheet above the keyboard and switch it to a
  // compact layout, so the keyboard can never cover the form (see the Modal).
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  // Keeps the bottom of the sheet clear of the gesture bar / home button.
  const insets = useSafeAreaInsets();

  // How tall the modal's own container actually is, and how tall it gets when
  // the keyboard is down. Android is inconsistent here: sometimes the modal
  // window resizes for the keyboard, sometimes it does not and the keyboard
  // just overlays it. Rather than assume, measure it — if the container has
  // already shrunk by roughly the keyboard height, the platform resized it for
  // us and adding another offset would double-count and shove the sheet to the
  // top of the screen.
  const [overlayHeight, setOverlayHeight] = useState(0);
  const fullOverlayHeight = useRef(0);

  function handleOverlayLayout(e) {
    const height = e.nativeEvent.layout.height;
    setOverlayHeight(height);
    if (keyboardHeight === 0 && height > fullOverlayHeight.current) {
      fullOverlayHeight.current = height;
    }
  }

  const windowResized =
    keyboardOpen &&
    fullOverlayHeight.current > 0 &&
    fullOverlayHeight.current - overlayHeight > keyboardHeight * 0.5;

  // Where the sheet's lower edge goes, and how much room it actually has.
  const sheetBottom = windowResized ? 0 : keyboardHeight;
  const usableHeight = windowResized
    ? overlayHeight
    : Math.max(0, overlayHeight - keyboardHeight);
  // Left uncapped until the first layout lands, otherwise the sheet would be
  // squeezed to its minimum for one frame and flash on open.
  const sheetMaxHeight =
    overlayHeight === 0 ? undefined : Math.max(220, usableHeight - insets.top - 12);

  const { items, total, currency, loading, updateQuantity, updateUOM, removeItem, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const userKey = (user && user.email) || null;

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [notes, setNotes] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('صنعاء');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  // Scope addresses to the signed-in customer, not merely to "logged in", and
  // clear them first so the previous user's list is never briefly visible.
  useEffect(() => {
    setAddresses([]);
    setSelectedAddress(null);
    if (userKey) {
      loadAddresses();
    }
  }, [userKey]);

  async function loadAddresses() {
    try {
      const data = await AddressAPI.getAddresses();
      const list = Array.isArray(data) ? data : [];
      // Always replace the list, including with an empty one. Skipping the
      // update for an empty response left the PREVIOUS user's addresses on
      // screen after logging in as somebody else.
      setAddresses(list);
      if (list.length > 0) {
        const primary = list.find((a) => a.is_primary_address) || list[0];
        setSelectedAddress(primary);
      } else {
        setSelectedAddress(null);
      }
    } catch (err) {
      console.warn('Could not load addresses:', err);
    }
  }

  function closeAddAddressModal() {
    // Dismiss the keyboard first, otherwise it lingers over the cart for a
    // moment after the sheet is gone.
    Keyboard.dismiss();
    setShowAddAddressModal(false);
  }

  function handleBackdropPress() {
    // With the keyboard up, a tap on the dimmed area should only put the
    // keyboard away and leave the form open with everything the user typed
    // intact. A second tap (keyboard already down) closes the sheet.
    if (keyboardHeight > 0) {
      Keyboard.dismiss();
      return;
    }
    closeAddAddressModal();
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
      closeAddAddressModal();
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

  async function handleRemoveItem(itemCode, uom = null) {
    try {
      await removeItem(itemCode, uom);
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
                      onPress={() => handleRemoveItem(line.item_code, line.uom)}
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
                        if (line.qty <= 1) handleRemoveItem(line.item_code, line.uom);
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

      {/* Add Address Modal — bottom sheet */}
      <Modal
        visible={showAddAddressModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeAddAddressModal}
      >
        {/*
          A React Native <Modal> is its own window, and Android does not treat it
          consistently: on some versions the modal window resizes for the
          keyboard, on others the keyboard simply overlays it. The sheet is
          absolutely positioned, and `handleOverlayLayout` measures which of the
          two is happening so `bottom` is only applied when the platform did not
          already account for the keyboard. That keeps the sheet's lower edge
          exactly on top of the keyboard instead of overshooting to the top of
          the screen.
        */}
        <View style={styles.modalOverlay} onLayout={handleOverlayLayout}>
          {/* Tap the dimmed area to dismiss. With the keyboard up, the first tap
              only hides the keyboard so the sheet is not thrown away by a stray
              touch while typing. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
          />

          <View
            style={[
              styles.modalSheet,
              keyboardOpen && styles.modalSheetCompact,
              {
                bottom: sheetBottom,
                maxHeight: sheetMaxHeight,
                // Clear the gesture bar / home button when the sheet is resting on
                // the screen edge. With the keyboard up there is no safe area to
                // protect any more, so it just needs a little breathing room.
                paddingBottom: keyboardOpen ? 16 : insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.modalTitle}>إضافة عنوان توصيل</Text>
                {!keyboardOpen && (
                  <Text style={styles.sheetSubtitle}>
                    أدخل تفاصيل الموقع حتى نوصّل طلبك بسهولة
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={closeAddAddressModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.sheetCloseBtn}
              >
                <Icon name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              // "always" (not "handled") so scrolling the form or tapping a
              // non-interactive part of the sheet does NOT dismiss the keyboard
              // — the user has to dismiss it deliberately.
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalInputGroup}>
                {!keyboardOpen && <Text style={styles.modalLabel}>المدينة / المنطقة</Text>}
                <TextInput
                  value={newAddressCity}
                  onChangeText={setNewAddressCity}
                  placeholder="المدينة / المنطقة — مثال: صنعاء , حي الروضة"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.modalInput, keyboardOpen && styles.modalInputCompact]}
                  textAlign="right"
                />
              </View>

              <View style={styles.modalInputGroup}>
                {!keyboardOpen && <Text style={styles.modalLabel}>العنوان بالتفصيل (الشارع، المعلم القريب)</Text>}
                <TextInput
                  value={newAddressLine}
                  onChangeText={setNewAddressLine}
                  placeholder="العنوان بالتفصيل — الشارع العام، بجوار مسجد"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.modalInput, keyboardOpen && styles.modalInputCompact]}
                  textAlign="right"
                />
              </View>

              <View style={styles.modalInputGroup}>
                {!keyboardOpen && <Text style={styles.modalLabel}>رقم هاتف المستلم</Text>}
                <TextInput
                  value={newAddressPhone}
                  onChangeText={setNewAddressPhone}
                  placeholder="رقم هاتف المستلم — 77XXXXXXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleAddAddress}
                  style={[styles.modalInput, keyboardOpen && styles.modalInputCompact]}
                  textAlign="right"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={closeAddAddressModal}
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
            </ScrollView>
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
    // Positioning is done by the absolutely-positioned sheet, so the overlay
    // only paints the scrim.
    flex: 1,
    backgroundColor: Colors.scrim,
  },
  modalSheet: {
    // Anchored to the keyboard by the inline `bottom`. The backdrop Pressable
    // comes first in the tree, so the sheet sits above it and still receives
    // touches.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surfaceContainerLowest,
    // Only the top corners are rounded — the sheet is flush with the screen
    // bottom, which is what makes it read as a bottom sheet.
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    // `paddingBottom` and `maxHeight` are applied inline in the JSX because
    // they depend on hook values, and StyleSheet.create() runs at module load
    // where no hook value is in scope yet.
    gap: 14,
    ...Shadows.lg,
  },
  modalSheetCompact: {
    // Shrink so all three fields and the buttons are visible at once with the
    // keyboard open, rather than one field at a time.
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
  },
  sheetHandle: {
    // The grabber that signals "this sheet can be dragged".
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outline,
    opacity: 0.4,
    marginBottom: 6,
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.bodySm,
    textAlign: 'left',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  modalScroll: {
    // Lets the form area compress (and therefore scroll) when the sheet is
    // capped by maxHeight, instead of overflowing past the screen edge.
    flexShrink: 1,
  },
  modalScrollContent: {
    gap: 14,
    paddingTop: 2,
  },
  modalInputCompact: {
    height: 42,
    paddingHorizontal: 10,
    fontSize: Typography.sizes.bodySm,
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