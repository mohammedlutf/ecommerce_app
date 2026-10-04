import React from 'react';
import { Text, Image, TouchableOpacity, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import { getImageUrl } from '../api/client';
import useDirectional from '../hooks/useDirectional';

// Soft, friendly gradient pair per common category (fallback when no image).
const CATEGORY_STYLES = {
  'الكل': { icon: 'grid', colors: ['#DCFCE7', '#BBF7D0'] },
  'خضروات': { icon: 'leaf-outline', colors: ['#DCFCE7', '#A7F3D0'] },
  'فواكه': { icon: 'nutrition-outline', colors: ['#FEF3C7', '#FDE68A'] },
  'ألبان': { icon: 'water-outline', colors: ['#DBEAFE', '#BFDBFE'] },
  'حليب': { icon: 'water-outline', colors: ['#DBEAFE', '#BFDBFE'] },
  'مخبوزات': { icon: 'cafe-outline', colors: ['#FDE68A', '#FCD34D'] },
  'حلويات': { icon: 'ice-cream-outline', colors: ['#FCE7F3', '#FBCFE8'] },
  'لحوم': { icon: 'restaurant-outline', colors: ['#FEE2E2', '#FECACA'] },
  'دجاج': { icon: 'egg-outline', colors: ['#FFEDD5', '#FED7AA'] },
  'مشروبات': { icon: 'cup-outline', colors: ['#E0E7FF', '#C7D2FE'] },
  'عصائر': { icon: 'wine-outline', colors: ['#FFEDD5', '#FDBA74'] },
  'ماء': { icon: 'water', colors: ['#CFFAFE', '#A5F3FC'] },
  'أرز': { icon: 'grain-outline', colors: ['#F5F5F4', '#E7E5E4'] },
  'حبوب': { icon: 'grain-outline', colors: ['#F5F5F4', '#E7E5E4'] },
  'زيوت': { icon: 'flask-outline', colors: ['#FEF9C3', '#FDE68A'] },
  'بهارات': { icon: 'sparkles-outline', colors: ['#FFE4E6', '#FECDD3'] },
  'مجمدة': { icon: 'snow-outline', colors: ['#E0F2FE', '#BAE6FD'] },
  'منظفات': { icon: 'sparkles', colors: ['#F3E8FF', '#DDD6FE'] },
  'عناية شخصية': { icon: 'heart-outline', colors: ['#FCE7F3', '#FBCFE8'] },
  'معلبات': { icon: 'archive-outline', colors: ['#ECFDF5', '#A7F3D0'] },
};

function pickStyle(name) {
  if (CATEGORY_STYLES[name]) return CATEGORY_STYLES[name];
  const palette = [
    ['#DCFCE7', '#BBF7D0'],
    ['#FEF3C7', '#FDE68A'],
    ['#DBEAFE', '#BFDBFE'],
    ['#FCE7F3', '#FBCFE8'],
    ['#FFEDD5', '#FED7AA'],
    ['#E0E7FF', '#C7D2FE'],
  ];
  const seed = name ? name.charCodeAt(0) + name.length : 0;
  const colors = palette[seed % palette.length];
  const monogram = name ? name.charAt(0) : '؟';
  return { monogram, colors };
}

export default function CategoryCard({
  category,
  isSelected,
  onSelect,
  variant = 'tile',
  chipActiveStyle = 'pill',
}) {
  const { textStart } = useDirectional();
  const name = typeof category === 'string' ? category : category.name;
  const count = category && category.count ? category.count : null;

  // Text chip — compact, no image (used on the Products screen).
  if (variant === 'chip') {
    const underline = chipActiveStyle === 'underline';
    const chipStyle =
      underline
        ? isSelected ? styles.chipUnderlineActive : styles.chipUnderlineInactive
        : isSelected ? styles.chipActive : styles.chipInactive;
    const textStyle =
      underline
        ? isSelected ? styles.chipTextUnderlineActive : styles.chipTextUnderlineInactive
        : isSelected ? styles.chipTextActive : styles.chipTextInactive;
    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => onSelect && onSelect(name)}
        style={[styles.chip, chipStyle]}
      >
        <Text style={[styles.chipText, textStart, textStyle]} numberOfLines={1}>
          {name}
        </Text>
        {count !== null && count !== undefined && (
          <View style={[styles.chipBadge, isSelected ? styles.chipBadgeActive : styles.chipBadgeInactive]}>
            <Text
              style={[styles.chipBadgeText, textStart, isSelected ? styles.chipBadgeTextActive : styles.chipBadgeTextInactive]}
            >
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Image tile — square thumbnail with label (used on the Home screen).
  const rawImage =
    typeof category === 'object' && category
      ? category.image || category.website_image || category.icon || null
      : null;
  const imageSrc = getImageUrl(rawImage);
  const style = pickStyle(name);

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => onSelect && onSelect(name)}
      style={styles.tile}
    >
      <View
        style={[
          styles.imageWrap,
          isSelected && styles.imageWrapSelected,
          { backgroundColor: style.colors[0] },
        ]}
      >
        {imageSrc ? (
          <Image source={{ uri: imageSrc }} style={styles.image} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={style.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            {style.icon ? (
              <Icon name={style.icon} size={24} color={Colors.primaryDark} />
            ) : (
              <Text style={[styles.monogram, textStart]}>{style.monogram}</Text>
            )}
          </LinearGradient>
        )}

        {isSelected && (
          <View style={styles.checkBadge}>
            <Icon name="checkmark" size={9} color="#ffffff" />
          </View>
        )}
      </View>

      <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
        {name}
      </Text>
      {count !== null && count !== undefined && (
        <Text style={[styles.count, textStart]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Tile variant
  tile: {
    alignItems: 'center',
    gap: 6,
  },
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  imageWrapSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  image: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primaryDark,
  },
  checkBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: '100%',
  },
  nameSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  count: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    marginTop: -3,
  },

  // Chip variant
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 5,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipInactive: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderColor: Colors.outlineVariant,
  },
  // Underline variant — flat tab look for the parent groups: a green underline
  // for the active one, never a rounded green pill.
  chipUnderlineActive: {
    borderWidth: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: Colors.primary,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  chipUnderlineInactive: {
    borderWidth: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipTextActive: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  chipTextInactive: {
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipTextUnderlineActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  chipTextUnderlineInactive: {
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  chipBadgeInactive: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  chipBadgeText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  chipBadgeTextActive: { color: '#ffffff' },
  chipBadgeTextInactive: { color: Colors.textMuted },
});