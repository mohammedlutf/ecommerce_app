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
  I18nManager,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import CatalogAPI from '../../api/catalog';
import { normalizeGroupName } from '../../utils/catalog';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

const PAGE_SIZE = 20;
const ALL_KEY = 'all';
const ALL_PAGE = '__all__';

const catName = (cat) => (typeof cat === 'string' ? cat : cat && cat.name);

// Memoized cell so product cards only re-render when their own product changes
// (the stable `onOpen` callback keeps the memo useful across parent re-renders).
const ProductGridCell = React.memo(function ProductGridCell({ product, onOpen }) {
  return (
    <View style={styles.gridColumn}>
      <ProductCard
        product={product}
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
 * useAutoRevealRow — keeps the selected chip of a horizontal group row on screen.
 *
 * A chip row can hold dozens of groups, so after a swipe (or a deep link that
 * selects a group off-screen) the active chip is invisible. Chips are measured
 * from the content's START edge — the right edge in RTL — and mapped onto the
 * ScrollView's `scrollTo` space, which is start-relative as well.
 *
 * `rowKey` should be a stable string for the row's items so unrelated re-renders
 * (e.g. a product page merging into state) do not yank the row back to center.
 *
 * Returns `{ scrollRef, scrollProps, measure }`:
 *   - spread `scrollProps` on the horizontal ScrollView
 *   - call `measure(index, layoutEvent)` from each chip wrapper's onLayout
 */
function useAutoRevealRow(activeIndex, rowKey) {
  const scrollRef = useRef(null);
  const metricsRef = useRef({}); // index -> { x, size } (x measured from the LEFT edge)
  const viewportRef = useRef({ width: 0, contentWidth: 0 });
  const lastTargetRef = useRef(-1);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const reveal = useCallback((index) => {
    const scrollNode = scrollRef.current;
    const metric = metricsRef.current[index];
    const { width: viewportWidth, contentWidth } = viewportRef.current;
    if (!scrollNode || !metric || viewportWidth <= 0) return;

    const distanceFromStart = I18nManager.isRTL
      ? Math.max(0, contentWidth - metric.x - metric.size)
      : metric.x;

    // Center the chip, then clamp so the row never over-scrolls its bounds.
    const maxOffset = Math.max(0, contentWidth - viewportWidth);
    const target = Math.max(
      0,
      Math.min(maxOffset, distanceFromStart + metric.size / 2 - viewportWidth / 2)
    );

    // Layout arrives as a burst of events; ignoring sub-pixel deltas keeps the
    // row from being re-scrolled (and re-animated) several times in a row.
    if (Math.abs(target - lastTargetRef.current) < 1) return;
    lastTargetRef.current = target;
    scrollNode.scrollTo({ x: target, y: 0, animated: true });
  }, []);

  useEffect(() => {
    reveal(activeIndex);
  }, [activeIndex, rowKey, reveal]);

  const measure = useCallback(
    (index, event) => {
      const { x, width } = event.nativeEvent.layout;
      metricsRef.current[index] = { x, size: width };
      // `onContentSizeChange` can land before the chip `onLayout` events, so the
      // active chip also re-centres from here.
      if (index === activeIndexRef.current) reveal(index);
    },
    [reveal]
  );

  const scrollProps = useMemo(
    () => ({
      onLayout: (event) => {
        viewportRef.current.width = event.nativeEvent.layout.width;
      },
      onContentSizeChange: (contentWidth) => {
        const changed = viewportRef.current.contentWidth !== contentWidth;
        viewportRef.current.contentWidth = contentWidth;
        if (changed) reveal(activeIndexRef.current);
      },
    }),
    [reveal]
  );

  return { scrollRef, scrollProps, measure };
}

export default function ProductsScreen({ route, navigation }) {
  useResetOnTabPress(navigation, 'ProductsTab');
  const { width } = useWindowDimensions();

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

  const [searchQuery, setSearchQuery] = useState(deepLinkSearch);
  const [activeSearch, setActiveSearch] = useState(deepLinkSearch);

  // Products are cached per child-group page so swiping back is instant.
  const [productsByKey, setProductsByKey] = useState({});
  const [hasMoreByKey, setHasMoreByKey] = useState({});
  const [loadedKeys, setLoadedKeys] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const offsetRef = useRef({});

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

  // Clamp the active index when the page list shrinks.
  useEffect(() => {
    if (activeChildIndex >= childPages.length) {
      setActiveChildIndex(Math.max(0, childPages.length - 1));
    }
  }, [activeChildIndex, childPages.length]);

  function mergePageFor(key, data, replace) {
    const pageItems = data && Array.isArray(data.items) ? data.items : [];
    setProductsByKey((cur) => {
      const base = replace ? [] : cur[key] ? cur[key].slice() : [];
      const merged = base.slice();
      for (const item of pageItems) {
        const code = item.item_code || item.name;
        if (!merged.some((p) => (p.item_code || p.name) === code)) {
          merged.push(item);
        }
      }
      return { ...cur, [key]: merged };
    });
    setHasMoreByKey((cur) => ({ ...cur, [key]: pageItems.length >= PAGE_SIZE }));
    setLoadedKeys((cur) => (cur[key] ? cur : { ...cur, [key]: true }));
    if (data && Array.isArray(data.groups) && data.groups.length > 0) {
      setCategories(data.groups);
    }
  }

  const loadKey = useCallback(
    async (key) => {
      const firstLoad = !loadedKeys[key];
      if (firstLoad) setInitialLoading(true);
      offsetRef.current[key] = 0;

      const leaf = key === ALL_PAGE ? ALL_KEY : key;
      const parent = activeParent === ALL_KEY ? ALL_KEY : activeParent;

      try {
        // The backend often keeps products on the parent (or an intermediate)
        // item group, so a leaf can come back empty while its parent has items.
        // Fetch leaf + parent in PARALLEL so the page resolves in a single
        // round-trip, then prefer the leaf when it actually returned items.
        const [leafData, parentData] = await Promise.all([
          CatalogAPI.getCatalog({
            itemGroup: leaf,
            search: activeSearch || null,
            limit: PAGE_SIZE,
            offset: 0,
          }),
          !activeSearch && leaf !== ALL_KEY && parent !== ALL_KEY && parent !== leaf
            ? CatalogAPI.getCatalog({
                itemGroup: parent,
                search: null,
                limit: PAGE_SIZE,
                offset: 0,
              })
            : Promise.resolve(null),
        ]);

        const leafHasItems =
          leafData && Array.isArray(leafData.items) && leafData.items.length > 0;
        const data = leafHasItems ? leafData : parentData || leafData;

        mergePageFor(key, data, true);
      } catch (err) {
        console.warn('Failed to fetch catalog:', err);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeSearch, activeParent, loadedKeys]
  );

  async function loadMoreKey(key) {
    if (loadingMore || !hasMoreByKey[key]) return;
    setLoadingMore(true);
    try {
      const curProducts = productsByKey[key];
      const data = await CatalogAPI.getCatalog({
        itemGroup: key === ALL_PAGE ? ALL_KEY : key,
        search: activeSearch || null,
        limit: PAGE_SIZE,
        offset: curProducts ? curProducts.length : 0,
      });
      mergePageFor(key, data, false);
    } catch (err) {
      console.warn('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshKey(key) {
    setRefreshing(true);
    await loadKey(key);
  }

  // Load/refresh the page whenever the active child group or search changes.
  useEffect(() => {
    loadKey(activeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeSearch]);

  // Live: re-sync the current page when the app returns to the foreground.
  useLiveRefresh(() => loadKey(activeKey), { intervalMs: 0, isEnabled: true });

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
      // Plain visit (tab press) -> always reset to the "الكل" page so the screen
      // does not open on whatever group was last deep-linked.
      if (handledDeepLinkRef.current !== null) {
        handledDeepLinkRef.current = null;
        setActiveParent(ALL_KEY);
        setActiveChildIndex(0);
        setSearchQuery('');
        setActiveSearch('');
      }
      return;
    }

    if (handledDeepLinkRef.current === deepLinkTarget) return;

    // Nothing to match against yet: stay pending (the default view is already
    // "الكل") and retry as soon as the hierarchy or the flat groups arrive.
    if (tree === null && categories.length === 0) return;

    if (applyDeepLink(deepLinkTarget)) {
      handledDeepLinkRef.current = deepLinkTarget;
      // A category link always clears any previous search so the tapped group
      // shows its own items instead of a filtered subset.
      setSearchQuery('');
      setActiveSearch('');
    } else {
      // Unresolvable link: fall back to "الكل" instead of leaving a stale page.
      console.warn(`Item group "${deepLinkTarget}" was not found in the catalog`);
      handledDeepLinkRef.current = deepLinkTarget;
      setActiveParent(ALL_KEY);
      setActiveChildIndex(0);
    }
  }, [deepLinkTarget, hierarchyLoading, tree, categories, applyDeepLink]);

  // A search arriving from Home while this screen is already mounted.
  const handledSearchRef = useRef(deepLinkSearch);
  useEffect(() => {
    if (deepLinkSearch === handledSearchRef.current) return;
    handledSearchRef.current = deepLinkSearch;
    setSearchQuery(deepLinkSearch);
    setActiveSearch(deepLinkSearch);
  }, [deepLinkSearch]);

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
  // so a string signature is used to avoid re-centring while browsing.
  const childRow = useAutoRevealRow(activeChildIndex, childPages.join('\u0001'));
  const parentRow = useAutoRevealRow(
    parentList.indexOf(activeParent),
    parentList.join('\u0001')
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

  function handleSearchSubmit() {
    setActiveSearch(searchQuery.trim());
  }

  function handleClearSearch() {
    setSearchQuery('');
    setActiveSearch('');
  }

  const activeProducts = productsByKey[activeKey] || [];
  // Skeleton only on the very first load; page switches keep the paged UI and
  // show an inline loader inside the new page instead (smooth swiping).
  const showSkeleton = initialLoading && Object.keys(productsByKey).length === 0;

  const onOpen = useCallback(
    (itemCode) => navigation.navigate('ProductDetail', { itemCode }),
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Search Header */}
      <View style={styles.header}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearchSubmit}
          onClear={handleClearSearch}
          placeholder="ابحث بالاسم أو الباركود..."
        />
      </View>

      {/* Parent groups — main departments */}
      <View style={styles.chipsGroup}>
        {/* <View style={styles.chipsLabelRow}>
          <Icon name="albums-outline" size={14} color={Colors.primary} />
          <Text style={styles.chipsLabel}>الأقسام الرئيسية</Text>
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
      <View style={[styles.chipsGroup, styles.chipsGroupSub]}>
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
        <Text style={styles.resultsText}>
          {activeSearch ? `نتائج البحث عن: "${activeSearch}" — ` : ''}
          عرض {activeProducts.length} من المنتجات
        </Text>
      </View> */}

      {showSkeleton ? (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.gridColumn}>
              <LoadingSkeleton height={150} borderRadius={Radius.xl} />
              <View style={{ marginTop: 8 }}>
                <LoadingSkeleton height={16} width="85%" />
                <LoadingSkeleton height={14} width="40%" style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
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
              return (
                <View
                  key={`${idx}-${key}`}
                  style={[styles.page, { width }]}
                >
                  {isActive ? (
                    <PageContent>
                      <FlatList
                        data={pageProducts}
                        keyExtractor={(item, index) => item.item_code || String(index)}
                        numColumns={2}
                        columnWrapperStyle={styles.columnWrapper}
                        contentContainerStyle={styles.listContent}
                        initialNumToRender={6}
                        maxToRenderPerBatch={10}
                        updateCellsBatchingPeriod={60}
                        windowSize={7}
                        removeClippedSubviews
                        renderItem={({ item }) => (
                          <ProductGridCell product={item} onOpen={onOpen} />
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
                          <View style={styles.footer}>
                            {loadingMore ? (
                              <>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.footerText}>جاري تحميل المزيد...</Text>
                              </>
                            ) : !hasMoreByKey[key] && pageProducts.length > 0 ? (
                              <Text style={styles.footerText}>— لقد وصلت إلى نهاية القائمة —</Text>
                            ) : null}
                          </View>
                        }
                        ListEmptyComponent={
                          loadedKeys[key] ? (
                            <EmptyState
                              icon="search-outline"
                              title="لم يتم العثور على منتجات"
                              description="جرب البحث بكلمات أخرى أو اختر فئة مختلفة."
                              actionLabel="عرض كل المنتجات"
                              onAction={showAll}
                            />
                          ) : initialLoading ? (
                            <View style={styles.pageLoader}>
                              <ActivityIndicator size="small" color={Colors.primary} />
                              <Text style={styles.pageLoaderText}>جاري تحميل المنتجات...</Text>
                            </View>
                          ) : null
                        }
                      />
                    </PageContent>
                  ) : (
                    <View style={styles.pagePlaceholder}>
                      {pageProducts.length > 0 ? (
                        <Text style={styles.pagePlaceholderText}>
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
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
  },
  chipsGroup: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    paddingBottom: 6,
    borderBottomColor: Colors.borderSubtle,
  },
  chipsGroupSub: {
    paddingBottom: 6,
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
    paddingHorizontal: 14,
    gap: 6,
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
    textAlign: 'left',
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
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
    paddingTop: 2,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  gridColumn: {
    width: '50%',
    padding: 6,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  pageLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  pageLoaderText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  footerText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
});