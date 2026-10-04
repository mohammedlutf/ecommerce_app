import React from 'react';
import { View, StyleSheet } from 'react-native';
import useResponsive from '../../hooks/useResponsive';
import { MAX_CONTENT_WIDTH, GUTTER } from '../../theme/responsive';

/**
 * Centred, width-capped content column.
 *
 * Every screen and every horizontal rail wraps its content in this. Without the
 * cap, a 2560px monitor renders one product card per row and forces the eye to
 * travel the entire viewport between the logo and the cart; without the
 * gutter, content touches the window edge on a phone.
 *
 * `bleed` opts a section out of the cap while keeping the gutter, which is what
 * full-bleed hero and carousel bands need.
 */
export default function Container({ children, style, maxWidth = MAX_CONTENT_WIDTH, bleed = false }) {
  const { gutter } = useResponsive();

  if (bleed) {
    return <View style={[styles.bleed, { paddingHorizontal: gutter }, style]}>{children}</View>;
  }

  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }, style]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
  bleed: {
    width: '100%',
    alignItems: 'center',
  },
});