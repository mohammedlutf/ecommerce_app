import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
/*
 * Aliased because this screen already defines its own local `openProduct`
 * callback that takes a whole product object; these take an `itemCode` and keep
 * the URL in step with the navigator.
 */
import {
  openProduct as navigateToProduct,
  openProducts as navigateToProducts,
} from '../../seo/linking';
import useDocumentHead from '../../seo/useDocumentHead';
import { organizationNode, websiteNode } from '../../seo/jsonld';
import { useI18n } from '../../i18n/I18nContext';
import { useSiteChrome } from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import PageFooter from '../../components/layout/PageFooter';
import { normalizeGroupName } from '../../utils/catalog';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';

const OFFERS_PARENT = 'العروض';
const OFFERS_ITEMS_PER_CHILD = 15;
const OFFER_CARD_WIDTH = 170;
const OFFER_CARD_GAP = 10;

/**
 * The pseudo-category tile that stands for "everything".
 *
 * Named once because it is a *label*, not an Item Group: nothing in the catalog
 * is called this, so it must never be sent to the API as a group filter.
 */
const ALL_CATEGORIES = 'الكل';

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
  const { t } = useI18n();
  const { showTabBar } = useSiteChrome();
  const { textStart, insetEnd, isRTL } = useDirectional();
  useDocumentHead({
    title: t('seo.homeTitle'),
    description: t('seo.homeDescription'),
    path: '/',
    jsonLd: useMemo(() => [organizationNode(), websiteNode()], []),
  });
  useResetOnTabPress(navigation, 'HomeTab');

  const { count: cartCount } = useCart();

  const [categories, setCategories] = useState([]);
  const [offerGroups, setOfferGroups] = useState([]); // [{ name, image }]
  const [offerProducts, setOfferProducts] = useState({}); // child name -> items
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const openProduct = useCallback(
    (product) => {
      const itemCode = product && (product.item_code || product.name);
      if (!itemCode) return;
      // Routed through the URL-aware helper so the address bar, the history
      // entry and the navigator all agree on `/ar/product/CODE` rather than
      // showing the home URL while a product is open.
      navigateToProduct(navigation, itemCode);
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

  // Focusing the Home search field hands over to the Products screen, which
  // already searches live as the user types. This field is therefore read-only:
  // text typed into it would never be seen, and the shopper would have to press
  // Enter for a search that the other screen runs continuously. Duplicating the
  // debounce, request-token and pagination machinery here would leave two search
  // implementations to keep in step forever.
  //
  // The token makes every hand-over a distinct value. It has to change on each
  // visit, because react-navigation MERGES params: a boolean would stay `true`
  // from an earlier tap and would fire again on unrelated later visits to this
  // tab. A value that only ever changes when a hand-over really happened is
  // inert once left behind.
  const searchHandoverRef = useRef(0);

  function handleSearchFocus() {
    searchHandoverRef.current += 1;
    navigateToProducts(navigation, {
        // Cleared explicitly: without this the Products screen would open on
        // whichever group or search was last deep-linked, and the shopper would
        // type into a field filtered by a category they did not choose.
        itemGroup: undefined,
        search: undefined,
        // `focusSearch` is a one-shot counter, not part of the URL, so it
        // travels in `extra` rather than becoming a shareable link.
        extra: { focusSearch: searchHandoverRef.current },
      });
  }

function handleSelectCategory(catName) {
    /*
     * "الكل" in the categories rail means "show me the whole tree", which is the
     * categories screen — not "every product". The rail's own "عرض الكل" link
     * beside it already went there, so the tile and that link were offering two
     * different meanings under the same word. `Categories` is a route on this
     * same stack, so the linking config resolves it to `/categories` without
     * having to name a tab.
     */
    if (catName === ALL_CATEGORIES) {
      navigation.navigate('Categories');
      return;
    }

    navigateToProducts(navigation, {
      itemGroup: catName,
      search: undefined,
      // Otherwise a search hand-over from this screen would still be in the
      // merged params and would steal focus from the category being browsed.
      extra: { focusSearch: undefined },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/*
        In-screen mobile header.

        Suppressed on desktop: `AppShell` already renders `SiteHeader` there,
        and drawing both produced a duplicate navbar stacked on top of each
        other. The site header carries search, account and cart for every tab,
        so nothing is lost by dropping this one.
      */}
      {showTabBar && (
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
              <View style={[styles.cartBadge, insetEnd(-4)]}>
                <Text style={[styles.cartBadgeText, textStart]}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

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
        {/*
          Search entry point.

          Phone only. On the desktop shell `SiteHeader` carries a search field in
          the sticky top bar, so rendering this as well gave the page two search
          boxes within a few hundred pixels of each other. The header one is the
          real control; this is a tap target that hands off to it on mobile,
          where there is no header.
        */}
        {showTabBar && (
          <View style={styles.searchSection}>
            <SearchBar
              asButton
              onPress={handleSearchFocus}
              placeholder="ابحث عن أرز، زيت، حليب..."          
              textInputStyle={{ textAlign: 'right', writingDirection: 'rtl' }} // Check if your SearchBar uses this prop name             
            />
          </View>
        )}

        {/* Hero */}
        <LinearGradient
          colors={['#FEE9D2', '#FDF3E3', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroBadge}>
            <Icon name="flame" size={13} color={Colors.onSecondary} />
            <Text style={[styles.heroBadgeText, textStart]}>عروض هذا الأسبوع</Text>
          </View>
          <Text style={[styles.heroTitle, textStart]}>أفضل الأسعار وأجود المنتجات</Text>
          <Text style={[styles.heroSubtitle, textStart]}>
            نوفر لكم كافة متطلبات المنزل مع توصيل سريع ومباشر حتى باب المنزل.
          </Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigateToProducts(navigation)}
            style={styles.heroCta}
          >
            <Text style={[styles.heroCtaText, textStart]}>تسوق الآن</Text>
            <Icon name="arrow-forward" size={16} color={Colors.onPrimary} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStart]}>الأقسام</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Categories')}
            style={styles.seeAllBtn}
          >
            <Text style={[styles.seeAllText, textStart]}>عرض الكل</Text>
            <Icon name="chevron-back" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <CategoryCard
            category={ALL_CATEGORIES}
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
          <Text style={[styles.sectionTitle, textStart]}>العروض الحصرية</Text>
          <TouchableOpacity
            onPress={() => handleSelectCategory(OFFERS_PARENT)}
            style={styles.seeAllBtn}
          >
            <Text style={[styles.seeAllText, textStart]}>عرض الكل</Text>
            {/*
             * `chevron-back` is a fixed glyph: `dir` does not mirror icons, so in
             * Arabic it would point against the reading direction and read as
             * "go back" on an affordance that actually means "see everything".
             */}
            <Icon
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={14}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {offersLoading ? (
          <View style={styles.offerRailLoader}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : offerGroups.length === 0 ? (
          <View style={styles.offersEmpty}>
            <Icon name="pricetags-outline" size={20} color={Colors.textMuted} />
            <Text style={[styles.offersEmptyText, textStart]}>لا توجد عروض متاحة حالياً</Text>
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
                    <Text style={[styles.offerTitle, textStart]} numberOfLines={1}>
                      {child.name}
                    </Text>
                  </View>
                  {items.length > 0 && (
                    <Text style={[styles.offerCount, textStart]}>{items.length} منتج</Text>
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
                  <Text style={[styles.offerEmptyText, textStart]}>
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

        {/*
          Footer lives INSIDE the ScrollView.

          Expo's web reset sets `body { overflow: hidden }` so each screen owns
          its own scrolling. Anything rendered as a sibling of the ScrollView
          would be pinned outside the scroll area and effectively invisible on a
          long page.
        */}
        <PageFooter />
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
  },
  heroSubtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: Typography.fontFamilyRegular,
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
