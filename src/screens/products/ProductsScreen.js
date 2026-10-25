import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
  I18nManager,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import ProductCardSkeleton, { SKELETON_CARDS } from '../../components/ProductCardSkeleton';
import PageFooter from '../../components/layout/PageFooter';
import CatalogAPI from '../../api/catalog';
import { normalizeGroupName } from '../../utils/catalog';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { useFocusEffect } from '@react-navigation/native';
import { useSiteHeaderVisibility } from '../../context/SiteHeaderVisibilityContext';
import { openProduct } from '../../seo/linking';
import useDocumentHead from '../../seo/useDocumentHead';
import { organizationNode, itemListNode } from '../../seo/jsonld';
import { useI18n } from '../../i18n/I18nContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useGridMetrics, default as useResponsive, useSiteChrome } from '../../hooks/useResponsive';
import { useAdmin } from '../../context/AdminContext';
import { formatCount } from '../../utils/format';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows, Spacing } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

const PAGE_SIZE = 20;
const ALL_KEY = 'all';
const ALL_PAGE = '__all__';

/**
 * How long a loaded page is reused before it may be re-fetched on its own.
 *
 * A page that is in memory is shown as-is: switching back to a group you just
 * visited, or answering a message and returning to the app, costs nothing and —
 * just as important — cannot move the list the shopper was reading. Past this
 * window the page is refreshed in place, which patches its rows without shrinking
 * it, and an explicit pull-to-refresh always refetches regardless.
 */
const CATALOG_TTL_MS = 5 * 60 * 1000;

/**
 * Ceiling for the "refresh everything this page has loaded" request made after
 * an admin save.
 *
 * A page can hold several pages' worth of products, and the one that was just
 * edited can be anywhere in it. Asking for the whole loaded page in one request
 * is what lets the edit be patched in without rebuilding the list — but the
 * catalogue endpoint caps a single response at 100 rows, so that is the honest
 * limit; a page longer than this is patched for its first hundred rows and left
 * alone below them.
 */
const RECONCILE_MAX = 100;

/**
 * Search tuning.
 *
 * `DEBOUNCE_MS` is long enough to swallow a burst of keystrokes on a phone
 * keyboard but short enough that results still feel live. `MIN_LEN` of 1 lets
 * the app respond to the first character instead of making the user type a
 * word before anything happens.
 */
const SEARCH_DEBOUNCE_MS = 280;
const SEARCH_MIN_LEN = 1;

const EMPTY_SEARCH = {
  query: '',
  items: [],
  hasMore: false,
  loading: false,
  loadingMore: false,
};

const catName = (cat) => (typeof cat === 'string' ? cat : cat && cat.name);

// Memoized cell so product cards only re-render when their own product changes
// (the stable `onOpen` callback keeps the memo useful across parent re-renders).
// `cellStyle`/`imageHeight` come from `useGridMetrics`, which the FlatLists below
// use for `numColumns` — the two have to agree or the cards stop lining up.
const ProductGridCell = React.memo(function ProductGridCell({
  product,
  onOpen,
  cellStyle,
  imageHeight,
}) {
  return (
    <View style={cellStyle}>
      <ProductCard
        product={product}
        imageHeight={imageHeight}
        onPress={() => onOpen(product.item_code || product.name)}
      />
    </View>
  );
});

// Fades + slides the product list in whenever its page mounts after a swipe, so
// content appears smoothly instead of popping in.
function PageContent({ children }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A page's placeholder grid.
 *
 * Six cards (`SKELETON_CARDS`), laid out with the very metrics the real grid
 * uses (`cellStyle` / `rowStyle` / `imageHeight` from `useGridMetrics`), so the
 * placeholder and the cards that replace it are geometrically identical and
 * nothing shifts when the items arrive.
 */
function ProductGridSkeleton({ cellStyle, rowStyle, imageHeight }) {
  return (
    <View style={[styles.skeletonGrid, rowStyle]}>
      {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
        <View key={i} style={cellStyle}>
          <ProductCardSkeleton imageHeight={imageHeight} />
        </View>
      ))}
    </View>
  );
}

/**
 * How many extra frames a reveal may be retried for.
 *
 * Android delivers the chip `onLayout` burst and `onContentSizeChange` in no
 * guaranteed order, and only re-fires `onContentSizeChange` when the content
 * size actually changes. A single pass can therefore measure the row while it is
 * still half-updated and never get corrected, so the reveal keeps re-running for
 * a few frames and stops as soon as the offset it wants holds still.
 */
const REVEAL_RETRY_FRAMES = 8;

/**
 * useAutoRevealRow — keeps the selected chip of a horizontal group row on screen.
 *
 * A chip row can hold dozens of groups, so after a swipe (or a deep link that
 * selects a group off-screen) the active chip is invisible. Note that the two
 * spaces involved are NOT the same: `onLayout` measures each chip from the
 * physical LEFT edge of the content, while `scrollTo({ x })` is start-relative
 * under RTL, where 0 is the right-hand end. `reveal` bridges the two.
 *
 * `rowKey` should be a stable string for the row's items so unrelated re-renders
 * (e.g. a product page merging into state) do not yank the row back to center,
 * and `count` is how many chips the row holds — chip 0 and chip `count - 1` are
 * what identify the row's start edge, so they must both be measured.
 *
 * Returns `{ scrollRef, scrollProps, measure }`:
 *   - spread `scrollProps` on the horizontal ScrollView
 *   - call `measure(index, layoutEvent)` from each chip wrapper's onLayout
 */
