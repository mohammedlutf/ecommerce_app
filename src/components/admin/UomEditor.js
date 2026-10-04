import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Icon from '../Icon';
import styles from './editorStyles';
import { normaliseDecimalInput } from '../../utils/numbers';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * The units-and-prices section of the product editor.
 *
 * Every field here is a *string* in state, converted once on save. The reason is
 * not stylistic: a conversion factor is a Precision field, so "0.25" must be
 * typeable. Backing these inputs with numbers makes the field delete the
 * trailing character the instant a "." is pressed, which makes fractional
 * conversion rates impossible to enter at all.
 */
export default function UomEditor({ uoms, onChange, onAddPress, stockUom }) {
  const { textStart } = useDirectional();
  // Units whose price the admin has chosen to store during this editing session,
  // keyed by UOM. Tracked separately from `has_item_price` so that "I just decided
  // to set this price" can be undone without touching a price that was already
  // stored before the sheet opened.
  const [newlyStored, setNewlyStored] = useState([]);

  function patch(index, key, value) {
    const next = uoms.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  }

  // Promote a derived unit to a stored one. The row is flagged so the diff treats
  // it as a change and the price actually gets sent — otherwise setting a price
  // that happens to equal the derived value would look like "nothing changed" and
  // silently never be written.
  function startSettingPrice(index) {
    patch(index, 'has_item_price', 1);
    setNewlyStored((prev) => (prev.includes(uoms[index].uom) ? prev : [...prev, uoms[index].uom]));
  }

  function cancelSettingPrice(index) {
    const uom = uoms[index].uom;
    patch(index, 'has_item_price', 0);
    setNewlyStored((prev) => prev.filter((u) => u !== uom));
  }

  function remove(index) {
    // The stock UOM defines the conversion base, so removing it would leave the
    // remaining factors with nothing to be relative to.
    if (uoms[index].uom === stockUom) return;
    onChange(uoms.filter((_, i) => i !== index));
    setNewlyStored((prev) => prev.filter((u) => u !== uoms[index].uom));
  }

  return (
    <View style={styles.section}>
      <View>
        <Text style={[styles.sectionTitle, textStart]}>الوحدات والأسعار</Text>
        <Text style={[styles.sectionHint, textStart]}>
          معدل التحويل يحدد كم وحدة تخزينية تساوي وحدة العرض. السعر المشتق محسوب من
          السعر الأساسي؛ اضغط «تعيين سعر» لحفظه كسعر مستقل للوحدة.
        </Text>
      </View>

      <View style={styles.uomHeaderRow}>
        <Text style={[styles.uomHeaderLabel, textStart, { flex: 1.4 }]}>الوحدة</Text>
        <Text style={[styles.uomHeaderLabel, textStart, { flex: 1 }]}>معدل التحويل</Text>
        <Text style={[styles.uomHeaderLabel, textStart, { flex: 1 }]}>سعر البيع</Text>
      </View>

      {uoms.map((row, index) => {
        const isStock = row.uom === stockUom || row.is_stock_uom === 1;
        // "Derived" means the storefront computes this price from the base price
        // and the conversion factor; there is no Item Price row behind it. So the
        // number is shown, but never offered as an input: typing into it would
        // create a stored price the admin did not intend, and leaving it alone
        // must not be read as "set it to zero".
        const isDerived = Number(row.has_item_price) !== 1;
        const hasPrice = String(row.price_list_rate ?? '') !== '';
        return (
          <View key={row.uom} style={styles.uomRow}>
            <View style={styles.uomRowHead}>
              <Text style={[styles.uomName, textStart]}>{row.uom}</Text>

              {isStock ? (
                <Text style={[styles.uomTag, textStart]}>الوحدة الأساسية</Text>
              ) : isDerived ? (
                <Text style={[styles.uomTag, textStart, styles.uomTagDerived]}>سعر مشتق</Text>
              ) : (
                <Text style={[styles.uomTag, textStart]}>سعر مخزّن</Text>
              )}

              {!isStock ? (
                <Pressable
                  onPress={() => remove(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`حذف الوحدة ${row.uom}`}
                  style={styles.iconBtn}
                >
                  <Icon name="trash-outline" size={16} color={Colors.error} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.uomFieldsRow}>
              <View style={[styles.uomField, { flex: 1 }]}>
                <Text style={[styles.uomFieldLabel, textStart]}>معدل التحويل</Text>
                <TextInput
                  style={[
                    styles.uomInput,
                    isStock && { backgroundColor: Colors.surfaceContainer },
                  ]}
                  value={String(row.conversion_factor ?? '')}
                  onChangeText={(text) =>
                    patch(index, 'conversion_factor', normaliseDecimalInput(text))
                  }
                  keyboardType="decimal-pad"
                  editable={!isStock}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={[styles.uomField, { flex: 1 }]}>
                <Text style={[styles.uomFieldLabel, textStart]}>سعر البيع</Text>
                {isDerived ? (
                  // Info first, editable on request. The computed price is shown
                  // as-is, and the admin can promote the unit to a stored price
                  // when the shop's real price differs from the derived one.
                  <View style={styles.uomInfo}>
                    <Text style={[styles.uomInfoValue, textStart]}>
                      {hasPrice ? String(row.price_list_rate) : '—'}
                    </Text>
                    <Text style={[styles.uomInfoNote, textStart]}>
                      {hasPrice ? 'محسوب من السعر الأساسي' : 'لا يوجد سعر مخزّن'}
                    </Text>
                    <Pressable
                      onPress={() => startSettingPrice(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`تعيين سعر للوحدة ${row.uom}`}
                      style={({ pressed }) => [
                        styles.uomSetPriceBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Icon name="create-outline" size={13} color={Colors.primary} />
                      <Text style={[styles.uomSetPriceText, textStart]}>تعيين سعر</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.uomField}>
                    {newlyStored.includes(row.uom) ? (
                      <Pressable
                        onPress={() => cancelSettingPrice(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`إلغاء تعيين سعر الوحدة ${row.uom}`}
                        style={styles.uomCancelPriceBtn}
                      >
                        <Icon name="close" size={12} color={Colors.onSurfaceVariant} />
                        <Text style={[styles.uomCancelPriceText, textStart]}>إلغاء التعيين</Text>
                      </Pressable>
                    ) : null}
                    <TextInput
                      style={styles.uomInput}
                      value={String(row.price_list_rate ?? '')}
                      onChangeText={(text) =>
                        patch(index, 'price_list_rate', normaliseDecimalInput(text))
                      }
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}

      <Pressable
        onPress={onAddPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.imageAction,
          { borderStyle: 'dashed' },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Icon name="add" size={18} color={Colors.primary} />
        <Text style={[styles.imageActionText, textStart]}>إضافة وحدة جديدة</Text>
      </Pressable>
    </View>
  );
}
