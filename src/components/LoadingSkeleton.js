import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/spacing';

export default function LoadingSkeleton({
  width = '100%',
  height = 20,
  borderRadius = Radius.md,
  circle = false,
  style,
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const resolvedRadius = circle ? Radius.full : borderRadius;
  const resolvedHeight = circle ? width : height;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height: resolvedHeight,
          borderRadius: resolvedRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surfaceContainerHigh || '#E5E9E7',
  },
});
