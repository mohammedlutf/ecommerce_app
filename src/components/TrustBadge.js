import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

export default function TrustBadge({ icon = 'rocket-outline', title, subtitle }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 13,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1 },
  title: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 2,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    textAlign: 'left',
    fontFamily: Typography.fontFamilyRegular,
  },
});