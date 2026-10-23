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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useToast } from '../../context/ToastContext';
import { useVendor } from '../../context/VendorContext';
import VendorAPI from '../../api/vendor';
import { getImageUrl } from '../../api/client';
import { captureProductImage } from '../../utils/productImage';
import { normaliseDecimalInput, parseDecimal } from '../../utils/numbers';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';
import PageFooter from '../../components/layout/PageFooter';

/**
 * VendorShopScreen — the shop's own profile and payout details.
 *
 * Split into "what shoppers see" (name, description, logo, delivery charge) and
 * "where the money goes" (bank details), because they are edited at different
 * times by different people and a single undifferentiated form hides which
 * fields an admin even looks at.
 *
 * What is *not* editable is shown read-only rather than hidden: the commission
 * rate and the shop status are facts about the vendor's commercial position, and
 * a vendor who cannot see them has to guess.
 */
export default function VendorShopScreen() {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { shop, refresh } = useVendor();

  const [shopName, setShopName] = useState(shop?.shop_name || '');
  const [description, setDescription] = useState(shop?.description || '');
  const [deliveryRate, setDeliveryRate] = useState(
    shop?.delivery_rate != null ? String(shop.delivery_rate) : '0'
  );
  const [bankName, setBankName] = useState(shop?.bank_name || '');
  const [accountHolder, setAccountHolder] = useState(shop?.account_holder || '');
  const [accountNumber, setAccountNumber] = useState(shop?.account_number || '');
  const [pendingLogo, setPendingLogo] = useState(null);

  const [saving, setSaving] = useState(false);

  const commissionRate = shop?.commission_rate;

  async function handlePickLogo(source) {
    try {
      const picked = await captureProductImage(source);
      if (picked) setPendingLogo(picked);
    } catch (err) {
      toast.error(err?.message || 'تعذر فتح الكاميرا');
    }
  }

  function buildChanges() {
    const changes = {};
    const base = shop || {};

    if (shopName.trim() !== (base.shop_name || '')) changes.shop_name = shopName.trim();
    if (description !== (base.description || '')) changes.description = description;
    if (Number(deliveryRate || 0) !== Number(base.delivery_rate || 0)) {
      changes.delivery_rate = Number(deliveryRate || 0);
    }
    if (bankName !== (base.bank_name || '')) changes.bank_name = bankName;
    if (accountHolder !== (base.account_holder || '')) changes.account_holder = accountHolder;
    if (accountNumber !== (base.account_number || '')) changes.account_number = accountNumber;

    if (pendingLogo) {
      changes.logoBase64 = pendingLogo.base64;
      changes.logoName = pendingLogo.name;
    }
    return changes;
  }

  async function handleSave() {
    if (!shopName.trim()) {
      toast.error('اسم المتجر مطلوب');
      return;
    }
    const rate = parseDecimal(deliveryRate);
    if (rate !== null && rate < 0) {
      toast.error('رسوم التوصيل لا يمكن أن تكون سالبة');
      return;
    }

    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      toast.success('لا توجد تغييرات لحفظها');
      return;
    }

    setSaving(true);
    try {
      await VendorAPI.updateShop(changes);
      toast.success('تم حفظ إعدادات المتجر');
      setPendingLogo(null);
      await refresh();
    } catch (err) {
      toast.error(err?.message || 'تعذر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  }

  const logoUri = pendingLogo ? pendingLogo.uri : shop?.logo ? getImageUrl(shop.logo) : '';

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={vendorStyles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[vendorStyles.scrollContent, { maxWidth: 1080, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[vendorStyles.column, { width: '100%' }]}>
            {/* Identity */}
            <View style={vendorStyles.card}>
              <View style={vendorStyles.sectionHeader}>
                <Icon name="storefront-outline" size={17} color={Colors.primary} />
                <Text style={[vendorStyles.sectionTitle, textStart]}>هوية المتجر</Text>
              </View>

              <View style={styles.logoRow}>
                <View style={styles.logoFrame}>
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logoImage} resizeMode="cover" />
                  ) : (
                    <Icon name="storefront-outline" size={30} color={Colors.textMuted} />
                  )}
                </View>
                <View style={vendorStyles.flex1}>
                  <Text style={[vendorStyles.label, textStart]}>شعار المتجر</Text>
                  <View style={styles.logoActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handlePickLogo('camera')}
                      style={styles.logoBtn}
                    >
                      <Icon name="camera-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.logoBtnText, textStart]}>الكاميرا</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handlePickLogo('library')}
                      style={styles.logoBtn}
                    >
                      <Icon name="images-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.logoBtnText, textStart]}>المعرض</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>اسم المتجر *</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={shopName}
                  onChangeText={setShopName}
                  maxLength={140}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>نبذة عن المتجر</Text>
                <TextInput
                  style={[vendorStyles.input, vendorStyles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={1000}
                  placeholder="اكتب وصفاً قصيراً يظهر للعملاء في صفحة متجرك."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>رسوم التوصيل</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={deliveryRate}
                  onChangeText={(text) => setDeliveryRate(normaliseDecimalInput(text))}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={[vendorStyles.hint, textStart, { marginTop: 6 }]}>
                  تُضاف مرة واحدة على كل طلب من متجرك.
                </Text>
              </View>
            </View>

            {/* Payout details */}
            <View style={vendorStyles.card}>
              <View style={vendorStyles.sectionHeader}>
                <Icon name="card-outline" size={17} color={Colors.primary} />
                <Text style={[vendorStyles.sectionTitle, textStart]}>بيانات استلام المستحقات</Text>
              </View>
              <Text style={[vendorStyles.hint, textStart]}>
                تُستخدم هذه البيانات لتحويل مستحقاتك بعد اعتماد كشوف التسوية.
              </Text>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>اسم البنك</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  maxLength={140}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>اسم صاحب الحساب</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                  maxLength={140}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>رقم الحساب</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  maxLength={140}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Read-only commercial facts */}
            <View style={vendorStyles.card}>
              <View style={vendorStyles.sectionHeader}>
                <Icon name="information-circle-outline" size={17} color={Colors.primary} />
                <Text style={[vendorStyles.sectionTitle, textStart]}>بيانات المنصة</Text>
              </View>

              <View style={vendorStyles.rowBetween}>
                <Text style={[vendorStyles.muted, textStart]}>نسبة العمولة</Text>
                <Text style={[vendorStyles.value, textStart]}>
                  {commissionRate != null ? `${commissionRate}%` : '—'}
                </Text>
              </View>
              <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                <Text style={[vendorStyles.muted, textStart]}>حالة المتجر</Text>
                <Text style={[vendorStyles.value, textStart]}>
                  {shop?.status === 'Approved' ? 'معتمد' : shop?.status || '—'}
                </Text>
              </View>
              <Text style={[vendorStyles.hint, textStart, { marginTop: 12, marginBottom: 0 }]}>
                تُحدَّد نسبة العمولة وحالة المتجر من إدارة المنصة ولا يمكن تعديلها من هنا.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={saving}
              onPress={handleSave}
              style={[vendorStyles.primaryBtn, saving && vendorStyles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <Icon name="save-outline" size={18} color={Colors.onPrimary} />
                  <Text style={[vendorStyles.primaryBtnText, textStart]}>حفظ الإعدادات</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Desktop-only site footer; it rides inside the scroll content
              because the app shell has no document-level flow for it to sit at
              the end of. */}
          <PageFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  logoFrame: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoBtnText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
});
