import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import CatalogAPI from '../../api/catalog';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

const PAGE_SIZE = 20;

export default function ProductsScreen({ route, navigation }) {
  useResetOnTabPress(navigation, 'ProductsTab');

  const initialItemGroup = route.params?.itemGroup;
  const initialCategory = route.params?.category || 'all';
  const initialSearch = route.params?.search || '';

  const [selectedCategory, setSelectedCategory] = useState(
    initialItemGroup || (initialCategory === 'all' ? 'all' : initialCategory)
  );
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mergePage = useCallback((data, replace) => {
    const pageItems = data && Array.isArray(data.items) ? data.items : [];
    const pageHasMore = pageItems.length >= PAGE_SIZE;

    setProducts((cur) => {
      const merged = replace ? [] : cur.slice();
      for (const item of pageItems) {
        const code = item.item_code || item.name;
        if (!merged.some((p) => (p.item_code || p.name) === code)) {
          merged.push(item);
        }
      }
      return merged;
    });
    setHasMore(pageHasMore);
    if (data && Array.isArray(data.groups) && data.groups.length > 0) {
      setCategories(data.groups);
    }
  }, []);

  const loadFirst = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setInitialLoading(true);
      try {
        const data = await CatalogAPI.getCatalog({
          itemGroup: selectedCategory,
          search: activeSearch || null,
          limit: PAGE_SIZE,
          offset: 0,
        });
        mergePage(data, true);
      } catch (err) {
        console.warn('Failed to fetch catalog:', err);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, activeSearch, mergePage]
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || initialLoading) return;
    setLoadingMore(true);
    try {
      const data = await CatalogAPI.getCatalog({
        itemGroup: selectedCategory,
        search: activeSearch || null,
        limit: PAGE_SIZE,
        offset: products.length,
      });
      mergePage(data, false);
    } catch (err) {
      console.warn('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, initialLoading, products.length, selectedCategory, activeSearch, mergePage]);

  useEffect(() => {
    loadFirst();
  }, [selectedCategory, activeSearch, loadFirst]);

  // Live: re-sync the first page only when the app returns to the foreground.
  // No in-app auto-polling (avoided the visible ~60s list refresh).
  useLiveRefresh(() => loadFirst({ silent: true }), { intervalMs: 0, isEnabled: true });

  function handleSelectCategory(name) {
    setSelectedCategory(name === 'الكل' ? 'all' : name);
    setSearchQuery('');
    setActiveSearch('');
  }

  function handleSearchSubmit() {
    setActiveSearch(searchQuery.trim());
  }

  function handleClearSearch() {
    setSearchQuery('');
    setActiveSearch('');
  }

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

      {/* Categories — compact text chips */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <CategoryCard
            category="الكل"
            variant="chip"
            isSelected={selectedCategory === 'all'}
            onSelect={handleSelectCategory}
          />
          {categories.map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : cat.name;
            return (
              <CategoryCard
                key={catName || idx}
                category={cat}
                variant="chip"
                isSelected={selectedCategory === catName}
                onSelect={handleSelectCategory}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Results */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {activeSearch ? `نتائج البحث عن: "${activeSearch}" — ` : ''}
          عرض {products.length} من المنتجات
        </Text>
      </View>

      {initialLoading && products.length === 0 ? (
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
        <FlatList
          data={products}
          keyExtractor={(item, index) => item.item_code || String(index)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFirst({ silent: true });
              }}
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
              ) : !hasMore && products.length > 0 ? (
                <Text style={styles.footerText}>— لقد وصلت إلى نهاية القائمة —</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridColumn}>
              <ProductCard
                product={item}
                onPress={() =>
                  navigation.navigate('ProductDetail', {
                    itemCode: item.item_code || item.name,
                  })
                }
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="لم يتم العثور على منتجات"
              description="جرب البحث بكلمات أخرى أو اختر فئة مختلفة."
              actionLabel="عرض كل المنتجات"
              onAction={() => {
                handleSelectCategory('الكل');
              }}
            />
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
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
  },
  categoriesWrapper: {
    backgroundColor: Colors.surface,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  categoriesRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'left',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
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