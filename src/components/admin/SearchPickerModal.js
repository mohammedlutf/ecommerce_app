import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import styles from './editorStyles';
import { Colors } from '../../theme/colors';
import useDirectional from '../../hooks/useDirectional';

/**
 * SearchPickerModal — pick one value from a list that is too long to chip.
 *
 * This replaces the horizontal chip rows that item groups and units of measure
 * used to render. Both lists are unbounded in ERPNext — a shop can have hundreds
 * of groups and dozens of units — and a chip row wide enough to hold them is a
 * scrolling strip inside a scrolling form, with no way to jump to a value you
 * cannot see. A searchable list is the same control the rest of the app already
 * uses for a long list.
 *
 * Three details that matter more than they look:
 *
 * 1. The query is cleared on every open. Carrying the previous search over means
 *    the sheet opens already filtered to something invisible, and the admin
 *    concludes the option is gone.
 * 2. `options` are matched case-insensitively on a trimmed substring, so
 *    "pcs" finds "Pcs" and a stray leading space cannot hide the only match.
 * 3. The chosen value stays highlighted in the list, so the sheet answers "what
 *    is this set to" as well as "what can I change it to".
 */
export default function SearchPickerModal({
  visible,
  title,
  subtitle = '',
  options = [],
  value = '',
  onSelect,
  onClose,
  emptyText = 'لا توجد خيارات مطابقة.',
}) {
  const { textStart } = useDirectional();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => String(option).toLowerCase().includes(needle));
  }, [options, query]);

  const total = options.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, textStart]}>{title}</Text>
              <Text style={[styles.headerSubtitle, textStart]}>
                {subtitle || (total ? `${total} خيار متاح` : '')}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeBtn}>
              <Icon name="close" size={20} color={Colors.onSurface} />
            </Pressable>
          </View>

          {/* Search only earns its space once the list is long enough to need it.
              A single-digit UOM list does not, and a dead input reads as broken. */}
          {total > 8 ? (
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث..."
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="مسح البحث"
                  style={styles.searchClear}
                >
                  <Icon name="close-circle" size={20} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {filtered.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Icon name="search-outline" size={36} color={Colors.textMuted} />
                <Text style={[styles.centreText, textStart]}>
                  {total === 0 ? 'لا توجد خيارات متاحة.' : emptyText}
                </Text>
              </View>
            ) : (
              filtered.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={option}
                    onPress={() => onSelect(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      selected && styles.pickerRowSelected,
                      pressed && !selected && styles.pickerRowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,
                        textStart,
                        selected && styles.pickerRowTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option}
                    </Text>
                    {selected ? <Icon name="checkmark" size={20} color={Colors.primary} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}