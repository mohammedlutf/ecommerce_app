import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import EmptyState from '../../components/EmptyState';
import { useVendor } from '../../context/VendorContext';
import VendorAPI from '../../api/vendor';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';

const PAGE_SIZE = 20;

/**
 * VendorProductsScreen — this shop's catalogue, with search and paging.
 *
 * The search term is debounced so a fast typist issues one request per settled
 * query rather than one per keystroke; the responses for a filtered query and an
 * unfiltered one are not ordered, and without debouncing the slower results of
 * "che" can overwrite the results of "cheese".
 */
export default function VendorProductsScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { isApproved } = useVendor();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const requestRef = useRef(0);
  const searchRef = useRef('');
  searchRef.current = debouncedSearch;
  const countRef = useRef(0);
  countRef.current = items.length;

  const load = useCallback(
    async ({ start = 0, append = false, showSpinner = true, term = searchRef.current } = {}) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await VendorAPI.getProducts({ start, pageSize: PAGE_SIZE, search: term });
        if (requestId !== requestRef.current) return;
        if (term !== searchRef.current) return;

        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (err) {
        if (requestId === requestRef.current) console.warn('Could not load vendor products:', err.message);
      } finally {
        if (requestId === requestRef.current) {
          if (append) setLoadingMore(false);
          else if (showSpinner) setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      if (!isApproved) return undefined;
      load({ showSpinner: items.length === 0 });
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isApproved, load])
  );

  // Re-query from the top whenever the settled search term changes.
  useEffect(() => {
    if (!isApproved) return;
    searchRef.current = debouncedSearch;
    setItems([]);
    setHasMore(false);
    load({ start: 0, showSpinner: true, term: debouncedSearch });
  }, [debouncedSearch, isApproved, load]);

  function handleRefresh() {
    setRefreshing(true);
    load({ showSpinner: false });
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    load({ start: countRef.current, append: true, showSpinner: false });
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث بالاسم أو رمز المنتج..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('VendorProductEdit', { itemCode: null })}
          style={styles.addBtn}
        >
          <Icon name="add" size={22} color={Colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={vendorStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={vendorStyles.column}>
          <Text style={[vendorStyles.hint, textStart]}>
            {total} منتج {search ? `يطابق «${search}»` : 'في متجرك'}
          </Text>

          {loading && items.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل المنتجات...</Text>
            </View>
          ) : items.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title={search ? 'لا توجد نتائج' : 'لا توجد منتجات بعد'}
              description={
                search
                  ? 'جرّب كلمة بحث أخرى.'
                  : 'أضف أول منتج إلى متجرك ليظهر للعملاء.'
              }
              actionLabel={search ? undefined : 'إضافة منتج'}
              onAction={search ? undefined : () => navigation.navigate('VendorProductEdit', { itemCode: null })}
            />
          ) : (
            <>
              {items.map((product) => (
                <TouchableOpacity
                  key={product.item_code}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('VendorProductEdit', { itemCode: product.item_code })}
                  style={styles.productRow}
                >
                  <View style={styles.productImage}>
                    <ProductImage
                      source={product.image || product.website_image || product.thumbnail}
                      style={styles.image}
                      resizeMode="contain"
                      fallbackIconSize={24}
                    />
                  </View>

                  <View style={vendorStyles.flex1}>
                    <Text style={[vendorStyles.value, textStart]} numberOfLines={2}>
                      {product.web_item_name || product.item_name || product.item_code}
                    </Text>
                    <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
                      {product.item_code}
                      {product.item_group ? ` · ${product.item_group}` : ''}
                    </Text>
                    <View
                      style={[
                        vendorStyles.badge,
                        {
                          marginTop: 6,
                          backgroundColor: Number(product.published) === 1
                            ? Colors.successContainer
                            : Colors.surfaceContainer,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          vendorStyles.badgeText,
                          textStart,
                          { color: Number(product.published) === 1 ? Colors.success : Colors.onSurfaceVariant },
                        ]}
                      >
                        {Number(product.published) === 1 ? 'منشور' : 'غير منشور'}
                      </Text>
                    </View>
                  </View>

                  <Icon name="chevron-back" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}

              {hasMore ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={vendorStyles.loadMoreBtn}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={[vendorStyles.loadMoreText, textStart]}>
                      عرض المزيد ({items.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
    padding: 0,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
    marginBottom: 10,
    ...Shadows.xs,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.outlineVariant,
  },
  image: { width: '88%', height: '88%' },
});
