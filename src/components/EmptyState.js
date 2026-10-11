import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import useDirectional from '../hooks/useDirectional';

export default function EmptyState({
  icon = 'basket-outline',
  iconColor = Colors.primary,
  title = 'لا توجد عناصر',
  description = 'لم نتمكن من العثور على أي عناصر هنا حالياً.',
  actionLabel,
  onAction,
}) {
  const { textStart } = useDirectional();
  return (
    <View style={styles.container}>
      <View style={styles.iconOuterRing}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={40} color={iconColor} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAction}
          style={[styles.actionBtn, Shadows.sm]}
        >
          <Text style={[styles.actionText, textStart]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconOuterRing: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  title: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 320,
    fontFamily: Typography.fontFamilyRegular,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: Radius.full,
  },
  actionText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
});