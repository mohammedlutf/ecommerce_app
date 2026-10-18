import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Icon from '../Icon';
import UomEditor from './UomEditor';
import UomPicker from './SearchPickerModal';
import PickerField from './PickerField';
import styles from './editorStyles';
import AdminAPI from '../../api/admin';
import { captureProductImage } from '../../utils/productImage';
import { parseDecimal } from '../../utils/numbers';
import { getImageUrl } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Spacing } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * AdminItemModal — edit one product across Item and Website Item.
 *
 * Two rules shape this component:
 *
 * 1. Only what actually changed is sent. `admin_update_item` treats every
 *    argument as optional, so submitting the whole form would let a stale editor
 *    overwrite a price or description another admin changed in the meantime.
 *
 * 2. Nothing is silently dropped. Server-side warnings (a group hidden from the
 *    website, a route that could not be rebuilt) are surfaced after saving,
 *    because every one of them makes the product behave differently from what
 *    the admin just saw on screen.
 */
export default function AdminItemModal({ visible, itemCode, onClose, onSaved }) {
  const { textStart } = useDirectional();
  const toast = useToast();

  // All hooks first, derived values after. A derived `const` sitting above the
  // `useState` it reads crashes at runtime while passing every syntax check.
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemGroup, setItemGroup] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [ranking, setRanking] = useState('0');
  const [published, setPublished] = useState(true);
  const [uoms, setUoms] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [newRecommended, setNewRecommended] = useState('');
  const [pendingImage, setPendingImage] = useState(null);

  const [references, setReferences] = useState({ item_groups: [], uom_list: [] });
  const [original, setOriginal] = useState(null);
  const [showUomPicker, setShowUomPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Numbers are held as strings so "0.25" is typeable, and `original` is kept in
  // a comparable shape so the diff below compares like with like.
  const normaliseUoms = useCallback(
    (rows) =>
      (rows || []).map((row) => ({
        uom: row.uom,
        conversion_factor: String(row.conversion_factor ?? 1),
        // Nullish stays empty rather than becoming "0": "no price stored" and
        // "a price of zero" are different facts, and collapsing them here is what
        // let a blank field overwrite a real price on save.
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

      setItemName(fallbackName);
      setItemGroup(item.item_group || '');
      setShortDescription(websiteItem.short_description || item.description || '');
      setLongDescription(websiteItem.web_long_description || '');
      setRanking(String(websiteItem.ranking || 0));
      setPublished(Number(websiteItem.published) === 1);
      setReferences(payload.references || { item_groups: [], uom_list: [] });
      setUoms(rows);
      setRecommended(payload.recommended_items || []);

      setOriginal({
        itemName: fallbackName,
        itemGroup: item.item_group || '',
        shortDescription: websiteItem.short_description || item.description || '',
        longDescription: websiteItem.web_long_description || '',
        ranking: Number(websiteItem.ranking || 0),
        published: Number(websiteItem.published) === 1,
        image: item.image || websiteItem.website_image || '',
        stockUom: item.stock_uom || '',
        // Compared with the same signature the live form uses, so "no change
        // detected" cannot disagree with the payload that actually gets sent.
        uoms: rows.map(
          (row) =>
            `${row.uom}:${parseDecimal(row.conversion_factor) ?? ''}:${Number(row.has_item_price) === 1 ? 1 : 0}:${parseDecimal(row.price_list_rate) ?? ''}`
        ),
        recommended: (payload.recommended_items || []).map((row) => row.item_code),
      });

      setWarnings([]);
    },
    [normaliseUoms]
  );

  // Reload on every open. Reading props on mount left the previous product's
  // prices sitting in the form when a different card was opened.
  useEffect(() => {
    if (!visible || !itemCode) return undefined;

    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setPendingImage(null);
    setNewRecommended('');
    setWarnings([]);

    AdminAPI.getItemPayload(itemCode)
      .then((payload) => {
        if (!cancelled) applyPayload(payload);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'تعذر تحميل بيانات المنتج');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, itemCode, applyPayload]);

  const availableUoms = useMemo(() => {
    const used = new Set(uoms.map((row) => row.uom));
    return (references.uom_list || []).filter((uom) => !used.has(uom));
  }, [references, uoms]);

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
    // A new unit starts at 1 with no price: 1 is the only factor that cannot be
    // wrong for an unknown relationship, and a blank price is visibly wrong in a
    // way that a made-up number would not be.
    setUoms((prev) => [
      ...prev,
      {
        uom,
        conversion_factor: '1',
        price_list_rate: '',
        is_stock_uom: 0,
        has_item_price: 0,
      },
    ]);
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

  function buildChanges() {
    const changes = {};
    if (!original) return changes;

    if (itemName.trim() !== original.itemName) changes.item_name = itemName.trim();
    if (itemGroup !== original.itemGroup) changes.item_group = itemGroup;
    if (shortDescription !== original.shortDescription) changes.short_description = shortDescription;
    if (longDescription !== original.longDescription) changes.web_long_description = longDescription;
    if (Number(ranking || 0) !== original.ranking) changes.ranking = Number(ranking || 0);
    if (published !== original.published) changes.published = published ? 1 : 0;

    // `has_item_price` is part of the signature because promoting a derived unit
    // to a stored one is itself a change. Without it, choosing "تعيين سعر" and
    // keeping the derived figure — the common case, since the shop usually starts
    // from that number — would produce an identical signature, nothing would be
    // sent, and the price would silently never be written.
    const current = uoms.map(
      (row) =>
        `${row.uom}:${parseDecimal(row.conversion_factor) ?? ''}:${Number(row.has_item_price) === 1 ? 1 : 0}:${parseDecimal(row.price_list_rate) ?? ''}`
    );
    if (current.join('|') !== original.uoms.join('|')) {
      changes.uoms = uoms.map((row) => {
        const entry = { uom: row.uom };

        // Sent only when the admin actually typed a positive number. An empty or
        // unparseable field used to be coerced to 0 here, which the backend
        // rejects for any non-stock unit ("conversion rate must be greater than
        // zero") and which would overwrite a real conversion factor besides.
        // Omitting it means "leave this factor as it is".
        const factor = parseDecimal(row.conversion_factor);
        if (factor !== null && factor > 0) entry.conversion_factor = factor;

        // Only send a price the admin can actually see and change. A derived
        // price is displayed read-only, so it is never sent — and an empty
        // stored price is sent as-is rather than as 0, because 0 is a real price
        // and would overwrite whatever the database actually holds.
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

  function validate(changes) {
    if (!itemName.trim()) return 'اسم المنتج مطلوب';
    if (!itemGroup) return 'اختر تصنيف المنتج';

    for (const row of uoms) {
      // The base unit is derived as 1 server-side, so its factor is not editable
      // and is not validated. Every other unit must carry a positive factor:
      // previously a blank field slipped through as 0 and failed on the server.
      const isStock = row.uom === (original && original.stockUom) || row.is_stock_uom === 1;
      const factor = parseDecimal(row.conversion_factor);

      if (!isStock && !(factor !== null && factor > 0)) {
        return `معدل التحويل للوحدة ${row.uom} يجب أن يكون أكبر من صفر`;
      }

      const rate = parseDecimal(row.price_list_rate);
      // Only stored prices are validated, since only those are ever sent.
      if (Number(row.has_item_price) === 1 && rate !== null && rate < 0) {
        return `سعر البيع للوحدة ${row.uom} غير صحيح`;
      }
    }

    if (Object.keys(changes).length === 0 && !pendingImage) return null;
    return null;
  }

  async function handleSave() {
    const changes = buildChanges();
    const problem = validate(changes);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      const result = await AdminAPI.updateItem(itemCode, changes);
      const notes = (result && result.warnings) || [];
      setWarnings(notes);

      if (notes.length === 0) {
        toast.success('تم حفظ التعديلات');
        // onSaved && onSaved(result);
        onSaved && onSaved({ ...result, itemCode, kind: 'updated' });
        onClose && onClose();
        return;
      }

      // Saved, but with consequences the admin needs to know about. Keep the
      // sheet open so the warnings sit next to the fields that caused them.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.success('تم الحفظ مع تنبيهات');
      onSaved && onSaved({ ...result, itemCode, kind: 'updated' });
    } catch (err) {
      toast.error(err?.message || 'تعذر حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, textStart]}>تعديل المنتج</Text>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeBtn}>
              <Icon name="close" size={20} color={Colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.centre}>
            <Icon name="alert-circle-outline" size={40} color={Colors.error} />
            <Text style={styles.centreText}>{loadError}</Text>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, textStart]}>إغلاق</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, textStart]}>تعديل المنتج</Text>
            <Text style={[styles.headerSubtitle, textStart]}>{itemCode}</Text>
          </View>
          <Pressable
            onPress={onClose}
            disabled={saving}
            accessibilityRole="button"
            style={styles.closeBtn}
          >
            <Icon name="close" size={20} color={Colors.onSurface} />
          </Pressable>
        </View>

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
            {loading ? (
              <View style={styles.centre}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.centreText}>جاري تحميل بيانات المنتج...</Text>
              </View>
            ) : (
              <>
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
                  <Text style={[styles.sectionTitle, textStart]}>البيانات الأساسية</Text>

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
                </View>

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

                <UomEditor
                  uoms={uoms}
                  onChange={setUoms}
                  onAddPress={() => setShowUomPicker(true)}
                  stockUom={original ? original.stockUom : ''}
                />

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
                    <Pressable onPress={handleAddRecommended} style={styles.uomInput}>
                      <Icon name="add" size={20} color={Colors.primary} />
                    </Pressable>
                  </View>
                </View>

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
              </>
            )}
          </ScrollView>

          {!loading && !loadError ? (
            <View style={styles.footer}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={styles.cancelBtn}
              >
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
                    <Icon name="save-outline" size={18} color={Colors.onPrimary} />
                    <Text style={[styles.saveText, textStart]}>حفظ التعديلات</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
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
      </SafeAreaView>
    </Modal>
  );
}
