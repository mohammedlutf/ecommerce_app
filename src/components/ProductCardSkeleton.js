import React from 'react';
import { StyleSheet, View } from 'react-native';
import LoadingSkeleton from './LoadingSkeleton';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/spacing';

/**
 * How many placeholder cards a grid or rail draws.
 *
 * A fixed six rather than a multiple of the column count: six is one phone
 * screenful at two-up (three rows) and fills a wide window's first row too, and
 * a fixed number means the placeholder does not change shape as the window
 * crosses a breakpoint. The point is only to hold the space.
 */
export const SKELETON_CARDS = 6;

/**
 * ProductCardSkeleton — one product card's placeholder.
 *
 * It deliberately mirrors `ProductCard`'s vertical layout — the same card chrome,
 * the same image box, the same caption lines — so the grid does not jump when
 * the real cards replace it. The three inner blocks are the animated
 * `LoadingSkeleton`; the card around them is static, because a frame of pulsing
 * card outlines reads as a broken screen rather than as loading.
 *
 * `imageHeight` must be the same value the real grid passes to `ProductCard`
 * (`useGridMetrics().imageHeight` in the product screens), or the placeholder
 * and the cards it stands in for will not line up.
 */
export default function ProductCardSkeleton({ imageHeight = 140, style }) {
  return (
    <View style={[styles.card, style]}>
      {/* `borderRadius` is 0 on purpose: the card clips its own corners. */}
      <LoadingSkeleton height={imageHeight} borderRadius={0} />
      <View style={styles.caption}>
        <LoadingSkeleton height={16} width="85%" />
        <LoadingSkeleton height={14} width="40%" style={styles.captionLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    // Matches the bottom margin `ProductCard` carries itself, so a placeholder
    // occupies the same height as the card it stands in for.
    marginBottom: 12,
  },
  caption: {
    padding: 12,
  },
  captionLine: {
    marginTop: 6,
  },
});
