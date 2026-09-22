import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

export default function AddressCard({ address, isSelected, onSelect }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect && onSelect(address)}
      style={[styles.card, isSelected ? styles.cardSelected : styles.cardUnselected]}
    >
      <View style={styles.headerRow}>
        <View style={styles.radioWrapper}>
          <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.title}>{address.address_title || 'عنوان التوصيل'}</Text>
        </View>
        {address.is_primary_address ? (
          <View style={styles.primaryBadge}>
            <Icon name="star" size={11} color={Colors.onPrimary} />
            <Text style={styles.primaryBadgeText}>الأساسي</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.addressLine}>{address.address_line1}</Text>
      {address.address_line2 ? (
        <Text style={styles.addressLine}>{address.address_line2}</Text>
      ) : null}

      <View style={styles.footerRow}>
        {address.city ? (
          <View style={styles.infoPill}>
            <Icon name="location-outline" size={13} color={Colors.primary} />
            <Text style={styles.infoText}>{address.city}</Text>
          </View>
        ) : null}
        {address.phone ? (
          <View style={styles.infoPill}>
            <Icon name="call-outline" size={13} color={Colors.primary} />
            <Text style={styles.infoText}>{address.phone}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerLow,
  },
  cardUnselected: {
    borderColor: Colors.outlineVariant,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  radioWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  primaryBadgeText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  addressLine: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  infoText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyMedium,
  },
});