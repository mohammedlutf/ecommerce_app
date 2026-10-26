import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import ProductCardSkeleton, { SKELETON_CARDS } from '../../components/ProductCardSkeleton';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import TrustBadge from '../../components/TrustBadge';
import ProductImage from '../../components/ProductImage';
import HeroCarousel from '../../components/HeroCarousel';
import CatalogAPI from '../../api/catalog';
import MarketplaceAPI from '../../api/marketplace';
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
import useResponsive, { useSiteChrome } from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import PageFooter from '../../components/layout/PageFooter';
import { normalizeGroupName } from '../../utils/catalog';
import { formatCount } from '../../utils/format';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { Breakpoints } from '../../theme/responsive';

const OFFERS_PARENT = 'العروض';
const OFFERS_ITEMS_PER_CHILD = 15;
const OFFER_CARD_WIDTH = 170;
const OFFER_CARD_GAP = 10;
// How many shops the home rail previews before handing over to the directory.
const SHOPS_RAIL_COUNT = 10;

/**
 * The static hero's proof points.
 *
 * Only shown on a wide web viewport, where the right-hand glass panel has room
 * to sit beside the copy. Phones keep the original compact hero.
 */
const HERO_BENEFITS = [
  {
    icon: 'rocket-outline',
    title: 'توصيل سريع',
    subtitle: 'نصل إلى باب منزلك في أسرع وقت',
  },
  {
    icon: 'leaf-outline',
    title: 'منتجات طازجة',
    subtitle: 'مختارة بعناية وتصل إليك يومياً',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'تسوق مطمئن',
    subtitle: 'منتجات أصلية وخيارات دفع مرنة',
  },
];

/**
 * How long the home strip is reused after a successful load.
 *
 * The offers, the category rail and the shops rail are read when the screen first
 * mounts; within this window a return to the app (or to the Home tab) shows what
 * is already there instead of re-requesting it. It is the same idea as the
 * catalogue's cache window on the Products screen: fresh enough to trust, slow
 * enough that the app is not fetching on every app switch.
 */
const HOME_TTL_MS = 5 * 60 * 1000;

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

/**
 * The placeholder for the offers section while its rails are being fetched.
 *
 * The child groups behind those rails are not known yet — the whole section
 * arrives in one go — so this stands in for the section rather than for a guessed
 * number of rails: one heading line and one rail of card placeholders, which is
 * about the height the first real rail takes. The rail scrolls like the real one,
 * so whatever overflows a narrow screen is still reachable.
 */
