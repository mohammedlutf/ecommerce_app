import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { impactLight, notifySuccess } from '../utils/haptics';
import Icon from './Icon';
import UOMSelector from './UOMSelector';
import QuantityStepper from './QuantityStepper';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import { formatCurrency, calculateDiscount } from '../utils/format';
import { rateForUom } from '../utils/catalog';
import ProductImage from './ProductImage';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useAdmin } from '../context/AdminContext';
import useDirectional from '../hooks/useDirectional';

function ProductCard({
  product,
  onPress,
  horizontal = false,
  showToastOnAdd = true,
  /**
   * Height of the image area.
   *
   * Defaults to 140pt, which is right for a 2-up phone grid but reads as a thin
   * letterbox once the card is one of four or five across a desktop window.
   * `ProductGrid` passes a value scaled to the column width so the card keeps a
   * consistent proportion instead of losing its image to whitespace.
   */
  imageHeight = 140,
}) {
  const { items: cartItems, addToCart, updateQuantity, removeItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const toast = useToast();
  const { isAdmin, openEditor } = useAdmin();
  const { textStart, insetStart, insetEnd } = useDirectional();

  const availableUoms =
    product.uoms && product.uoms.length > 0
      ? product.uoms
      : [{ uom: product.stock_uom || 'حبة', rate: product.rate || product.price || 0 }];

  const [selectedUom, setSelectedUom] = useState(
    product.uom || (availableUoms[0] && availableUoms[0].uom) || 'حبة'
  );
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartActionLoading, setCartActionLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const wishlistScale = useRef(new Animated.Value(1)).current;

  const currentRate = rateForUom(product, selectedUom);
  // product.price  || 
  const originalPrice = product.original_rate || product.old_rate ||  null;
  const discountPercent = calculateDiscount(currentRate, originalPrice);

  const cartLine = cartItems.find(
    (item) =>
      item.item_code === product.item_code && (item.uom === selectedUom || !item.uom)
  );
  const inCartQty = cartLine ? cartLine.qty : 0;
  const wishlisted = isWishlisted(product.item_code);

  function animatePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 300, useNativeDriver: true }),
    ]).start();
  }

  function animateWishlist() {
    Animated.sequence([
      Animated.timing(wishlistScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.spring(wishlistScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }

  function handleOpenEditor() {
    if (!product.item_code) return;
    openEditor(product.item_code);
  }

  async function handleToggleWishlist() {
    setWishlistLoading(true);
    animateWishlist();
    try {
      const added = await toggleWishlist(product.item_code);
      impactLight();
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
      await addToCart(product.item_code, 1, selectedUom, product);
      notifySuccess();
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 1200);
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
        await removeItem(product.item_code, selectedUom);
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onPress && onPress(product)}
        style={[
          styles.card,
          horizontal ? styles.cardHorizontal : styles.cardVertical,
        ]}
      >
        {/* Media */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <ProductImage
            source={product.website_image || product.image}
            blurhash={product.blurhash}
            style={styles.image}
          />

          {discountPercent ? (
            <View style={[styles.discountBadge, insetStart(8)]}>
              <Text style={[styles.discountText, textStart]}>{discountPercent}%-</Text>
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.wishlistWrapper,
              insetEnd(8),
              { transform: [{ scale: wishlistScale }] },
            ]}
          >
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
                  size={17}
                  color={wishlisted ? Colors.error : Colors.onSurfaceVariant}
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Admin-only. The backend enforces this too; hiding it is a courtesy to
              shoppers, not the control itself. */}
          {isAdmin ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenEditor}
              accessibilityRole="button"
              accessibilityLabel={`تعديل ${product.item_name || product.item_code}`}
              style={[styles.adminBtn, insetEnd(8)]}
            >
              <Icon name="create-outline" size={17} color={Colors.onPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/*
           * Vendor badge. Only a real vendor shop is badged: the platform's own
           * catch-all shop owns every unassigned product, and badging all of
           * them with the store's own name would be noise, not information.
           * `is_platform` is therefore explicitly false, not merely falsy.
           */}
          {product.shop && product.shop.shop_name && product.shop.is_platform === false ? (
            <View style={styles.shopRow}>
              <Icon name="storefront-outline" size={10} color={Colors.primary} />
              <Text style={[styles.shopText, textStart]} numberOfLines={1}>
                {product.shop.shop_name}
              </Text>
            </View>
          ) : null}

          {product.item_group ? (
            <View style={styles.categoryRow}>
              <Icon name="pricetag-outline" size={10} color={Colors.textMuted} />
              <Text style={[styles.categoryText, textStart]} numberOfLines={1}>
                {product.item_group}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.title, textStart]} numberOfLines={2}>
            {product.item_name || product.web_item_name || product.item_code}
          </Text>

          <UOMSelector
            uoms={availableUoms}
            stockUom={product.stock_uom}
            selectedUom={selectedUom}
            onSelectUom={(uomName, unitObj) => {
              setSelectedUom(uomName);
            }}
            size="sm"
          />

          {/* Pricing */}
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, textStart]}>{formatCurrency(currentRate)}</Text>
            {originalPrice && originalPrice > currentRate ? (
              <View style={styles.oldPriceWrap}>
                <Text style={[styles.originalPrice, textStart]}>{formatCurrency(originalPrice)}</Text>
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
                fullWidth
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
                ) : addedToCart ? (
                  <>
                    <Icon name="checkmark" size={16} color={Colors.onPrimary} />
                    <Text style={[styles.addToCartText, textStart]}>تمت الإضافة</Text>
                  </>
                ) : (
                  <>
                    <Icon name="add" size={16} color={Colors.onPrimary} />
                    <Text style={[styles.addToCartText, textStart]}>أضف للسلة</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardVertical: { width: '100%', marginBottom: 12 },
  cardHorizontal: { flexDirection: 'row', marginBottom: 12 },
  imageContainer: {
    position: 'relative',
    width: '100%',
    // Overridden by the `imageHeight` prop; this is the phone-grid default.
    height: 140,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '90%', height: '90%' },
  discountBadge: {
    position: 'absolute',
    top: 8,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    ...Shadows.xs,
  },
  discountText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  wishlistWrapper: {
    position: 'absolute',
    top: 8,
    zIndex: 10,
  },
  wishlistBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest || '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
    ...Shadows.xs,
  },
  wishlistBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  adminBtn: {
    position: 'absolute',
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  content: { padding: 12, flex: 1, justifyContent: 'space-between' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  shopText: {
    flexShrink: 1,
    fontSize: Typography.sizes.labelSm,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  categoryText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  title: {
    fontSize: Typography.sizes.titleSm,
    color: Colors.onSurface,
    lineHeight: Typography.lineHeights.titleSm,
    marginBottom: 6,
    fontFamily: Typography.fontFamilySemiBold,
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
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
    ...Shadows.xs,
  },
  addToCartText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
});

/**
 * Memoized: grid rows re-render whenever their parent does, but a card's output
 * only depends on its `product`, `imageHeight`, `onPress` and layout flags. With
 * the parent passing stable references, unchanged cards skip re-render entirely.
 */
export default React.memo(ProductCard);