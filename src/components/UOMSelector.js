import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';

export default function UOMSelector({
  uoms = [],
  stockUom,
  selectedUom,
  onSelectUom,
  disabled = false,
  size = 'md', // 'sm' | 'md'
}) {
  const isSm = size === 'sm';

  if (!uoms || uoms.length === 0) {
    if (!stockUom) return null;
    return (
      <View style={[styles.singleContainer, isSm && styles.singleContainerSm]}>
        <View style={styles.singleIndicatorDot} />
        <Text style={[styles.singleText, isSm && styles.singleTextSm]} numberOfLines={1}>
          {stockUom}
        </Text>
      </View>
    );
  }

  const displayList = uoms.length === 1 && stockUom ? [stockUom] : uoms;

  if (displayList.length <= 1) {
    const singleName = typeof displayList[0] === 'string' ? displayList[0] : displayList[0]?.uom;
    if (!singleName) return null;

    return (
      <View style={[styles.singleContainer, isSm && styles.singleContainerSm]}>
        <View style={styles.singleIndicatorDot} />
        <Text style={[styles.singleText, isSm && styles.singleTextSm]} numberOfLines={1}>
          {singleName}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, isSm && styles.containerSm]}
      nestedScrollEnabled={true}
      directionalLockEnabled={true}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      {displayList.map((unit) => {
        const uomName = typeof unit === 'string' ? unit : unit.uom;
        const isSelected = uomName === selectedUom;

        return (
          <TouchableOpacity
            key={uomName}
            activeOpacity={0.75}
            disabled={disabled}
            onPress={() => onSelectUom && onSelectUom(uomName, unit)}
            style={[
              styles.pill,
              isSm && styles.pillSm,
              isSelected ? styles.pillActive : styles.pillInactive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                isSm && styles.pillTextSm,
                isSelected ? styles.pillTextActive : styles.pillTextInactive,
              ]}
              numberOfLines={1}
            >
              {uomName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceContainerLow || '#F1F5F3',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: Radius.full,
    gap: 5,
    marginVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.outlineVariant || 'rgba(0,0,0,0.06)',
  },
  singleContainerSm: {
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  singleIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  singleText: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  singleTextSm: {
    fontSize: 11,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow || '#F1F5F3',
    padding: 3,
    borderRadius: Radius.full,
    gap: 3,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 65, 41, 0.06)',
  },
  containerSm: {
    padding: 2,
    marginVertical: 2,
  },
  pill: {
    flexShrink: 0,
    minWidth: 48,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSm: {
    minWidth: 40,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pillActive: {
    backgroundColor: Colors.surfaceContainerLowest || '#ffffff',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 65, 41, 0.12)',
    ...Shadows.xs,
  },
  pillInactive: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 12,
    textAlign: 'center',
  },
  pillTextSm: {
    fontSize: 11,
  },
  pillTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  pillTextInactive: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
});