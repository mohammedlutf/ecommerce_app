import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { getImageUrl } from '../api/client';
import { blurhashToDataUri } from '../utils/blurhash';

/**
 * A product photo with a graceful, dependency-free loading experience.
 *
 * Native `Image` (kept deliberately — no `expo-image` and no native rebuild,
 * see OVERHAUL_PLAN.md) gives no placeholder, no fade and no fallback, so a
 * catalogue of 24 cards flashes empty boxes and shows a broken icon when a
 * request fails. This wraps it with three things:
 *
 *   1. a blurhash placeholder, decoded to a tiny PNG data URI in JS, shown
 *      until the real photo is decoded;
 *   2. a short cross-fade so photos settle in instead of popping;
 *   3. an icon fallback when the URL is missing or the image errors.
 *
 * The wrapper is a plain `View` carrying the caller's `style`; the layers are
 * absolutely positioned inside it, so existing call sites keep their layout.
 */
export default function ProductImage({
  source,
  blurhash,
  style,
  resizeMode = 'cover',
  fallbackIcon = 'bag-handle-outline',
  fallbackIconSize = 42,
  fallbackIconColor = Colors.textMuted,
  fadeDuration = 220,
  onLoad,
  onError,
  ...rest
}) {
  const uri = getImageUrl(source);
  const placeholderUri = blurhashToDataUri(blurhash);
  const opacity = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  // A new URI is a new image: reset the fade and the error state so a recycled
  // card does not show the previous product's photo through the new one.
  useEffect(() => {
    opacity.setValue(0);
    setFailed(false);
  }, [uri, opacity]);

  function handleLoad(event) {
    Animated.timing(opacity, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start();
    if (onLoad) onLoad(event);
  }

  function handleError(event) {
    setFailed(true);
    if (onError) onError(event);
  }

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, style]}>
        {placeholderUri ? (
          <Image source={{ uri: placeholderUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <Icon name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <View style={style}>
      {placeholderUri ? (
        <Image source={{ uri: placeholderUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <Animated.Image
        {...rest}
        source={{ uri }}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
        style={[StyleSheet.absoluteFill, { opacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
