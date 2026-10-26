import React, { useLayoutEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import Container from '../../components/layout/Container';
import PageFooter from '../../components/layout/PageFooter';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';
import { useI18n } from '../../i18n/I18nContext';
import useDocumentHead from '../../seo/useDocumentHead';
import { Colors } from '../../theme/colors';
import { Radius, Shadows } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const POLICIES = {
  privacy: {
    icon: 'shield-checkmark-outline',
    path: '/privacy',
    titleKey: 'privacyPolicy.title',
    descriptionKey: 'seo.privacyDescription',
    introKey: 'privacyPolicy.intro',
    // Each section is a title/body pair in the string catalogue. Keeping the
    // list declarative means the screen does not accumulate hand-numbered JSX.
    sections: ['collect', 'use', 'share', 'cookies', 'security', 'rights'],
    relatedRoute: 'ReturnPolicy',
    relatedTitleKey: 'returnPolicy.title',
  },
  returns: {
    icon: 'refresh-circle-outline',
    path: '/returns',
    titleKey: 'returnPolicy.title',
    descriptionKey: 'seo.returnsDescription',
    introKey: 'returnPolicy.intro',
    sections: ['window', 'fresh', 'process', 'refunds', 'exclusions'],
    relatedRoute: 'PrivacyPolicy',
    relatedTitleKey: 'privacyPolicy.title',
  },
};

/**
 * One component for both legal pages.
 *
 * The two routes (`PrivacyPolicy`, `ReturnPolicy`) are separate in the linking
 * config and the native stack so each has its own addressable URL, but the
 * layout, typography and contact callout are identical. Rendering the policy
 * kind from the route name also keeps a cold deep link correct even before the
 * route's `initialParams` have been applied.
 */
export default function PolicyScreen({ route, navigation }) {
  const { t } = useI18n();
  const { textStart, isRTL } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();

  const kind =
    route?.name === 'ReturnPolicy' || route?.params?.policy === 'returns'
      ? 'returns'
      : 'privacy';
  const policy = POLICIES[kind];
  const prefix = kind === 'returns' ? 'returnPolicy' : 'privacyPolicy';

  useDocumentHead({
    title: t(policy.titleKey),
    description: t(policy.descriptionKey),
    path: policy.path,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(policy.titleKey) });
  }, [navigation, t, policy.titleKey]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageFill}>
          <Container>
            <View style={[styles.page, showDesktopChrome && styles.pageDesktop]}>
              <View style={styles.policyColumn}>
                <LinearGradient
                  colors={[Colors.primaryLight, Colors.surfaceContainerLowest]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.hero, showDesktopChrome && styles.heroDesktop]}
                >
                  <View pointerEvents="none" style={styles.heroOrb} />
                  <View style={styles.heroIcon}>
                    <Icon name={policy.icon} size={28} color={Colors.primary} />
                  </View>
                  <Text style={[styles.eyebrow, textStart]}>{t('legal.eyebrow')}</Text>
                  <Text
                    style={[
                      styles.title,
                      showDesktopChrome && styles.titleDesktop,
                      textStart,
                    ]}
                  >
                    {t(policy.titleKey)}
                  </Text>
                  <Text style={[styles.intro, textStart]}>{t(policy.introKey)}</Text>

                  <View style={styles.updatedPill}>
                    <Icon name="time-outline" size={14} color={Colors.textMuted} />
                    <Text style={[styles.updatedText, textStart]}>
                      {t('legal.lastUpdated')}
                    </Text>
                  </View>
                </LinearGradient>

                <View style={styles.sectionCard}>
                  {policy.sections.map((section, index) => (
                    <View
                      key={section}
                      style={[styles.section, index > 0 && styles.sectionBordered]}
                    >
                      <View style={styles.sectionHeading}>
                        <View style={styles.sectionNumber}>
                          <Text style={styles.sectionNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.sectionTitle, textStart]}>
                          {t(`${prefix}.${section}Title`)}
                        </Text>
                      </View>
                      <Text style={[styles.sectionBody, textStart]}>
                        {t(`${prefix}.${section}Body`)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.contactCard}>
                  <View style={styles.contactIcon}>
                    <Icon name="chatbubbles-outline" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.contactCopy}>
                    <Text style={[styles.contactTitle, textStart]}>
                      {t('legal.contactTitle')}
                    </Text>
                    <Text style={[styles.contactText, textStart]}>
                      {t('legal.contactText')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => navigation.navigate('Contact')}
                    style={({ pressed }) => [
                      styles.contactButton,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel={t('legal.contactCta')}
                  >
                    <Text style={[styles.contactButtonText, textStart]}>
                      {t('legal.contactCta')}
                    </Text>
                    <Icon
                      name={isRTL ? 'arrow-back' : 'arrow-forward'}
                      size={15}
                      color={Colors.onPrimary}
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => navigation.navigate(policy.relatedRoute)}
                  className={showDesktopChrome ? 'hover-tint' : undefined}
                  style={({ pressed }) => [
                    styles.relatedCard,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={t(policy.relatedTitleKey)}
                >
                  <View style={styles.relatedIcon}>
                    <Icon
                      name={kind === 'privacy' ? 'refresh-circle-outline' : 'shield-checkmark-outline'}
                      size={21}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={styles.relatedCopy}>
                    <Text style={[styles.relatedLabel, textStart]}>
                      {t('legal.relatedTitle')}
                    </Text>
                    <Text style={[styles.relatedTitle, textStart]}>
                      {t(policy.relatedTitleKey)}
                    </Text>
                  </View>
                  <Icon
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>
          </Container>
        </View>

        <PageFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageFill: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 32,
  },
  pageDesktop: {
    paddingTop: 32,
    paddingBottom: 48,
  },
  policyColumn: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.72,
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    padding: 24,
  },
  heroDesktop: {
    padding: 38,
  },
  heroOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,65,41,0.05)',
    top: -110,
    right: -70,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 5,
    fontSize: Typography.sizes.headlineLg,
    lineHeight: 36,
    color: Colors.primaryDark,
    fontFamily: Typography.fontFamilyExtraBold,
  },
  titleDesktop: {
    fontSize: 36,
    lineHeight: 48,
  },
  intro: {
    marginTop: 12,
    maxWidth: 720,
    fontSize: Typography.sizes.bodyMd,
    lineHeight: 24,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },
  updatedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  updatedText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },

  sectionCard: {
    marginTop: 22,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.xs,
  },
  section: {
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  sectionBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyExtraBold,
  },
  sectionTitle: {
    flex: 1,
    fontSize: Typography.sizes.titleMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyBold,
  },
  sectionBody: {
    marginTop: 9,
    fontSize: Typography.sizes.bodyMd,
    lineHeight: 25,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },

  contactCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
    padding: 20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  contactIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
    minWidth: 210,
  },
  contactTitle: {
    fontSize: Typography.sizes.titleSm,
    color: Colors.primaryDark,
    fontFamily: Typography.fontFamilyBold,
  },
  contactText: {
    marginTop: 3,
    fontSize: Typography.sizes.bodySm,
    lineHeight: 19,
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.fontFamilyRegular,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    height: 42,
  },
  contactButtonText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },

  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  relatedIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedCopy: {
    flex: 1,
  },
  relatedLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  relatedTitle: {
    marginTop: 1,
    fontSize: Typography.sizes.labelLg,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
});
