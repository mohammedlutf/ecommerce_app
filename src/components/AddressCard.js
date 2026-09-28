import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import { parseCoords, formatCoordsForDisplay } from '../utils/geo';

/**
 * AddressCard — one saved delivery address.
 *
 * `onSelect` is for choosing an address (checkout). `onEdit` / `onDelete` /
 * `onSetDefault` are for managing them, and are only rendered when provided — so
 * the same card serves the cart (read/pick) and the account (manage) without
 * the management controls leaking into checkout.
 */
export default function AddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  busy = false,
}) {
  const coords = parseCoords(address.address_line2);
  // The pin's readable name is stored in `pincode`.
  const placeName = address.pincode;
  const manageable = !!(onEdit || onDelete || onSetDefault);

  return (
    <View style={[styles.card, isSelected ? styles.cardSelected : styles.cardUnselected]}>
      <TouchableOpacity
        activeOpacity={onSelect ? 0.85 : 1}
        onPress={onSelect ? () => onSelect(address) : undefined}
        disabled={!onSelect}
        accessibilityRole={onSelect ? 'button' : undefined}
        accessibilityState={onSelect ? { selected: !!isSelected } : undefined}
      >
        <View style={styles.headerRow}>
          <View style={styles.radioWrapper}>
            {onSelect ? (
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
            ) : (
              <Icon name="location" size={18} color={Colors.primary} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {address.address_title || 'عنوان التوصيل'}
            </Text>
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
          <Text style={styles.addressLineMuted}>{address.address_line2}</Text>
        ) : null}
        {placeName ? (
          <View style={styles.placeRow}>
            <Icon name="navigate-outline" size={13} color={Colors.primary} />
            <Text style={styles.placeText} numberOfLines={2}>
              {placeName}
            </Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {address.city ? (
            <View style={styles.infoPill}>
              <Icon name="business-outline" size={13} color={Colors.primary} />
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

        {coords ? (
          <Text style={styles.coords}>{formatCoordsForDisplay(coords)}</Text>
        ) : null}
      </TouchableOpacity>

      {manageable ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(address)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="تعديل العنوان"
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed, busy && styles.actionDisabled]}
            >
              <Icon name="create-outline" size={15} color={Colors.primary} />
              <Text style={styles.actionText}>تعديل</Text>
            </Pressable>
          ) : null}

          {onSetDefault && !address.is_primary_address ? (
            <Pressable
              onPress={() => onSetDefault(address)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="تعيين كعنوان أساسي"
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed, busy && styles.actionDisabled]}
            >
              <Icon name="star-outline" size={15} color={Colors.primary} />
              <Text style={styles.actionText}>أساسي</Text>
            </Pressable>
          ) : null}

          {onDelete ? (
            <Pressable
              onPress={() => onDelete(address)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="حذف العنوان"
              style={({ pressed }) => [styles.action, styles.actionDanger, pressed && styles.actionPressed, busy && styles.actionDisabled]}
            >
              <Icon name="trash-outline" size={15} color={Colors.error} />
              <Text style={[styles.actionText, styles.actionTextDanger]}>حذف</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
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
    gap: 8,
  },
  radioWrapper: {
    flex: 1,
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
    flex: 1,
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
    lineHeight: 21,
    marginBottom: 3,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
  },
  // `address_line2` holds the raw "lat,lng" pin. It is kept small and muted:
  // it is diagnostic detail, not something a customer needs to read.
  addressLineMuted: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
    textAlign: 'left',
    marginBottom: 2,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 4,
  },
  placeText: {
    flex: 1,
    fontSize: Typography.sizes.labelMd,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyMedium,
    lineHeight: 18,
    textAlign: 'left',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  coords: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
    marginTop: 6,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryContainer,
  },
  actionDanger: {
    backgroundColor: Colors.errorContainer,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onPrimaryContainer,
  },
  actionTextDanger: {
    color: Colors.error,
  },
});
