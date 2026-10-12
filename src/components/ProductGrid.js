import React, { useCallback, useMemo } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import ProductCard from './ProductCard';
import EmptyState from './EmptyState';
import useResponsive from '../hooks/useResponsive';
import { useI18n } from '../i18n/I18nContext';
import { Colors } from '../theme/colors';

/**
 * Image height as a fraction of card width.
 *
 * The product photo is what a shopper scans for, so it keeps a stable
 * proportion rather than a fixed pixel height — otherwise the same 140pt band
 * looks generous on a 160pt phone card and like a letterbox on a 280pt desktop
 * one.
 */
const IMAGE_RATIO = 0.78;

/** Narrowest a card may get before its price row stops being legible. */
const MIN_CARD_WIDTH = 150;

/**
 * Responsive product grid.
 *
 * ## Why cells are percentage-width rather than flex
 *
 * `FlatList` hands `numColumns` children to each row and ignores any width a
 * child asks for, so the gutter has to come from padding inside each cell plus a
 * matching negative margin on the row. Sizing cells with flex-basis instead
 * makes the final row's cells stretch to fill the row, which reads as a broken
 * grid whenever the item count is not a multiple of the column count.
 *
 * ## Column count
 *
 * Starts from `GRID_COLUMNS` for the breakpoint, then clamps against the window
 * width so a card never falls below `MIN_CARD_WIDTH`. The clamp uses the window
 * rather than the measured list, which over-estimates the space available once
 * the gutter and page padding are removed — but the error is in the safe
 * direction and only ever shows at narrow widths, where being conservative is
 * right.
 */
export default function ProductGrid({
  data,
  onPressProduct,
  ListHeaderComponent,
  ListFooterComponent,
  keyExtractor,
  loading = false,
  emptyTitle,
  emptyHint,
  emptyIcon = 'cube-outline',
  emptyActionLabel,
  emptyAction,
  columns: columnsOverride,
  gap: gapOverride,
}) {
  const { width, columns: responsiveColumns, gridGap } = useResponsive();
  const { t } = useI18n();

  const gap = gapOverride ?? gridGap;

  const columns = useMemo(() => {
    const base = columnsOverride ?? responsiveColumns;
    const maxByWidth = Math.floor(width / (MIN_CARD_WIDTH + gap));
    return Math.max(2, Math.min(base, maxByWidth));
  }, [columnsOverride, responsiveColumns, width, gap]);

  const cellStyle = useMemo(
    () => ({ width: `${100 / columns}%`, paddingHorizontal: gap / 2, paddingBottom: gap }),
    [columns, gap]
  );

  const rowStyle = useMemo(() => ({ marginHorizontal: -gap / 2 }), [gap]);

  // Card width in points: the window less both page gutters, divided by the
  // columns, less this cell's own horizontal padding. Feeds the image height so
  // the photo scales with the card instead of the viewport.
  const cardWidth = useMemo(
    () => (width - gap * 2) / columns - gap,
    [width, columns, gap]
  );
  const imageHeight = Math.max(110, Math.round(cardWidth * IMAGE_RATIO));

  const renderItem = useCallback(
    ({ item }) => (
      <View style={cellStyle}>
        <ProductCard product={item} imageHeight={imageHeight} onPress={onPressProduct} />
      </View>
    ),
    [cellStyle, imageHeight, onPressProduct]
  );

  const key = keyExtractor || ((item) => item.item_code || String(item));

  if (loading && (!data || data.length === 0)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle || t('products.noProducts')}
        description={emptyHint || t('products.noProductsHint')}
        actionLabel={emptyActionLabel}
        onAction={emptyAction}
      />
    );
  }

  return (
    <FlatList
      data={data}
      // Changing numColumns requires a remount: FlatList computes row layout
      // once from the initial column count and will not re-flow on a prop
      // change alone.
      key={`grid-${columns}`}
      renderItem={renderItem}
      keyExtractor={key}
      numColumns={columns}
      // Only legal on a multi-column list: react-native-web throws
      // "columnWrapperStyle not supported for single column lists" otherwise, and
      // an invariant failure during render unmounts the whole screen.
      columnWrapperStyle={columns > 1 ? rowStyle : undefined}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={columns * 4}
      maxToRenderPerBatch={columns * 4}
      updateCellsBatchingPeriod={50}
      windowSize={9}
      // VirtualizedList defaults this to true on Android, which is where
      // detaching off-screen rows actually saves memory. iOS and web keep it
      // off: on web the cells are percentage-width and clipping can blank
      // them, and iOS wins less from it than it costs in scroll jank.
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 8,
  },
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
  },
});