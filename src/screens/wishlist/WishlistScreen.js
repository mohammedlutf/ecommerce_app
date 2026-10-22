import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import PageFooter from '../../components/layout/PageFooter';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { openProduct, openProducts } from '../../seo/linking';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';

export default function WishlistScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  useDocumentHead({ title: t('seo.wishlistTitle'), path: '/wishlist', noindex: true });
  const { isAuthenticated } = useAuth();
  const { items, loading, fetchWishlist } = useWishlist();
  const { showDesktopChrome } = useSiteChrome();
  const { width } = useWindowDimensions();
  const columns = showDesktopChrome ? (width >= 1200 ? 5 : width >= 900 ? 4 : 3) : 2;

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <EmptyState
          icon="lock-closed-outline"
          title="تسجيل الدخول مطلوب"
          description="يرجى تسجيل الدخول لعرض قائمة رغباتك والمنتجات المفضلة لديك."
          actionLabel="تسجيل الدخول الآن"
          onAction={() => navigation.navigate('AccountTab')}
        />
      </SafeAreaView>
    );
  }
 
  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      {showDesktopChrome ? null : (
        <View style={styles.header}>
          <Text style={[styles.title, textStart]}>قائمة رغباتي ({items.length})</Text>
        </View>
      )}

      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, textStart]}>جاري تحميل قائمة الرغبات...</Text>
        </View>
      ) : (
        /*
         * `ListFooterComponent` is where PageFooter goes: Expo's web reset makes
         * the body non-scrolling, so the footer only stays reachable if it is
         * inside the list rather than beside it.
         */
        <FlatList
          data={items}
          keyExtractor={(item, index) => item.item_code || item.name || String(index)}
          numColumns={columns}
          key={`wishlist-grid-${columns}`}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
          contentContainerStyle={[styles.listContent, showDesktopChrome && styles.listContentWide]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchWishlist}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.gridColumn, { width: `${100 / columns}%` }]}>
              <ProductCard
                product={item}
                onPress={() => openProduct(navigation, item.item_code || item.name)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="لا توجد منتجات مفضلة"
              description="تصفح المنتجات وأضفها إلى قائمتك لتظهر هنا."
              actionLabel="تصفح المنتجات"
              onAction={() => openProducts(navigation)}
            />
          }
          ListFooterComponent={showDesktopChrome ? <PageFooter /> : null}
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
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  title: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
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
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  listContentWide: {
    paddingHorizontal: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  gridColumn: {
    padding: 6,
  },
});
