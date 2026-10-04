import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import useDirectional from '../hooks/useDirectional';

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  onFocus,
  onPress,
  inputRef,
  autoFocus = false,
  asButton = false,
  placeholder = 'ابحث عن المنتجات أو الفئات...',
}) {
  const { textStart } = useDirectional();
  // Entry-point mode: this bar does not search, it hands over to a real search
  // field on another screen. Deliberately a Pressable and NOT a readOnly
  // TextInput: a non-editable TextInput is not focusable on Android, so `onFocus`
  // never fires and the bar is completely inert — which is exactly what a
  // readOnly version of this field did. A Pressable fires on both platforms.
  if (asButton) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      >
        <Icon name="search" size={18} color={Colors.textMuted} />
        <Text style={[styles.placeholderText, textStart]} numberOfLines={1}>
          {placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="search" size={18} color={Colors.textMuted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={[styles.input, textStart]}
        returnKeyType="search"
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
  containerPressed: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outline,
  },
  placeholderText: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },
});