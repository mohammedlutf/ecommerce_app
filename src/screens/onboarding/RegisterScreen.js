import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Icon from '../../components/Icon';
import CountryCodeInput from '../../components/CountryCodeInput';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { DEFAULT_COUNTRY, minDigitsFor, toCombinedDigits, MAX_DIGITS } from '../../constants/countries';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

function AuthInput({ icon, ...props }) {
  return (
    <View style={styles.inputWrapper}>
      <View pointerEvents="none">{icon}</View>
      <TextInput
        {...props}
        placeholderTextColor={Colors.textMuted}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

function PrimaryButton({ onPress, loading, children }) {
  const { textStart } = useDirectional();
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.97, friction: 5, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.92}
        disabled={loading}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={styles.primaryBtn}
      >
        {loading ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <Text style={[styles.primaryBtnText, textStart]}>{children}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RegisterScreen({ navigation }) {
  const { t } = useI18n();
  const { register, login } = useAuth();
  const toast = useToast();
  const { complete, skip } = useOnboarding();
  const { textStart } = useDirectional();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  async function handleSubmit() {
    const digits = phone.replace(/[^0-9]/g, '');
    const min = minDigitsFor(country);

    if (!name.trim()) {
      toast.error(t('onboarding.errNameRequired'));
      return;
    }
    if (digits.length < min) {
      toast.error(t('onboarding.errPhoneInvalid'));
      return;
    }
    if (!password || password.length < 6) {
      toast.error(t('onboarding.errPasswordShort'));
      return;
    }

    setLoading(true);
    try {
      const combined = toCombinedDigits(country, digits);
      const res = await register(combined, name.trim(), password);
      if (res && res.status === 'error') {
        toast.error(res.message);
        return;
      }
      // Registration only creates the account — log straight into the fresh
      // session so the flow can hand off to the store without another form.
      await login(combined, digits, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('onboarding.loginSuccess'));
      complete();
    } catch (err) {
      toast.error(err?.message || t('onboarding.errRegisterFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#F3FBF6', '#F8FAF9', '#FFFFFF']} style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              keyboardOpen && { ...styles.scrollContentKeyboardOpen, paddingBottom: keyboardHeight + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-back" size={22} color={Colors.onSurfaceVariant} />
              <Text style={[styles.backText, textStart]}>{t('onboarding.back')}</Text>
            </TouchableOpacity>

            {/* Card */}
            <View style={styles.card}>
              <Text style={[styles.cardHeadline, textStart]}>{t('onboarding.registerTitle')}</Text>
              <Text style={[styles.cardSubheadline, textStart]}>
                {t('onboarding.registerSubtitle')}
              </Text>

              <AuthInput
                icon={<Icon name="person-outline" size={20} color={Colors.textMuted} />}
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.namePlaceholder')}
                autoCapitalize="words"
                style={styles.inputText}
              />

              <CountryCodeInput
                value={phone}
                onChangeText={setPhone}
                country={country}
                onChangeCountry={setCountry}
                placeholder={t('onboarding.phonePlaceholder')}
                maxLength={country.code === 'YE' ? 9 : MAX_DIGITS}
                showLabel
              />

              <View style={styles.inputWrapper}>
                <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('onboarding.passwordPlaceholder')}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.input, styles.inputText]}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.buttonWrap}>
                <PrimaryButton
                  onPress={handleSubmit}
                  loading={loading}
                >
                  {t('onboarding.createAccount')}
                </PrimaryButton>
              </View>
            </View>

            {/* Skip */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={skip}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.skipBtn}
            >
              <Text style={[styles.skipText, textStart]}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  scrollContentKeyboardOpen: {
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingVertical: 6,
    paddingEnd: 10,
  },
  backText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 20,
    ...Shadows.lg,
  },
  cardHeadline: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  cardSubheadline: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
    marginBottom: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
  inputText: {
    textAlign: 'right',
  },
  buttonWrap: {
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 6,
  },
  skipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textMuted,
  },
});