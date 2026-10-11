import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';

export default function QuantityStepper({
  quantity = 1,
  onIncrement,
  onDecrement,
  min = 0,
  max = 999,
  loading = false,
  size = 'md', // 'sm' | 'md' | 'lg'
}) {
  const isMin = quantity <= min;
  const isMax = quantity >= max;

  const isLg = size === 'lg';
  const isSm = size === 'sm';

  return (
    <View style={[styles.container, isSm && styles.containerSm, isLg && styles.containerLg]}>
      <TouchableOpacity
        activeOpacity={0.65}
        onPress={onDecrement}
        disabled={isMin}
        style={[
          styles.button,
          isSm && styles.buttonSm,
          isLg && styles.buttonLg,
          isMin && styles.buttonDisabled,
        ]}
      >
        <Icon
          name="remove"
          size={isSm ? 14 : isLg ? 20 : 16}
          color={isMin ? Colors.outlineVariant : Colors.primary}
        />
      </TouchableOpacity>

      <View style={[styles.quantityWrapper, isSm && styles.quantityWrapperSm, isLg && styles.quantityWrapperLg]}>
        <Text
          style={[
            styles.quantityText,
            isSm && styles.quantityTextSm,
            isLg && styles.quantityTextLg,
          ]}
        >
          {quantity}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.65}
        onPress={onIncrement}
        disabled={isMax}
        style={[
          styles.button,
          isSm && styles.buttonSm,
          isLg && styles.buttonLg,
          isMax && styles.buttonDisabled,
        ]}
      >
        <Icon
          name="add"
          size={isSm ? 14 : isLg ? 20 : 16}
          color={isMax ? Colors.outlineVariant : Colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 3,
    alignSelf: 'flex-start',
    ...Shadows.xs,
  },
  containerSm: {
    borderRadius: Radius.full,
    padding: 2,
  },
  containerLg: {
    borderRadius: Radius.full,
    padding: 4,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  buttonSm: {
    width: 26,
    height: 26,
  },
  buttonLg: {
    width: 40,
    height: 40,
  },
  buttonDisabled: {
    backgroundColor: Colors.surfaceContainerLow,
    opacity: 0.6,
  },
  quantityWrapper: {
    minWidth: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityWrapperSm: {
    minWidth: 26,
    paddingHorizontal: 4,
  },
  quantityWrapperLg: {
    minWidth: 44,
    paddingHorizontal: 10,
  },
  quantityText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  quantityTextSm: {
    fontSize: Typography.sizes.bodySm,
  },
  quantityTextLg: {
    fontSize: Typography.sizes.titleMd,
  },
});