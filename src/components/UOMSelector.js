import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

/**
 * UOMSelector — pill switcher for product pack sizes (حبة / كيلو / علبة ...).
 * Selecting a UOM changes the displayed rate on the parent card.
 */
export default function UOMSelector({
  uoms = [],
  selectedUom,
  onSelectUom,
  disabled = false,
  size = 'md', // 'sm' | 'md'
}) {
  if (!uoms || uoms.length <= 1) return null;

  return (
    <View style={styles.container}>
      {uoms.map((unit) => {
        const uomName = typeof unit === 'string' ? unit : unit.uom;
        const isSelected = uomName === selectedUom;

        return (
          <TouchableOpacity
            key={uomName}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => onSelectUom && onSelectUom(uomName, unit)}
            style={[
              styles.pill,
              size === 'sm' ? styles.pillSm : styles.pillMd,
              isSelected ? styles.pillActive : styles.pillInactive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                size === 'sm' ? styles.pillTextSm : styles.pillTextMd,
                isSelected ? styles.pillTextActive : styles.pillTextInactive,
              ]}
              numberOfLines={1}
            >
              {uomName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  pill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillMd: { paddingHorizontal: 14, paddingVertical: 6 },
  pillSm: { paddingHorizontal: 9, paddingVertical: 4 },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillInactive: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderColor: Colors.outlineVariant,
  },
  pillText: { fontFamily: Typography.fontFamilyMedium },
  pillTextMd: { fontSize: Typography.sizes.labelMd },
  pillTextSm: { fontSize: Typography.sizes.labelSm },
  pillTextActive: { color: Colors.onPrimary, fontFamily: Typography.fontFamilyBold },
  pillTextInactive: { color: Colors.onSurface, fontFamily: Typography.fontFamilyMedium },
});