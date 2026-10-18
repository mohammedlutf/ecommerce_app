import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import UomEditor from '../../components/admin/UomEditor';
import UomPicker from '../../components/admin/SearchPickerModal';
import PickerField from '../../components/admin/PickerField';
import styles from '../../components/admin/editorStyles';
import VendorAPI from '../../api/vendor';
import { captureProductImage } from '../../utils/productImage';
import { normaliseDecimalInput, parseDecimal, isPositiveNumber } from '../../utils/numbers';
import { getImageUrl } from '../../api/client';
import { useVendor } from '../../context/VendorContext';
import { useToast } from '../../context/ToastContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * VendorProductEditScreen — create a product, or edit one of the shop's own.
 *
 * One screen for both directions, because the fields are the same and the only
 * real differences are the units control and the save call:
 *
 * - Create has no product yet, so the name doubles as the code (the server
 *   slugifies and de-duplicates it), the base unit and its price are asked for
 *   up front, and there is nothing to diff against — everything typed is new.
 * - Edit loads the existing payload and sends only what changed, so two people
 *   editing the same product cannot clobber each other's untouched fields.
 *
 * It reuses the admin editor's parts (`UomEditor`, `PickerField`, the shared
 * styles) rather than forking a second look for the same job. A vendor's product
 * is an admin's product with a shop stamped on it; the form should not pretend
 * otherwise.
 */
