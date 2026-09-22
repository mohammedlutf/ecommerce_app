import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'ابحث عن المنتجات أو الفئات...',
}) {
  return (
    <View style={styles.container}>
      <Icon name="search" size={18} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
        returnKeyType="search"
        textAlign="right"
      />
      {value && value.length > 0 ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close-circle" size={18} color={Colors.outline} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    ...{
      shadowColor: '#0F1E2D',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    paddingVertical: 0,
    textAlign: 'right',
  },
  clearBtn: {
    padding: 2,
  },
});