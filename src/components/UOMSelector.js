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
      <View style={styles.singleWrapper}>
        <Text style={[styles.singleText, isSm && styles.singleTextSm]} numberOfLines={1}>
          لكل {stockUom}
        </Text>
      </View>
    );
  }

  const displayList = uoms.length === 1 && stockUom ? [stockUom] : uoms;

  if (displayList.length <= 1) {
    const singleName = typeof displayList[0] === 'string' ? displayList[0] : displayList[0]?.uom;
    if (!singleName) return null;

    return (
      <View style={styles.singleWrapper}>
        <Text style={[styles.singleText, isSm && styles.singleTextSm]} numberOfLines={1}>
          لكل {singleName}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
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
              styles.chip,
              isSm && styles.chipSm,
              isSelected ? styles.chipSelected : styles.chipUnselected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isSm && styles.chipTextSm,
                isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
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
  singleWrapper: {
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  singleText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  singleTextSm: {
    fontSize: 10.5,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSm: {
    paddingVertical: 2.5,
    paddingHorizontal: 7.5,
  },
  chipSelected: {
    backgroundColor: Colors.primaryLight || '#E8F5EE',
    borderColor: Colors.primary,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: Colors.outlineVariant || '#E2E8F0',
  },
  chipText: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  chipTextSm: {
    fontSize: 10.5,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  chipTextUnselected: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
});