export default function VendorProductEditScreen({ navigation, route }) {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { isApproved } = useVendor();

  const itemCode = route?.params?.itemCode || null;
  const isEdit = !!itemCode;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [references, setReferences] = useState({
    item_groups: [],
    uom_list: [],
    warehouses: [],
    website_warehouse: '',
  });

  // Shared fields.
  const [itemName, setItemName] = useState('');
  const [itemGroup, setItemGroup] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [ranking, setRanking] = useState('0');
  const [published, setPublished] = useState(true);
  const [pendingImage, setPendingImage] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Create-only fields.
  const [stockUom, setStockUom] = useState('');
  const [price, setPrice] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [extraUoms, setExtraUoms] = useState([]);

  // Edit-only fields.
  const [uoms, setUoms] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [newRecommended, setNewRecommended] = useState('');
  const [original, setOriginal] = useState(null);

  const [showUomPicker, setShowUomPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showStockUomPicker, setShowStockUomPicker] = useState(false);

  // A conversion factor is a Precision field, so "0.25" must be typeable. The
  // nullish guard keeps "not stored" distinct from "stored as zero".
  const normaliseUoms = useCallback(
    (rows) =>
      (rows || []).map((row) => ({
        uom: row.uom,
        conversion_factor: String(row.conversion_factor ?? 1),
        price_list_rate: row.price_list_rate == null ? '' : String(row.price_list_rate),
        is_stock_uom: row.is_stock_uom,
        has_item_price: row.has_item_price,
      })),
    []
  );

  const applyPayload = useCallback(
    (payload) => {
      const item = payload.item || {};
      const websiteItem = payload.website_item || {};
      const rows = normaliseUoms(payload.uoms);
      const fallbackName = item.item_name || websiteItem.web_item_name || payload.item_code;

      setItemName(fallbackName || '');
      setItemGroup(item.item_group || '');
      setShortDescription(websiteItem.short_description || item.description || '');
      setLongDescription(websiteItem.web_long_description || '');
      setRanking(String(websiteItem.ranking || 0));
      setPublished(Number(websiteItem.published) === 1);
      setReferences(payload.references || { item_groups: [], uom_list: [] });
      setStockUom(item.stock_uom || '');
      setWarehouse(websiteItem.website_warehouse || payload.references?.website_warehouse || '');
      setUoms(rows);
      setRecommended(payload.recommended_items || []);

      setOriginal({
        itemName: fallbackName || '',
        itemGroup: item.item_group || '',
        shortDescription: websiteItem.short_description || item.description || '',
        longDescription: websiteItem.web_long_description || '',
        ranking: Number(websiteItem.ranking || 0),
        published: Number(websiteItem.published) === 1,
        image: item.image || websiteItem.website_image || '',
        stockUom: item.stock_uom || '',
        // Compared with the exact signature the live form builds, so "no change"
        // here cannot disagree with what the save would actually send.
        uoms: rows.map(
          (row) =>
            `${row.uom}:${parseDecimal(row.conversion_factor) ?? ''}:${
              Number(row.has_item_price) === 1 ? 1 : 0
            }:${parseDecimal(row.price_list_rate) ?? ''}`
        ),
        recommended: (payload.recommended_items || []).map((row) => row.item_code),
      });

      setWarnings([]);
    },
    [normaliseUoms]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (isEdit) {
        const payload = await VendorAPI.getProductPayload(itemCode);
        applyPayload(payload);
      } else {
        const data = await VendorAPI.getReferenceData();
        setReferences({
          item_groups: data.item_groups || [],
          uom_list: data.uom_list || [],
          warehouses: data.warehouses || [],
          website_warehouse: data.website_warehouse || '',
        });
        // Pre-select sensible defaults. Requiring two taps before the form is
        // usable is friction on a form nobody is reading yet.
        setItemGroup((prev) => prev || (data.item_groups || [])[0] || '');
        setStockUom((prev) => prev || (data.uom_list || [])[0] || '');
        setWarehouse((prev) => prev || data.website_warehouse || (data.warehouses || [])[0] || '');
      }
    } catch (err) {
      setLoadError(err?.message || 'تعذر تحميل بيانات المنتج');
    } finally {
      setLoading(false);
    }
  }, [isEdit, itemCode, applyPayload]);

  useEffect(() => {
    load();
  }, [load]);

  // A non-approved vendor (deep link, or a shop suspended mid-session) must not
  // be left on a form whose every action the server would reject.
  useEffect(() => {
    if (!loading && !isApproved) navigation.goBack();
  }, [loading, isApproved, navigation]);

  const availableUoms = useMemo(() => {
    if (isEdit) {
      const used = new Set(uoms.map((row) => row.uom));
      return (references.uom_list || []).filter((uom) => !used.has(uom));
    }
    return (references.uom_list || []).filter(
      (uom) => uom !== stockUom && !extraUoms.some((row) => row.uom === uom)
    );
  }, [isEdit, references, uoms, stockUom, extraUoms]);

  const previewImage = pendingImage
    ? pendingImage.uri
    : original && original.image
      ? getImageUrl(original.image)
      : '';

  async function handlePickImage(source) {
    try {
      const picked = await captureProductImage(source);
      if (!picked) return;
      setPendingImage(picked);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      toast.error(err?.message || 'تعذر فتح الكاميرا');
    }
  }

  function handleAddUom(uom) {
    setShowUomPicker(false);
    if (isEdit) {
      setUoms((prev) => [
        ...prev,
        { uom, conversion_factor: '1', price_list_rate: '', is_stock_uom: 0, has_item_price: 0 },
      ]);
    } else {
      setExtraUoms((prev) => [...prev, { uom, conversion_factor: '1', price_list_rate: '' }]);
    }
  }

  function handleAddRecommended() {
    const code = newRecommended.trim();
    if (!code) return;
    if (!itemCode) return;
    if (code === itemCode) {
      toast.error('لا يمكن إضافة المنتج نفسه كاقتراح');
      return;
    }
    if (recommended.some((row) => row.item_code === code)) {
      toast.error('هذا المنتج موجود في الاقتراحات بالفعل');
      return;
    }
    setRecommended((prev) => [...prev, { item_code: code, web_item_name: code, image: '', route: '' }]);
    setNewRecommended('');
  }

  // --- Validation and payload --------------------------------------------

  function validateCreate() {
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

  function buildCreatePayload() {
    // The base unit travels in the same list as the rest, so the server builds
    // Item Price rows for every unit along one code path instead of
    // special-casing the base unit here and again there.
    const uomRows = [
      { uom: stockUom, conversion_factor: 1, price_list_rate: Number(price) },
      ...extraUoms.map((row) => {
        const entry = { uom: row.uom };
        const factor = parseDecimal(row.conversion_factor);
        if (factor !== null) entry.conversion_factor = factor;
        const rate = parseDecimal(row.price_list_rate);
        // An extra unit with no price stays unset rather than becoming 0, which
        // the storefront would read as a free item.
        if (rate !== null) entry.price_list_rate = rate;
        return entry;
      }),
    ];

    return {
      itemCode: itemName.trim(),
      itemName: itemName.trim(),
      itemGroup,
      stockUom,
      priceListRate: Number(price),
      ranking: Number(ranking || 0),
      websiteWarehouse: warehouse,
      shortDescription,
      webLongDescription: longDescription,
      published,
      uoms: uomRows,
      imageBase64: pendingImage && pendingImage.base64,
      imageName: pendingImage && pendingImage.name,
    };
  }

  function buildUpdateChanges() {
    const changes = {};
    if (!original) return changes;

    if (itemName.trim() !== original.itemName) changes.item_name = itemName.trim();
    if (itemGroup !== original.itemGroup) changes.item_group = itemGroup;
    if (shortDescription !== original.shortDescription) changes.short_description = shortDescription;
    if (longDescription !== original.longDescription) changes.web_long_description = longDescription;
    if (Number(ranking || 0) !== original.ranking) changes.ranking = Number(ranking || 0);
    if (published !== original.published) changes.published = published ? 1 : 0;

    // `has_item_price` belongs in the signature: promoting a derived unit to a
    // stored one is itself a change, even when the stored figure equals the
    // derived one, and without it that edit would look like a no-op.
    const current = uoms.map(
      (row) =>
        `${row.uom}:${parseDecimal(row.conversion_factor) ?? ''}:${
          Number(row.has_item_price) === 1 ? 1 : 0
        }:${parseDecimal(row.price_list_rate) ?? ''}`
    );
    if (current.join('|') !== original.uoms.join('|')) {
      changes.uoms = uoms.map((row) => {
        const entry = { uom: row.uom };

        // Omitting a factor means "leave it as it is"; coercing a blank field to
        // 0 would overwrite a real conversion factor and fail validation.
        const factor = parseDecimal(row.conversion_factor);
        if (factor !== null && factor > 0) entry.conversion_factor = factor;

        // Only stored prices are sent. A derived price is shown read-only, and
        // an empty stored price is sent as-is rather than as 0, because 0 is a
        // real price that would overwrite whatever the database holds.
        const rate = parseDecimal(row.price_list_rate);
        if (Number(row.has_item_price) === 1 && rate !== null) entry.price_list_rate = rate;

        return entry;
      });
    }

    const codes = recommended.map((row) => row.item_code);
    if (codes.join('|') !== original.recommended.join('|')) {
      changes.recommended = codes.map((code) => ({ item_code: code }));
    }

    if (pendingImage) {
      changes.imageBase64 = pendingImage.base64;
      changes.imageName = pendingImage.name;
    }

    return changes;
  }

  function validateUpdate() {
    if (!itemName.trim()) return 'اسم المنتج مطلوب';
    if (!itemGroup) return 'اختر تصنيف المنتج';

    for (const row of uoms) {
      const isStock = row.uom === (original && original.stockUom) || row.is_stock_uom === 1;
      const factor = parseDecimal(row.conversion_factor);
      if (!isStock && !(factor !== null && factor > 0)) {
        return `معدل التحويل للوحدة ${row.uom} يجب أن يكون أكبر من صفر`;
      }
      const rate = parseDecimal(row.price_list_rate);
      if (Number(row.has_item_price) === 1 && rate !== null && rate < 0) {
        return `سعر البيع للوحدة ${row.uom} غير صحيح`;
      }
    }
    return null;
  }

  async function handleSave() {
    const problem = isEdit ? validateUpdate() : validateCreate();
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const changes = buildUpdateChanges();
        const result = await VendorAPI.updateProduct(itemCode, changes);
        const notes = (result && result.warnings) || [];
        setWarnings(notes);

        if (notes.length === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success('تم حفظ التعديلات');
          navigation.goBack();
          return;
        }
        // Saved, but with consequences the vendor needs to see next to the
        // fields that caused them. Keep the screen open.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        toast.success('تم الحفظ مع تنبيهات');
        return;
      }

      const result = await VendorAPI.createProduct(buildCreatePayload());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const notes = (result && result.warnings) || [];
      if (notes.length > 0) notes.forEach((note) => toast.error(note));
      else toast.success('تم إضافة المنتج بنجاح');

      // Back rather than reset: the list refetches on focus, and leaving an
      // empty form open invites a duplicate entry.
      navigation.goBack();
    } catch (err) {
      toast.error(err?.message || (isEdit ? 'تعذر حفظ التعديلات' : 'تعذر إضافة المنتج'));
    } finally {
      setSaving(false);
    }
  }

  // --- Render -------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.centre}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.centreText}>{loadError}</Text>
          <Pressable onPress={load} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, textStart]}>إعادة المحاولة</Text>
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {warnings.length > 0 ? (
            <View style={styles.warnings}>
              {warnings.map((note) => (
                <View key={note} style={{ flexDirection: 'row', gap: 6 }}>
                  <Icon name="warning-outline" size={15} color={Colors.warning} />
                  <Text style={[styles.warningText, textStart]}>{note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, textStart]}>صورة المنتج</Text>
            <View style={styles.imageFrame}>
              {previewImage ? (
                <Image source={{ uri: previewImage }} style={styles.image} resizeMode="contain" />
              ) : (
                <Icon name="image-outline" size={44} color={Colors.textMuted} />
              )}
              {pendingImage ? (
                <View style={styles.imageBadge}>
                  <Icon name="checkmark-circle" size={12} color={Colors.onPrimary} />
                  <Text style={[styles.imageBadgeText, textStart]}>بانتظار الحفظ</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.imageActions}>
              <Pressable
                onPress={() => handlePickImage('camera')}
                style={({ pressed }) => [styles.imageAction, pressed && { opacity: 0.7 }]}
              >
                <Icon name="camera-outline" size={18} color={Colors.primary} />
                <Text style={[styles.imageActionText, textStart]}>الكاميرا</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickImage('library')}
                style={({ pressed }) => [styles.imageAction, pressed && { opacity: 0.7 }]}
              >
                <Icon name="images-outline" size={18} color={Colors.primary} />
                <Text style={[styles.imageActionText, textStart]}>المعرض</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, textStart]}>بيانات المنتج</Text>

            <View>
              <Text style={[styles.label, textStart]}>اسم المنتج</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <PickerField
              label="التصنيف"
              value={itemGroup}
              placeholder="اختر تصنيف المنتج"
              required
              onPress={() => setShowGroupPicker(true)}
            />

            <View>
              <Text style={[styles.label, textStart]}>الترتيب في المتجر</Text>
              <TextInput
                style={styles.input}
                value={ranking}
                onChangeText={(text) => setRanking(text.replace(/[^0-9-]/g, ''))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {!isEdit && references.warehouses && references.warehouses.length > 0 ? (
              <View>
                <Text style={[styles.label, textStart]}>المستودع</Text>
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
                          <Text style={[styles.chipText, textStart, selected && styles.chipTextSelected]}>
                            {w}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>

          {isEdit ? (
            <UomEditor
              uoms={uoms}
              onChange={setUoms}
              onAddPress={() => setShowUomPicker(true)}
              stockUom={original ? original.stockUom : ''}
            />
          ) : (
            <View style={styles.section}>
              <View>
                <Text style={[styles.sectionTitle, textStart]}>الوحدات والأسعار</Text>
                <Text style={[styles.sectionHint, textStart]}>
                  حدّد وحدة القياس الأساسية وسعرها، ثم أضف وحدات أخرى إن كان المنتج يُباع
                  بأكثر من وحدة.
                </Text>
              </View>

              <PickerField
                label="وحدة القياس الأساسية"
                value={stockUom}
                placeholder="اختر وحدة القياس"
                required
                onPress={() => setShowStockUomPicker(true)}
              />

              <View>
                <Text style={[styles.label, textStart]}>سعر البيع للوحدة الأساسية</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={(text) => setPrice(normaliseDecimalInput(text))}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {extraUoms.map((row, index) => (
                <View key={row.uom} style={styles.uomRow}>
                  <View style={styles.uomRowHead}>
                    <Text style={[styles.uomName, textStart]}>{row.uom}</Text>
                    <Pressable
                      onPress={() => setExtraUoms((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityRole="button"
                      accessibilityLabel={`حذف الوحدة ${row.uom}`}
                      style={styles.iconBtn}
                    >
                      <Icon name="trash-outline" size={16} color={Colors.error} />
                    </Pressable>
                  </View>
                  <View style={styles.uomFieldsRow}>
                    <View style={styles.uomField}>
                      <Text style={[styles.uomFieldLabel, textStart]}>معدل التحويل</Text>
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
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={styles.uomField}>
                      <Text style={[styles.uomFieldLabel, textStart]}>سعر البيع</Text>
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
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <Pressable
                onPress={() => setShowUomPicker(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.imageAction,
                  { borderStyle: 'dashed' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon name="add" size={18} color={Colors.primary} />
                <Text style={[styles.imageActionText, textStart]}>إضافة وحدة</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, textStart]}>الوصف</Text>
            <View>
              <Text style={[styles.label, textStart]}>وصف مختصر</Text>
              <TextInput
                style={styles.input}
                value={shortDescription}
                onChangeText={setShortDescription}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View>
              <Text style={[styles.label, textStart]}>الوصف الكامل</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={longDescription}
                onChangeText={setLongDescription}
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {isEdit ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, textStart]}>منتجات مقترحة</Text>
              <Text style={[styles.sectionHint, textStart]}>
                اكتب رمز المنتج (Item Code) كما هو في النظام.
              </Text>

              {recommended.map((row) => (
                <View key={row.item_code} style={styles.listRow}>
                  <Text style={[styles.listRowText, textStart]} numberOfLines={1}>
                    {row.web_item_name || row.item_code}
                  </Text>
                  <Text style={[styles.uomHeaderLabel, textStart]}>{row.item_code}</Text>
                  <Pressable
                    onPress={() =>
                      setRecommended((prev) => prev.filter((r) => r.item_code !== row.item_code))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`حذف ${row.item_code}`}
                    style={styles.iconBtn}
                  >
                    <Icon name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newRecommended}
                  onChangeText={setNewRecommended}
                  autoCapitalize="none"
                  placeholder="Item Code"
                  placeholderTextColor={Colors.textMuted}
                />
                <Pressable onPress={handleAddRecommended} style={styles.uomInput} accessibilityRole="button">
                  <Icon name="add" size={20} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, textStart]}>منشور في المتجر</Text>
                <Text style={[styles.switchHint, textStart]}>
                  عند الإيقاف يختفي المنتج من التطبيق والموقع فوراً.
                </Text>
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
            <Text style={[styles.cancelText, textStart]}>إلغاء</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
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
                <Icon name={isEdit ? 'save-outline' : 'add-circle-outline'} size={18} color={Colors.onPrimary} />
                <Text style={[styles.saveText, textStart]}>
                  {isEdit ? 'حفظ التعديلات' : 'إنشاء المنتج'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <UomPicker
        visible={showUomPicker}
        title="إضافة وحدة قياس"
        options={availableUoms}
        onSelect={handleAddUom}
        onClose={() => setShowUomPicker(false)}
        emptyText="كل وحدات القياس المفعّلة مستخدمة في هذا المنتج بالفعل."
      />

      <UomPicker
        visible={showGroupPicker}
        title="اختر تصنيف المنتج"
        options={references.item_groups || []}
        value={itemGroup}
        onSelect={(group) => {
          setItemGroup(group);
          setShowGroupPicker(false);
        }}
        onClose={() => setShowGroupPicker(false)}
      />

      <UomPicker
        visible={showStockUomPicker}
        title="اختر وحدة القياس الأساسية"
        options={references.uom_list || []}
        value={stockUom}
        onSelect={(uom) => {
          setStockUom(uom);
          setShowStockUomPicker(false);
        }}
        onClose={() => setShowStockUomPicker(false)}
      />
    </SafeAreaView>
  );
}
