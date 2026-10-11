import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useDirectional from '../hooks/useDirectional';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';

export default function TrustBadge({ icon = 'rocket-outline', title, subtitle }) {
  const { textStart, rowFixed } = useDirectional();
  return (
    <View style={[styles.container, rowFixed]}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={22} color={Colors.primary} />
      </View>
      {/*
       * `rowFixed` keeps this pair in source order in both languages, so the copy
       * sits on the writing-direction edge and the icon beside it. A plain `row`
       * would mirror under RTL and strand the text away from the right edge,
       * because the icon would occupy it.
       */}
      <View style={[styles.textContainer, textStart]}>
        <Text style={[styles.title, textStart]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, textStart]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 14,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
    ...Shadows.xs,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1 },
  title: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },
});
