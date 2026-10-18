import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Keyboard,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import ProductCardSkeleton, { SKELETON_CARDS } from '../../components/ProductCardSkeleton';
import SearchBar from '../../components/SearchBar';
import PageFooter from '../../components/layout/PageFooter';
import MarketplaceAPI from '../../api/marketplace';
import useDirectional from '../../hooks/useDirectional';
import { useGridMetrics } from '../../hooks/useResponsive';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import useDocumentHead from '../../seo/useDocumentHead';
import { openProduct } from '../../seo/linking';
import { formatCount } from '../../utils/format';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { MAX_CONTENT_WIDTH } from '../../theme/responsive';

const PAGE_SIZE = 24;

/**
 * Search tuning. The same numbers as `ProductsScreen`, so "type, wait, results
 * appear" feels the same whether the shopper is searching the whole catalogue
 * or one shop.
 */
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LEN = 1;

/**
 * A count that tolerates a missing field.
 *
 * `count` (the match count for the current term) is newer than the rest of the
 * shop payload, so a backend that has not been updated simply does not send it;
 * the number of rows drawn is then the honest fallback instead of `0`.
 */
function asCount(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * One vendor shop's public storefront: its profile, a search over its own
 * products, and a paged grid of the results.
 *
 * The endpoint only resolves approved shops, so a suspended or removed vendor
 * lands on the "not available" state rather than an error — which is exactly
 * what a shopper who follows an old link should see.
 *
 * The search is deliberately server-side. A shop's catalogue can be far larger
 * than one page, so filtering the rows already downloaded would search only the
 * first 24 products and then confidently report no other matches. The term
 * rides along with the shop filter instead, which also means it can never
 * surface another vendor's products.
 */
export default function ShopScreen({ route, navigation }) {
  const shopName = (route.params && route.params.shop) || '';
  const { textStart } = useDirectional();
  const { columns, cellStyle, rowStyle, imageHeight } = useGridMetrics();

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  // Two different numbers, because they answer two different questions:
  // `total` is the shop's live product count (the profile card), `count` is how
  // many products matched the current search (the results header).
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  // The request-driving term is the *settled* one: `searchQuery` alone would
  // fire a request per keystroke, and the responses for "che" and "cheese" can
  // land out of order.
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = debouncedQuery.length >= SEARCH_MIN_LEN;

  // True once a shop payload has been rendered. Read from a ref rather than
  // from `shop` so `loadFirstPage` does not change identity when the shop
  // arrives — that would re-run the effect that calls it, forever.
  const loadedRef = useRef(false);
  // Only the newest request may write state. A filtered query is slower than an
  // unfiltered one, so a stale answer would otherwise replace the current
  // results with the previous term's.
  const requestRef = useRef(0);

  const loadFirstPage = useCallback(
    async (term, { keepItems = false } = {}) => {
      if (!shopName) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const token = ++requestRef.current;
      if (!keepItems) {
        // Dropped up front, so the grid can never show products that do not
        // match what is in the search field while the new page is in flight.
        setLoading(true);
        setItems([]);
        setHasMore(false);
      }
      setError(false);
      try {
        const data = await MarketplaceAPI.getShop(shopName, {
          start: 0,
          limit: PAGE_SIZE,
          search: term,
        });
        if (token !== requestRef.current) return;
        setShop((data && data.shop) || null);
        loadedRef.current = true;
        const rows = (data && Array.isArray(data.items) && data.items) || [];
        setItems(rows);
        setTotal(asCount(data && data.total, rows.length));
        setCount(asCount(data && data.count, rows.length));
        setHasMore(rows.length >= PAGE_SIZE);
        setNotFound(false);
      } catch (err) {
        if (token !== requestRef.current) return;
        console.warn('Could not load shop:', err.message);
        if (loadedRef.current) {
          // The shop itself is fine and already on screen — it was the search
          // that failed. Replacing the page with "this shop is unavailable"
          // would send the shopper away from a shop that works. A background
          // refresh gets no error state at all: the rows stay put and the
          // spinner simply stops.
          if (!keepItems) {
            setError(true);
            setItems([]);
            setCount(0);
          }
        } else {
          // Suspended, rejected or simply gone: the server refuses the read,
          // and a shopper must see a calm "not available", not a crash.
          setShop(null);
          setItems([]);
          setNotFound(true);
        }
      } finally {
        if (token === requestRef.current) setLoading(false);
      }
    },
    [shopName]
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !shopName) return;
    const token = requestRef.current;
    setLoadingMore(true);
    try {
      const data = await MarketplaceAPI.getShop(shopName, {
        start: items.length,
        limit: PAGE_SIZE,
        search: debouncedQuery,
      });
      // A newer query started while this page was in flight: its rows belong to
      // the previous term, so they are dropped rather than appended.
      if (token !== requestRef.current) return;
      const rows = (data && Array.isArray(data.items) && data.items) || [];
      // Appended by code so a page overlap cannot render a product twice.
      setItems((cur) => {
        const seen = new Set(cur.map((row) => row.item_code || row.name));
        return cur.concat(rows.filter((row) => row && !seen.has(row.item_code || row.name)));
      });
      setHasMore(rows.length >= PAGE_SIZE);
    } catch (err) {
      console.warn('Could not load more shop products:', err.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, shopName, items.length, debouncedQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // `keepItems`: the grid stays on screen under the refresh spinner instead
      // of emptying out and flashing skeletons.
      await loadFirstPage(debouncedQuery, { keepItems: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage, debouncedQuery]);

  /*
   * Reset the per-shop state.
   *
   * `navigate('Shop', …)` does not push a new screen when a `Shop` route is
   * already in the stack — it pops back to it and swaps its params — so this
   * component can be handed a different shop without ever remounting.
   * Everything below is scoped to one shop: without this, the previous shop's
   * card, results and search term would be shown under the new shop's name.
   *
   * Clearing the field leaves the debounced term stale for one tick, so the
   * first load for the new shop can still carry the old term; the empty term
   * arrives 300ms later as a second request and the newest answer wins. One
   * wasted query, against a second code path to avoid it.
   */
  useEffect(() => {
    setShop(null);
    setItems([]);
    setTotal(0);
    setCount(0);
    setHasMore(false);
    setSearchQuery('');
    setNotFound(false);
    setError(false);
    setLoading(true);
    loadedRef.current = false;
  }, [shopName]);

  useEffect(() => {
    loadFirstPage(debouncedQuery);
  }, [loadFirstPage, debouncedQuery]);

  const handleClearSearch = useCallback(() => {
    // Nothing to fetch here: the empty term re-runs the effect above and the
    // shop's own listing comes back.
    setSearchQuery('');
  }, []);

  // Results do not wait for submit — the debounced term owns them — so the only
  // useful thing this key can do is put the keyboard away.
  const handleSearchSubmit = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleRetry = useCallback(() => {
    loadFirstPage(debouncedQuery);
  }, [loadFirstPage, debouncedQuery]);

  useDocumentHead({
    title: isSearching ? `البحث عن ${debouncedQuery} - متجر` : 'متجر',
    path: shopName ? `/shops/${shopName}` : '/shops',
    // A search inside a shop is a transient filtered view, not a landing page:
    // indexing it would accrue an unbounded set of near-duplicate URLs.
    noindex: isSearching,
  });

  const profileCard = shop ? (
    <View style={styles.profileCard}>
      <ProductImage
        source={shop.logo}
        style={styles.profileLogo}
        resizeMode="contain"
        fallbackIcon="storefront-outline"
        fallbackIconSize={34}
      />
      <View style={styles.profileInfo}>
        <Text style={[styles.profileName, textStart]} numberOfLines={1}>
          {shop.shop_name || shop.name}
        </Text>
        <Text style={[styles.profileDescription, textStart]} numberOfLines={3}>
          {shop.description || 'تسوّق من هذا المتجر الآن.'}
        </Text>
        <View style={styles.profileCountRow}>
          <Icon name="cube-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.profileCountText}>{formatCount(total)}</Text>
        </View>
      </View>
    </View>
  ) : null;

  // The full-screen loader belongs to the very first load only. Once the shop is
  // on screen, a search loads *inside* the page — blanking the profile card (and
  // the search field the shopper is typing in) would be a visible regression.
  if (loading && !shop && !notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, textStart]}>جاري تحميل المتجر...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <EmptyState
          icon="storefront-outline"
          title="المتجر غير متاح حالياً"
          description="ربما توقف هذا المتجر أو أزيل من المنصة. تصفح متاجر أخرى أو أحدث المنتجات."
          actionLabel="رجوع"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <FlatList
        data={items}
        key={`shop-grid-${columns}`}
        keyExtractor={(item, index) => item.item_code || item.name || String(index)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? rowStyle : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // The search field lives in the list header, so a tap on it (or on a
        // result) must not be swallowed by the keyboard dismissing first.
        keyboardShouldPersistTaps="handled"
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {profileCard}

            <View style={styles.searchWrap}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearchSubmit}
                onClear={handleClearSearch}
                placeholder="ابحث داخل هذا المتجر..."
              />
            </View>

            {isSearching ? (
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderText}>
                  <Text style={[styles.resultHeaderTitle, textStart]} numberOfLines={1}>
                    {loading ? 'جارٍ البحث...' : error ? 'تعذّر البحث' : formatCount(count)}
                  </Text>
                  <Text style={[styles.resultHeaderQuery, textStart]} numberOfLines={1}>
                    {`نتائج البحث عن: ${debouncedQuery}`}
                  </Text>
                </View>
                {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
              </View>
            ) : (
              <Text style={[styles.productsTitle, textStart]}>منتجات المتجر</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={cellStyle}>
            <ProductCard
              product={item}
              imageHeight={imageHeight}
              onPress={() => openProduct(navigation, item.item_code || item.name)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={[styles.skeletonGrid, rowStyle]}>
              {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                <View key={index} style={cellStyle}>
                  <ProductCardSkeleton imageHeight={imageHeight} />
                </View>
              ))}
            </View>
          ) : error ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="تعذّر تحميل المنتجات"
              description="حدثت مشكلة أثناء جلب منتجات هذا المتجر. تحقق من اتصالك وحاول مرة أخرى."
              actionLabel="إعادة المحاولة"
              onAction={handleRetry}
            />
          ) : isSearching ? (
            <EmptyState
              icon="search-outline"
              title="لا توجد نتائج في هذا المتجر"
              description={`لا توجد نتائج لـ "${debouncedQuery}" في هذا المتجر. جرّب كلمات أخرى أو امسح البحث.`}
              actionLabel="مسح البحث"
              onAction={handleClearSearch}
            />
          ) : (
            <EmptyState
              icon="cube-outline"
              title="لا توجد منتجات في هذا المتجر"
              description="هذا المتجر ليس لديه منتجات معروضة الآن. تصفح أحدث عروضنا من المتجر الرئيسي."
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={[styles.footerText, textStart]}>جاري تحميل المزيد...</Text>
              </>
            ) : null}
            <PageFooter />
          </View>
        }
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
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  listContent: {
    padding: 12,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.sm,
  },
  profileLogo: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileName: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  profileDescription: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  profileCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  profileCountText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  searchWrap: {
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  resultHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  resultHeaderTitle: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  resultHeaderQuery: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  productsTitle: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 10,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footer: {
    paddingTop: 8,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
});
