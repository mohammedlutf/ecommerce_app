import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

/**
 * Icon — single source of truth for app icons (Ionicons).
 * Keeps glyph + naming consistent across screens.
 */
export default function Icon({
  name,
  size = 22,
  color = Colors.onSurface,
  ...rest
}) {
  return <Ionicons name={name} size={size} color={color} {...rest} />;
}