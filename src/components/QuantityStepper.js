import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

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
        activeOpacity={0.7}
        onPress={onDecrement}
        disabled={isMin || loading}
        style={[styles.button, isSm && styles.buttonSm, isLg && styles.buttonLg, isMin && styles.buttonDisabled]}
      >
        <Icon name="remove" size={isSm ? 14 : 18} color={isMin ? Colors.outline : Colors.primary} />
      </TouchableOpacity>

      <View style={[styles.quantityWrapper, isSm && styles.quantityWrapperSm]}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text
            style={[
              styles.quantityText,
              isSm && styles.quantityTextSm,
              isLg && styles.quantityTextLg,
            ]}
          >
            {quantity}
          </Text>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onIncrement}
        disabled={isMax || loading}
        style={[styles.button, isSm && styles.buttonSm, isLg && styles.buttonLg, isMax && styles.buttonDisabled]}
      >
        <Icon name="add" size={isSm ? 14 : 18} color={isMax ? Colors.outline : Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  containerSm: { borderRadius: Radius.md },
  containerLg: { borderRadius: Radius.lg },
  button: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
  },
  buttonSm: { width: 30, height: 30 },
  buttonLg: { width: 44, height: 44 },
  buttonDisabled: { opacity: 0.45 },
  quantityWrapper: {
    minWidth: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityWrapperSm: { minWidth: 30 },
  quantityText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  quantityTextSm: { fontSize: Typography.sizes.bodySm },
  quantityTextLg: { fontSize: Typography.sizes.titleLg },
});