function useAutoRevealRow(activeIndex, rowKey, count) {
  const scrollRef = useRef(null);
  const metricsRef = useRef({}); 
  const viewportRef = useRef({ width: 0, contentWidth: 0 });
  const lastRevealRef = useRef({ rowKey: null, target: null });
  const activeIndexRef = useRef(activeIndex);
  const retryRef = useRef(null);
  const hasInitializedRef = useRef(false);
  activeIndexRef.current = activeIndex;
  const reveal = useCallback(
    (index) => {
      const scrollNode = scrollRef.current;
      const metric = metricsRef.current[index];
      const { width: viewportWidth, contentWidth } = viewportRef.current;
      
      // Do not attempt calculation until native dimensions are actually loaded
      if (!scrollNode || viewportWidth <= 0 || contentWidth <= 0) return null;

      const isRTL = I18nManager.isRTL; 
      let target;
      let canInitialize = false;

        if (isRTL) {
          if (!hasInitializedRef.current && activeIndex === 0) {
            // Snap to far right on initial load
            target = Math.max(0, contentWidth - viewportWidth);
            canInitialize = true;
          } else {
            if (!metric) return null; // Wait until the active item metric is measured
            target = Math.round(metric.x + metric.size / 2 - viewportWidth / 2);
            target = Math.max(0, Math.min(contentWidth - viewportWidth, target));
            canInitialize = true;
          }
        } else {
        if (!metric) return null;
        target = Math.max(
          0,
          Math.min(contentWidth - viewportWidth, metric.x + metric.size / 2 - viewportWidth / 2)
        );
        canInitialize = true;
      }

      const last = lastRevealRef.current;
      const isFirstMount = !hasInitializedRef.current;

      if (canInitialize) {
        hasInitializedRef.current = true;
      }

      if (last.rowKey !== rowKey || Math.abs(target - last.target) >= 1) {
        lastRevealRef.current = { rowKey, target };
        // Use animated: false on the exact first jump to prevent a jarring visual slide in release builds
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ x: target, y: 0, animated: !isFirstMount });
          }
        });
      }

      return target;
    },
    [count, rowKey, activeIndex]
  );

  // Reset initialization flag when rowKey changes (e.g., category switch)
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [rowKey]);

  const scheduleReveal = useCallback(() => {
    let settled = reveal(activeIndexRef.current);
    if (retryRef.current != null) return;
    let frames = 0;
    const tick = () => {
      frames += 1;
      const next = reveal(activeIndexRef.current);
      if (next !== null && next === settled) {
        retryRef.current = null;
        return;
      }
      settled = next;
      retryRef.current = frames < REVEAL_RETRY_FRAMES ? requestAnimationFrame(tick) : null;
    };
    retryRef.current = requestAnimationFrame(tick);
  }, [reveal]);

  useEffect(() => {
    scheduleReveal();
  }, [activeIndex, rowKey, scheduleReveal]);

  useEffect(
    () => () => {
      if (retryRef.current != null) cancelAnimationFrame(retryRef.current);
    },
    []
  );

  const measure = useCallback(
    (index, event) => {
      const { x, width } = event.nativeEvent.layout;
      metricsRef.current[index] = { x, size: width };
      scheduleReveal();
    },
    [scheduleReveal]
  );

  const scrollProps = useMemo(
    () => ({
      onLayout: (event) => {
        viewportRef.current.width = event.nativeEvent.layout.width;
        scheduleReveal();
      },
      onContentSizeChange: (contentWidth) => {
        const changed = viewportRef.current.contentWidth !== contentWidth;
        viewportRef.current.contentWidth = contentWidth;
        if (changed) scheduleReveal();
      },
    }),
    [scheduleReveal]
  );

  return { scrollRef, scrollProps, measure };
}
/**
 * SearchResultsHeader — the bar between the search field and the results.
 *
 * Replaces the two group-chip rows while a search is active: those chips select
 * a slice of the catalog, which is meaningless once results span all of it.
 * Showing the query and the live count is what makes a search feel like a
 * search instead of a filter.
 */
function SearchResultsHeader({ query, count, loading }) {
  const { textStart } = useDirectional();
  return (
    <View style={styles.searchHeader}>
      <View style={styles.searchHeaderText}>
        <Text style={[styles.searchHeaderTitle, textStart]} numberOfLines={1}>
          {loading ? 'جارٍ البحث...' : formatCount(count)}
        </Text>
        <Text style={[styles.searchHeaderQuery, textStart]} numberOfLines={1}>
          {`نتائج البحث عن: ${query}`}
        </Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
    </View>
  );
}

/**
 * SearchResults — the whole-catalog result list.
 *
 * Deliberately a separate tree from the group pager, and it owns its own state
 * upstream of this component. Two reasons, both load-bearing:
 *
 *  1. Group browsing and searching are mutually exclusive, so they cannot share
 *     a list. Sharing one meant a search overwrote the "الكل" page's slot, and
 *     clearing the field left those results on screen until a refetch came back.
 *  2. Search spans every item, so there is no page to swipe through — one
 *     continuous paginated list is the only honest layout.
 */
function SearchResults({ state, onOpen, onLoadMore, refreshing, onRefresh, onClearAll, onScroll }) {
  const { textStart } = useDirectional();
  const { items, loading, loadingMore, hasMore, query } = state;
  const { columns, cellStyle, rowStyle, imageHeight } = useGridMetrics();
  const { showDesktopChrome } = useSiteChrome();

  if (loading && items.length === 0) {
    return (
      <View style={[styles.skeletonGrid, rowStyle]}>
        {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
          <View key={i} style={cellStyle}>
            <ProductCardSkeleton imageHeight={imageHeight} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      // FlatList computes row layout once from the initial column count, so a
      // resize across a breakpoint needs a remount to re-flow.
      key={`search-grid-${columns}`}
      keyExtractor={(item, index) => item.item_code || String(index)}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? rowStyle : undefined}
      contentContainerStyle={[
        styles.listContent,
        !showDesktopChrome && styles.listContentMobile,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={60}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item }) => (
        <ProductGridCell
          product={item}
          onOpen={onOpen}
          cellStyle={cellStyle}
          imageHeight={imageHeight}
        />
      )}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
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
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="search-outline"
          title="لم يتم العثور على منتجات"
          description={`لا توجد نتائج لـ "${query}". جرّب كلمات أخرى أو امسح البحث.`}
          actionLabel="مسح البحث"
          onAction={onClearAll}
        />
      }
    />
  );
}

