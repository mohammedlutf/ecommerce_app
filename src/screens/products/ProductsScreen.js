import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
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
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

export default function ProductsScreen({ route, navigation }) {
  const initialCategory = route.params?.category || 'all';
  const initialSearch = route.params?.search || '';

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async (search = searchQuery) => {
    setLoading(true);
    try {
      const data = await CatalogAPI.getCatalog({
        itemGroup: selectedCategory,
        search: search || null,
        limit: 50,
      });
      if (data) {
        setProducts(data.items || []);
        if (data.groups && data.groups.length > 0) {
          setCategories(data.groups);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch catalog:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, fetchProducts]);

  // Live: re-fetch when the app reactivates and every 60s.
  useLiveRefresh(fetchProducts, { intervalMs: 60000, isEnabled: true });

  function handleSearchSubmit() {
    fetchProducts(searchQuery);
  }

  function handleClearSearch() {
    setSearchQuery('');
    fetchProducts('');
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

      {/* Categories */}
      <View style={styles.categoriesWrapper}>
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
      </View>

      {/* Results */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {loading ? 'جاري التحميل...' : `عرض ${products.length} من المنتجات`}
        </Text>
      </View>

      {loading ? (
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchProducts(searchQuery);
              }}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.gridColumn}>
              <ProductCard
                product={item}
                onPress={() =>
                  navigation.navigate('ProductDetail', {
                    itemCode: item.item_code,
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
                setSelectedCategory('all');
                handleClearSearch();
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
});