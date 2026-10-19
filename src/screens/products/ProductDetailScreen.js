import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
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
import ProductCard from '../../components/ProductCard';
import ProductImage from '../../components/ProductImage';
import PageFooter from '../../components/layout/PageFooter';
import CatalogAPI from '../../api/catalog';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import useDirectional from '../../hooks/useDirectional';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { formatCurrency, formatCount, formatDate } from '../../utils/format';
import { rateForUom } from '../../utils/catalog';
import { offerView } from '../../utils/offers';
import useDocumentHead from '../../seo/useDocumentHead';
import { organizationNode, productNode, breadcrumbNode } from '../../seo/jsonld';
import { openProduct, openProducts } from '../../seo/linking';
import { useI18n } from '../../i18n/I18nContext';

/**
 * Target size of the "related items" rail.
 *
 * A target, not a cap. Whatever the merchant defined on the Website Item's
 * `recommended_items` table is always shown in full — a product with eight
 * defined recommendations keeps all eight. Only a short row is topped up.
 */
const RECOMMENDED_TARGET = 6;
const RECOMMENDED_CARD_WIDTH = 170;
const RECOMMENDED_CARD_GAP = 10;

/**
 * How long the product on screen is reused before the app re-syncs it on its
 * own.
 *
 * Answering a message and coming straight back must not cost a request — and,
 * because a reload goes through the full-screen loader, must not throw the
 * shopper back to the top of the page either. Past this window the page
 * re-syncs itself in the background; pulling to refresh is not wired here, so
 * opening another product (or restarting) always fetches for real.
 */
const PRODUCT_TTL_MS = 5 * 60 * 1000;

/**
 * The items shown under "منتجات ذات صلة".
 *
 * The merchant's own picks come first. When the row is still short, it is
 * topped up from the same item group and then by name search, so a product with
 * no recommendations at all does not end up with a single lonely card. Each
 * stage is independent: a thin group must not stop the search from running.
 *
 * The product itself is never recommended back to the shopper.
 */
async function buildRecommendedItems(product) {
  const defined = (
    Array.isArray(product.recommended_items) ? product.recommended_items : []
  ).filter((entry) => entry && entry.item_code);

  if (defined.length >= RECOMMENDED_TARGET) return defined;

  const seen = new Set(defined.map((entry) => entry.item_code));
  if (product.item_code) seen.add(product.item_code);
  const out = defined.slice();

  const stages = [];
  if (product.item_group) {
    stages.push(() =>
      CatalogAPI.getCatalog({ itemGroup: product.item_group, limit: RECOMMENDED_TARGET * 2 })
    );
  }
  const term = (product.item_name || product.web_item_name || '').trim();
  if (term) {
    stages.push(() => CatalogAPI.searchItems({ search: term, limit: RECOMMENDED_TARGET * 2 }));
  }

  for (const run of stages) {
    if (out.length >= RECOMMENDED_TARGET) break;
    try {
      const data = await run();
      for (const item of (data && Array.isArray(data.items) ? data.items : [])) {
        if (out.length >= RECOMMENDED_TARGET) break;
        if (!item || !item.item_code || seen.has(item.item_code)) continue;
        seen.add(item.item_code);
        out.push(item);
      }
    } catch (err) {
      // A failed top-up leaves the rail short; it must not hide the items that
      // were already resolved.
      console.warn('Could not top up recommended items:', err.message);
    }
  }

  return out;
}

function StarRow({ rating, size = 14 }) {
  return (
    <View style={styles.starRowSmall}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon
          key={s}
          name={rating >= s ? 'star' : 'star-outline'}
          size={size}
          color={rating >= s ? Colors.secondary : Colors.outlineVariant}
        />
      ))}
    </View>
  );
}

function ReviewRow({ review }) {
  const { textStart } = useDirectional();
  const rating = Math.round(Number(review.rating) || 0);
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewItemHead}>
        <StarRow rating={rating} />
        <Text style={[styles.reviewDate, textStart]}>
          {formatDate(review.published_on || review.creation)}
        </Text>
      </View>
      {review.review_title ? (
        <Text style={[styles.reviewItemTitle, textStart]}>{review.review_title}</Text>
      ) : null}
      {review.comment ? (
        <Text style={[styles.reviewItemComment, textStart]}>{review.comment}</Text>
      ) : null}
      {review.user ? <Text style={[styles.reviewItemUser, textStart]}>{review.user}</Text> : null}
    </View>
  );
}

