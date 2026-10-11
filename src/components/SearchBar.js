import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import useDirectional from '../hooks/useDirectional';

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  onFocus,
  onBlur,
  onPress,
  inputRef,
  autoFocus = false,
  asButton = false,
  placeholder = 'ابحث عن المنتجات أو الفئات...',
}) {
  const [isFocused, setIsFocused] = useState(false);
  const { textStart } = useDirectional();

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

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
        style={({ pressed }) => [
          styles.container,
          styles.shadow,
          pressed && styles.containerPressed,
        ]}
      >
        <View style={styles.iconWrapper}>
          <Icon name="search" size={19} color={Colors.primary} />
        </View>
        <Text style={[styles.placeholderText, textStart]} numberOfLines={1}>
          {placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        styles.shadow,
        isFocused && styles.containerFocused,
      ]}
    >
      <View style={styles.iconWrapper}>
        <Icon
          name="search"
          size={19}
          color={isFocused ? Colors.primary : Colors.textMuted}
        />
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={[styles.input, textStart]}
        returnKeyType="search"
      />
      {value && value.length > 0 ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onClear}
          style={styles.clearBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
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
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  shadow: {
    ...Shadows.sm,
  },
  containerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.focus,
  },
  containerPressed: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outline,
    transform: [{ scale: 0.99 }],
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
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