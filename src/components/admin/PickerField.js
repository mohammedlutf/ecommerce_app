import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../Icon';
import styles from './editorStyles';
import { Colors } from '../../theme/colors';
import useDirectional from '../../hooks/useDirectional';

/**
 * PickerField — a read-only field that opens a SearchPickerModal.
 *
 * Stands in for the input it replaces, so the form keeps the rhythm of a normal
 * labelled field: same height, same border, same typography. The only difference
 * a shopper can see is that the row is tappable and carries a chevron, and the
 * placeholder reads as an instruction rather than as a value.
 *
 * An unset field is styled differently from a set one on purpose. A field that
 * looks filled but is empty is indistinguishable from a real selection until the
 * form is submitted and rejected.
 */
export default function PickerField({ label, value, placeholder, onPress, required = false }) {
  const { textStart } = useDirectional();
  const hasValue = !!value;

  return (
    <View>
      <Text style={[styles.label, textStart]}>
        {label}
        {required ? <Text style={styles.pickerRequired}>{' *'}</Text> : null}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={hasValue ? `${label}: ${value}` : label}
        style={({ pressed }) => [
          styles.pickerField,
          !hasValue && styles.pickerFieldEmpty,
          pressed && styles.pickerFieldPressed,
        ]}
      >
        <Text
          style={[styles.pickerFieldText, textStart, !hasValue && styles.pickerFieldPlaceholder]}
          numberOfLines={1}
        >
          {hasValue ? value : placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}