function ReviewsSummary({ reviews }) {
  const { textStart } = useDirectional();
  if (reviews.length === 0) return null;
  const average =
    reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length;
  return (
    <View style={styles.reviewsSummary}>
      <StarRow rating={Math.round(average)} size={16} />
      <Text style={[styles.reviewsSummaryText, textStart]}>
        {`${average.toFixed(1)} من 5 · ${formatCount(reviews.length, 'تقييم', 'تقييمان', 'تقييمات')}`}
      </Text>
    </View>
  );
}

export default function ProductDetailScreen({ route, navigation }) {
  const { itemCode } = route.params || {};

  const { items: cartItems, addToCart, updateQuantity, removeItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const { textStart } = useDirectional();

  const [pkgdetail, setPackage] = useState('');

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  // When this product was last loaded successfully. A ref, not state: the
  // refresh path reads it and it must never itself trigger a render.
  const fetchedAtRef = useRef(0);
  const [selectedUom, setSelectedUom] = useState('حبة');
  const [qty, setQty] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Mirrors `Webshop Settings`. Both default to true so the page renders its
  // full content on the very first frame instead of flashing empty sections
  // while the settings request is still in the air.
  const [settings, setSettings] = useState({
    enableReviews: true,
    enableRecommendations: true,
  });
  const [recommended, setRecommended] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  const { locale } = useI18n();

  /*
   * Document head for this product.
   *
   * Everything is `useMemo`-ed on `product` so a re-render caused by, say,
   * changing the quantity does not rebuild and re-serialise the JSON-LD block.
   * The live node carries the real price and stock from the API — unlike the
   * build-time prerender, which deliberately omits price because it would be
   * frozen at build time.
   */
  const headJsonLd = useMemo(() => {
    if (!product) return null;
    return [
      organizationNode(),
      productNode(product, { locale }),
      breadcrumbNode(
        [
          ...(product.item_group
            ? [{ name: product.item_group, path: `/products/${encodeURIComponent(product.item_group)}` }]
            : []),
          { name: product.item_name || product.item_code, path: `/product/${product.item_code}` },
        ],
        locale
      ),
    ].filter(Boolean);
  }, [product, locale]);

  useDocumentHead({
    title: product ? product.item_name || product.web_item_name || product.item_code : undefined,
    description:
      product && (product.short_description || product.web_long_description)
        ? String(product.short_description || product.web_long_description).slice(0, 300)
        : undefined,
    path: `/product/${itemCode}`,
    image: product && (product.website_image || product.image),
    type: 'product',
    jsonLd: headJsonLd,
  });

  /**
   * Load the product, or quietly re-sync it once its copy has gone stale.
   *
   * `silent` is the "this page is already on screen" refresh: it never shows the
   * full-screen loader (which unmounts the whole page, so it also threw the
   * shopper back to the top of it) and it never touches what they chose — the
   * selected unit, the quantity — nor reports a background failure as an error.
   */
  const fetchDetail = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      // Only a completed load may mark this product fresh, so a failed fetch
      // cannot buy itself the cache window from the next foreground.
      let ok = false;
      try {
        const data = await CatalogAPI.getItem(itemCode);
        if (data) {
          setProduct(data);
          if (!silent) {
            if (data.uoms && data.uoms.length > 0) {
              setSelectedUom(data.uoms[0].uom);
            } else if (data.stock_uom) {
              setSelectedUom(data.stock_uom);
            }
          }
          ok = true;
        }
      } catch (err) {
        // A background refresh has nothing to apologise for: the page it is
        // refreshing still shows a perfectly usable product.
        if (!silent) toast.error(err?.message || 'تعذر تحميل تفاصيل المنتج');
      } finally {
        if (!silent) setLoading(false);
        if (ok) fetchedAtRef.current = Date.now();
      }
    },
    [itemCode, toast]
  );

  useEffect(() => {
    // A different product is a different page: nothing cached for the previous
    // one may make this one look fresh.
    fetchedAtRef.current = 0;
    fetchDetail();
  }, [fetchDetail]);

  // Live: re-sync the product when the app returns to the foreground — but only
  // after what is on screen has gone stale, and silently even then. A product
  // page that reloads on every app switch is both slow and, because the reload
  // goes through the full-screen loader, a guaranteed jump back to the top.
  useLiveRefresh(
    () => {
      if (Date.now() - fetchedAtRef.current < PRODUCT_TTL_MS) return undefined;
      return fetchDetail({ silent: true });
    },
    { intervalMs: 0, isEnabled: true }
  );

  // The storefront switches are site-wide, so this is read once per screen and
  // cached by the API layer. Failure is handled there (fails open) — there is
  // nothing to retry here.
  useEffect(() => {
    let cancelled = false;
    CatalogAPI.getWebshopSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Identity of the recommendation source.
   *
   * `fetchDetail` runs again on every return to the foreground and hands back a
   * brand new product object, so depending on the object itself would re-run
   * the top-up requests for an unchanged answer. This string is stable exactly
   * when the product and its defined recommendations are unchanged.
   */
  const recommendedKey = useMemo(
    () =>
      product
        ? `${product.item_code}::${(product.recommended_items || [])
            .map((entry) => entry && entry.item_code)
            .join(',')}`
        : '',
    [product]
  );

  useEffect(() => {
    if (!product || !recommendedKey || !settings.enableRecommendations) return undefined;

    let cancelled = false;
    setRecommendedLoading(true);
    (async () => {
      let list = [];
      try {
        list = await buildRecommendedItems(product);
      } catch (err) {
        // Without this the rail would spin forever: a rejection here skips the
        // reset below and nothing else ever clears the loader.
        console.warn('Could not load recommended items:', err.message);
      }
      if (cancelled) return;
      setRecommended(list);
      setRecommendedLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `product` is read for its fields but `recommendedKey` is the value that
    // actually changes when the recommendation set does — see the memo above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedKey, settings.enableRecommendations]);

  const openRecommended = useCallback(
    (related) => {
      const code = related && related.item_code;
      // `push`, not `navigate`: these are other products, so backing out of one
      // should land on the product the shopper was reading, not skip it.
      if (code) openProduct(navigation, code, { method: 'push' });
    },
    [navigation]
  );

  if (loading || !product) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, textStart]}>جاري تحميل تفاصيل المنتج...</Text>
      </SafeAreaView>
    );
  }

  const availableUoms =
    product.uoms && product.uoms.length > 0
      ? product.uoms
      : [{ uom: product.stock_uom || 'حبة', rate: product.rate || product.price || 0 }];

  const currentRate = rateForUom(product, selectedUom);
  // Everything the item's offer table configures for the selected UOM: the
  // offer title, the discount percentage, the struck-through original price and
  // the wholesale label. Null when the item has no offer for this UOM.
  const offer = offerView(product, selectedUom, currentRate);

  // Groups this product is cross-listed into beyond its own one. Each chip opens
  // that group's listing — the same catalogue call the Products screen makes, so
  // a product published into several groups is reachable from every one of them.
  const extraGroups = Array.from(
    new Set(
      (Array.isArray(product.website_item_groups) ? product.website_item_groups : [])
        .map((group) => String(group || '').trim())
        .filter((group) => group && group !== (product.item_group || '').trim())
    )
  );

  // The offer's long text is a rich-text field, so tags are stripped before it
  // is shown, and a field that is only markup renders nothing at all rather than
  // leaving an empty line in the strip.
  const offerDetails = offer ? offer.details.replace(/<[^>]*>?/gm, '').trim() : '';
  
  const cartLine = cartItems.find(
    (item) =>
      item.item_code === product.item_code && (item.uom === selectedUom || !item.uom)
  );
  const inCartQty = cartLine ? cartLine.qty : 0;
  const wishlisted = isWishlisted(product.item_code);
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const showReviews = settings.enableReviews;
  const showRecommended = settings.enableRecommendations;

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
    // const previousUom = selectedUom;
    setSelectedUom(uom);
    // If this product is already in the cart under a different UOM, migrate
    // the cart line immediately so the cart reflects the change live.
    // console.log(uom)
    // console.log(product.uoms.find((u) => u.uom === uom).package)
    // console.log(product)
    // console.log(product.uoms.find((u) => u.uom === uom))
    if (product.stock_uom != uom){
      setPackage(product.uoms.find((u) => u.uom === uom).package);
      

    }else{
      setPackage('');
    }
    

    // const line = cartItems.find(
    //   (i) => i.item_code === product.item_code && i.uom === previousUom
    // );
    // if (line) {
    //   updateUOM(product.item_code, uom, previousUom);
    // }
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageWrapper}>
          <ProductImage
            source={product.website_image || product.image}
            blurhash={product.blurhash}
            style={styles.heroImage}
            resizeMode="contain"
            fallbackIconSize={64}
          />

          {offer && offer.showDiscount ? (
            <View style={styles.discountTag}>
              <Text style={[styles.discountTagText, textStart]}>{offer.percent}% خصم</Text>
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
          {product.shop && product.shop.shop_name && product.shop.is_platform === false ? (
            <View style={styles.categoryRow}>
              <Icon name="storefront-outline" size={13} color={Colors.primary} />
              <Text style={[styles.shopLabel, textStart]}>{product.shop.shop_name}</Text>
            </View>
          ) : null}

          {product.item_group ? (
            <View style={styles.categoryRow}>
              <Icon name="pricetag-outline" size={13} color={Colors.textMuted} />
              <Text style={[styles.categoryLabel, textStart]}>{product.item_group}</Text>
            </View>
          ) : null}

          {/* The other groups this product is listed in. Tapping one filters the
              Products screen by it, exactly like the group chips there. */}
          {extraGroups.length ? (
            <View style={styles.groupChipsRow}>
              <Icon name="albums-outline" size={13} color={Colors.textMuted} />
              <View style={styles.groupChips}>
                {extraGroups.map((group) => (
                  <TouchableOpacity
                    key={group}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`عرض ${group}`}
                    onPress={() => openProducts(navigation, { itemGroup: group })}
                    style={styles.groupChip}
                  >
                    <Text style={[styles.groupChipText, textStart]} numberOfLines={1}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.productTitle, textStart]}>
            {product.item_name || product.web_item_name || product.item_code}
          </Text>

          <View style={styles.stockRow}>
            <View style={styles.stockDot} />
            <Text style={[styles.stockText, textStart]}>متوفر في المخزون</Text>
          </View>

          

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceText, textStart]}>{formatCurrency(currentRate)}</Text>
            {offer && offer.originalPrice ? (
              <Text style={[styles.originalPriceText, textStart]}>
                {formatCurrency(offer.originalPrice)}
              </Text>
            ) : null}
            <Text style={[styles.uomIndicator, textStart]}>/ لكل {selectedUom}</Text>
          </View>

          {/* Offer — title / discount, in the order the merchant chose, plus the
              wholesale label when this UOM is a wholesale (bulk) price. */}
          {offer && (offer.showTitle || offer.showDiscount || offer.subtitle || offerDetails) ? (
            <View style={styles.offerStrip}>
              {offer.showTitle || offer.showDiscount ? (
                <View style={styles.offerHeaderRow}>
                  {offer.titleBeforeDiscount && offer.showTitle ? (
                    <Text style={[styles.offerTitle, textStart]} numberOfLines={2}>
                      {offer.title}
                    </Text>
                  ) : null}

                  {offer.showDiscount ? (
                    <View style={styles.offerDiscountBadge}>
                      <Text style={styles.offerDiscountText}>{offer.percent}%-</Text>
                    </View>
                  ) : null}

                  {!offer.titleBeforeDiscount && offer.showTitle ? (
                    <Text style={[styles.offerTitle, textStart]} numberOfLines={2}>
                      {offer.title}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {offer.subtitle ? (
                <Text style={[styles.offerSubtitle, textStart]}>{offer.subtitle}</Text>
              ) : null}

              {offerDetails ? (
                <Text style={[styles.offerDetails, textStart]}>{offerDetails}</Text>
              ) : null}
            </View>
          ) : null}

          {offer && offer.isWholesale ? (
            <View style={styles.wholesalePill}>
              <Icon name="pricetags-outline" size={14} color={Colors.onPrimaryContainer} />
              <Text style={[styles.wholesalePillText, textStart]}>{offer.wholesaleLabel}</Text>
            </View>
          ) : null}

          {/* UOM */}
          {availableUoms.length > 1 && (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, textStart]}>اختر وحدة التعبئة / الحجم</Text>
              <UOMSelector
                uoms={availableUoms}
                selectedUom={selectedUom}
                onSelectUom={handleSelectUom}
                size="md"
              />
            </View>
          )}

          {pkgdetail != '' && (
            <View style={styles.stockRow}>
            <View style={styles.stockDot} />
            <Text style={[styles.stockText, textStart]}>{pkgdetail}</Text>
          </View>
          )}
          


          {/* Qty */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, textStart]}>الكمية المطلوبة</Text>
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
              <Text style={[styles.sectionLabel, textStart]}>تفاصيل ومواصفات المنتج</Text>
              <Text style={[styles.descriptionText, textStart]}>
                {product.description.replace(/<[^>]*>?/gm, '').trim()}
              </Text>
            </View>
          ) : null}

          {/* Recommended items — off unless Webshop Settings enables them */}
          {showRecommended && (recommendedLoading || recommended.length > 0) ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, textStart]}>منتجات ذات صلة</Text>

              {recommended.length === 0 ? (
                <View style={styles.recommendedLoader}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recommendedRail}
                >
                  {recommended.map((item, idx) => (
                    <View key={item.item_code || idx} style={styles.recommendedCard}>
                      <ProductCard product={item} onPress={openRecommended} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* Reviews — off unless Webshop Settings enables them */}
          {showReviews ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.sectionLabel, textStart]}>تقييمات وآراء العملاء</Text>

              <ReviewsSummary reviews={reviews} />

              <View style={styles.addReviewCard}>
                <Text style={[styles.addReviewTitle, textStart]}>أضف تقييمك للمنتج</Text>
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
                    <Text style={[styles.submitReviewText, textStart]}>إرسال التقييم</Text>
                  )}
                </TouchableOpacity>
              </View>

              {reviews.length > 0 ? (
                <View style={styles.reviewList}>
                  {reviews.map((review, idx) => (
                    <ReviewRow key={`${review.creation || idx}-${idx}`} review={review} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.noReviewsText, textStart]}>
                  لا توجد تقييمات لهذا المنتج بعد. كن أول من يقيّمه.
                </Text>
              )}
            </View>
          ) : null}

          {/* Desktop-only site footer, inside the scroll content. */}
          <PageFooter />
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceColumn}>
          <Text style={[styles.bottomPriceLabel, textStart]}>المجموع</Text>
          <Text style={[styles.bottomPriceValue, textStart]}>
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
              <Text style={[styles.bottomAddText, textStart]}>
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
  offerStrip: {
    marginTop: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryContainer,
    gap: 6,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerTitle: {
    flexShrink: 1,
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSecondaryContainer,
    fontFamily: Typography.fontFamilyBold,
  },
  offerDiscountBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  offerDiscountText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
  offerSubtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSecondaryContainer,
    fontFamily: Typography.fontFamilyMedium,
  },
  offerDetails: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeights.bodySm,
  },
  wholesalePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  wholesalePillText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onPrimaryContainer,
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
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  shopLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  groupChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  groupChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupChip: {
    maxWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  groupChipText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilySemiBold,
  },
  productTitle: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    lineHeight: 28,
    marginBottom: 8,
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
  },
  descriptionText: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
    fontFamily: Typography.fontFamilyRegular,
  },
  reviewSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  recommendedRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: RECOMMENDED_CARD_GAP,
    // Bleeds past `infoCard`'s 20pt padding so the rail reads as its own band
    // and the first card still lines up with the section label above it.
    paddingHorizontal: 20,
    marginHorizontal: -20,
    paddingVertical: 2,
  },
  recommendedCard: {
    width: RECOMMENDED_CARD_WIDTH,
  },
  recommendedLoader: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
  },
  reviewsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reviewsSummaryText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilySemiBold,
  },
  starRowSmall: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewList: {
    marginTop: 14,
    gap: 10,
  },
  reviewItem: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 6,
  },
  reviewItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewDate: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  reviewItemTitle: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyBold,
  },
  reviewItemComment: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 21,
    fontFamily: Typography.fontFamilyRegular,
  },
  reviewItemUser: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  noReviewsText: {
    marginTop: 14,
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
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
  },
  bottomPriceValue: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
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




