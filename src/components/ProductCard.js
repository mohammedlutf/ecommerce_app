import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from './Icon';
import UOMSelector from './UOMSelector';
import QuantityStepper from './QuantityStepper';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import { formatCurrency, calculateDiscount } from '../utils/format';
import { getImageUrl } from '../api/client';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';

export default function ProductCard({
  product,
  onPress,
  horizontal = false,
  showToastOnAdd = true,
}) {
  const { items: cartItems, addToCart, updateQuantity, removeItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const toast = useToast();

  const availableUoms =
    product.uoms && product.uoms.length > 0
      ? product.uoms
      : [{ uom: product.stock_uom || 'حبة', rate: product.rate || product.price || 0 }];

  const [selectedUom, setSelectedUom] = useState(
    product.uom || (availableUoms[0] && availableUoms[0].uom) || 'حبة'
  );
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartActionLoading, setCartActionLoading] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;

  const currentUomObj = availableUoms.find(
    (u) => (typeof u === 'string' ? u : u.uom) === selectedUom
  );
  const currentRate =
    currentUomObj && currentUomObj.rate
      ? currentUomObj.rate
      : product.rate || product.price || 0;
  const originalPrice = product.original_rate || product.old_rate || null;
  const discountPercent = calculateDiscount(currentRate, originalPrice);

  const cartLine = cartItems.find(
    (item) =>
      item.item_code === product.item_code && (item.uom === selectedUom || !item.uom)
  );
  const inCartQty = cartLine ? cartLine.qty : 0;
  const wishlisted = isWishlisted(product.item_code);
  const imageUrl = getImageUrl(product.website_image || product.image);

  function animatePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }

  async function handleToggleWishlist() {
    setWishlistLoading(true);
    try {
      const added = await toggleWishlist(product.item_code);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nowWishlisted = added !== false;
      if (showToastOnAdd) {
        toast.success(nowWishlisted ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة');
      }
    } catch (err) {
      toast.error(err?.message || 'تعذر تحديث المفضلة');
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleAddToCart() {
    animatePress();
    setCartActionLoading(true);
    try {
      await addToCart(product.item_code, 1, selectedUom);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (showToastOnAdd) toast.success('تمت الإضافة إلى السلة');
    } catch (err) {
      toast.error(err?.message || 'تعذر إضافة المنتج');
    } finally {
      setCartActionLoading(false);
    }
  }

  async function handleIncrement() {
    setCartActionLoading(true);
    try {
      await updateQuantity(product.item_code, inCartQty + 1, selectedUom);
    } catch (err) {
      toast.error(err?.message || 'تعذر تحديث الكمية');
    } finally {
      setCartActionLoading(false);
    }
  }

  async function handleDecrement() {
    setCartActionLoading(true);
    try {
      if (inCartQty <= 1) {
        await removeItem(product.item_code);
      } else {
        await updateQuantity(product.item_code, inCartQty - 1, selectedUom);
      }
    } catch (err) {
      toast.error(err?.message || 'تعذر تحديث الكمية');
    } finally {
      setCartActionLoading(false);
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress && onPress(product)}
      style={[
        styles.card,
        horizontal ? styles.cardHorizontal : styles.cardVertical,
      ]}
    >
      {/* Media */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.placeholderImage}>
            <Icon name="bag-handle-outline" size={42} color={Colors.textMuted} />
          </View>
        )}

        {discountPercent ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercent}%-</Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleToggleWishlist}
          disabled={wishlistLoading}
          style={[styles.wishlistBtn, wishlisted && styles.wishlistBtnActive]}
        >
          {wishlistLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Icon
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={wishlisted ? Colors.error : Colors.onSurface}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {product.item_group ? (
          <View style={styles.categoryRow}>
            <Icon name="pricetag-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.categoryText} numberOfLines={1}>
              {product.item_group}
            </Text>
          </View>
        ) : null}

        <Text style={styles.title} numberOfLines={2}>
          {product.item_name || product.web_item_name || product.item_code}
        </Text>

        {availableUoms.length > 1 && (
          <UOMSelector
            uoms={availableUoms}
            selectedUom={selectedUom}
            onSelectUom={(uom) => setSelectedUom(uom)}
            size="sm"
          />
        )}

        {/* Pricing */}
        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>{formatCurrency(currentRate)}</Text>
          {originalPrice && originalPrice > currentRate ? (
            <View style={styles.oldPriceWrap}>
              <Text style={styles.originalPrice}>{formatCurrency(originalPrice)}</Text>
            </View>
          ) : null}
        </View>

        {/* Action */}
        <View style={styles.actionContainer}>
          {inCartQty > 0 ? (
            <QuantityStepper
              quantity={inCartQty}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              loading={cartActionLoading}
              size="sm"
            />
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAddToCart}
              disabled={cartActionLoading}
              style={styles.addToCartBtn}
            >
              {cartActionLoading ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <Icon name="add" size={16} color={Colors.onPrimary} />
                  <Text style={styles.addToCartText}>أضف للسلة</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardVertical: { width: '100%', marginBottom: 12 },
  cardHorizontal: { flexDirection: 'row', marginBottom: 12 },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '92%', height: '92%' },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    ...Shadows.sm,
  },
  discountText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  wishlistBtnActive: {
    backgroundColor: '#fff0f0',
  },
  content: { padding: 12, flex: 1, justifyContent: 'space-between' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  categoryText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  title: {
    fontSize: Typography.sizes.titleSm,
    color: Colors.onSurface,
    lineHeight: 20,
    marginBottom: 6,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'left',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginVertical: 6,
  },
  currentPrice: {
    fontSize: Typography.sizes.priceMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  oldPriceWrap: { flexShrink: 1 },
  originalPrice: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    fontFamily: Typography.fontFamilyMedium,
  },
  actionContainer: { marginTop: 4 },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  addToCartText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
});