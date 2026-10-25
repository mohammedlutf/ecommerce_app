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
  LayoutAnimation,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Icon from '../../components/Icon';
import LottieView from 'lottie-react-native';
import PageFooter from '../../components/layout/PageFooter';
import CountryCodeInput from '../../components/CountryCodeInput';
import { DEFAULT_COUNTRY, minDigitsFor, toCombinedDigits, MAX_DIGITS } from '../../constants/countries';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useSiteChrome } from '../../hooks/useResponsive';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * The segmented switcher highlights the ACTIVE BUTTON rather than sliding a
 * separate absolutely-positioned thumb between the two tabs.
 *
 * The sliding thumb had to guess its own geometry (measured width, plus the
 * sign of the travel depending on `I18nManager.isRTL`, since a row lays out
 * right-to-left under forced RTL) and got it wrong — the highlight landed on
 * the tab that was NOT selected. Letting each button paint its own background
 * cannot be direction-dependent at all, and it matches the account tab switcher
 * used elsewhere in the app.
 */

/**
 * PrimaryButton — the only animation left on this screen: a subtle press
 * scale. The form panels are deliberately NOT animated when you switch between
 * login and create-account, so the content swaps instantly.
 */
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
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={[styles.primaryBtnText, textStart]}>{children}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

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

