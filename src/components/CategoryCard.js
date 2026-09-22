import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

export default function CategoryCard({ category, isSelected, onSelect }) {
  const name = typeof category === 'string' ? category : category.name;
  const count = category && category.count ? category.count : null;

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => onSelect && onSelect(name)}
      style={[styles.card, isSelected ? styles.cardActive : styles.cardInactive]}
    >
      <Text
        style={[styles.text, isSelected ? styles.textActive : styles.textInactive]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {count !== null && (
        <View style={[styles.badge, isSelected ? styles.badgeActive : styles.badgeInactive]}>
          <Text
            style={[styles.badgeText, isSelected ? styles.badgeTextActive : styles.badgeTextInactive]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 6,
  },
  cardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cardInactive: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderColor: Colors.outlineVariant,
  },
  text: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
  },
  textActive: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  textInactive: {
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyMedium,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  badgeInactive: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  badgeText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  badgeTextActive: { color: '#ffffff' },
  badgeTextInactive: { color: Colors.textMuted },
});