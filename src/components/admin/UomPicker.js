import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import styles from './editorStyles';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * Chooses a Unit of Measure to add to a product.
 *
 * Already-used units are filtered out rather than disabled: the list is short,
 * and a disabled row with no explanation reads as a broken control. A search
 * field is unnecessary for the same reason — the UOM list in ERPNext is tens of
 * entries, not thousands.
 */
export default function UomPicker({ visible, options, onPick, onClose }) {
  const { textStart } = useDirectional();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, textStart]}>اختر وحدة القياس</Text>
              <Text style={[styles.headerSubtitle, textStart]}>{options.length ? `${options.length} وحدة متاحة` : ''}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeBtn}>
              <Icon name="close" size={20} color={Colors.onSurface} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {options.length === 0 ? (
              <View style={styles.centre}>
                <Icon name="checkmark-done-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.centreText}>
                  كل وحدات القياس المفعّلة مستخدمة في هذا المنتج بالفعل.
                </Text>
              </View>
            ) : (
              options.map((uom) => (
                <Pressable
                  key={uom}
                  onPress={() => onPick(uom)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.section,
                    { paddingVertical: Spacing.md },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.uomName, textStart]}>{uom}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
