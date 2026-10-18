import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useVendor } from '../../context/VendorContext';
import VendorAPI from '../../api/vendor';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';

/**
 * VendorApplyScreen — apply to open a shop.
 *
 * A storefront admin reviews this at the desk; nothing here creates a shop.
 * The form is intentionally short: the fewer fields between a prospective vendor
 * and a decision, the fewer abandoned applications, and the payout details can
 * be filled in later from the shop settings once the shop exists.
 */
export default function VendorApplyScreen({ navigation }) {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { user } = useAuth();
  const { refresh } = useVendor();

  const defaultPhone =
    (user && user.mobileNo) || ((user && user.email) ? user.email.split('@')[0].replace(/[^\d]/g, '') : '');

  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function validate() {
    if (!shopName.trim()) return 'اسم المتجر مطلوب';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 6) return 'رقم هاتف صحيح مطلوب';
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      await VendorAPI.applyForShop({
        shopName: shopName.trim(),
        phone: String(phone).trim(),
        description: description.trim(),
      });
      toast.success('تم إرسال طلبك بنجاح');
      await refresh();
      navigation.goBack();
    } catch (err) {
      toast.error(err?.message || 'تعذر إرسال الطلب');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={vendorStyles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={vendorStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={vendorStyles.column}>
            <Text style={[vendorStyles.pageSubtitle, textStart]}>
              أخبرنا باسم متجرك ورقم التواصل. ستُراجع الإدارة طلبك وتُعلمك بالنتيجة.
            </Text>

            <View style={vendorStyles.card}>
              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>اسم المتجر *</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="مثال: متجر الأصالة"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={140}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>رقم الهاتف *</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="7xxxxxxxx"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={20}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>نبذة عن المتجر</Text>
                <TextInput
                  style={[vendorStyles.input, vendorStyles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="ماذا تبيع؟ من أين تشحن؟ أي معلومة تساعد الإدارة على المراجعة."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={1000}
                />
              </View>

              <View style={styles.notice}>
                <Icon name="information-circle-outline" size={18} color={Colors.info} />
                <Text style={[styles.noticeText, textStart]}>
                  بالضغط على «إرسال الطلب» أنت توافق على عرض منتجاتك ضمن المنصة وبشروط العمولة
                  المعتمدة.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={saving}
                onPress={handleSubmit}
                style={[vendorStyles.primaryBtn, { marginTop: 8 }, saving && vendorStyles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <>
                    <Icon name="send-outline" size={18} color={Colors.onPrimary} />
                    <Text style={[vendorStyles.primaryBtnText, textStart]}>إرسال الطلب</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.infoContainer,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