export default function LoginScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  const { showDesktopChrome } = useSiteChrome();
  useDocumentHead({ title: t('seo.loginTitle'), path: '/login', noindex: true });
  const { login, register } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('login');
  const [showForgot, setShowForgot] = useState(false);

  const [loginPhone, setLoginPhone] = useState('');
  const [loginCountry, setLoginCountry] = useState(DEFAULT_COUNTRY);
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerCountry, setRegisterCountry] = useState(DEFAULT_COUNTRY);
  const [registerPassword, setRegisterPassword] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');

  const [loading, setLoading] = useState(false);

  // Used to collapse the brand block and bottom-anchor the form while typing,
  // so the keyboard never leaves the screen shrunken and scrollable.
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  async function handleLogin() {
    const digits = loginPhone.replace(/[^0-9]/g, '');
    const min = minDigitsFor(loginCountry);
    if (digits.length < min) {
      toast.error(
        min === 9
          ? 'يرجى إدخال رقم الهاتف اليمني الصحيح مكون من 9 أرقام'
          : `يرجى إدخال رقم هاتف صحيح (${min} أرقام على الأقل)`
      );
      return;
    }
    if (!loginPassword) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);
    try {
      // The combined number (dialling code + national number) is the identity we
      // send. AuthAPI also retries the legacy local-only keys so accounts that
      // were created before the combined format keep working.
      await login(toCombinedDigits(loginCountry, digits), digits, loginPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('تم تسجيل الدخول بنجاح، أهلاً بعودتك');
      /*
       * A direct visit to /login has no screen to go back to. Leaving the form
       * on screen after a successful sign-in looks like the login failed, so
       * fall through to the account hub in that case.
       */
      if (navigation) {
        if (navigation.canGoBack()) navigation.goBack();
        else if (navigation.navigate) navigation.navigate('Account');
      }
    } catch (err) {
      toast.error(err?.message || 'فشل تسجيل الدخول، تحقق من البيانات');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const cleanPhone = registerPhone.replace(/[^0-9]/g, '');
    const min = minDigitsFor(registerCountry);
    if (!registerName.trim()) {
      toast.error('يرجى إدخال الاسم الكامل');
      return;
    }
    if (cleanPhone.length < min) {
      toast.error(
        min === 9
          ? 'يرجى إدخال رقم هاتف يمني صحيح مكون من 9 أرقام'
          : `يرجى إدخال رقم هاتف صحيح (${min} أرقام على الأقل)`
      );
      return;
    }
    if (!registerPassword || registerPassword.length < 6) {
      toast.error('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      return;
    }

    setLoading(true);
    try {
      const res = await register(
        toCombinedDigits(registerCountry, cleanPhone),
        registerName,
        registerPassword
      );
      if (res && res.status === 'error') {
        toast.error(res.message);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.');
      switchTab('login');
      setLoginPhone(cleanPhone);
      setLoginCountry(registerCountry);
      setRegisterName('');
      setRegisterPhone('');
      setRegisterPassword('');
    } catch (err) {
      toast.error(err?.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }

  function handleForgot() {
    if (!forgotEmail.trim()) {
      toast.error('يرجى إدخال بريدك الإلكتروني');
      return;
    }
    toast.success('تم إرسال تعليمات الاستعادة إذا كان البريد مسجلاً لدينا');
    setForgotEmail('');
    setShowForgot(false);
  }

  return (
    <LinearGradient colors={['#F3FBF6', '#F8FAF9', '#FFFFFF']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <KeyboardAvoidingView
          // Android uses `softwareKeyboardLayoutMode: "pan"`, so the window is
          // never resized and no extra offset is needed here. iOS does resize
          // the window, so it needs the padding to keep the form visible.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              showDesktopChrome && styles.scrollContentWeb,
              // Android runs `softwareKeyboardLayoutMode: "pan"`, so opening the
              // keyboard no longer resizes the window — the app keeps its exact
              // layout. The form is padded up by the measured keyboard height
              // and anchored to the bottom, so it sits just above the keyboard
              // instead of the keyboard shoving the whole app around.
              keyboardOpen && {
                ...styles.scrollContentKeyboardOpen,
                paddingBottom: keyboardHeight + 16,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            {/*
              On the web the brand and the form sit side by side; on a phone the
              wrapper is a plain column so the existing layout is unchanged.
            */}
            <View style={[styles.authRow, showDesktopChrome && styles.authRowWeb]}>
            {/* Brand — collapsed while typing to free vertical space */}
            <View
              style={[
                styles.brandWrap,
                showDesktopChrome && styles.brandWrapWeb,
                keyboardOpen && styles.brandWrapCollapsed,
              ]}
            >
              
                {/* <LinearGradient
                  colors={['#22C55E', Colors.primary, Colors.primaryDark]}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name="storefront" size={38} color="#ffffff" />
                </LinearGradient> */}

                {/* <Image
                          source={require('../../../assets/login_icon.png')}
                          style={styles.brandImage}
                          resizeMode="contain"
                        /> */}
                 <LottieView
                              source={require('../../../assets/lottie/login.json')}
                              autoPlay
                              loop
                              style={[styles.animation, showDesktopChrome && styles.animationWeb]}
                              renderMode="HARDWARE"
                            />
              {/* <Text style={[styles.brandTitle, textStart]}>زاد ماركت</Text> */}
             <Text style={[styles.brandTagline, textStart]}>تسوق طازج وتوصيل سريع حتى باب منزلك</Text>

              {/*
                The marketing copy only earns its space on the wide layout; on
                a phone it would push the form below the fold.
              */}
              {showDesktopChrome ? (
                <View style={styles.benefits}>
                  <Text style={[styles.benefitsTitle, textStart]}>{t('auth.benefitsTitle')}</Text>
                  {[t('auth.benefit1'), t('auth.benefit2'), t('auth.benefit3')].map((benefit) => (
                    <View key={benefit} style={styles.benefitRow}>
                      <View style={styles.benefitIcon}>
                        <Icon name="checkmark" size={13} color={Colors.primaryDark} />
                      </View>
                      <Text style={[styles.benefitText, textStart]}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Card */}
            <View style={[styles.card, showDesktopChrome && styles.cardWeb]}>
              {showForgot ? (
                <View>
                  <Text style={[styles.cardHeadline, textStart]}>استعادة كلمة المرور</Text>
                  <Text style={[styles.cardSubheadline, textStart]}>
                    أدخل بريدك الإلكتروني وسنرسل لك تعليمات الاستعادة.
                  </Text>

                  <AuthInput
                    icon={<Icon name="mail-outline" size={20} color={Colors.textMuted} />}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="البريد الإلكتروني"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ textAlign: 'right' }}
                  />

                  <PrimaryButton onPress={handleForgot} loading={loading}>
                    إرسال تعليمات الاستعادة
                  </PrimaryButton>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowForgot(false)}
                    style={styles.linkRow}
                  >
                    <Text style={[styles.linkText, textStart]}>العودة لتسجيل الدخول</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Segmented switcher */}
                  <View style={styles.tabSwitcher}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => switchTab('login')}
                      style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]}
                    >
                      <Text
                        style={[
                          styles.tabButtonText, textStart,
                          activeTab === 'login' && styles.tabButtonTextActive,
                        ]}
                      >
                        تسجيل الدخول
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => switchTab('register')}
                      style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                    >
                      <Text
                        style={[
                          styles.tabButtonText, textStart,
                          activeTab === 'register' && styles.tabButtonTextActive,
                        ]}
                      >
                        حساب جديد
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {activeTab === 'login' ? (
                    <View>
                      <Text style={[styles.cardHeadline, textStart]}>أهلاً بعودتك 👋</Text>
                      <Text style={[styles.cardSubheadline, textStart]}>
                        سجّل دخولك لتتابع طلباتك ومفضلتك.
                      </Text>

                      <CountryCodeInput
                        value={loginPhone}
                        onChangeText={setLoginPhone}
                        country={loginCountry}
                        onChangeCountry={setLoginCountry}
                        placeholder="ادخل رقم الهاتف"
                        maxLength={loginCountry.code === 'YE' ? 9 : MAX_DIGITS}
                      />

                      <View style={styles.inputWrapper}>
                        <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
                        <TextInput
                          value={loginPassword}
                          onChangeText={setLoginPassword}
                          placeholder="كلمة المرور"
                          secureTextEntry={!showPassword}
                          placeholderTextColor={Colors.textMuted}
                          style={[styles.input, { textAlign: 'right' }]}
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

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setShowForgot(true);
                        }}
                        style={styles.forgotRow}
                      >
                        <Text style={[styles.forgotText, textStart]}>نسيت كلمة المرور؟</Text>
                      </TouchableOpacity>

                      <PrimaryButton onPress={handleLogin} loading={loading}>
                        تسجيل الدخول
                      </PrimaryButton>
                    </View>
                  ) : (
                    <View>
                      <Text style={[styles.cardHeadline, textStart]}>إنشاء حساب جديد ✨</Text>
                      <Text style={[styles.cardSubheadline, textStart]}>
                        ابدأ التسوق واستمتع بالعروض الحصرية.
                      </Text>

                      <AuthInput
                        icon={<Icon name="person-outline" size={20} color={Colors.textMuted} />}
                        value={registerName}
                        onChangeText={setRegisterName}
                        placeholder="اكتب اسمك"
                        style={{ textAlign: 'right' }}
                      />

                      <CountryCodeInput
                        value={registerPhone}
                        onChangeText={setRegisterPhone}
                        country={registerCountry}
                        onChangeCountry={setRegisterCountry}
                        placeholder="ادخل رقم الهاتف"
                        maxLength={registerCountry.code === 'YE' ? 9 : MAX_DIGITS}
                      />

                      <View style={styles.inputWrapper}>
                        <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
                        <TextInput
                          value={registerPassword}
                          onChangeText={setRegisterPassword}
                          placeholder="كلمة المرور (6 أحرف على الأقل)"
                          secureTextEntry={!showPassword}
                          placeholderTextColor={Colors.textMuted}
                          style={[styles.input, { textAlign: 'right' }]}
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

                      <PrimaryButton onPress={handleRegister} loading={loading}>
                        إنشاء الحساب
                      </PrimaryButton>
                    </View>
                  )}
                </>
              )}
            </View>
            </View>

            {showDesktopChrome ? (
              /*
               * The desktop page gets the same site footer as every other web
               * page. It is rendered outside the padded row and the scroll
               * content has no horizontal padding on web, so the footer band is
               * full-bleed like everywhere else.
               */
              <PageFooter />
            ) : (
              /* Trust row */
              <View style={styles.trustRow}>
                <View style={styles.trustItem}>
                  <Icon name="shield-checkmark-outline" size={16} color={Colors.success} />
                  <Text style={[styles.trustText, textStart]}>بياناتك محمية ومشفرة</Text>
                </View>
                <View style={styles.trustDot} />
                <View style={styles.trustItem}>
                  <Icon name="checkmark-done-outline" size={16} color={Colors.success} />
                  <Text style={[styles.trustText, textStart]}>ضمان جودة المنتجات</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
    // Extra room below the submit button so it can always be scrolled clear of
    // the keyboard instead of ending up underneath it.
    paddingBottom: 32,
    // `flexGrow` is required for the centring below to be safe: without it, a
    // content column taller than the viewport gets centred and its top half
    // becomes unreachable by scrolling (the "top of the design is cut off"
    // bug). With flexGrow the container is at least one screen tall, so
    // centring only applies when there is actually spare room.
    flexGrow: 1,
    justifyContent: 'center',
  },
  scrollContentKeyboardOpen: {
    // The brand block is collapsed, and the container is padded by the keyboard
    // height inline, so `flex-end` lands the form directly on top of the
    // keyboard. Nothing below it is reachable-but-hidden, and the window itself
    // is never resized, so the app never shifts.
    justifyContent: 'flex-end',
    paddingTop: 12,
  },
  /*
   * Desktop: no outer padding on the scroll content, because `PageFooter` is
   * its child and must span the window. The split layout below owns the
   * horizontal spacing instead.
   */
  scrollContentWeb: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: 'flex-start',
  },
  authRow: {
    width: '100%',
  },
  authRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
    flexWrap: 'wrap',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 16,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  brandWrapWeb: {
    alignItems: 'flex-start',
    width: 400,
    maxWidth: '100%',
    marginTop: 0,
    marginBottom: 0,
    padding: 28,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  animationWeb: {
    width: 240,
    height: 240,
    marginTop: -24,
    marginBottom: -8,
  },
  benefits: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  benefitsTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  benefitText: {
    flex: 1,
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  brandWrapCollapsed: {
    // The logo + title + tagline cost ~150dp, which is the difference between
    // the form fitting above the keyboard and needing to be scrolled.
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  logoTile: {
    width: 76,
    height: 76,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: Typography.sizes.headlineLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primaryDark,
    marginTop: 12,
  },
  brandTagline: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 24,
    ...Shadows.lg,
  },
  cardWeb: {
    width: 460,
    maxWidth: '100%',
    padding: 32,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  tabButtonActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.sm,
  },
  tabButtonText: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textMuted,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
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
    marginBottom: 20,
  },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    gap: 12,
    ...Shadows.xs,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 18,
    marginTop: -2,
  },
  forgotText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
  linkRow: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  linkText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },
  brandImage: {
    width: 130,
    height: 130,
  },
  animation: {
    
    width: 200,
    height: 200,
    aspectRatio: 1,
    maxWidth: 340,
    alignSelf: 'center',
    marginTop: -18,
  },
});
