import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
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

export default function WishlistScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  useDocumentHead({ title: t('seo.wishlistTitle'), path: '/wishlist', noindex: true });
  const { isAuthenticated } = useAuth();
  const { items, loading, fetchWishlist } = useWishlist();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={[styles.title, textStart]}>قائمة رغباتي ({items.length})</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primaryContainer} />
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
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchWishlist}
              colors={[Colors.primaryContainer]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.gridColumn}>
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

          ListFooterComponent={<PageFooter />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
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
    fontWeight: '800',
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
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  gridColumn: {
    width: '50%',
    padding: 6,
  },
});
