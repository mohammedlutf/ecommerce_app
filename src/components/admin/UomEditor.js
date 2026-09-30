import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Icon from '../Icon';
import styles from './editorStyles';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

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
  function patch(index, key, value) {
    const next = uoms.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  }

  function remove(index) {
    // The stock UOM defines the conversion base, so removing it would leave the
    // remaining factors with nothing to be relative to.
    if (uoms[index].uom === stockUom) return;
    onChange(uoms.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.sectionTitle}>الوحدات والأسعار</Text>
        <Text style={styles.sectionHint}>
          معدل التحويل يحدد كم وحدة تخزينية تساوي وحدة العرض. تغيير سعر الوحدة الأساسية
          يغيّر الأسعار المشتقة للوحدات الأخرى.
        </Text>
      </View>

      <View style={styles.uomHeaderRow}>
        <Text style={[styles.uomHeaderLabel, { flex: 1.4 }]}>الوحدة</Text>
        <Text style={[styles.uomHeaderLabel, { flex: 1 }]}>معدل التحويل</Text>
        <Text style={[styles.uomHeaderLabel, { flex: 1 }]}>سعر البيع</Text>
      </View>

      {uoms.map((row, index) => {
        const isStock = row.uom === stockUom || row.is_stock_uom === 1;
        return (
          <View key={row.uom} style={styles.uomRow}>
            <View style={styles.uomRowHead}>
              <Text style={styles.uomName}>{row.uom}</Text>

              {isStock ? (
                <Text style={styles.uomTag}>الوحدة الأساسية</Text>
              ) : row.has_item_price === 1 ? (
                <Text style={styles.uomTag}>سعر مخزّن</Text>
              ) : (
                // Not a stored price. Say so, because an admin who edits this
                // number needs to know it will create a price row rather than
                // change one that already exists.
                <Text style={[styles.uomTag, styles.uomTagDerived]}>سعر مشتق</Text>
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
                <Text style={styles.uomFieldLabel}>معدل التحويل</Text>
                <TextInput
                  style={[
                    styles.uomInput,
                    isStock && { backgroundColor: Colors.surfaceContainer },
                  ]}
                  value={String(row.conversion_factor ?? '')}
                  onChangeText={(text) => patch(index, 'conversion_factor', text.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  editable={!isStock}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={[styles.uomField, { flex: 1 }]}>
                <Text style={styles.uomFieldLabel}>سعر البيع</Text>
                <TextInput
                  style={styles.uomInput}
                  value={String(row.price_list_rate ?? '')}
                  onChangeText={(text) => patch(index, 'price_list_rate', text.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
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
        <Text style={styles.imageActionText}>إضافة وحدة جديدة</Text>
      </Pressable>
    </View>
  );
}
