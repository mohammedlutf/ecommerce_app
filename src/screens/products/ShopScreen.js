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
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import PageFooter from '../../components/layout/PageFooter';
import MarketplaceAPI from '../../api/marketplace';
import useDirectional from '../../hooks/useDirectional';
import { useGridMetrics } from '../../hooks/useResponsive';
import useDocumentHead from '../../seo/useDocumentHead';
import { openProduct } from '../../seo/linking';
import { formatCount } from '../../utils/format';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { MAX_CONTENT_WIDTH } from '../../theme/responsive';

const PAGE_SIZE = 24;

/**
 * One vendor shop's public storefront: its profile plus a paged grid of the
 * products it sells.
 *
 * The endpoint only resolves approved shops, so a suspended or removed vendor
 * lands on the "not available" state rather than an error — which is exactly
 * what a shopper who follows an old link should see.
 */
export default function ShopScreen({ route, navigation }) {
  const shopName = (route.params && route.params.shop) || '';
  const { textStart } = useDirectional();
  const { columns, cellStyle, rowStyle, imageHeight } = useGridMetrics();
  useDocumentHead({ title: 'متجر', path: shopName ? `/shops/${shopName}` : '/shops' });

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadFirstPage = useCallback(async () => {
    if (!shopName) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const data = await MarketplaceAPI.getShop(shopName, { start: 0, limit: PAGE_SIZE });
      setShop((data && data.shop) || null);
      const rows = (data && Array.isArray(data.items) && data.items) || [];
      setItems(rows);
      setTotal(Number((data && data.total) || 0) || rows.length);
      setHasMore(rows.length >= PAGE_SIZE);
      setNotFound(false);
    } catch (err) {
      // Suspended, rejected or simply gone: the server refuses the read, and a
      // shopper must see a calm "not available", not a crash.
      console.warn('Could not load shop:', err.message);
      setShop(null);
      setItems([]);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [shopName]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !shopName) return;
    setLoadingMore(true);
    try {
      const data = await MarketplaceAPI.getShop(shopName, {
        start: items.length,
        limit: PAGE_SIZE,
      });
      const rows = (data && Array.isArray(data.items) && data.items) || [];
      // Appended by code so a page overlap cannot render a product twice.
      setItems((cur) => {
        const seen = new Set(cur.map((row) => row.item_code || row.name));
        return cur.concat(rows.filter((row) => row && !seen.has(row.item_code || row.name)));
      });
      setHasMore(rows.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, shopName, items.length]);

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

  if (loading && !notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, textStart]}>جاري تحميل المتجر...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        key={`shop-grid-${columns}`}
        keyExtractor={(item, index) => item.item_code || item.name || String(index)}
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
        ListHeaderComponent={
          <>
            {profileCard}
            <Text style={[styles.productsTitle, textStart]}>منتجات المتجر</Text>
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
          <EmptyState
            icon="cube-outline"
            title="لا توجد منتجات في هذا المتجر"
            description="هذا المتجر ليس لديه منتجات معروضة الآن. تصفح أحدث عروضنا من المتجر الرئيسي."
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
  productsTitle: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 10,
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
