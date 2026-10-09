import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import Icon from './Icon';
import { COUNTRIES, DEFAULT_COUNTRY, searchCountries, MAX_DIGITS } from '../constants/countries';
import useDirectional from '../hooks/useDirectional';

/**
 * CountryCodeInput — phone number field with a tappable dialling-code prefix.
 *
 * The prefix pill opens a searchable full-screen list of every supported
 * country. A full-screen modal (rather than a bottom sheet) is used on purpose:
 * the list needs the whole viewport, and it keeps the selection UI completely
 * clear of the keyboard that the search field raises.
 *
 * Country state is owned by the parent so validation can be country-aware, but
 * it is seeded with Yemen (+967) and works standalone if the parent ignores
 * `onChangeCountry`.
 */
export default function CountryCodeInput({
  value,
  onChangeText,
  country,
  onChangeCountry,
  placeholder = '771234567',
  maxLength = MAX_DIGITS,
  showLabel = true,
  style,
  autoFocus = false,
}) {
  const { textStart } = useDirectional();
  const [selected, setSelected] = useState(country || DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const active = country || selected;
  const insets = useSafeAreaInsets();

  const results = useMemo(() => searchCountries(COUNTRIES, query), [query]);

  function pick(next) {
    setSelected(next);
    onChangeCountry && onChangeCountry(next);
    setPickerOpen(false);
    setQuery('');
    Keyboard.dismiss();
  }

  function openPicker() {
    Keyboard.dismiss();
    setPickerOpen(true);
  }

  return (
    <>
      <View style={[styles.field, style]}>
        <Pressable
          onPress={openPicker}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel={`رمز الدولة ${active.nameAr} ${active.dial}`}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={[styles.flag, textStart]}>{active.flag}</Text>
          <Text style={[styles.dial, textStart]}>+{active.dial}</Text>
          <Icon name="chevron-down" size={14} color={Colors.onSurfaceVariant} />
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          value={value}
          onChangeText={(text) => onChangeText && onChangeText(text.replace(/[^0-9]/g, ''))}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          maxLength={maxLength}
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>

      {showLabel ? (
        <Pressable onPress={openPicker} style={styles.hintRow}>
          <Text style={[styles.hint, textStart]}>
            رمز الدولة: <Text style={[styles.hintStrong, textStart]}>+{active.dial}</Text>
          </Text>
          <Text style={[styles.hintAction, textStart]}>تغيير</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
        statusBarTranslucent={false}
      >
        <SafeAreaView style={styles.pickerRoot} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <View style={styles.pickerTitleWrap}>
              <Text style={[styles.pickerTitle, textStart]}>اختر الدولة</Text>
              <Text style={[styles.pickerSubtitle, textStart]}>
                رمز الدولة الحالي +{active.dial} — {active.nameAr}
              </Text>
            </View>
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <Icon name="close" size={20} color={Colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Icon name="search" size={18} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث عن دولة أو رمز"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.resultCount, textStart]}>
            {results.length === COUNTRIES.length
              ? `${COUNTRIES.length} دولة`
              : `${results.length} نتيجة`}
          </Text>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 16 },
            ]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, textStart]}>لا توجد دول مطابقة</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.code === active.code;
              return (
                <Pressable
                  onPress={() => pick(item)}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && styles.rowSelected,
                    pressed && !isSelected && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.rowFlag, textStart]}>{item.flag}</Text>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowName, textStart]} numberOfLines={1}>
                      {item.nameAr}
                    </Text>
                    <Text style={[styles.rowNameEn, textStart]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={[styles.rowDial, textStart]}>+{item.dial}</Text>
                  {isSelected ? (
                    <View style={styles.check}>
                      <Icon name="checkmark" size={14} color={Colors.onPrimary} />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 8,
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  pillPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  flag: {
    fontSize: 22,
  },
  dial: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.outlineVariant,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    paddingVertical: 0,
    textAlign: 'right',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: -4,
  },
  hint: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamily,
    color: Colors.textMuted,
  },
  hintStrong: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurfaceVariant,
  },
  hintAction: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },

  pickerRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  pickerTitleWrap: {
    flex: 1,
  },
  pickerTitle: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  pickerSubtitle: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamily,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    textAlign: 'right',
  },
  resultCount: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamily,
    color: Colors.textMuted,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 6,
  },
  listContent: {
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    marginBottom: 4,
  },
  rowSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  rowFlag: {
    fontSize: 26,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowName: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  rowNameEn: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamily,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rowDial: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurfaceVariant,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamily,
    color: Colors.textMuted,
  },
});
