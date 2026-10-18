import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import EmptyState from '../../components/EmptyState';
import PageFooter from '../../components/layout/PageFooter';
import MarketplaceAPI from '../../api/marketplace';
import useDirectional from '../../hooks/useDirectional';
import { useGridMetrics } from '../../hooks/useResponsive';
import useDocumentHead from '../../seo/useDocumentHead';
import { formatCount } from '../../utils/format';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { MAX_CONTENT_WIDTH } from '../../theme/responsive';

const PAGE_SIZE = 24;

/**
 * The shopper-facing shop directory: every approved vendor shop, paged.
 *
 * A public read — guests can browse it too — and a failed call degrades to an
 * empty directory (the API layer never throws for these), because a marketplace
 * with no shops yet should read as "nothing here yet", not as a broken page.
 */
export default function ShopDirectoryScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { columns, cellStyle, rowStyle } = useGridMetrics({ minCardWidth: 160 });
  useDocumentHead({ title: 'متاجر المنصة', path: '/shops' });

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // A full page is the only "there might be more" evidence these endpoints give
  // (no total is returned), the same heuristic the search list uses.
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadFirstPage = useCallback(async () => {
    const rows = await MarketplaceAPI.getShops({ start: 0, limit: PAGE_SIZE });
    setShops(rows);
    setHasMore(rows.length >= PAGE_SIZE);
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await MarketplaceAPI.getShops({ start: shops.length, limit: PAGE_SIZE });
      // Appended by name so a page overlap cannot render a shop twice.
      setShops((cur) => {
        const seen = new Set(cur.map((row) => row.name));
        return cur.concat(rows.filter((row) => row && !seen.has(row.name)));
      });
      setHasMore(rows.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, shops.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const openShop = useCallback(
    (shop) => {
      if (shop && shop.name) navigation.navigate('Shop', { shop: shop.name });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, textStart]}>متاجر المنصة</Text>
        <Text style={[styles.subtitle, textStart]}>
          تسوّق من متاجر موثوقة، وكل طلب يُشحن إليك مباشرة.
        </Text>
      </View>

      {loading && shops.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, textStart]}>جاري تحميل المتاجر...</Text>
        </View>
      ) : (
        <FlatList
          data={shops}
          // FlatList locks its column layout at mount; a resize across a
          // breakpoint needs a remount key or the cards stop lining up.
          key={`shops-grid-${columns}`}
          keyExtractor={(item, index) => item.name || String(index)}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? rowStyle : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
          renderItem={({ item }) => (
            <View style={cellStyle}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openShop(item)}
                style={styles.shopCard}
              >
                <ProductImage
                  source={item.logo}
                  style={styles.shopLogo}
                  resizeMode="contain"
                  fallbackIcon="storefront-outline"
                  fallbackIconSize={30}
                />
                <Text style={[styles.shopName, textStart]} numberOfLines={1}>
                  {item.shop_name || item.name}
                </Text>
                <Text style={[styles.shopDescription, textStart]} numberOfLines={2}>
                  {item.description || 'تسوّق من هذا المتجر الآن.'}
                </Text>
                <View style={styles.shopCountRow}>
                  <Icon name="cube-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.shopCountText}>
                    {formatCount(item.product_count)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="لا توجد متاجر بعد"
              description="لم ينضم أي بائع إلى المنصة حتى الآن. كن أول بائع عندنا!"
            />
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  title: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  subtitle: {
    marginTop: 4,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
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
    // Caps the grid so the directory does not stretch across a 2560px window.
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },
  shopCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    gap: 6,
    ...Shadows.xs,
  },
  shopLogo: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  shopName: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  shopDescription: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    textAlign: 'center',
    minHeight: 32,
  },
  shopCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  shopCountText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
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
