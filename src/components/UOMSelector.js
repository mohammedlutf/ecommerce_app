import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

/**
 * UOMSelector — responsive single-row pill switcher for product pack sizes.
 * Falls back to displaying stockUom if uoms list is empty or has a single item.
 */
export default function UOMSelector({
  uoms = [],
  stockUom,
  selectedUom,
  onSelectUom,
  disabled = false,
}) {
  // If there are no uoms at all, but we have a stockUom, display it as a single static badge
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

  // If there's only 1 uom, display it nicely using the stockUom or the single item
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
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#EDF3ED',
    padding: 4,
    borderRadius: 8,
    gap: 4,
    marginVertical: 6,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#ffffff', // Matches emerald-mint style
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
    color: '#334155', // Matches charcoal-ink style
    fontWeight: '500',
  },
});