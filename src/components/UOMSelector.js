import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

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
    backgroundColor: '#EDF3ED',
    padding: 3,
    borderRadius: 8,
    gap: 0,
    marginVertical: 2,
  },
  pill: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: MIN_PILL_WIDTH,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  pillInactive: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 11,
    textAlign: 'center',
  },
  pillTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  pillTextInactive: {
    color: '#334155',
    fontWeight: '500',
  },
});