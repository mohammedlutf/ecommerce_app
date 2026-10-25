import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
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

  // Image tile — square thumbnail with label (used on the Home screen), or a
  // full-width feature card when the desktop homepage lays the same tiles out in
  // a grid.
  const isGrid = variant === 'grid';
  const imageSrc =
    typeof category === 'object' && category
      ? category.image || category.website_image || category.icon || null
      : null;
  const style = pickStyle(name);

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => onSelect && onSelect(name)}
      className={isGrid ? 'hover-lift' : undefined}
      style={[styles.tile, isGrid && styles.gridTile]}
    >
      <View
        style={[
          isGrid ? styles.gridImageWrap : styles.imageWrap,
          isSelected && styles.imageWrapSelected,
          { backgroundColor: style.colors[0] },
        ]}
      >
        {imageSrc ? (
          <ProductImage
            source={imageSrc}
            style={styles.image}
            resizeMode="cover"
            fallbackIcon="pricetags-outline"
            fallbackIconSize={isGrid ? 36 : 26}
          />
        ) : (
          <LinearGradient
            colors={style.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            {style.icon ? (
              <Icon
                name={style.icon}
                size={isGrid ? 36 : 26}
                color={Colors.primaryDark}
              />
            ) : (
              <Text
                style={[styles.monogram, isGrid && styles.gridMonogram, textStart]}
              >
                {style.monogram}
              </Text>
            )}
          </LinearGradient>
        )}

        {isSelected && (
          <View style={styles.checkBadge}>
            <Icon name="checkmark" size={9} color="#ffffff" />
          </View>
        )}
      </View>

      <Text
        style={[
          styles.name,
          isGrid && styles.gridName,
          isSelected && styles.nameSelected,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {count !== null && count !== undefined ? (
        <Text
          style={[styles.count, isGrid && styles.gridCount, textStart]}
          numberOfLines={1}
        >
          {count}
        </Text>
      ) : isGrid ? (
        // Keep every desktop card the same height when a department arrives
        // without a product count.
        <View style={styles.gridCountSpacer} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Tile variant
  tile: {
    alignItems: 'center',
    gap: 7,
  },
  gridTile: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.xs,
  },
  imageWrap: {
    width: 92,
    height: 92,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.xs,
  },
  gridImageWrap: {
    width: '100%',
    aspectRatio: 1.3,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  imageWrapSelected: {
    borderWidth: 2.5,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  image: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primaryDark,
  },
  gridMonogram: {
    fontSize: Typography.sizes.displayLg,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  name: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 92,
  },
  gridName: {
    width: '100%',
    maxWidth: '100%',
    marginTop: 2,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
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
  gridCount: {
    marginTop: 0,
  },
  gridCountSpacer: {
    height: 14,
  },

  // Chip variant — child sub-category micro-pills (height ~30dp, compact, non-bulky)
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 4,
  },
  chipActive: {
    backgroundColor: Colors.primaryLight || '#E8F5EE',
    borderColor: Colors.primary,
  },
  chipInactive: {
    backgroundColor: Colors.surfaceContainerLowest || '#ffffff',
    borderColor: Colors.outlineVariant || '#E2E8F0',
  },
  // Parent group variant: Minimalist Compact Tabs with sleek bottom indicator line
  chipUnderlineActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: Colors.primary,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  chipUnderlineInactive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  chipTextInactive: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  chipTextUnderlineActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
    fontSize: 13,
  },
  chipTextUnderlineInactive: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    fontSize: 13,
  },
  chipBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(0, 65, 41, 0.1)',
  },
  chipBadgeInactive: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  chipBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilyBold,
  },
  chipBadgeTextActive: { color: Colors.primary },
  chipBadgeTextInactive: { color: Colors.textMuted },
});