import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import TrustBadge from '../../components/TrustBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import CatalogAPI from '../../api/catalog';
import { useCart } from '../../context/CartContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';

export default function HomeScreen({ navigation }) {
  const { count: cartCount } = useCart();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHome = useCallback(async () => {
    try {
      const data = await CatalogAPI.getCatalog({
        itemGroup: selectedCategory,
        limit: 20,
      });
      if (data) {
        setProducts(data.items || []);
        if (data.groups && data.groups.length > 0) {
          setCategories(data.groups);
        }
      }
    } catch (err) {
      console.warn('Could not load home catalog:', err);
    }
  }, [selectedCategory]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setInitialLoading(true);
      await fetchHome();
      if (mounted) setInitialLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchHome]);

  // Live: re-fetch the home catalog when the app reactivates and every 60s.
  useLiveRefresh(fetchHome, { intervalMs: 60000, isEnabled: true });

  async function onRefresh() {
    setRefreshing(true);
    await fetchHome();
    setRefreshing(false);
  }

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      navigation.navigate('ProductsTab', {
        screen: 'Products',
        params: { search: searchQuery },
      });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <LinearGradient
            colors={['#22C55E', '#16A34A', Colors.primaryDark]}
            style={styles.brandLogo}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="storefront" size={20} color="#ffffff" />
          </LinearGradient>
          <View>
            <Text style={styles.brandName}>سوبرماركت حضرموت</Text>
            <Text style={styles.brandTagline}>تسوق طازج يومياً</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CartTab')}
          style={styles.cartBtn}
        >
          <Icon name="cart" size={22} color={Colors.primaryDark} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Search */}
        <View style={styles.searchSection}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onClear={() => setSearchQuery('')}
            placeholder="ابحث عن أرز، زيت، حليب، خضار..."
          />
        </View>

        {/* Hero */}
        <LinearGradient
          colors={['#FEE9D2', '#FDF3E3', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroBadge}>
            <Icon name="flame" size={13} color={Colors.onSecondary} />
            <Text style={styles.heroBadgeText}>عروض هذا الأسبوع</Text>
          </View>
          <Text style={styles.heroTitle}>أفضل الأسعار وأجود المنتجات</Text>
          <Text style={styles.heroSubtitle}>
            نوفر لكم كافة متطلبات المنزل مع توصيل سريع ومباشر حتى باب المنزل.
          </Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ProductsTab')}
            style={styles.heroCta}
          >
            <Text style={styles.heroCtaText}>تسوق العروض الآن</Text>
            <Icon name="arrow-forward" size={16} color={Colors.onPrimary} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الأقسام</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProductsTab')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>عرض الكل</Text>
            <Icon name="chevron-back" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <CategoryCard
            category="الكل"
            isSelected={selectedCategory === 'all'}
            onSelect={() => setSelectedCategory('all')}
          />
          {categories.map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : cat.name;
            return (
              <CategoryCard
                key={idx}
                category={cat}
                isSelected={selectedCategory === catName}
                onSelect={(name) => setSelectedCategory(name)}
              />
            );
          })}
        </ScrollView>

        {/* Products */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'all' ? 'أحدث المنتجات' : selectedCategory}
          </Text>
          <Text style={styles.productCount}>{products.length} منتج</Text>
        </View>

        {initialLoading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.gridItem}>
                <LoadingSkeleton height={150} borderRadius={Radius.xl} />
                <View style={{ marginTop: 8 }}>
                  <LoadingSkeleton height={16} width="80%" />
                  <LoadingSkeleton height={14} width="40%" style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((product, idx) => (
              <View key={product.item_code || idx} style={styles.gridItem}>
                <ProductCard
                  product={product}
                  onPress={() =>
                    navigation.navigate('ProductsTab', {
                      screen: 'ProductDetail',
                      params: { itemCode: product.item_code },
                    })
                  }
                />
              </View>
            ))}
          </View>
        )}

        {/* Trust */}
        <View style={styles.trustSection}>
          <TrustBadge
            icon="rocket-outline"
            title="توصيل سريع وموثوق"
            subtitle="نصلك أينما كنت في أسرع وقت"
          />
          <TrustBadge
            icon="cash-outline"
            title="الدفع عند الاستلام"
            subtitle="ادفع نقداً عند استلام طلبيتك"
          />
          <TrustBadge
            icon="sparkles-outline"
            title="ضمان جودة المنتجات"
            subtitle="منتجات أصلية وطازجة دائماً"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  brandName: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  brandTagline: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'left',
  },
  cartBtn: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: Radius.xxl,
    padding: 20,
    ...Shadows.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  heroTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    marginBottom: 6,
    textAlign: 'left',
  },
  heroSubtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    alignSelf: 'flex-start',
    ...Shadows.sm,
  },
  heroCtaText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  productCount: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  categoriesRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  gridItem: {
    width: '50%',
    padding: 6,
  },
  trustSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
});