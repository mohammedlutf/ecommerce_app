import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
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
      <View style={[styles.iconCircle, { backgroundColor: Colors.primaryContainer }]}>
        <Icon name={icon} size={38} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity activeOpacity={0.85} onPress={onAction} style={styles.actionBtn}>
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
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 300,
    fontFamily: Typography.fontFamilyRegular,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  actionText: {
    color: '#ffffff',
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
});