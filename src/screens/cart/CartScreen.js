import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import QuantityStepper from '../../components/QuantityStepper';
import UOMSelector from '../../components/UOMSelector';
import AddressCard from '../../components/AddressCard';
import AddressFormModal from '../../components/AddressFormModal';
import EmptyState from '../../components/EmptyState';
import ProductImage from '../../components/ProductImage';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import useResponsive from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import PageFooter from '../../components/layout/PageFooter';
import useConfirm from '../../components/ConfirmDialog';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import CartAPI from '../../api/cart';
import AddressAPI from '../../api/address';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { MAX_CONTENT_WIDTH } from '../../theme/responsive';
import { formatCurrency, formatCount } from '../../utils/format';

export default function CartScreen({ navigation }) {
  useResetOnTabPress(navigation, 'CartTab');
  const { isDesktop } = useResponsive();
  const { confirm, confirmDialog } = useConfirm();
  const { textStart } = useDirectional();
  // Per-visitor state: the cart must never be indexed, and there is nothing to
  // describe to a crawler. Mirrors the `/cart` disallow in robots.txt.
  useDocumentHead({ path: '/cart', noindex: true });

  const { items, groups, total, currency, loading, updateQuantity, updateUOM, removeItem, clearCart } =
    useCart();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const userKey = (user && user.email) || null;

  // The form offers the customer's own number as the default recipient phone.
  // These accounts are registered by phone number, so the local part of the
  // login address is the fallback when `mobile_no` was never filled in — the
  // same chain the server applies in `_resolve_phone`.
  const defaultPhone =
    (user && user.mobileNo) || (userKey ? userKey.split('@')[0].replace(/[^\d]/g, '') : '');

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [notes, setNotes] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Delivery charge for the selected address, resolved by the server (see
  // CartAPI.getDeliveryEstimate). Kept as its own slice rather than folded into
  // `total`, which is the items subtotal and must keep meaning exactly that.
  // `groups` is the server's per-vendor breakdown — each row carries that
  // vendor's share of the delivery charge, computed by the same plan checkout
  // charges, so the two can never disagree.
  const [delivery, setDelivery] = useState({ charges: 0, shippingAccount: '', source: '', groups: [], loading: false, error: false });
  // Items subtotal plus delivery. Declared after `delivery` because it reads it.
  // Computed here rather than in the cart context because `total` is the
  // server's items subtotal and is also used for the "basket" badge and reorder
  // logic — adding shipping into it there would corrupt all three.
  const grandTotal = Number(total || 0) + Number(delivery.charges || 0);

  // Scope addresses to the signed-in customer, not merely to "logged in", and
  // clear them first so the previous user's list is never briefly visible.
  useEffect(() => {
    setAddresses([]);
    setSelectedAddress(null);
    if (userKey) {
      loadAddresses();
    }
  }, [userKey]);

  // The delivery charge depends on which address is selected, so it is refetched
  // whenever that changes — including back to "no address", which must not leave
  // the previous address's price sitting in the summary.
  useEffect(() => {
    let cancelled = false;
    const addressName = selectedAddress ? selectedAddress.name : null;

    // Reset first so a stale amount is never shown next to the new address for
    // the moment the request is in flight.
    setDelivery({ charges: 0, shippingAccount: '', source: '', groups: [], loading: true, error: false });

    CartAPI.getDeliveryEstimate(addressName)
      .then((data) => {
        if (cancelled) return;
        setDelivery({
          // The server's response carries `delivery_charges` (the total across
          // every vendor group); `charges` is tolerated as a legacy alias so an
          // older backend still prices the summary correctly.
          charges: Number(
            (data && data.delivery_charges !== undefined ? data.delivery_charges : data && data.charges) || 0
          ),
          shippingAccount: (data && data.shipping_account) || '',
          source: (data && data.source) || '',
          groups: (data && Array.isArray(data.groups) && data.groups) || [],
          loading: false,
          error: false,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        // `error` is kept separate from `charges: 0` on purpose. A charge the
        // shop set to zero and a charge we failed to fetch are not the same
        // fact, and collapsing them makes a broken request look exactly like
        // free delivery. The amount still defaults to 0, which cannot
        // undercharge: submit_order resolves the real charge server-side.
        console.warn('Could not load the delivery charge:', err);
        setDelivery({ charges: 0, shippingAccount: '', source: '', groups: [], loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAddress ? selectedAddress.name : null]);

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

  function handleCloseAddAddress() {
    if (savingAddress) return;
    setShowAddAddressModal(false);
  }

  /**
   * Save an address from the shared form.
   *
   * `values` is the form's payload — `{ addressTitle, addressLine1, city, phone,
   * coords, placeName, isDefault }` — so the payload is built in one place for
   * both the cart and the account screen instead of being assembled by each
   * caller. On success the new address is selected straight away, otherwise the
   * shopper would have to pick it manually before they could check out.
   */
  async function handleAddAddress(values) {
    setSavingAddress(true);
    try {
      const name = await AddressAPI.addAddress(values);
      setShowAddAddressModal(false);
      toast.success('تم إضافة العنوان بنجاح');
      await loadAddresses();
      if (name) {
        setSelectedAddress((current) => {
          // Prefer the server's copy so the primary flag and the stored pin are
          // the ones that will actually be used at checkout.
          const list = Array.isArray(addresses) ? addresses : [];
          return list.find((a) => a.name === name) || current;
        });
      }
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
      confirm({
        title: 'تسجيل الدخول مطلوب',
        message: 'يرجى تسجيل الدخول لمتابعة عملية الشراء.',
        confirmLabel: 'تسجيل الدخول',
        cancelLabel: 'إلغاء',
        tone: 'info',
        onConfirm: () => navigation.navigate('AccountTab'),
      });
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
        // Sent for an explicit, auditable payload and so the confirmation screen
        // can echo the figures. Advisory only — the server resolves the real
        // charge again from the address and Webshop Settings.
        deliveryCharges: delivery.charges,
        shippingAccount: delivery.shippingAccount,
      });

      clearCart();
      navigation.navigate('OrderConfirmation', {
        // The checkout creates one Sales Order per vendor sharing a group id;
        // `group` is the shopper-facing reference (there is no single `name`).
        orderId: order.group,
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
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, textStart]}>جاري تحميل السلة...</Text>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

/**
   * Checkout sections, extracted so the phone and desktop layouts compose the
   * same elements.
   *
   * Duplicating this markup per layout is how the two versions silently drift —
   * a delivery-fee fix lands in one column and not the other, and the desktop
   * cart then quotes a total the mobile cart never shows.
   */
  const headerBlock = (
    <View style={styles.cartHeader}>
      <Text style={[styles.cartTitle, textStart]}>سلة المشتريات ({items.length})</Text>
      <Text style={[styles.liveHint, textStart]}>
        <View style={styles.liveDot} /> تُحدَّث السلة تلقائياً
      </Text>
    </View>
  );

  /**
   * One cart line. Extracted from the list so the single-shop (flat) and
   * multi-shop (per-vendor sections) layouts render the exact same card — a
   * fix to the stepper or the price row must reach both, not just one.
   */
  const renderLine = (line, idx) => (
    <View key={`${line.item_code}-${line.uom || idx}`} style={styles.cartItemCard}>
      <View style={styles.itemImageWrapper}>
        <ProductImage
          source={line.image}
          style={styles.itemImage}
          resizeMode="contain"
          fallbackIconSize={26}
        />
      </View>

      <View style={styles.itemInfo}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemName, textStart]} numberOfLines={2}>
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
            <Text style={[styles.itemUnitPrice, textStart]}>
              {formatCurrency(line.rate)} / {line.uom}
            </Text>
            <Text style={[styles.itemTotal, textStart]}>
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

  // A one-shop basket is not "grouped" — it is just a basket. The per-vendor
  // headers (and with them the promise of separate deliveries) only appear once
  // the cart actually spans more than one shop, so the common case keeps the
  // layout it always had.
  const multiShop = groups.length > 1;

  const itemsBlock = (
    <View style={styles.itemsList}>
      {groups.map((group) => (
        <View key={group.shop || 'platform'} style={styles.vendorGroup}>
          {multiShop && (
            <View style={styles.vendorGroupHeader}>
              <ProductImage
                source={group.logo}
                style={styles.vendorGroupLogo}
                resizeMode="contain"
                fallbackIconSize={16}
              />
              <Text style={[styles.vendorGroupName, textStart]} numberOfLines={1}>
                {group.shop_name || (group.is_platform ? 'متجر زاد ماركت' : 'متجر')}
              </Text>
              <Text style={styles.vendorGroupCount}>{formatCount(group.count)}</Text>
            </View>
          )}
          <View style={styles.vendorGroupItems}>{group.items.map(renderLine)}</View>
        </View>
      ))}
    </View>
  );

  /**
   * The amount cell of a delivery row. `charges` is that row's own total — the
   * whole-cart charge for a single-shop basket, or one vendor's share in the
   * multi-shop breakdown.
   */
  const renderDeliveryValue = (charges) =>
    delivery.loading ? (
      <ActivityIndicator size="small" color={Colors.textMuted} />
    ) : delivery.error ? (
      // Never "مجاني" here: that would claim delivery is free when the
      // truth is only that the price could not be read.
      <Text style={[styles.summaryValue, textStart, { color: Colors.textMuted, fontFamily: Typography.fontFamilyBold }]}>
        تعذّر تحديد الرسوم
      </Text>
    ) : Number(charges || 0) > 0 ? (
      <Text style={[styles.summaryValue, textStart, { color: Colors.error, fontFamily: Typography.fontFamilyBold }]}>
        {formatCurrency(charges, currency)}
      </Text>
    ) : (
      <Text style={[styles.summaryValue, textStart, { color: Colors.success, fontFamily: Typography.fontFamilyBold }]}>
        مجاني
      </Text>
    );

  const summaryBlock = (
    <View style={styles.sectionCard}>
      <View style={styles.sectionTitleRow}>
        <Icon name="receipt-outline" size={17} color={Colors.primary} />
        <Text style={[styles.sectionTitle, textStart]}>تفاصيل الفاتورة</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, textStart]}>إجمالي المنتجات</Text>
        <Text style={[styles.summaryValue, textStart]}>{formatCurrency(total, currency)}</Text>
      </View>

      {multiShop && delivery.groups.length > 1 ? (
        // A multi-vendor basket ships in separate parcels, so delivery is
        // quoted per vendor — the same per-shop plan submit_order charges, so
        // this breakdown and the final order can never disagree.
        delivery.groups.map((group) => (
          <View style={styles.summaryRow} key={group.shop || 'platform'}>
            <Text style={[styles.summaryLabel, textStart]} numberOfLines={1}>
              رسوم التوصيل — {group.shop_name || (group.is_platform ? 'متجر زاد ماركت' : 'متجر')}
            </Text>
            {renderDeliveryValue(group.delivery_charges)}
          </View>
        ))
      ) : (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, textStart]}>رسوم التوصيل</Text>
          {renderDeliveryValue(delivery.charges)}
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, textStart]}>طريقة الدفع</Text>
        <View style={styles.paymentBadge}>
          <Icon name="cash-outline" size={15} color={Colors.primary} />
          <Text style={[styles.summaryValue, textStart, { color: Colors.primary, fontFamily: Typography.fontFamilyBold }]}>
            الدفع عند الاستلام (نقد)
          </Text>
        </View>
      </View>

      <View style={[styles.summaryRow, styles.grandTotalRow]}>
        <Text style={[styles.grandTotalLabel, textStart]}>المجموع الكلي المطلوب</Text>
        <Text style={[styles.grandTotalValue, textStart]}>
          {formatCurrency(grandTotal, currency)}
        </Text>
      </View>
    </View>
  );

  const notesBlock = (
    <View style={styles.sectionCard}>
      <View style={styles.sectionTitleRow}>
        <Icon name="create-outline" size={17} color={Colors.primary} />
        <Text style={[styles.sectionTitle, textStart]}>ملاحظات أو تعليمات خاصة للتوصيل</Text>
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
  );

  const addressBlock = (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="location-outline" size={17} color={Colors.primary} />
          <Text style={[styles.sectionTitle, textStart]}>عنوان التوصيل</Text>
        </View>
        {isAuthenticated && (
          <TouchableOpacity onPress={() => setShowAddAddressModal(true)} activeOpacity={0.8}>
            <Text style={[styles.addAddressText, textStart]}>+ إضافة عنوان</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isAuthenticated ? (
        <View style={styles.authNotice}>
          <Icon name="lock-closed-outline" size={18} color={Colors.textMuted} />
          <Text style={[styles.authNoticeText, textStart]}>يرجى تسجيل الدخول لتحديد عنوان التوصيل</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AccountTab')}
            style={styles.authNoticeBtn}
          >
            <Text style={[styles.authNoticeBtnText, textStart]}>تسجيل الدخول</Text>
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
  );

  const checkoutBlock = (
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
          <Text style={[styles.checkoutBtnText, textStart]}>تأكيد الطلب — الدفع عند الاستلام</Text>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pageInner}>
          {isDesktop ? (
            /*
             * Two columns: the order summary and the pay button stay in a rail
             * at the inline start, so the total is visible without scrolling
             * while the shopper is still choosing an address.
             *
             * The rail comes first in the source because `dir="rtl"` makes the
             * first child of a row the right-hand one — which is where an Arabic
             * shopper expects the summary, and where flexbox puts it in English
             * without a second rule.
             */
            <View style={styles.checkoutLayout}>
              <View style={styles.checkoutRail}>
                {summaryBlock}
                {checkoutBlock}
              </View>
              <View style={styles.checkoutMain}>
                {headerBlock}
                {itemsBlock}
                {notesBlock}
                {addressBlock}
              </View>
            </View>
          ) : (
            <>
              {headerBlock}
              {itemsBlock}
              {summaryBlock}
              {notesBlock}
              {addressBlock}
              {checkoutBlock}
            </>
          )}
        </View>
        <PageFooter />
      </ScrollView>

      {/* Web confirm dialog (native uses the platform alert). */}
      {confirmDialog}

      {/* Add address — the very same form the account screen uses, so the two
          cannot drift apart in validation, in the map picker, or in what they
          send to the server. */}
      <AddressFormModal
        visible={showAddAddressModal}
        defaultPhone={defaultPhone}
        saving={savingAddress}
        onClose={handleCloseAddAddress}
        onSubmit={handleAddAddress}
      />
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
  pageInner: {
    width: '100%',
    // Caps the column so the cart does not stretch to a 2560px window, while
    // staying centred rather than pinned to the left edge.
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  checkoutLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  checkoutRail: {
    // The rail carries no scrolling of its own; it simply sits beside the main
    // column and is as tall as its content.
    width: 360,
    maxWidth: '100%',
  },
  checkoutMain: {
    flex: 1,
    minWidth: 0,
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
  vendorGroup: {
    // One card per vendor once the basket spans shops. The gap between groups
    // matches the gap between loose cart lines, so a multi-shop cart reads as
    // one list rather than as clustered blocks.
    gap: 10,
  },
  vendorGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  vendorGroupLogo: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  vendorGroupName: {
    flex: 1,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  vendorGroupCount: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  vendorGroupItems: {
    gap: 12,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 14,
    ...Shadows.xs,
  },
  itemImageWrapper: {
    width: 84,
    height: 84,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.outlineVariant,
  },
  itemImage: {
    width: '88%',
    height: '88%',
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
  },
  itemTotal: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 18,
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
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  addAddressText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  authNotice: {
    padding: 14,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.full,
  },
  authNoticeBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  noAddressBox: {
    padding: 18,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 12,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
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
  deliveryNote: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 4,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 14,
    marginTop: 8,
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
    borderRadius: Radius.full,
    paddingVertical: 16,
    ...Shadows.md,
  },
  checkoutBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
});