function OffersSkeleton({ desktop = false }) {
  return (
    <View style={[styles.offerBlock, desktop && styles.offerBlockDesktop]}>
      <View style={[styles.offerSkeletonHeader, desktop && styles.offerSkeletonHeaderDesktop]}>
        <LoadingSkeleton width={7} height={7} circle />
        <LoadingSkeleton width={140} height={18} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.offerRail, desktop && styles.offerRailDesktop]}
      >
        {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
          <View key={i} style={[styles.offerCard, desktop && styles.offerCardDesktop]}>
            <ProductCardSkeleton imageHeight={desktop ? 168 : 140} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Section heading with a small brand accent.
 *
 * The accent bar is what separates a section from the flat stack of headings
 * the page used to be; it also gives the title a reliable optical edge in both
 * RTL and LTR without hard-coding a left or right position.
 */
function SectionTitle({ children, desktop = false }) {
  const { textStart } = useDirectional();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionAccent, desktop && styles.sectionAccentDesktop]} />
      <Text
        style={[
          styles.sectionTitle,
          desktop && styles.sectionTitleDesktop,
          textStart,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * A shop in the marketplace rail (phone) or grid (desktop).
 *
 * Kept as one component so the logo fallback, count wording and press target
 * cannot drift between the two layouts.
 */
function ShopTile({ shop, desktop = false, onPress }) {
  const { textStart } = useDirectional();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={desktop ? 'hover-lift' : undefined}
      style={[styles.shopTile, desktop && styles.shopTileGrid]}
    >
      <ProductImage
        source={shop.logo}
        style={[styles.shopTileLogo, desktop && styles.shopTileLogoGrid]}
        resizeMode="contain"
        fallbackIcon="storefront-outline"
        fallbackIconSize={desktop ? 30 : 26}
      />
      <Text style={[styles.shopTileName, textStart]} numberOfLines={1}>
        {shop.shop_name || shop.name}
      </Text>
      <Text style={[styles.shopTileCount, textStart]} numberOfLines={1}>
        {formatCount(shop.product_count)}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useI18n();
  const { width: windowWidth, maxWidth: contentMaxWidth, gutter } = useResponsive();
  const { showTabBar, showDesktopChrome } = useSiteChrome();
  const { textStart, insetEnd, isRTL } = useDirectional();
  const desktop = showDesktopChrome;
  const wideWeb = showDesktopChrome && windowWidth >= Breakpoints.lg;
  const categoryColumns =
    windowWidth >= Breakpoints.xl ? 7 : windowWidth >= Breakpoints.lg ? 6 : 4;
  const shopColumns =
    windowWidth >= Breakpoints.xl ? 5 : windowWidth >= Breakpoints.lg ? 4 : 3;
  useDocumentHead({
    title: t('seo.homeTitle'),
    description: t('seo.homeDescription'),
    path: '/',
    jsonLd: useMemo(() => [organizationNode(), websiteNode()], []),
  });
  useResetOnTabPress(navigation, 'HomeTab');

  const { count: cartCount } = useCart();

  const [categories, setCategories] = useState([]);
  // The first page of the shop directory rail. A marketplace with no approved
  // vendors yet renders no rail at all (see the render guard), so this starts
  // empty and a failed fetch simply keeps it that way.
  const [shops, setShops] = useState([]);
  // Whether the merchant wants the shop rail on this screen at all
  // (`Webshop Settings` → Show shops on homepage). Starts shown, which is both
  // what the home screen did before the switch existed and what a settings call
  // that never answered falls back to.
  const [showShopsOnHome, setShowShopsOnHome] = useState(true);
  // The merchant's hero banners. Empty is the documented default: with none,
  // the hero is exactly what it was before the advertising table existed.
  const [heroAds, setHeroAds] = useState([]);
  const [offerGroups, setOfferGroups] = useState([]); // [{ name, image }]
  const [offerProducts, setOfferProducts] = useState({}); // child name -> items
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // When the strip above was last loaded successfully. Returning to the app
  // inside the cache window reuses what is on screen: a home screen that reloads
  // on every app switch is slow, and it costs a round-trip per offers rail.
  const homeFetchedAtRef = useRef(0);

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

  /*
   * Where a tapped advertising banner goes.
   *
   * The merchant's most specific target wins: a product, then a category, then
   * an external link. A banner with none of the three is rendered without a
   * press target at all (see HeroCarousel), so this only ever sees the real
   * destinations.
   */
  const handleAdPress = useCallback(
    (ad) => {
      if (!ad) return;

      if (ad.itemCode) {
        navigateToProduct(navigation, ad.itemCode);
        return;
      }

      if (ad.itemGroup) {
        navigateToProducts(navigation, {
          itemGroup: ad.itemGroup,
          // Same reset as a category tile: a leftover search or an earlier
          // hand-over would otherwise filter the very category being advertised.
          search: undefined,
          extra: { focusSearch: undefined },
        });
        return;
      }

      // http(s) only. The field is merchant-entered free text, and anything
      // else handed to the OS is at best ignored and at worst an unintended
      // scheme launch.
      if (ad.url && /^https?:\/\//i.test(ad.url)) {
        Linking.openURL(ad.url).catch((err) =>
          console.warn('Could not open advertising link:', err)
        );
      }
    },
    [navigation]
  );

  /**
   * Load the home strip: the category rail, the offers parent and one rail of
   * products per offers child.
   *
   * `silent` is for a refresh of data that is already on screen (returning to the
   * app, an explicit pull-to-refresh that has its own spinner): the sections stay
   * mounted, no skeleton is shown and nothing reflows — the rails simply swap
   * their contents when the response lands. A refresh that is visibly a reload is
   * exactly what made a shopper lose their place.
   */
  const fetchHome = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setOffersLoading(true);
    // Only a completed load may mark the cache fresh, so a failed fetch cannot
    // buy itself minutes of silence from the next foreground.
    let ok = false;
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
        ok = true;
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
      ok = true;
    } catch (err) {
      console.warn('Could not load home catalog:', err);
    } finally {
      setOffersLoading(false);
      if (ok) homeFetchedAtRef.current = Date.now();
    }
  }, []);

  // The shop-directory rail is independent of the catalogue fetches above: a
  // slow or failing shops endpoint must not hold up the offers, and a failed
  // call already degrades to an empty list inside the API layer.
  const fetchShops = useCallback(async () => {
    const rows = await MarketplaceAPI.getShops({ limit: SHOPS_RAIL_COUNT });
    setShops(rows);
  }, []);

  // The hero is either the merchant's advertising banners or the built-in
  // gradient hero, and which one it is comes from the same settings call the
  // product page already makes. Its own fetch rather than part of `fetchHome`:
  // the call is cached and cheap, a site without the advertising table simply
  // answers "none", and a slow one must not hold the catalogue back.
  //
  // That one answer carries the shop-rail switch too, so the screen reads both
  // from a single request instead of two. The settings are returned so a caller
  // can act on the switch without reading state back a render later.
  const fetchHomeSettings = useCallback(async ({ force = false } = {}) => {
    const settings = await CatalogAPI.getWebshopSettings({ force });
    setHeroAds(settings.homepageAds || []);
    setShowShopsOnHome(settings.showShopsOnHome);
    return settings;
  }, []);

  // Settings first, then the shop rail only when the merchant left it on: on a
  // deployment that hides the shops, the app never makes the shops call and
  // never downloads logos it would not draw. The settings call is cached, so on
  // a warm start the rail is not delayed by it.
  const loadHomeExtras = useCallback(async () => {
    const settings = await fetchHomeSettings();
    if (settings.showShopsOnHome) fetchShops();
  }, [fetchHomeSettings, fetchShops]);

  useEffect(() => {
    fetchHome();
    loadHomeExtras();
  }, [fetchHome, loadHomeExtras]);

  // Live: refresh the home strip when the app returns to the foreground — but
  // only once what is on screen has gone stale.
  //
  // Reloading unconditionally is what made a shopper lose their place: the offers
  // section was torn down and rebuilt (and, before the rails were silent, the
  // whole nerve centre of the screen re-rendered) every time they answered a
  // message and came back. Inside the cache window nothing is requested at all and
  // the screen is exactly as they left it; past it, one silent refresh per
  // foreground brings prices and stock back up to date without a visible reload.
  // The banner list and the shops switch ride along the same gate — the settings
  // call answers from its own ten-minute cache almost every time anyway.
  const refreshOnForeground = useCallback(() => {
    if (Date.now() - homeFetchedAtRef.current < HOME_TTL_MS) return undefined;
    return Promise.all([fetchHome({ silent: true }), loadHomeExtras()]);
  }, [fetchHome, loadHomeExtras]);
  useLiveRefresh(refreshOnForeground, { intervalMs: 0, isEnabled: true });

  async function onRefresh() {
    setRefreshing(true);
    // The explicit gesture: `force` on the settings (the shopper asked for fresh
    // content, and the cache would otherwise answer from ten minutes ago), and a
    // SILENT catalogue refresh so the rails keep their contents while the request
    // is in the air — the spinner on the RefreshControl is the progress report.
    // The shops are re-fetched from the fresh answer rather than unconditionally,
    // so turning the rail off takes effect on the same gesture that turns it on.
    const settings = await fetchHomeSettings({ force: true });
    const jobs = [fetchHome({ silent: true })];
    if (settings.showShopsOnHome) jobs.push(fetchShops());
    await Promise.all(jobs);
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

  // Two rows of departments read better than a rail of 92dp circles on a
  // desktop, while the "see all" link still reaches the full catalogue.
  const desktopCategories = [ALL_CATEGORIES, ...categories].slice(
    0,
    categoryColumns * 2
  );
  const desktopShops = shops.slice(0, shopColumns * 2);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Contact')}
              style={styles.cartBtn}
              accessibilityRole="button"
              accessibilityLabel={t('nav.contact')}
            >
              <Icon name="headset-outline" size={22} color={Colors.primaryDark} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CartTab')}
              style={styles.cartBtn}
              accessibilityRole="button"
              accessibilityLabel={t('nav.cart')}
            >
              <Icon name="cart" size={22} color={Colors.primaryDark} />
              {cartCount > 0 && (
                <View style={[styles.cartBadge, insetEnd(-4)]}>
                  <Text style={[styles.cartBadgeText, textStart]}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !showDesktopChrome && styles.scrollContentMobile,
        ]}
        showsVerticalScrollIndicator={false}
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
          The page column.

          On desktop the outer view supplies the shell gutter and the inner view
          caps the content at the same width as `SiteHeader`/`PageFooter`. On a
          phone the wrappers add nothing, so the existing 16dp section gutters
          remain the single source of spacing.
        */}
        <View style={[styles.pageOuter, desktop && { paddingHorizontal: gutter }]}>
          <View style={[styles.pageInner, desktop && { maxWidth: contentMaxWidth }]}>
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

        {/* Hero — the merchant's advertising banners when `Webshop Settings`
            carries any, the built-in hero otherwise. Only one of the two is ever
            mounted, so a deployment with no banners renders exactly what it
            rendered before the table existed. */}
        {heroAds.length > 0 ? (
          <HeroCarousel ads={heroAds} onPressAd={handleAdPress} />
        ) : (
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark || '#00593A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.heroBanner,
              desktop && styles.heroBannerDesktop,
              wideWeb && styles.heroBannerWide,
            ]}
          >
            {wideWeb ? (
              <>
                <View pointerEvents="none" style={styles.heroOrbLarge} />
                <View pointerEvents="none" style={styles.heroOrbSmall} />
              </>
            ) : null}

            <View style={[styles.heroCopy, wideWeb && styles.heroCopyWide]}>
              <View style={styles.heroBadge}>
                <Icon name="flame" size={13} color="#ffffff" />
                <Text style={[styles.heroBadgeText, textStart]}>عروض هذا الأسبوع</Text>
              </View>
              <Text
                style={[
                  styles.heroTitle,
                  desktop && styles.heroTitleDesktop,
                  wideWeb && styles.heroTitleWide,
                  textStart,
                ]}
              >
                أفضل الأسعار وأجود المنتجات
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  desktop && styles.heroSubtitleDesktop,
                  textStart,
                ]}
              >
                نوفر لكم كافة متطلبات المنزل مع توصيل سريع ومباشر حتى باب
                المنزل.
              </Text>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigateToProducts(navigation)}
                  style={[styles.heroCta, desktop && styles.heroCtaDesktop]}
                >
                  <Text style={[styles.heroCtaText, textStart]}>تسوق الآن</Text>
                  <Icon name="arrow-forward" size={16} color={Colors.primary} />
                </TouchableOpacity>

                {desktop ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('Categories')}
                    style={styles.heroSecondary}
                  >
                    <Icon name="grid-outline" size={16} color="#ffffff" />
                    <Text style={[styles.heroSecondaryText, textStart]}>
                      تصفح الأقسام
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {wideWeb ? (
              <View style={styles.heroPanel}>
                <View style={styles.heroPanelHead}>
                  <View style={styles.heroPanelIcon}>
                    <Icon name="sparkles" size={17} color={Colors.secondary} />
                  </View>
                  <View style={styles.heroPanelHeadText}>
                    <Text style={[styles.heroPanelTitle, textStart]}>
                      تسوق أسهل كل يوم
                    </Text>
                    <Text style={[styles.heroPanelSub, textStart]}>
                      كل احتياجات البيت في مكان واحد
                    </Text>
                  </View>
                </View>

                <View style={styles.heroBenefits}>
                  {HERO_BENEFITS.map((benefit) => (
                    <View key={benefit.title} style={styles.heroBenefit}>
                      <View style={styles.heroBenefitIcon}>
                        <Icon name={benefit.icon} size={17} color="#ffffff" />
                      </View>
                      <View style={styles.heroBenefitText}>
                        <Text style={[styles.heroBenefitTitle, textStart]}>
                          {benefit.title}
                        </Text>
                        <Text style={[styles.heroBenefitSub, textStart]}>
                          {benefit.subtitle}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.heroPanelNote}>
                  <Icon name="cash-outline" size={15} color={Colors.secondary} />
                  <Text style={[styles.heroPanelNoteText, textStart]}>
                    الدفع عند الاستلام متاح
                  </Text>
                </View>
              </View>
            ) : null}
          </LinearGradient>
        )}

        {/* Categories */}
        <View style={[styles.sectionHeader, desktop && styles.sectionHeaderDesktop]}>
          <SectionTitle desktop={desktop}>الأقسام</SectionTitle>
          <TouchableOpacity
            onPress={() => navigation.navigate('Categories')}
            style={[styles.seeAllBtn, desktop && styles.seeAllBtnDesktop]}
          >
            <Text style={[styles.seeAllText, textStart]}>عرض الكل</Text>
            <Icon name="chevron-back" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {desktop ? (
          <View style={styles.categoryGrid}>
            {desktopCategories.map((cat, idx) => {
              const catName = typeof cat === 'string' ? cat : cat.name;
              return (
                <View
                  key={catName || idx}
                  style={[
                    styles.categoryGridCell,
                    { width: `${100 / categoryColumns}%` },
                  ]}
                >
                  <CategoryCard
                    category={cat}
                    variant="grid"
                    onSelect={handleSelectCategory}
                  />
                </View>
              );
            })}
            {categories.length === 0 && offersLoading
              ? Array.from({ length: Math.max(categoryColumns - 1, 0) }).map(
                  (_, idx) => (
                    <View
                      key={`category-skeleton-${idx}`}
                      style={[
                        styles.categoryGridCell,
                        { width: `${100 / categoryColumns}%` },
                      ]}
                    >
                      <View style={styles.categorySkeletonCard}>
                        <View style={styles.categorySkeletonImage}>
                          <LoadingSkeleton
                            width="100%"
                            height="100%"
                            borderRadius={Radius.lg}
                          />
                        </View>
                        <LoadingSkeleton
                          width="66%"
                          height={12}
                          borderRadius={Radius.full}
                        />
                      </View>
                    </View>
                  )
                )
              : null}
          </View>
        ) : (
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
        )}

        {/* Shops — the entry point into the marketplace directory. Rendered only
            when at least one approved vendor exists: an empty rail (and a link
            to an empty directory) is dead space on a single-shop deployment.
            `Webshop Settings` → Show shops on homepage hides the rail here and
            here only; the directory is still linked from the Products screen. */}
        {showShopsOnHome && shops.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, desktop && styles.sectionHeaderDesktop]}>
              <SectionTitle desktop={desktop}>متاجر المنصة</SectionTitle>
              <TouchableOpacity
                onPress={() => navigation.navigate('ShopDirectory')}
                style={[styles.seeAllBtn, desktop && styles.seeAllBtnDesktop]}
              >
                <Text style={[styles.seeAllText, textStart]}>عرض الكل</Text>
                <Icon
                  name={isRTL ? 'chevron-forward' : 'chevron-back'}
                  size={14}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>

            {desktop ? (
              <View style={styles.shopGrid}>
                {desktopShops.map((shop) => (
                  <View
                    key={shop.name}
                    style={[
                      styles.shopGridCell,
                      { width: `${100 / shopColumns}%` },
                    ]}
                  >
                    <ShopTile
                      shop={shop}
                      desktop
                      onPress={() =>
                        navigation.navigate('Shop', { shop: shop.name })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {shops.map((shop) => (
                  <ShopTile
                    key={shop.name}
                    shop={shop}
                    onPress={() =>
                      navigation.navigate('Shop', { shop: shop.name })
                    }
                  />
                ))}
              </ScrollView>
            )}
          </>
        ) : null}

        {/* عروضي — one scrollable rail per child of the العروض group */}
        <View style={[styles.sectionHeader, desktop && styles.sectionHeaderDesktop]}>
          <SectionTitle desktop={desktop}>العروض الحصرية</SectionTitle>
          <TouchableOpacity
            onPress={() => {
              if (offersParent) {
                try {
                  openProducts(navigation, { itemGroup: offersParent.name });
                  return;
                } catch {}
              }
              handleSelectCategory(OFFERS_PARENT);
            }}
            style={[styles.seeAllBtn, desktop && styles.seeAllBtnDesktop]}
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
          <OffersSkeleton desktop={desktop} />
        ) : offerGroups.length === 0 ? (
          <View style={[styles.offersEmpty, desktop && styles.offersEmptyDesktop]}>
            <Icon name="pricetags-outline" size={20} color={Colors.textMuted} />
            <Text style={[styles.offersEmptyText, textStart]}>لا توجد عروض متاحة حالياً</Text>
          </View>
        ) : (
          offerGroups.map((child) => {
            const items = offerProducts[child.name] || [];
            return (
              <View
                key={child.name}
                style={[styles.offerBlock, desktop && styles.offerBlockDesktop]}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelectCategory(child.name)}
                  style={[styles.offerHeader, desktop && styles.offerHeaderDesktop]}
                >
                  <View style={styles.offerHeaderRight}>
                    <View style={styles.offerDot} />
                    <Text
                      style={[
                        styles.offerTitle,
                        desktop && styles.offerTitleDesktop,
                        textStart,
                      ]}
                      numberOfLines={1}
                    >
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
                    contentContainerStyle={[
                      styles.offerRail,
                      desktop && styles.offerRailDesktop,
                    ]}
                  >
                    {items.map((item, idx) => (
                      <View
                        key={item.item_code || idx}
                        style={[styles.offerCard, desktop && styles.offerCardDesktop]}
                      >
                        <ProductCard
                          product={item}
                          onPress={openProduct}
                          imageHeight={desktop ? 168 : 140}
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text
                    style={[
                      styles.offerEmptyText,
                      desktop && styles.offerEmptyTextDesktop,
                      textStart,
                    ]}
                  >
                    لا توجد منتجات في هذا القسم حالياً
                  </Text>
                )}
              </View>
            );
          })
        )}

        {/* Trust */}
        <View style={[styles.trustSection, desktop && styles.trustSectionDesktop]}>
          <View style={desktop ? styles.trustCellDesktop : null}>
            <TrustBadge
              icon="rocket-outline"
              title="توصيل سريع وموثوق"
              subtitle="نصلك أينما كنت في أسرع وقت"
              style={desktop ? styles.trustBadgeDesktop : undefined}
            />
          </View>
          <View style={desktop ? styles.trustCellDesktop : null}>
            <TrustBadge
              icon="cash-outline"
              title="الدفع عند الاستلام"
              subtitle="ادفع نقداً عند استلام طلبيتك"
              style={desktop ? styles.trustBadgeDesktop : undefined}
            />
          </View>
          <View style={desktop ? styles.trustCellDesktop : null}>
            <TrustBadge
              icon="sparkles-outline"
              title="ضمان جودة المنتجات"
              subtitle="منتجات أصلية وطازجة دائماً"
              style={desktop ? styles.trustBadgeDesktop : undefined}
            />
          </View>
        </View>

          </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // No bottom padding: the site footer is the last child, and any padding here
  // becomes an empty strip underneath it. Phones have no footer, so they keep
  // their breathing room below the last section.
  scrollContent: {
    paddingBottom: 0,
  },
  scrollContentMobile: {
    paddingBottom: 32,
  },
  // Desktop page column. The outer view owns the shell gutter; the inner view
  // owns the same max width as the header and footer, so the hero, section
  // headings and footer all share one vertical edge.
  pageOuter: {
    width: '100%',
    alignItems: 'center',
  },
  pageInner: {
    width: '100%',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroBanner: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: Radius.xxl,
    padding: 22,
    ...Shadows.md,
  },
  heroBannerDesktop: {
    marginHorizontal: 0,
    marginTop: 24,
    borderRadius: 30,
    padding: 32,
  },
  heroBannerWide: {
    minHeight: 372,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    padding: 44,
    overflow: 'hidden',
  },
  heroCopy: {
    flexShrink: 1,
  },
  heroCopyWide: {
    flex: 1,
    minWidth: 0,
  },
  heroOrbLarge: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
  },
  heroOrbSmall: {
    position: 'absolute',
    bottom: -150,
    left: '28%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  heroTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: '#ffffff',
    marginBottom: 6,
  },
  heroTitleDesktop: {
    fontSize: 32,
    lineHeight: 48,
    marginBottom: 10,
  },
  heroTitleWide: {
    maxWidth: 610,
    fontSize: 38,
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: Typography.sizes.bodySm,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
    marginBottom: 18,
    fontFamily: Typography.fontFamilyRegular,
  },
  heroSubtitleDesktop: {
    maxWidth: 560,
    fontSize: Typography.sizes.bodyLg,
    lineHeight: 28,
    marginBottom: 26,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    ...Shadows.sm,
  },
  heroCtaDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  heroCtaText: {
    color: Colors.primary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  heroSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroSecondaryText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  heroPanel: {
    flexShrink: 0,
    width: 340,
    padding: 24,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    gap: 18,
  },
  heroPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  heroPanelIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroPanelHeadText: {
    flex: 1,
    minWidth: 0,
  },
  heroPanelTitle: {
    color: '#ffffff',
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
  },
  heroPanelSub: {
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyRegular,
  },
  heroBenefits: {
    gap: 15,
  },
  heroBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  heroBenefitIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroBenefitText: {
    flex: 1,
    minWidth: 0,
  },
  heroBenefitTitle: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  heroBenefitSub: {
    marginTop: 1,
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: Typography.sizes.labelMd,
    lineHeight: 19,
    fontFamily: Typography.fontFamilyRegular,
  },
  heroPanelNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
  },
  heroPanelNoteText: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyMedium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionHeaderDesktop: {
    paddingHorizontal: 0,
    marginTop: 34,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 10,
    minWidth: 0,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
  },
  sectionAccentDesktop: {
    width: 5,
    height: 23,
  },
  sectionTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  sectionTitleDesktop: {
    fontSize: 24,
    lineHeight: 32,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllBtnDesktop: {
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.primaryLight,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -7,
  },
  categoryGridCell: {
    padding: 7,
  },
  categorySkeletonCard: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    ...Shadows.xs,
  },
  categorySkeletonImage: {
    width: '100%',
    aspectRatio: 1.3,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  shopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  shopGridCell: {
    padding: 8,
  },
  shopTile: {
    width: OFFER_CARD_WIDTH,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.xs,
  },
  shopTileGrid: {
    width: '100%',
    padding: 18,
    gap: 7,
    ...Shadows.sm,
  },
  shopTileLogo: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  shopTileLogoGrid: {
    width: 64,
    height: 64,
  },
  shopTileName: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'center',
    maxWidth: '100%',
  },
  shopTileCount: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  offerBlock: {
    marginBottom: 18,
  },
  offerBlockDesktop: {
    padding: 20,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    ...Shadows.xs,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  offerHeaderDesktop: {
    paddingHorizontal: 0,
    marginBottom: 12,
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
  offerTitleDesktop: {
    fontSize: Typography.sizes.headlineSm,
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
  offerRailDesktop: {
    gap: 16,
    paddingHorizontal: 0,
  },
  offerCard: {
    width: OFFER_CARD_WIDTH,
    marginBottom: 4,
  },
  offerCardDesktop: {
    width: 210,
  },
  offerSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  offerSkeletonHeaderDesktop: {
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  offerEmptyText: {
    paddingHorizontal: 16,
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  offerEmptyTextDesktop: {
    paddingHorizontal: 0,
    paddingVertical: 6,
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
  offersEmptyDesktop: {
    marginHorizontal: 0,
    padding: 20,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    ...Shadows.xs,
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
  trustSectionDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    marginTop: 36,
    marginBottom: 8,
    gap: 14,
  },
  trustCellDesktop: {
    flex: 1,
    minWidth: 0,
  },
  trustBadgeDesktop: {
    flex: 1,
  },
});