export default function ProductsScreen({ route, navigation }) {
  const { textStart, isRTL } = useDirectional();
  useResetOnTabPress(navigation, 'ProductsTab');
  const { width } = useWindowDimensions();
  const { isAdmin, savedTick, lastSaved } = useAdmin();
  const { locale, t } = useI18n();
  const { showDesktopChrome } = useSiteChrome();
  const { setHeaderHidden } = useSiteHeaderVisibility();

  /**
   * Responsive grid metrics for the browse pager.
   *
   * `width` doubles as the pager page width, so a resize re-flows the columns
   * and the swipeable track together — they can never disagree about how wide a
   * page is.
   */
  const {
    columns: gridColumns,
    cellStyle: gridCellStyle,
    rowStyle: gridRowStyle,
    imageHeight: gridImageHeight,
  } = useGridMetrics();

  // The tab stack keeps this screen mounted, so the deep link is read live from
  // `route.params` instead of being captured once on mount. Otherwise a second
  // tap on a group (Home / Categories) would re-navigate with new params while
  // the screen silently kept the first group it ever resolved.
  const deepLinkTarget =
    route.params?.itemGroup ||
    (route.params?.category && route.params.category !== ALL_KEY
      ? route.params.category
      : null) ||
    null;
  const deepLinkSearch = route.params?.search || '';

  const [tree, setTree] = useState(null); // [{ name, image, children }]
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [categories, setCategories] = useState([]); // flat fallback groups
  const [activeParent, setActiveParent] = useState(ALL_KEY); // 'all' | parent name
  const [activeChildIndex, setActiveChildIndex] = useState(0);

  /*
   * The "الكل" check is what makes a plain TAB PRESS land on the first
   * department rather than on the whole catalogue, and it is deliberately not
   * applied unconditionally: this screen stays mounted while the shopper is in a
   * deep link, so an unconditional reset would yank someone out of the group
   * they arrived on the moment a plain visit replaces that param.
   *
   * A department with no children is still a valid landing: its `childPages`
   * fall back to the department itself, so the pane shows its own products.
   */
  const startParent = useCallback(
    (current) =>
      current === ALL_KEY && tree && tree.length > 0 ? tree[0].name : current,
    [tree]
  );

  const [searchQuery, setSearchQuery] = useState(deepLinkSearch);

  // Search lives in its own slice, separate from `productsByKey`. Sharing one
  // list meant the results were written over the "الكل" page's slot, so clearing
  // the field had to wait for a refetch to draw the catalog back — and any
  // search response still in flight could land afterwards and put the old
  // results back on screen.
  const [searchState, setSearchState] = useState(EMPTY_SEARCH);

  // The query actually being fetched: what is typed, trimmed, once typing has
  // paused. `searchQuery` alone must not drive requests or every keystroke
  // would hit the server.
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const isSearchActive = debouncedQuery.length >= SEARCH_MIN_LEN;

  // Monotonic request token. A response is only allowed to write state if its
  // token is still the newest one issued, which is what makes a slow, stale
  // response harmless instead of a source of wrong results.
  const searchTokenRef = useRef(0);
  const catalogTokenRef = useRef(0);
  // The real <TextInput> behind the search field, so a hand-off from Home can
  // put the cursor in it.
  const searchInputRef = useRef(null);

  // Products are cached per child-group page so swiping back is instant.
  const [productsByKey, setProductsByKey] = useState({});
  const [hasMoreByKey, setHasMoreByKey] = useState({});
  const [loadedKeys, setLoadedKeys] = useState({});
  // When each page was last loaded successfully. A ref, not state: it is read
  // from the refresh path and must never itself trigger a render.
  const loadedAtRef = useRef({});
  // Page keys whose first fetch came back as an error. Tracked so a failed page
  // shows a retry instead of a skeleton that can never resolve — the skeleton is
  // only truthful while a request is actually outstanding.
  const [failedKeys, setFailedKeys] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const offsetRef = useRef({});

  /*
   * Header hide-on-scroll.
   *
   * The desktop site header is outside every screen scroller, so it would
   * otherwise stay pinned through the whole catalogue. Track the list offset
   * here and ask the shell to collapse it after a deliberate downward scroll.
   * The refs keep this out of the render path: a scroll event must not re-render
   * the grid.
   */
  const lastListOffset = useRef(0);
  const headerHiddenRef = useRef(false);

  const parentList = useMemo(
    () => (tree ? [ALL_KEY, ...tree.map((p) => p.name)] : [ALL_KEY]),
    [tree]
  );

  const childrenOfParent = useMemo(() => {
    if (activeParent === ALL_KEY || !tree) return [];
    const p = tree.find((x) => x.name === activeParent);
    return p ? p.children : [];
  }, [tree, activeParent]);

  // The pages (child groups) available under the active parent.
  const childPages = useMemo(() => {
    if (activeParent === ALL_KEY) {
      // No hierarchy (fallback): keep the flat catalog groups as pages.
      return tree
        ? [ALL_KEY]
        : [ALL_KEY, ...categories.map((c) => catName(c)).filter(Boolean)];
    }
    const kids = childrenOfParent.map((c) => c.name);
    return kids.length > 0 ? kids : [activeParent];
  }, [tree, activeParent, childrenOfParent, categories]);

  const activeKey = childPages[activeChildIndex] || childPages[0] || ALL_KEY;

  const resetHeader = useCallback(() => {
    headerHiddenRef.current = false;
    lastListOffset.current = 0;
    setHeaderHidden(false);
  }, [setHeaderHidden]);

  // Leaving Products — or coming back to it — must never leave the shared header
  // collapsed behind another screen.
  useFocusEffect(
    useCallback(() => {
      resetHeader();
      return resetHeader;
    }, [resetHeader])
  );

  // Switching a category or entering/leaving search replaces the list under the
  // pointer, so restore the header instead of carrying the previous scroll
  // direction into the new list.
  useEffect(() => {
    resetHeader();
  }, [activeKey, isSearchActive, resetHeader]);

  const handleListScroll = useCallback(
    (event) => {
      if (!showDesktopChrome) return;
      const offset = event?.nativeEvent?.contentOffset?.y;
      if (!Number.isFinite(offset)) return;

      const y = Math.max(0, offset);
      const delta = y - lastListOffset.current;
      lastListOffset.current = y;

      if (y <= 8) {
        if (headerHiddenRef.current) {
          headerHiddenRef.current = false;
          setHeaderHidden(false);
        }
        return;
      }

      if (delta > 6 && y > 80 && !headerHiddenRef.current) {
        headerHiddenRef.current = true;
        setHeaderHidden(true);
      } else if (delta < -6 && headerHiddenRef.current) {
        headerHiddenRef.current = false;
        setHeaderHidden(false);
      }
    },
    [setHeaderHidden, showDesktopChrome]
  );

  // Clamp the active index when the page list shrinks.
  useEffect(() => {
    if (activeChildIndex >= childPages.length) {
      setActiveChildIndex(Math.max(0, childPages.length - 1));
    }
  }, [activeChildIndex, childPages.length]);

  /**
   * Write a fetched page into the cache.
   *
   * Three modes, because "show me the current catalogue" and "leave me exactly
   * where I am" are different jobs:
   *
   *  - `replace`  — the page becomes the response, in the server's order. First
   *    load, an explicit pull-to-refresh, and a newly created product.
   *  - `append`   — the next page, added to what is already on screen.
   *  - `reconcile` — refresh the page IN PLACE: every row already on screen is
   *    patched with the fresh data and keeps its position, anything the response
   *    has that the page does not is added below, and — for the one product named
   *    by `focus` — a row the server no longer returns is dropped, because it was
   *    just unpublished or moved to another group.
   *
   * `reconcile` is what an admin save uses, and the point is that it is length-
   * and order-preserving: `replace` rebuilt the page from its first twenty items,
   * so a shopper who had scrolled further down was thrown back up the list every
   * time a product was edited. Note the deliberate restraint in dropping: a row
   * can also leave the fetched window simply because something else was ranked
   * above it, and deleting that row on the shopper would be a lie. Only the
   * product the admin actually edited is ever removed, and only when the server
   * itself no longer lists it.
   */
  function applyPage(key, data, mode, requestedLimit = PAGE_SIZE, focus = null) {
    const pageItems = data && Array.isArray(data.items) ? data.items : [];
    setProductsByKey((cur) => {
      const local = cur[key] || [];

      if (mode === 'reconcile') {
        // An answered request with nothing in it means this group has no products
        // left to show — every row of it would be a ghost.
        if (pageItems.length === 0) return { ...cur, [key]: [] };

        const byCode = new Map();
        for (const item of pageItems) byCode.set(item.item_code || item.name, item);

        // The `focus` row may only be dropped when the fetched window actually
        // covers the whole page. Beyond the window, "not in the response" means
        // nothing more than "that far down was not asked for".
        const coversPage = local.length <= pageItems.length;

        const next = [];
        const seen = new Set();
        for (const item of local) {
          const code = item.item_code || item.name;
          if (focus && coversPage && code === focus && !byCode.has(code)) continue;
          next.push(byCode.get(code) || item);
          if (code) seen.add(code);
        }

        for (const item of pageItems) {
          const code = item.item_code || item.name;
          if (!code || seen.has(code)) continue;
          next.push(item);
          seen.add(code);
        }
        return { ...cur, [key]: next };
      }

      const base = mode === 'replace' ? [] : local.slice();
      const merged = base.slice();
      for (const item of pageItems) {
        const code = item.item_code || item.name;
        if (!merged.some((p) => (p.item_code || p.name) === code)) {
          merged.push(item);
        }
      }
      return { ...cur, [key]: merged };
    });
    // Short of what was asked for means the group is exhausted. For a first page
    // this is exactly the old `pageItems.length >= PAGE_SIZE` test.
    setHasMoreByKey((cur) => ({ ...cur, [key]: pageItems.length >= requestedLimit }));
    setLoadedKeys((cur) => (cur[key] ? cur : { ...cur, [key]: true }));
    // A page that has been fetched is no longer in the "failed" state, whether
    // this was its first load or a retry of one.
    setFailedKeys((cur) => (cur[key] ? { ...cur, [key]: false } : cur));
    // Stamped on success only: a page that answered is fresh, one that errored is
    // not, so a failure cannot buy itself the cache window.
    loadedAtRef.current[key] = Date.now();
    if (data && Array.isArray(data.groups) && data.groups.length > 0) {
      setCategories(data.groups);
    }
  }

  /**
   * Is this page already in memory and young enough to keep?
   *
   * Read from the ref alone rather than from `loadedKeys`, so the answer is the
   * same before and after a render: the pages that asked this question are React
   * effects and the AppState listener, and neither may depend on a state value it
   * happens to have captured.
   */
  function isPageFresh(key) {
    const at = loadedAtRef.current[key];
    return !!at && Date.now() - at < CATALOG_TTL_MS;
  }

  /**
   * Fetch a page and write it into the cache.
   *
   * `mode` is the write mode (see `applyPage`), `limit` how many rows the request
   * may return and `focus` the one product an admin has just saved. `reconcile`
   * callers widen the limit to cover everything the page has already loaded — the
   * product that was edited may be forty rows down — while the routine background
   * refresh asks for a single page.
   */
  const loadKey = useCallback(
    async (key, { mode = 'replace', limit = PAGE_SIZE, focus = null } = {}) => {
      const token = ++catalogTokenRef.current;
      const isStale = () => token !== catalogTokenRef.current;

      const firstLoad = !loadedKeys[key];
      if (firstLoad) {
        setInitialLoading(true);
        // Cleared here rather than by the caller, so pressing "retry" puts the
        // page back into its skeleton state for as long as the new request runs.
        setFailedKeys((cur) => (cur[key] ? { ...cur, [key]: false } : cur));
      }
      offsetRef.current[key] = 0;

      const leaf = key === ALL_PAGE ? ALL_KEY : key;
      const parent = activeParent === ALL_KEY ? ALL_KEY : activeParent;

      try {
        // The backend often keeps products on the parent (or an intermediate)
        // item group, so a leaf can come back empty while its parent has items.
        // Fetch leaf + parent in PARALLEL so the page resolves in a single
        // round-trip, then prefer the leaf when it actually returned items.
        //
        // No `search` is sent here: browsing a group is a different mode from
        // searching, and mixing the two is what let a live search term narrow
        // (or empty out) the group the user was browsing.
        const [leafData, parentData] = await Promise.all([
          CatalogAPI.getCatalog({
            itemGroup: leaf,
            limit,
            offset: 0,
          }),
          leaf !== ALL_KEY && parent !== ALL_KEY && parent !== leaf
            ? CatalogAPI.getCatalog({
                itemGroup: parent,
                limit,
                offset: 0,
              })
            : Promise.resolve(null),
        ]);

        // A newer request for a different group (or a pull-to-refresh) started
        // while this one was in the air, so this response is stale and must not
        // overwrite the page the user is actually looking at.
        if (isStale()) return;

        const leafHasItems =
          leafData && Array.isArray(leafData.items) && leafData.items.length > 0;
        const data = leafHasItems ? leafData : parentData || leafData;

        applyPage(key, data, mode, limit, focus);
      } catch (err) {
        if (!isStale()) {
          console.warn('Failed to fetch catalog:', err);
          setFailedKeys((cur) => ({ ...cur, [key]: true }));
        }
      } finally {
        if (!isStale()) {
          setInitialLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [activeParent, loadedKeys]
  );

  async function loadMoreKey(key) {
    if (loadingMore || !hasMoreByKey[key]) return;
    const token = catalogTokenRef.current;
    setLoadingMore(true);
    try {
      const curProducts = productsByKey[key];
      const data = await CatalogAPI.getCatalog({
        itemGroup: key === ALL_PAGE ? ALL_KEY : key,
        limit: PAGE_SIZE,
        offset: curProducts ? curProducts.length : 0,
      });
      if (token !== catalogTokenRef.current) return;
      applyPage(key, data, 'append');
    } catch (err) {
      if (token === catalogTokenRef.current) console.warn('Failed to load more products:', err);
    } finally {
      if (token === catalogTokenRef.current) setLoadingMore(false);
    }
  }

  async function refreshKey(key) {
    setRefreshing(true);
    await loadKey(key);
  }

  // An admin edit or a new product has to show up without the user pulling to
  // refresh, otherwise "saved" looks like it did nothing. `savedTick` is bumped by
  // AdminContext on every successful save; skipping the very first value keeps a
  // mount from triggering a redundant catalog fetch.
  //
  // What it must NOT do is rebuild the page: an admin editing a product in the
  // list they are scrolled down is not asking to be sent back up it. So an edit
  // is reconciled in place, and only the page that is actually showing the
  // product is fetched at all.
  const firstSavedTickRef = useRef(true);
  useEffect(() => {
    if (firstSavedTickRef.current) {
      firstSavedTickRef.current = false;
      return;
    }

    // The save may have touched a product that another page of this group is
    // showing, so no cached page stays trusted — but only this one is on screen
    // and has to be fetched now.
    loadedAtRef.current = {};

    // A newly created product is not on any page yet, so there is nothing to
    // patch: the page is rebuilt from the server in its canonical order.
    if (lastSaved.kind === 'created') {
      loadKey(activeKey);
      return;
    }

    const local = productsByKey[activeKey] || [];
    const editedIsOnThisPage = local.some(
      (p) => (p.item_code || p.name) === lastSaved.itemCode
    );

    // An edit of a product this page is showing: refreshed IN PLACE, which is
    // what leaves the shopper exactly where they were. The request covers the
    // whole loaded page, since the product may be well below the first screenful.
    if (editedIsOnThisPage) {
      loadKey(activeKey, {
        mode: 'reconcile',
        limit: Math.min(Math.max(PAGE_SIZE, local.length), RECONCILE_MAX),
        focus: lastSaved.itemCode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTick]);

  /**
   * The search query. Owns the request lifecycle for the results list:
   *
   *  - below `SEARCH_MIN_LEN` (i.e. the field was cleared) the results are
   *    dropped SYNCHRONOUSLY, so the catalog is back on screen immediately
   *    instead of after a round-trip, and the bumped token stops any in-flight
   *    search from writing its results back over the catalog. This is the fix
   *    for "I deleted the search and the same results were still there".
   *  - otherwise only the newest request may write; older ones are dropped.
   */
  useEffect(() => {
    const query = debouncedQuery;
    const token = ++searchTokenRef.current;

    if (query.length < SEARCH_MIN_LEN) {
      setSearchState(EMPTY_SEARCH);
      return undefined;
    }

    let cancelled = false;
    setSearchState({ query, items: [], hasMore: false, loading: true, loadingMore: false });

    (async () => {
      try {
        const data = await CatalogAPI.searchItems({ search: query, limit: PAGE_SIZE, offset: 0 });
        if (cancelled || token !== searchTokenRef.current) return;

        const items = data && Array.isArray(data.items) ? data.items : [];
        setSearchState({
          query,
          items,
          hasMore: items.length >= PAGE_SIZE,
          loading: false,
          loadingMore: false,
        });
      } catch (err) {
        if (cancelled || token !== searchTokenRef.current) return;
        console.warn('Search failed:', err);
        setSearchState({ ...EMPTY_SEARCH, query });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const loadMoreSearch = useCallback(async () => {
    const { query, items, hasMore, loading, loadingMore } = searchState;
    if (loading || loadingMore || !hasMore || query.length < SEARCH_MIN_LEN) return;

    const token = searchTokenRef.current;
    setSearchState((s) => ({ ...s, loadingMore: true }));
    try {
      const data = await CatalogAPI.searchItems({
        search: query,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      if (token !== searchTokenRef.current) return;

      const incoming = data && Array.isArray(data.items) ? data.items : [];
      setSearchState((s) => {
        // The field was cleared or retyped while this page was loading.
        if (s.query !== query) return s;
        const seen = new Set(s.items.map((it) => it.item_code || it.name));
        const merged = s.items.concat(
          incoming.filter((it) => !seen.has(it.item_code || it.name))
        );
        return {
          ...s,
          items: merged,
          hasMore: incoming.length >= PAGE_SIZE,
          loadingMore: false,
        };
      });
    } catch (err) {
      if (token === searchTokenRef.current) {
        console.warn('Failed to load more results:', err);
        setSearchState((s) => ({ ...s, loadingMore: false }));
      }
    }
  }, [searchState]);

  const refreshSearch = useCallback(async () => {
    const query = searchState.query;
    if (query.length < SEARCH_MIN_LEN) {
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    // A fresh token, so a response from the in-flight search effect — or a
    // "load more" still running — cannot land on top of this refresh.
    const token = ++searchTokenRef.current;
    try {
      const data = await CatalogAPI.searchItems({ search: query, limit: PAGE_SIZE, offset: 0 });
      if (token !== searchTokenRef.current) return;
      const items = data && Array.isArray(data.items) ? data.items : [];
      setSearchState((s) => ({
        ...s,
        items,
        hasMore: items.length >= PAGE_SIZE,
        loading: false,
        loadingMore: false,
      }));
    } catch (err) {
      if (token === searchTokenRef.current) {
        console.warn('Search refresh failed:', err);
        setSearchState((s) => ({ ...s, loading: false }));
      }
    } finally {
      if (token === searchTokenRef.current) setRefreshing(false);
    }
  }, [searchState.query]);

  // Load the browsed group page when the active child group changes — unless it
  // is already in memory and young (`isPageFresh`). Switching back to a group you
  // just looked at is then instant, and the page you left is untouched.
  useEffect(() => {
    if (!isPageFresh(activeKey)) loadKey(activeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // Live: re-sync the current page when the app returns to the foreground — but
  // only once the page has gone stale, and then IN PLACE (`reconcile`), which
  // patches the rows it can see rather than rebuilding the page under the
  // shopper's scroll position.
  //
  // Returning from another app used to refetch and rebuild the page every single
  // time, which is what threw a shopper who was deep in the list back to the top
  // and made the screen feel slow. Inside the cache window nothing is requested
  // at all now.
  //
  // Still disabled during a search: the foreground sync refetches a group page,
  // and doing that mid-search would replace the results with a browsed group.
  useLiveRefresh(
    () => {
      if (isPageFresh(activeKey)) return undefined;
      return loadKey(activeKey, { mode: 'reconcile' });
    },
    {
      intervalMs: 0,
      isEnabled: !isSearchActive,
    }
  );

  // Resolve deep links (category / search from Home or Categories).
  //
  // This screen stays mounted inside the tab stack, so this must react to EVERY
  // new deep link, not just the first one. `handledDeepLinkRef` remembers the
  // last target that was applied so a re-render (or the hierarchy arriving late)
  // does not fight the user's own chip/pager selection.
  const handledDeepLinkRef = useRef(null);

  const applyDeepLink = useCallback(
    (target) => {
      if (!target) return false;

      const wanted = normalizeGroupName(target);
      if (!wanted) return false;

      if (tree) {
        // 1) The link points at a leaf (child) group -> open its parent tab and
        //    land on that child.
        for (const parent of tree) {
          const kids = parent.children || [];
          const idx = kids.findIndex((c) => normalizeGroupName(c.name) === wanted);
          if (idx >= 0) {
            setActiveParent(parent.name);
            setActiveChildIndex(idx);
            return true;
          }
        }
        // 2) The link points at a parent group itself -> open its first child.
        const parentHit = tree.find((p) => normalizeGroupName(p.name) === wanted);
        if (parentHit) {
          setActiveParent(parentHit.name);
          setActiveChildIndex(0);
          return true;
        }
        return false;
      }

      // 3) No hierarchy available: fall back to the flat group list, where the
      //    first page is the synthetic "الكل" chip.
      const idx = categories.findIndex((c) => normalizeGroupName(catName(c)) === wanted);
      if (idx >= 0) {
        setActiveParent(ALL_KEY);
        setActiveChildIndex(idx + 1);
        return true;
      }
      return false;
    },
    [tree, categories]
  );

  useEffect(() => {
    if (hierarchyLoading) return;

    if (!deepLinkTarget) {
      // Plain visit (tab press) -> start from the beginning rather than opening
      // on whatever group was last deep-linked: the first department, and its
      // first child. An already-chosen department is left alone (see
      // `startParent`) so a param change cannot evict someone who is browsing.
      if (handledDeepLinkRef.current !== null) {
        handledDeepLinkRef.current = null;
        setActiveParent(startParent);
        setActiveChildIndex(0);
        setSearchQuery('');
      }
      return;
    }

    if (handledDeepLinkRef.current === deepLinkTarget) return;

    // Nothing to match against yet: stay pending (the default view is already
    // the first department) and retry as soon as the hierarchy or the flat
    // groups arrive.
    if (tree === null && categories.length === 0) return;

    if (applyDeepLink(deepLinkTarget)) {
      handledDeepLinkRef.current = deepLinkTarget;
      // A category link always clears any previous search so the tapped group
      // shows its own items instead of a filtered subset.
      setSearchQuery('');
    } else {
      // Unresolvable link: fall back to "الكل" instead of leaving a stale page.
      console.warn(`Item group "${deepLinkTarget}" was not found in the catalog`);
      handledDeepLinkRef.current = deepLinkTarget;
      setActiveParent(ALL_KEY);
      setActiveChildIndex(0);
    }
  }, [deepLinkTarget, hierarchyLoading, tree, categories, applyDeepLink, startParent]);

  // First answer from the hierarchy: open on the first department (see
  // `startParent`). Kept separate from the deep-link effect above so that the
  // wait for the tree does not sit behind `hierarchyLoading` as well.
  useEffect(() => {
    setActiveParent(startParent);
  }, [startParent]);

  // A search arriving from Home while this screen is already mounted.
  // `setSearchQuery` is enough: the debounced search effect above owns the
  // results, so there is no second copy of "the search being run" to keep in
  // sync — which is exactly what used to go stale.
  const handledSearchRef = useRef(deepLinkSearch);
  useEffect(() => {
    if (deepLinkSearch === handledSearchRef.current) return;
    handledSearchRef.current = deepLinkSearch;
    setSearchQuery(deepLinkSearch);
  }, [deepLinkSearch]);

  // Hand-off from the Home screen's search field: clear the field and put the
  // cursor in it, so the shopper can simply carry on typing and the debounced
  // search above runs exactly as it does for someone who typed here directly.
  //
  // The param is a changing counter, not a boolean. react-navigation MERGES
  // params, so a boolean would remain `true` from an earlier hand-over and would
  // re-focus this field on unrelated later visits to the tab. Keying the effect
  // on a value that only changes when a hand-over actually happened means a
  // value left behind in the params does nothing.
  const focusSearchToken = route.params?.focusSearch;
  useEffect(() => {
    if (focusSearchToken === undefined || focusSearchToken === null) return;
    // Cleared as well as focused: without this the shopper would carry on typing
    // into a previous search, or into a category page, and wonder why the
    // results do not match what they typed.
    setSearchQuery('');
    // Deferred because the Products tab is usually already mounted, and a tab
    // that is not the focused one yet cannot take input focus — focusing during
    // the transition is silently dropped.
    const timer = setTimeout(() => searchInputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [focusSearchToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const hierarchy = await CatalogAPI.getItemGroupHierarchy();
        if (mounted) setTree(hierarchy);
      } finally {
        if (mounted) setHierarchyLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Subtle slide/fade for the child row when switching parent groups.
  const childChipsAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    childChipsAnim.setValue(0);
    Animated.timing(childChipsAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParent]);

  // --- Custom gesture-driven pager --------------------------------------------
  // A native horizontal pager flips direction unexpectedly in RTL context, so
  // the page transitions are driven by translateX + PanResponder with an
  // explicit, deterministic rule: swipe RIGHT = next child, swipe LEFT = back.
  const baseOffset = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const translateX = Animated.add(baseOffset, dragOffset);
  
  const activeIndexRef = useRef(activeChildIndex);
  activeIndexRef.current = activeChildIndex;
  const childPagesRef = useRef(childPages);
  childPagesRef.current = childPages;

  // Keep the pager aligned to the active child on every change (chip press,
  // parent switch, or swipe release). This is the single animation path, so
  // page transitions always glide with the same easing and stay interruptible.
  const settleSlide = useCallback(
    (index) => {
      baseOffset.stopAnimation();
      dragOffset.stopAnimation();
      const x = index * width;
      Animated.parallel([
        Animated.timing(baseOffset, {
          toValue: x,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dragOffset, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [width]
  );

  useEffect(() => {
    settleSlide(activeChildIndex);
  }, [activeChildIndex, childPages.length, settleSlide]);

  // Keep the selected chip of both group rows on screen after a swipe, a chip
  // press or a deep link. `childPages` is a fresh array on every catalog merge,
  // so a string signature is used to avoid re-centring while browsing. The count
  // is what lets each row tell its own start edge apart from the last chip.
  const childRow = useAutoRevealRow(
    activeChildIndex,
    childPages.join('\u0001'),
    childPages.length
  );
  const parentRow = useAutoRevealRow(
    parentList.indexOf(activeParent),
    parentList.join('\u0001'),
    parentList.length
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        baseOffset.stopAnimation();
        dragOffset.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const startIndex = activeIndexRef.current;
        const count = childPagesRef.current.length;
        // Lower bound: how far we can pull the next page in from the right
        // (dragging left). Upper bound: how far we can pull the previous page
        // in from the left (dragging right). Blocks rubber-banding past edges.
        const lower = -(count - 1 - startIndex) * width;
        const upper = startIndex * width;
        // The drag is mirrored so a rightward swipe pulls the NEXT page in
        // (reversed scrolling): as the finger moves right, the track glides
        // left and the following page is revealed from the right edge.
        dragOffset.setValue(Math.max(lower, Math.min(upper, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const start = activeIndexRef.current;
        const threshold = width * 0.15;
        let target = start;
        if (g.dx > threshold || g.vx > 0.5) target = start + 1; // swipe right → next
        else if (g.dx < -threshold || g.vx < -0.5) target = start - 1; // swipe left → previous
        target = Math.max(0, Math.min(target, childPagesRef.current.length - 1));
        if (target !== start) {
          // Commit immediately so the chips + counter react while the track is
          // still gliding; the settleSlide effect drives the animation.
          setActiveChildIndex(target);
        } else {
          // Reverted — just ease the drag back into place.
          Animated.timing(dragOffset, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(dragOffset, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  function handleSelectParent(key) {
    if (key === activeParent) return;
    setActiveParent(key);
    setActiveChildIndex(0);
  }

  function handleSelectChild(key) {
    const idx = childPages.findIndex((k) => k === key);
    if (idx < 0) return;
    setActiveChildIndex(idx);
  }

  function showAll() {
    setActiveParent(ALL_KEY);
    setActiveChildIndex(0);
  }

  /**
   * Clearing the field is a pure local operation.
   *
   * There is nothing to wait for and nothing to fetch: the debounced search
   * effect sees the empty term and drops the results on the next tick, while
   * the group pager underneath is still holding the full catalog, so the
   * catalog reappears immediately. Making the old implementation round-trip
   * through the server is what left the deleted term's results on screen.
   */
  function handleClearSearch() {
    setSearchQuery('');
  }

  // The search field submits, but results no longer wait for it: the debounced
  // effect above starts searching as the user types. Submitting still dismisses
  // the keyboard, which is the only thing the user actually wants from it.
  function handleSearchSubmit() {
    // Intentionally a no-op for the query: it is already live.
  }

  const activeProducts = productsByKey[activeKey] || [];
  /*
   * Page loading, and why there are two places a skeleton appears.
   *
   * `showSkeleton` covers the very first paint, before any page has data: the
   * placeholder replaces the pager itself. Afterwards the pager stays mounted and
   * each page owns its own skeleton, so switching a child group (or a parent,
   * which resets the child list) shows the grid placeholder straight away instead
   * of an empty area with a spinner — the same shape in both places, so the two
   * states are indistinguishable to the shopper.
   *
   * `failedKeys` is what keeps the skeleton honest: it is only drawn while a
   * request for that page is actually outstanding. A page whose fetch errored
   * shows a retry, not a placeholder that pulses forever.
   */
  const showSkeleton = initialLoading && Object.keys(productsByKey).length === 0;

  const onOpen = useCallback(
    (itemCode) => openProduct(navigation, itemCode),
    [navigation]
  );

  /*
   * Document head for the catalogue.
   *
   * Placed after every value it reads so no hook closes over a binding that has
   * not been initialised yet.
   *
   * Three states need distinct treatment: a search is transient and must never
   * be indexed, or the site accrues an unbounded set of thin result pages; a
   * category is a real landing page worth indexing; the bare catalogue is the
   * primary listing. `path` mirrors the browse state so the canonical URL always
   * points at the page actually on screen.
   */
  const isSearchPage = isSearchActive;
  const headCategory = activeKey !== ALL_KEY ? activeKey : null;
  const headPath = isSearchPage
    ? '/products'
    : headCategory
      ? `/products/${encodeURIComponent(headCategory)}`
      : '/products';

  const headJsonLd = useMemo(() => {
    if (isSearchPage || activeProducts.length === 0) return null;
    return [
      organizationNode(),
      itemListNode(activeProducts, {
        locale,
        path: headCategory ? `/products/${encodeURIComponent(headCategory)}` : '/products',
      }),
    ];
  }, [isSearchPage, activeProducts, locale, headCategory]);

  useDocumentHead({
    title: isSearchPage
      ? t('seo.searchTitle', { query: debouncedQuery })
      : headCategory || t('seo.productsTitle'),
    description: isSearchPage
      ? t('seo.searchDescription', { query: debouncedQuery })
      : headCategory
        ? t('seo.categoryDescription', { category: headCategory })
        : t('seo.productsDescription'),
    path: headPath,
    noindex: isSearchPage,
    jsonLd: headJsonLd,
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={Platform.OS === 'web' ? ['left', 'right'] : ['top', 'left', 'right']}>
      {/*
        Search bar.

        Hidden on the desktop shell: `SiteHeader` carries a search field in the
        sticky top bar, and two search boxes on one screen reads as a bug rather
        than as a feature.

        The trade-off is that this field owns the live query state (focus, clear,
        debounce). On desktop the header's search is the only control, and it
        hands off by pushing a new `search` param, so `SearchResultsHeader` below
        is what tells the shopper what is currently filtered.
      */}
      {!showDesktopChrome && (
        <View style={styles.header}>
          <SearchBar
            inputRef={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onClear={handleClearSearch}
            placeholder="ابحث بالاسم عن متنجك..."          
            />
          {/* Marketplace entry point. Kept out of the category chips on purpose:
              a shop is not an item group, and mixing the two taxonomies into one
              row made both harder to scan. Hidden on desktop, where `SiteHeader`
              already carries the browse controls. */}
          {/* <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ShopDirectory')}
            style={styles.shopsBanner}
          >
            <Icon name="storefront-outline" size={16} color={Colors.primary} />
            <Text style={[styles.shopsBannerText, textStart]}>تصفح متاجر المنصة</Text>
            <Icon
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={14}
              color={Colors.primary}
            />
          </TouchableOpacity> */}
        </View>
      )}

      {isSearchActive ? (
        <>
          <SearchResultsHeader
            query={searchState.query || debouncedQuery}
            count={searchState.items.length}
            loading={searchState.loading}
          />
          <SearchResults
            state={searchState}
            onOpen={onOpen}
            onLoadMore={loadMoreSearch}
            refreshing={refreshing}
            onRefresh={refreshSearch}
            onClearAll={handleClearSearch}
            onScroll={handleListScroll}
          />
        </>
      ) : (
        <>
          {/* Parent groups — main departments */}
          <View style={[styles.chipsGroup, Platform.OS === 'web' && showDesktopChrome ? styles.chipsSticky : null]}>
            {/* <View style={styles.chipsLabelRow}>
          <Icon name="albums-outline" size={14} color={Colors.primary} />
          <Text style={[styles.chipsLabel, textStart]}>الأقسام الرئيسية</Text>
        </View> */}
            <ScrollView
              ref={parentRow.scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              {...parentRow.scrollProps}
            >
              {parentList.map((key, idx) => (
                <View key={key} onLayout={(event) => parentRow.measure(idx, event)}>
                  <CategoryCard
                    category={key === ALL_KEY ? 'الكل' : key}
                    variant="chip"
                    chipActiveStyle="underline"
                    isSelected={activeParent === key}
                    onSelect={() => handleSelectParent(key)}
                  />
                </View>
              ))}
        </ScrollView>
          </View>

          {/* Child groups — filtered by active parent, first one activated */}
          <View style={[styles.chipsGroup, styles.chipsGroupSub, Platform.OS === 'web' && showDesktopChrome ? styles.chipsStickySub : null]}>
            <Animated.View
              style={{
                opacity: childChipsAnim,
                transform: [
                  {
                    translateX: childChipsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [26, 0],
                    }),
                  },
                ],
              }}
            >
              <ScrollView
                ref={childRow.scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
                keyboardShouldPersistTaps="handled"
                {...childRow.scrollProps}
              >
                {childPages.map((key, idx) => (
                  <View
                    key={`${key}`}
                    onLayout={(event) => childRow.measure(idx, event)}
                  >
                    <CategoryCard
                      category={key === ALL_KEY ? 'الكل' : key}
                      variant="chip"
                      isSelected={idx === activeChildIndex}
                      onSelect={() => handleSelectChild(key)}
                    />
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </View>

          {/* Results info */}
          {/* <View style={styles.resultsInfo}>
        <Text style={[styles.resultsText, textStart]}>
          عرض {activeProducts.length} من المنتجات
        </Text>
      </View> */}

          {showSkeleton ? (
            <ProductGridSkeleton
              cellStyle={gridCellStyle}
              rowStyle={gridRowStyle}
              imageHeight={gridImageHeight}
            />
          ) : (
            <View
              {...panResponder.panHandlers}
              style={styles.pager}
            >
              <Animated.View
                style={[
                  styles.pagerTrack,
                  { width: childPages.length * width, transform: [{ translateX }] },
                ]}
              >
                {childPages.map((key, idx) => {
                  const pageProducts = productsByKey[key] || [];
                  const isActive = key === activeKey;

                  // Only the active page mounts its product list. Other pages are
                  // lightweight placeholders so a parent with many children does not
                  // mount dozens of nested FlatLists / product cards at once.
                  //
                  // The active page draws its own skeleton until it has items, so a
                  // swipe or a chip press never lands on a blank area with a spinner.
                  return (
                    <View
                      key={`${idx}-${key}`}
                      style={[styles.page, { width }]}
                    >
                      {isActive ? (
                        <PageContent>
                          {!loadedKeys[key] ? (
                            failedKeys[key] ? (
                              <EmptyState
                                icon="cloud-offline-outline"
                                title="تعذّر تحميل المنتجات"
                                description="حدثت مشكلة أثناء جلب منتجات هذا القسم. تحقق من اتصالك وحاول مرة أخرى."
                                actionLabel="إعادة المحاولة"
                                onAction={() => loadKey(key)}
                              />
                            ) : (
                              <ProductGridSkeleton
                                cellStyle={gridCellStyle}
                                rowStyle={gridRowStyle}
                                imageHeight={gridImageHeight}
                              />
                            )
                          ) : (
                            <FlatList
                              data={pageProducts}
                              key={`page-grid-${gridColumns}`}
                              keyExtractor={(item, index) => item.item_code || String(index)}
                              numColumns={gridColumns}
                              columnWrapperStyle={gridColumns > 1 ? gridRowStyle : undefined}
                              contentContainerStyle={[
                                styles.listContent,
                                !showDesktopChrome && styles.listContentMobile,
                              ]}
                              showsVerticalScrollIndicator={false}
                              onScroll={handleListScroll}
                              scrollEventThrottle={16}
                              initialNumToRender={6}
                              maxToRenderPerBatch={10}
                              updateCellsBatchingPeriod={60}
                              windowSize={7}
                              removeClippedSubviews
                              renderItem={({ item }) => (
                                <ProductGridCell
                                  product={item}
                                  onOpen={onOpen}
                                  cellStyle={gridCellStyle}
                                  imageHeight={gridImageHeight}
                                />
                              )}
                              onEndReached={() => loadMoreKey(key)}
                              onEndReachedThreshold={0.4}
                              refreshControl={
                                <RefreshControl
                                  refreshing={refreshing}
                                  onRefresh={() => refreshKey(key)}
                                  colors={[Colors.primary]}
                                  tintColor={Colors.primary}
                                />
                              }
                              ListFooterComponent={
                                <View style={styles.footerWrap}>
                                  <View style={styles.footer}>
                                    {loadingMore ? (
                                      <>
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                        <Text style={[styles.footerText, textStart]}>جاري تحميل المزيد...</Text>
                                      </>
                                    ) : !hasMoreByKey[key] && pageProducts.length > 0 ? (
                                      <Text style={[styles.footerText, textStart]}>— لقد وصلت إلى نهاية القائمة —</Text>
                                    ) : null}
                                  </View>

                                  {/*
                                    Products has no page-level ScrollView, only per-category
                                    FlatLists inside the pager. `ListFooterComponent` is therefore
                                    the only position where the footer sits *inside* the scrollable
                                    area and can actually be reached.
                                  */}
                                  <PageFooter />
                                </View>
                              }
                              ListEmptyComponent={
                                <EmptyState
                                  icon="search-outline"
                                  title="لم يتم العثور على منتجات"
                                  description="جرب البحث بكلمات أخرى أو اختر فئة مختلفة."
                                  actionLabel="عرض كل المنتجات"
                                  onAction={showAll}
                                />
                              }
                            />
                          )}
                        </PageContent>
                      ) : (
                        <View style={styles.pagePlaceholder}>
                          {pageProducts.length > 0 ? (
                            <Text style={[styles.pagePlaceholderText, textStart]}>
                              {key === ALL_KEY ? 'الكل' : key}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            </View>
          )}
        </>
      )}

      {/* Admin-only entry to the create-product screen. A FAB rather than a
          header icon so it reads as "add", not "settings". */}
      {isAdmin ? (
        <Pressable
          onPress={() => navigation.navigate('AdminNewItem')}
          accessibilityRole="button"
          accessibilityLabel="إضافة منتج جديد"
          style={({ pressed }) => [styles.adminFab, pressed && { opacity: 0.85 }]}
        >
          <Icon name="add" size={26} color={Colors.onPrimary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  adminFab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    
  },
  shopsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
  },
  shopsBannerText: {
    flex: 1,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  searchHeaderText: {
    flex: 1,
  },
  searchHeaderTitle: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilySemiBold,
  },
  searchHeaderQuery: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipsGroup: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingTop: 4,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  chipsGroupSub: {
    backgroundColor: Colors.surfaceContainerLow || '#F8FAF9',
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  chipsSticky: {
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 20, backgroundColor: Colors.surfaceContainerLowest } : {}),
  },
  chipsStickySub: {
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 48, zIndex: 19, backgroundColor: Colors.surfaceContainerLow || '#F8FAF9' } : {}),
  },
  chipsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 3,
  },
  chipsLabel: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilySemiBold,
  },
  chipsRow: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.background,
  },
  resultsText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  pager: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerTrack: {
    flexDirection: 'row',
    height: '100%',
  },
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePlaceholderText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilySemiBold,
  },
  // No bottom padding: the footer is the list footer, so padding here would
  // leave an empty band under it.
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 0,
    paddingTop: 2,
  },
  listContentMobile: {
    paddingBottom: 24,
  },
  // Grid gutters are expressed per-cell in `useGridMetrics` (padding inside the
  // cell plus a negative margin on the row), so there is no `columnWrapper` or
  // fixed `gridColumn` here any more — the column count is not a constant.
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  // Cancels the content container's 10px horizontal padding so the footer band
  // spans the window while its own `Container` keeps the content aligned.
  // No explicit width: the negative margins must be able to stretch the box,
  // and `width: '100%'` would pin it to the padded width instead.
  footerWrap: {
    marginHorizontal: -10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    width: '100%',
  },
  footerText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
});
