import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Icon from '../../components/Icon';
import UomPicker from '../../components/admin/UomPicker';
import styles from '../../components/admin/editorStyles';
import AdminAPI from '../../api/admin';
import { captureProductImage } from '../../utils/productImage';
import { normaliseDecimalInput, parseDecimal, isPositiveNumber } from '../../utils/numbers';
import { useAdmin } from '../../context/AdminContext';
import { useToast } from '../../context/ToastContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

/**
 * AdminNewItemScreen — create a product.
 *
 * A full screen rather than a sheet: creating a product needs more fields than
 * editing one (item code, base unit, warehouse, the base price), and a keyboard
 * plus a camera plus a scrolling form does not fit inside a modal without
 * fighting it for space.
 *
 * Numbers are strings here for the same reason as in the editor — a conversion
 * factor of "0.25" has to be typeable.
 */
export default function AdminNewItemScreen({ navigation }) {
  const toast = useToast();
  const { isAdmin } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [references, setReferences] = useState({ item_groups: [], uom_list: [], warehouses: [] });
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemGroup, setItemGroup] = useState('');
  const [stockUom, setStockUom] = useState('');
  const [price, setPrice] = useState('');
  const [ranking, setRanking] = useState('0');
  const [warehouse, setWarehouse] = useState('');
  const [published, setPublished] = useState(true);
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [extraUoms, setExtraUoms] = useState([]);
  const [pendingImage, setPendingImage] = useState(null);
  const [showUomPicker, setShowUomPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await AdminAPI.getReferenceData();
      setReferences({
        item_groups: data.item_groups || [],
        uom_list: data.uom_list || [],
        warehouses: data.warehouses || [],
      });
      // Pre-select the first group and the first UOM. Requiring a tap on both
      // before the form is usable is friction on a form nobody is reading yet.
      setItemGroup((prev) => prev || (data.item_groups || [])[0] || '');
      setStockUom((prev) => prev || (data.uom_list || [])[0] || '');
      setWarehouse((prev) => prev || data.website_warehouse || (data.warehouses || [])[0] || '');
      setLoadError('');
    } catch (err) {
      setLoadError(err?.message || 'تعذر تحميل البيانات المرجعية');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A non-admin arriving here (deep link, or a session that just lost admin)
  // must not be left on a form whose every action would be rejected.
  useEffect(() => {
    if (!loading && !isAdmin) navigation.goBack();
  }, [loading, isAdmin, navigation]);

  async function handlePickImage(source) {
    try {
      const picked = await captureProductImage(source);
      if (picked) setPendingImage(picked);
    } catch (err) {
      toast.error(err?.message || 'تعذر فتح الكاميرا');
    }
  }

  function handleAddUom(uom) {
    setShowUomPicker(false);
    setExtraUoms((prev) => [...prev, { uom, conversion_factor: '1', price_list_rate: '' }]);
  }

  function validate() {
    if (!itemCode.trim()) return 'رمز المنتج مطلوب';
    if (!itemName.trim()) return 'اسم المنتج مطلوب';
    if (!itemGroup) return 'اختر تصنيف المنتج';
    if (!stockUom) return 'اختر وحدة القياس الأساسية';
    if (!isPositiveNumber(price)) return 'أدخل سعر بيع للوحدة الأساسية';

    for (const row of extraUoms) {
      if (!isPositiveNumber(row.conversion_factor)) {
        return `معدل التحويل للوحدة ${row.uom} يجب أن يكون أكبر من صفر`;
      }
      const rate = parseDecimal(row.price_list_rate);
      if (rate !== null && rate < 0) {
        return `سعر البيع للوحدة ${row.uom} غير صحيح`;
      }
    }
    return null;
  }

  async function handleCreate() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      // The base unit is part of the same list the editor sends, so one code
      // path builds Item Price rows for every unit instead of special-casing the
      // base unit on the client and again on the server.
      const uoms = [
        { uom: stockUom, conversion_factor: 1, price_list_rate: Number(price) },
        ...extraUoms.map((row) => {
          const entry = { uom: row.uom };

          // Sent only when genuinely typed. validate() has already rejected a
          // missing or non-positive factor, but omitting rather than coercing to
          // 0 keeps a bad value from ever reaching the backend.
          const factor = parseDecimal(row.conversion_factor);
          if (factor !== null) entry.conversion_factor = factor;

          // An extra unit with no price leaves the price unset rather than
          // sending 0, which the storefront would then read as a free item.
          const rate = parseDecimal(row.price_list_rate);
          if (rate !== null) entry.price_list_rate = rate;

          return entry;
        }),
      ];

      const result = await AdminAPI.createItem({
        itemCode: itemCode.trim(),
        itemName: itemName.trim(),
        itemGroup,
        stockUom,
        priceListRate: Number(price),
        ranking: Number(ranking || 0),
        websiteWarehouse: warehouse,
        shortDescription,
        webLongDescription: longDescription,
        published,
        uoms,
        imageBase64: pendingImage && pendingImage.base64,
        imageName: pendingImage && pendingImage.name,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const notes = (result && result.warnings) || [];
      if (notes.length > 0) {
        notes.forEach((note) => toast.error(note));
      } else {
        toast.success('تم إضافة المنتج بنجاح');
      }

      // Back rather than reset: the list screen refetches on savedTick, and
      // leaving the admin on an empty form invites a duplicate entry.
      navigation.goBack();
    } catch (err) {
      toast.error(err?.message || 'تعذر إضافة المنتج');
    } finally {
      setSaving(false);
    }
  }

  const availableUoms = (references.uom_list || []).filter(
    (uom) => uom !== stockUom && !extraUoms.some((row) => row.uom === uom)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centre}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.centreText}>{loadError}</Text>
          <Pressable onPress={load} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>صورة المنتج</Text>
            <View style={styles.imageFrame}>
              {pendingImage ? (
                <Image source={{ uri: pendingImage.uri }} style={styles.image} resizeMode="contain" />
              ) : (
                <Icon name="image-outline" size={44} color={Colors.textMuted} />
              )}
            </View>
            <View style={styles.imageActions}>
              <Pressable
                onPress={() => handlePickImage('camera')}
                style={({ pressed }) => [styles.imageAction, pressed && { opacity: 0.7 }]}
              >
                <Icon name="camera-outline" size={18} color={Colors.primary} />
                <Text style={styles.imageActionText}>الكاميرا</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickImage('library')}
                style={({ pressed }) => [styles.imageAction, pressed && { opacity: 0.7 }]}
              >
                <Icon name="images-outline" size={18} color={Colors.primary} />
                <Text style={styles.imageActionText}>المعرض</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>بيانات المنتج</Text>

            <View>
              <Text style={styles.label}>رمز المنتج (Item Code)</Text>
              <TextInput
                style={styles.input}
                value={itemCode}
                onChangeText={setItemCode}
                autoCapitalize="none"
                placeholder="eg. APPLE-RED-1KG"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View>
              <Text style={styles.label}>اسم المنتج</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View>
              <Text style={styles.label}>التصنيف</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipsRow}>
                  {(references.item_groups || []).map((group) => {
                    const selected = group === itemGroup;
                    return (
                      <Pressable
                        key={group}
                        onPress={() => setItemGroup(group)}
                        style={({ pressed }) => [
                          styles.chip,
                          selected && styles.chipSelected,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {group}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>سعر البيع للوحدة الأساسية</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={(text) => setPrice(normaliseDecimalInput(text))}
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View>
              <Text style={styles.label}>الترتيب في المتجر</Text>
              <TextInput
                style={styles.input}
                value={ranking}
                onChangeText={(text) => setRanking(text.replace(/[^0-9-]/g, ''))}
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {references.warehouses && references.warehouses.length > 0 ? (
              <View>
                <Text style={styles.label}>المستودع</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipsRow}>
                    {references.warehouses.map((w) => {
                      const selected = w === warehouse;
                      return (
                        <Pressable
                          key={w}
                          onPress={() => setWarehouse(w)}
                          style={({ pressed }) => [
                            styles.chip,
                            selected && styles.chipSelected,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{w}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الوحدة الأساسية</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
                {(references.uom_list || []).map((uom) => {
                  const selected = uom === stockUom;
                  return (
                    <Pressable
                      key={uom}
                      onPress={() => setStockUom(uom)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{uom}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>وحدات إضافية</Text>
            <Text style={styles.sectionHint}>
              اتركها فارغة إن كان المنتج بوحدة قياس واحدة فقط.
            </Text>

            {extraUoms.map((row, index) => (
              <View key={row.uom} style={styles.uomRow}>
                <View style={styles.uomRowHead}>
                  <Text style={styles.uomName}>{row.uom}</Text>
                  <Pressable
                    onPress={() => setExtraUoms((prev) => prev.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    style={styles.iconBtn}
                  >
                    <Icon name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                </View>
                <View style={styles.uomFieldsRow}>
                  <View style={styles.uomField}>
                    <Text style={styles.uomFieldLabel}>معدل التحويل</Text>
                    <TextInput
                      style={styles.uomInput}
                      value={row.conversion_factor}
                      onChangeText={(text) =>
                        setExtraUoms((prev) =>
                          prev.map((r, i) =>
                            i === index
                              ? { ...r, conversion_factor: normaliseDecimalInput(text) }
                              : r
                          )
                        )
                      }
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.uomField}>
                    <Text style={styles.uomFieldLabel}>سعر البيع</Text>
                    <TextInput
                      style={styles.uomInput}
                      value={row.price_list_rate}
                      onChangeText={(text) =>
                        setExtraUoms((prev) =>
                          prev.map((r, i) =>
                            i === index ? { ...r, price_list_rate: normaliseDecimalInput(text) } : r
                          )
                        )
                      }
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => setShowUomPicker(true)}
              style={({ pressed }) => [
                styles.imageAction,
                { borderStyle: 'dashed' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name="add" size={18} color={Colors.primary} />
              <Text style={styles.imageActionText}>إضافة وحدة</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الوصف</Text>
            <View>
              <Text style={styles.label}>وصف مختصر</Text>
              <TextInput
                style={styles.input}
                value={shortDescription}
                onChangeText={setShortDescription}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>الوصف الكامل</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={longDescription}
                onChangeText={setLongDescription}
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>نشر في المتجر مباشرة</Text>
                <Text style={styles.switchHint}>سيظهر المنتج للعملاء فور إنشائه.</Text>
              </View>
              <Switch
                value={published}
                onValueChange={setPublished}
                trackColor={{ true: Colors.primary, false: Colors.outlineVariant }}
                thumbColor={Colors.surface}
              />
            </View>
          </View>

          <View style={{ height: Spacing.xl }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={() => navigation.goBack()} disabled={saving} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </Pressable>
          <Pressable
            onPress={handleCreate}
            disabled={saving}
            accessibilityState={{ disabled: saving }}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && styles.saveBtnDisabled,
              pressed && !saving && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <Icon name="add-circle-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.saveText}>إنشاء المنتج</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <UomPicker
        visible={showUomPicker}
        options={availableUoms}
        onPick={handleAddUom}
        onClose={() => setShowUomPicker(false)}
      />
    </SafeAreaView>
  );
}
