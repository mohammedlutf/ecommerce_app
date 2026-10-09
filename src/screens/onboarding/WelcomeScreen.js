import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n/I18nContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

const WELCOME_ANIMATION = require('../../../assets/onboarding/welcome.json');

const BENEFITS = [
  { icon: 'leaf-outline', color: Colors.primary },
  { icon: 'flash-outline', color: Colors.secondary },
  { icon: 'pricetags-outline', color: Colors.primaryDark },
];

function PrimaryButton({ onPress, children }) {
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
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={styles.primaryBtn}
      >
        <Text style={[styles.primaryBtnText, textStart]}>{children}</Text>
        <Icon name="arrow-forward" size={20} color={Colors.onPrimary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WelcomeScreen({ navigation }) {
  const { t } = useI18n();
  const { skip } = useOnboarding();
  const { textStart } = useDirectional();

  return (
    <LinearGradient colors={['#F3FBF6', '#F8FAF9', '#FFFFFF']} style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Animation stage */}
          <View style={styles.artWrap}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../../../assets/login_icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <LottieView
              source={WELCOME_ANIMATION}
              autoPlay
              loop
              style={styles.animation}
              renderMode="HARDWARE"
            />
          </View>

          {/* Copy */}
          <Text style={[styles.title, textStart]}>{t('onboarding.welcomeTitle')}</Text>
          <Text style={[styles.subtitle, textStart]}>{t('onboarding.welcomeSubtitle')}</Text>

          {/* Benefits */}
          <View style={styles.benefitsCard}>
            {BENEFITS.map((benefit, index) => (
              <View
                key={benefit.icon}
                style={[styles.benefitRow, index < BENEFITS.length - 1 && styles.benefitDivider]}
              >
                <View style={styles.benefitIconBg}>
                  <Icon name={benefit.icon} size={18} color={benefit.color} />
                </View>
                <Text style={[styles.benefitText, textStart]}>
                  {t(`onboarding.benefit${index + 1}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <PrimaryButton onPress={() => navigation.navigate('Register')}>
            {t('onboarding.getStarted')}
          </PrimaryButton>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={skip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipText, textStart]}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    marginBottom: -8,
    zIndex: 2,
  },
  logo: {
    width: 52,
    height: 52,
  },
  animation: {
    width: '78%',
    aspectRatio: 1,
    maxWidth: 340,
    alignSelf: 'center',
    marginTop: -18,
  },
  title: {
    fontSize: Typography.sizes.headlineLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 20,
  },
  benefitsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...Shadows.sm,
    marginBottom: 22,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  benefitDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  benefitIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 54,
    ...Shadows.md,
  },
  primaryBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  skipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textMuted,
  },
});