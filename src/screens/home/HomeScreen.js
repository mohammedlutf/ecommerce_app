import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import TrustBadge from '../../components/TrustBadge';
import CatalogAPI from '../../api/catalog';
import { useCart } from '../../context/CartContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { normalizeGroupName } from '../../utils/catalog';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';

const OFFERS_PARENT = 'العروض';
const OFFERS_ITEMS_PER_CHILD = 15;
const OFFER_CARD_WIDTH = 152;
const OFFER_CARD_GAP = 10;

/**
 * Locate the offers parent group in the hierarchy. Exact (normalized) match
 * first, then a loose "contains عروض" match so a slightly different spelling
 * ("عروض" / "العروض（T）") still resolves.
 */
function findOffersParent(tree) {
  if (!Array.isArray(tree) || tree.length === 0) return null;
  const wanted = normalizeGroupName(OFFERS_PARENT);
  const exact = tree.find((p) => normalizeGroupName(p.name) === wanted);
  if (exact) return exact;
  return (
    tree.find((p) => normalizeGroupName(p.name).includes(wanted)) || null
  );
}

export default function HomeScreen({ navigation }) {
  useResetOnTabPress(navigation, 'HomeTab');

  const { count: cartCount } = useCart();

  const [categories, setCategories] = useState([]);
  const [offerGroups, setOfferGroups] = useState([]); // [{ name, image }]
  const [offerProducts, setOfferProducts] = useState({}); // child name -> items
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openProduct = useCallback(
    (product) => {
      const itemCode = product && (product.item_code || product.name);
      if (!itemCode) return;
      navigation.navigate('ProductDetail', { itemCode });
    },
    [navigation]
  );

  const fetchHome = useCallback(async () => {
    setOffersLoading(true);
    try {
      // The flat group list for the "الأقسام" rail.
      const catalog = await CatalogAPI.getCatalog({ itemGroup: 'all', limit: 20 });
      if (catalog && Array.isArray(catalog.groups) && catalog.groups.length > 0) {
        setCategories(catalog.groups);
      }

      // "عروضي" — the العروض parent group, its children, and 15 products each.
      const hierarchy = await CatalogAPI.getItemGroupHierarchy();
      const parent = findOffersParent(hierarchy);
      const children = (parent && parent.children) || [];
      setOfferGroups(children);

      if (children.length === 0) {
        setOfferProducts({});
        return;
      }

      const fetchItems = async (itemGroup) => {
        const data = await CatalogAPI.getCatalog({
          itemGroup,
          limit: OFFERS_ITEMS_PER_CHILD,
        });
        return data && Array.isArray(data.items) ? data.items : [];
      };

      const results = await Promise.all(
        children.map(async (child) => {
          try {
            let items = await fetchItems(child.name);
            if (items.length === 0) {
              // Same fallback as the Products screen: the backend often keeps
              // the products on the parent (or an intermediate) item group, so a
              // child can come back empty while its parent has items.
              items = parent ? await fetchItems(parent.name) : [];
            }
            return [child.name, items.slice(0, OFFERS_ITEMS_PER_CHILD)];
          } catch (err) {
            console.warn(`Could not load offers for "${child.name}":`, err);
            return [child.name, []];
          }
        })
      );
      setOfferProducts(Object.fromEntries(results));
    } catch (err) {
      console.warn('Could not load home catalog:', err);
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  // Live: re-fetch the home strip whenever the app returns to the foreground
  // (no aggressive in-app polling that visually refreshes the list).
  useLiveRefresh(fetchHome, { intervalMs: 0, isEnabled: true });

  async function onRefresh() {
    setRefreshing(true);
    await fetchHome();
    setRefreshing(false);
  }

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      // `itemGroup: undefined` is explicit on purpose: react-navigation MERGES
      // params, so omitting it would keep the previously deep-linked group and
      // the results would be filtered by that group instead of the search.
      navigation.navigate('ProductsTab', {
        screen: 'Products',
        params: { search: searchQuery.trim(), itemGroup: undefined },
      });
    }
  }

  function handleSelectCategory(catName) {
    navigation.navigate('ProductsTab', {
      screen: 'Products',
      params: {
        itemGroup: catName === 'الكل' ? undefined : catName,
        search: undefined,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Header */}
      <View style={styles.topHeader}>
        <Image
          source={require('../../../assets/rtlrecologo.png')}
          style={styles.brandImage}
          resizeMode="contain"
        />

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
            onPress={() => navigation.navigate('Categories')}
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
            variant="tile"
            onSelect={handleSelectCategory}
          />
          {categories.map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : cat.name;
            return (
              <CategoryCard
                key={catName || idx}
                category={cat}
                variant="tile"
                onSelect={handleSelectCategory}
              />
            );
          })}
        </ScrollView>

        {/* عروضي — one scrollable rail per child of the العروض group */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>العروض الحصرية</Text>
          <TouchableOpacity
            onPress={() => handleSelectCategory(OFFERS_PARENT)}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>عرض الكل</Text>
            <Icon name="chevron-back" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {offersLoading ? (
          <View style={styles.offerRailLoader}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : offerGroups.length === 0 ? (
          <View style={styles.offersEmpty}>
            <Icon name="pricetags-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.offersEmptyText}>لا توجد عروض متاحة حالياً</Text>
          </View>
        ) : (
          offerGroups.map((child) => {
            const items = offerProducts[child.name] || [];
            return (
              <View key={child.name} style={styles.offerBlock}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelectCategory(child.name)}
                  style={styles.offerHeader}
                >
                  <View style={styles.offerHeaderRight}>
                    <View style={styles.offerDot} />
                    <Text style={styles.offerTitle} numberOfLines={1}>
                      {child.name}
                    </Text>
                  </View>
                  {items.length > 0 && (
                    <Text style={styles.offerCount}>{items.length} منتج</Text>
                  )}
                </TouchableOpacity>

                {items.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.offerRail}
                  >
                    {items.map((item, idx) => (
                      <View
                        key={item.item_code || idx}
                        style={styles.offerCard}
                      >
                        <ProductCard product={item} onPress={openProduct} />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.offerEmptyText}>
                    لا توجد منتجات في هذا القسم حالياً
                  </Text>
                )}
              </View>
            );
          })
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
  brandImage: {
    width: 150,
    height: 42,
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
  categoriesRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 14,
  },
  offerBlock: {
    marginBottom: 18,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  offerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  offerDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
  },
  offerTitle: {
    flex: 1,
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  offerCount: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  offerRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: OFFER_CARD_GAP,
    paddingHorizontal: 16,
  },
  offerCard: {
    width: OFFER_CARD_WIDTH,
    marginBottom: 4,
  },
  offerRailLoader: {
    height: 180,
    marginHorizontal: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerEmptyText: {
    paddingHorizontal: 16,
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'left',
  },
  offersEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    padding: 18,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  offersEmptyText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  trustSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
});