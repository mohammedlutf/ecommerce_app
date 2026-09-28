import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from './Icon';
import LocationPicker from './LocationPicker';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Spacing } from '../theme/spacing';
import { parseCoords } from '../utils/geo';

const DEFAULT_CITY = 'صنعاء';

/** Cities offered as quick chips so most addresses need no typing at all. */
const CITY_SUGGESTIONS = ['صنعاء', 'عدن', 'المكلا', 'حضرموت', 'تعز', 'إب', 'سيئون', 'المحويت'];

/**
 * AddressFormModal — add or edit one delivery address.
 *
 * Used for both create and edit: the only difference is the heading and the
 * submit handler, and having one form means the two can never drift apart in
 * validation or in what they send.
 *
 * `initial` is the Address document being edited (or null for a new one).
 * `onSubmit(values)` receives the raw fields; persistence is the caller's job.
 */
function AddressFormModal({
  visible,
  initial = null,
  defaultPhone = '',
  saving = false,
  onClose,
  onSubmit,
}) {
  const isEdit = !!initial;

  const [addressTitle, setAddressTitle] = useState('المنزل');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState(DEFAULT_CITY);
  const [phone, setPhone] = useState('');
  const [useOwnPhone, setUseOwnPhone] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');
  // One object, not a coordinate and a label in separate state: the picker reads
  // `value.placeName` to show what it resolved, and keeping the label in its own
  // state meant it was always undefined by the time it got there.
  const [location, setLocation] = useState(null);

  // Re-seed the form every time the sheet opens. Reading `initial` on mount
  // would leave the previous address's values in the fields when the user opens
  // a different one.
  useEffect(() => {
    if (!visible) return;

    setAddressTitle((initial && initial.address_title) || 'المنزل');
    setAddressLine1((initial && initial.address_line1) || '');
    setCity((initial && initial.city) || DEFAULT_CITY);
    // The pin round-trips through `address_line2`; the readable name it resolved
    // to is carried in `pincode`, so an existing address reopens fully labelled.
    const existingCoords = parseCoords(initial && initial.address_line2);
    setLocation(
      existingCoords ? { ...existingCoords, placeName: (initial && initial.pincode) || '' } : null
    );
    setIsDefault(!!(initial && initial.is_primary_address));
    setError('');

    // An existing address already has its own phone, so the "use my number"
    // shortcut only makes sense for a new one.
    const existingPhone = (initial && initial.phone) || '';
    setUseOwnPhone(!isEdit);
    setPhone(existingPhone || defaultPhone || '');
  }, [visible, initial, defaultPhone, isEdit]);

  const effectivePhone = useOwnPhone ? defaultPhone : phone.trim();

  function handleToggleOwnPhone(next) {
    setUseOwnPhone(next);
    // Clear a stale value from the other branch so switching back and forth
    // cannot send a number the user did not intend to use.
    if (next) setPhone('');
  }

  function handlePickLocation(next) {
    setLocation({
      latitude: next.latitude,
      longitude: next.longitude,
      placeName: next.placeName || '',
    });
  }

  function handleSubmit() {
    if (!addressLine1.trim()) {
      setError('يرجى كتابة تفاصيل العنوان (الشارع، البناية، أقرب معلم)');
      return;
    }
    if (!city.trim()) {
      setError('يرجى كتابة المدينة');
      return;
    }
    // The recipient phone is optional, but if the user chose to enter one it
    // has to be a number the driver can actually call.
    if (!useOwnPhone && phone.trim() && phone.replace(/[^\d]/g, '').length < 6) {
      setError('رقم هاتف المستلم غير صحيح');
      return;
    }

    setError('');
    Keyboard.dismiss();
    onSubmit({
      addressTitle: addressTitle.trim() || 'عنوان التوصيل',
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      // Empty when the user picked "use my number": the server then falls back to
      // the customer's own mobile, so nothing is guessed on the client.
      phone: effectivePhone,
      // `coords` and `placeName` are read off the same object; only the
      // latitude/longitude keys are used to build `address_line2`.
      coords: location,
      placeName: location ? location.placeName : '',
      isDefault,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent={false}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{isEdit ? 'تعديل العنوان' : 'عنوان جديد'}</Text>
              <Text style={styles.headerSubtitle}>
                {isEdit ? 'حدّث تفاصيل العنوان أو موقعه' : 'أضف موقع التسليم لنوصل طلبك بدقة'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <Icon name="close" size={20} color={Colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
          >
            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Address title */}
            <Field label="الاسم" hint="مثلاً: المنزل، العمل">
              <TextInput
                value={addressTitle}
                onChangeText={setAddressTitle}
                placeholder="المنزل"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                returnKeyType="next"
                maxLength={60}
              />
            </Field>

            {/* Address detail */}
            <Field
              label="تفاصيل العنوان"
              required
              hint="الشارع، رقم البناية، أقرب معلم مميز"
            >
              <TextInput
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="شارع الزبيري، جوار مسجد النور، الدور الثاني"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.inputMultiline]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
            </Field>

            {/* City */}
            <Field label="المدينة" required>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder={DEFAULT_CITY}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                returnKeyType="next"
                maxLength={60}
              />
              <View style={styles.chipsRow}>
                {CITY_SUGGESTIONS.map((suggestion) => {
                  const selected = city.trim() === suggestion;
                  return (
                    <Pressable
                      key={suggestion}
                      onPress={() => setCity(suggestion)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && !selected && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {/* Map */}
            <Field label="موقع التسليم" hint="اسحب المؤشر أو اضغط على الخريطة">
              <LocationPicker value={location} onChange={handlePickLocation} />
            </Field>

            {/* Recipient phone — optional */}
            <Field label="رقم هاتف المستلم" hint="اختياري">
              <View style={styles.phoneCard}>
                <View style={styles.phoneToggleRow}>
                  <View style={styles.phoneToggleText}>
                    <Text style={styles.phoneToggleTitle}>استخدم رقمي</Text>
                    <Text style={styles.phoneToggleSub}>
                      {defaultPhone ? defaultPhone : 'رقم حسابك'}
                    </Text>
                  </View>
                  <Switch
                    value={useOwnPhone}
                    onValueChange={handleToggleOwnPhone}
                    trackColor={{ false: Colors.outlineVariant, true: Colors.primary }}
                    thumbColor={Colors.onPrimary}
                    ios_backgroundColor={Colors.outlineVariant}
                  />
                </View>

                {!useOwnPhone ? (
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="7XXXXXXXX"
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.input, styles.phoneInput]}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    maxLength={20}
                  />
                ) : null}
              </View>
            </Field>

            {/* Default address */}
            <Pressable
              onPress={() => setIsDefault((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDefault }}
              style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
            >
              <View style={[styles.checkbox, isDefault && styles.checkboxChecked]}>
                {isDefault ? <Icon name="checkmark" size={14} color={Colors.onPrimary} /> : null}
              </View>
              <View style={styles.checkTextWrap}>
                <Text style={styles.checkTitle}>اجعله العنوان الأساسي</Text>
                <Text style={styles.checkSub}>سيتم اختياره تلقائياً عند الطلب</Text>
              </View>
            </Pressable>
          </ScrollView>

          {/* Sticky footer. It needs no keyboard handling of its own: on Android
              the app is configured with `softwareKeyboardLayoutMode: "resize"`,
              so this window shrinks when the keyboard opens and a plain flex
              layout puts the buttons directly on top of it. The earlier version
              padded this by the measured keyboard height as well, which stacked
              on top of the platform's own adjustment and threw the whole form
              to the top of the screen. On iOS the KeyboardAvoidingView above
              does the lifting. */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
            >
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.saveBtn,
                saving && styles.saveBtnDisabled,
                pressed && !saving && styles.saveBtnPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <Icon name={isEdit ? 'save-outline' : 'add'} size={18} color={Colors.onPrimary} />
                  <Text style={styles.saveText}>{isEdit ? 'حفظ التعديلات' : 'حفظ العنوان'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Field — one labelled input group.
 *
 * Wrapping every field in the same component is what keeps the label size,
 * hint colour and vertical rhythm identical across the form; doing it inline
 * per field is how those drift apart.
 */
function Field({ label, hint, required = false, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.requiredMark}>*</Text> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  headerSubtitle: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  closeBtnPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.error,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  label: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  requiredMark: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.error,
  },
  hint: {
    flex: 1,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    height: 52,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    textAlign: 'right',
  },
  inputMultiline: {
    height: 88,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  chipSelected: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  chipPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  chipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  chipTextSelected: {
    color: Colors.onPrimaryContainer,
    fontFamily: Typography.fontFamilySemiBold,
  },
  phoneCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 12,
    gap: 10,
  },
  phoneToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneToggleText: {
    flex: 1,
  },
  phoneToggleTitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  phoneToggleSub: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  phoneInput: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  checkRowPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkTextWrap: {
    flex: 1,
  },
  checkTitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  checkSub: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  cancelBtn: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cancelBtnPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  cancelText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
  },
  saveBtnPressed: {
    backgroundColor: Colors.primaryPress,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onPrimary,
  },
});

export default AddressFormModal;
