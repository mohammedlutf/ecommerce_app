import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';

const MIN_PILL_WIDTH = 52;

export default function UOMSelector({
  uoms = [],
  stockUom,
  selectedUom,
  onSelectUom,
  disabled = false,
}) {
  if (!uoms || uoms.length === 0) {
    if (!stockUom) return null;
    return (
      <View style={styles.container}>
        <View style={[styles.pill, styles.pillActive]}>
          <Text style={[styles.pillText, styles.pillTextActive]} numberOfLines={1}>
            {stockUom}
          </Text>
        </View>
      </View>
    );
  }

  const displayList = uoms.length === 1 && stockUom ? [stockUom] : uoms;

  if (displayList.length <= 1) {
    const singleName = typeof displayList[0] === 'string' ? displayList[0] : displayList[0]?.uom;
    if (!singleName) return null;

    return (
      <View style={styles.container}>
        <View style={[styles.pill, styles.pillActive]}>
          <Text style={[styles.pillText, styles.pillTextActive]} numberOfLines={1}>
            {singleName}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      // --- FIX FOR NESTED HORIZONTAL SCROLLING ---
      nestedScrollEnabled={true}
      directionalLockEnabled={true}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      // -------------------------------------------
    >
      {displayList.map((unit) => {
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
              isSelected ? styles.pillActive : styles.pillInactive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
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
  container: {
    flexDirection: 'row',
    flexGrow: 1,
    backgroundColor: Colors.surfaceContainerLow || '#EDF3ED',
    padding: 3,
    borderRadius: Radius.md,
    gap: 2,
    marginVertical: 2,
  },
  pill: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: MIN_PILL_WIDTH,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: Colors.surfaceContainerLowest || '#ffffff',
    ...Shadows.xs,
  },
  pillInactive: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 11,
    textAlign: 'center',
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