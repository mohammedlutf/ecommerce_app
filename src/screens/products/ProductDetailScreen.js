import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import UOMSelector from '../../components/UOMSelector';
import QuantityStepper from '../../components/QuantityStepper';
import CatalogAPI from '../../api/catalog';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency, calculateDiscount } from '../../utils/format';
import { rateForUom } from '../../utils/catalog';
import { getImageUrl } from '../../api/client';

export default function ProductDetailScreen({ route, navigation }) {
  const { itemCode } = route.params || {};

  const { items: cartItems, addToCart, updateQuantity, removeItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUom, setSelectedUom] = useState('حبة');
  const [qty, setQty] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await CatalogAPI.getItem(itemCode);
      if (data) {
        setProduct(data);
        if (data.uoms && data.uoms.length > 0) {
          setSelectedUom(data.uoms[0].uom);
        } else if (data.stock_uom) {
          setSelectedUom(data.stock_uom);
        }
      }
    } catch (err) {
      toast.error(err?.message || 'تعذر تحميل تفاصيل المنتج');
    } finally {
      setLoading(false);
    }
  }, [itemCode]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Live: re-fetch the product when the app returns to the foreground.
  useLiveRefresh(fetchDetail, { intervalMs: 0, isEnabled: true });

  if (loading || !product) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل المنتج...</Text>
      </SafeAreaView>
    );
  }

  const availableUoms =
    product.uoms && product.uoms.length > 0
      ? product.uoms
      : [{ uom: product.stock_uom || 'حبة', rate: product.rate || product.price || 0 }];

  const currentRate = rateForUom(product, selectedUom);
  const originalPrice = product.original_rate || null;
  const discountPercent = calculateDiscount(currentRate, originalPrice);

  const cartLine = cartItems.find(
    (item) =>
      item.item_code === product.item_code && (item.uom === selectedUom || !item.uom)
  );
  const inCartQty = cartLine ? cartLine.qty : 0;
  const wishlisted = isWishlisted(product.item_code);
  const imageUrl = getImageUrl(product.website_image || product.image);

  async function handleAddToCart() {
    setActionLoading(true);
    try {
      await addToCart(product.item_code, qty, selectedUom, product);
      toast.success('تمت إضافة المنتج إلى سلتك بنجاح');
    } catch (err) {
      toast.error(err?.message || 'فشلت إضافة المنتج');
    } finally {
      setActionLoading(false);
    }
  }

  function handleSelectUom(uom) {
    const previousUom = selectedUom;
    setSelectedUom(uom);
    // If this product is already in the cart under a different UOM, migrate
    // the cart line immediately so the cart reflects the change live.
    const line = cartItems.find(
      (i) => i.item_code === product.item_code && i.uom === previousUom
    );
    if (line) {
      updateUOM(product.item_code, uom, previousUom);
    }
  }

  async function handleToggleWishlist() {
    setWishlistLoading(true);
    try {
      const added = await toggleWishlist(product.item_code);
      const nowWishlisted = added !== false;
      toast.success(nowWishlisted ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة');
    } catch (err) {
      toast.error(err?.message || 'تعذر تحديث المفضلة');
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleReviewSubmit() {
    if (!isAuthenticated) {
      toast.error('يرجى تسجيل الدخول أولاً لإضافة تقييم');
      return;
    }
    if (!reviewComment.trim()) {
      toast.error('يرجى كتابة تعليقك على المنتج');
      return;
    }

    setReviewSubmitting(true);
    try {
      await CatalogAPI.addReview({
        websiteItem: product.name || product.item_code,
        rating,
        reviewTitle: 'تقييم العميل',
        comment: reviewComment,
      });
      toast.success('شكراً لك! تم إرسال تقييمك بنجاح');
      setReviewComment('');
    } catch (err) {
      toast.error(err?.message || 'تعذر إرسال التقييم');
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Image */}
        <View style={styles.imageWrapper}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderBox}>
              <Icon name="bag-handle-outline" size={64} color={Colors.textMuted} />
            </View>
          )}

          {discountPercent ? (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagText}>{discountPercent}% خصم</Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleToggleWishlist}
            disabled={wishlistLoading}
            style={[styles.wishlistCircle, wishlisted && styles.wishlistCircleActive]}
          >
            {wishlistLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Icon
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={24}
                color={wishlisted ? Colors.error : Colors.onSurface}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          {product.item_group ? (
            <View style={styles.categoryRow}>
              <Icon name="pricetag-outline" size={13} color={Colors.primary} />
              <Text style={styles.categoryLabel}>{product.item_group}</Text>
            </View>
          ) : null}

          <Text style={styles.productTitle}>
            {product.item_name || product.web_item_name || product.item_code}
          </Text>

          <View style={styles.stockRow}>
            <View style={styles.stockDot} />
            <Text style={styles.stockText}>متوفر في المخزون</Text>
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{formatCurrency(currentRate)}</Text>
            {originalPrice && originalPrice > currentRate ? (
              <Text style={styles.originalPriceText}>{formatCurrency(originalPrice)}</Text>
            ) : null}
            <Text style={styles.uomIndicator}>/ لكل {selectedUom}</Text>
          </View>

          {/* UOM */}
          {availableUoms.length > 1 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>اختر وحدة التعبئة / الحجم</Text>
              <UOMSelector
                uoms={availableUoms}
                selectedUom={selectedUom}
                onSelectUom={handleSelectUom}
                size="md"
              />
            </View>
          )}

          {/* Qty */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>الكمية المطلوبة</Text>
            <QuantityStepper
              quantity={inCartQty > 0 ? inCartQty : qty}
              onIncrement={() => {
                if (inCartQty > 0) {
                  updateQuantity(product.item_code, inCartQty + 1, selectedUom);
                } else {
                  setQty(qty + 1);
                }
              }}
              onDecrement={() => {
                if (inCartQty > 0) {
                  if (inCartQty <= 1) removeItem(product.item_code, selectedUom);
                  else updateQuantity(product.item_code, inCartQty - 1, selectedUom);
                } else {
                  if (qty > 1) setQty(qty - 1);
                }
              }}
              size="lg"
            />
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>تفاصيل ومواصفات المنتج</Text>
              <Text style={styles.descriptionText}>
                {product.description.replace(/<[^>]*>?/gm, '').trim()}
              </Text>
            </View>
          ) : null}

          {/* Reviews */}
          <View style={styles.reviewSection}>
            <Text style={styles.sectionLabel}>تقييمات وآراء العملاء</Text>

            <View style={styles.addReviewCard}>
              <Text style={styles.addReviewTitle}>أضف تقييمك للمنتج</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} activeOpacity={0.7} onPress={() => setRating(s)}>
                    <Icon name={rating >= s ? 'star' : 'star-outline'} size={26} color={rating >= s ? Colors.secondary : Colors.outlineVariant} />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="شاركنا رأيك حول جودة وسرعة التوصيل..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                style={styles.reviewInput}
                textAlign="right"
              />

              <TouchableOpacity
                activeOpacity={0.88}
                disabled={reviewSubmitting}
                onPress={handleReviewSubmit}
                style={styles.submitReviewBtn}
              >
                {reviewSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitReviewText}>إرسال التقييم</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceColumn}>
          <Text style={styles.bottomPriceLabel}>المجموع</Text>
          <Text style={styles.bottomPriceValue}>
            {formatCurrency(currentRate * (inCartQty > 0 ? inCartQty : qty))}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={actionLoading}
          onPress={handleAddToCart}
          style={styles.bottomAddBtn}
        >
          {actionLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Icon name="cart" size={20} color="#ffffff" />
              <Text style={styles.bottomAddText}>
                {inCartQty > 0 ? `في السلة (${inCartQty}) - تحديث` : 'أضف إلى السلة'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageWrapper: {
    position: 'relative',
    height: 300,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '85%',
    height: '85%',
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    ...Shadows.sm,
  },
  discountTagText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
  wishlistCircle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  wishlistCircleActive: { backgroundColor: '#fff0f0' },
  infoCard: {
    padding: 20,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    marginTop: -4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  productTitle: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    lineHeight: 28,
    marginBottom: 8,
    textAlign: 'left',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  stockText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.success,
    fontFamily: Typography.fontFamilyBold,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 20,
  },
  priceText: {
    fontSize: Typography.sizes.displayLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },
  originalPriceText: {
    fontSize: Typography.sizes.headlineSm,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    fontFamily: Typography.fontFamilyMedium,
  },
  uomIndicator: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 10,
    textAlign: 'left',
  },
  descriptionText: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  reviewSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  addReviewCard: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 16,
    borderRadius: Radius.lg,
  },
  addReviewTitle: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 8,
    textAlign: 'left',
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  reviewInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 10,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
    marginBottom: 12,
    textAlign: 'right',
  },
  submitReviewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitReviewText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    ...Shadows.lg,
  },
  bottomPriceColumn: { gap: 2 },
  bottomPriceLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'left',
  },
  bottomPriceValue: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
    textAlign: 'left',
  },
  bottomAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    minWidth: 190,
    justifyContent: 'center',
    ...Shadows.md,
  },
  bottomAddText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
});