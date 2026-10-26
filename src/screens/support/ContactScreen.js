import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Linking,
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
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO_URL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_TEL_URL,
  WHATSAPP_CHAT_URL,
} from '../../constants/contact';
import { useToast } from '../../context/ToastContext';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';
import { useI18n } from '../../i18n/I18nContext';
import useDocumentHead from '../../seo/useDocumentHead';
import { Colors } from '../../theme/colors';
import { Radius, Shadows } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

/**
 * The public contact page.
 *
 * Deliberately not a form: there is no ticket or mail endpoint behind this app,
 * and a form that silently drops a message is worse than no form. The three
 * destinations here are the ones that actually reach a person — phone, email
 * and a WhatsApp chat. The policy pages are linked from the same screen so a
 * shopper can answer "can I return this?" without hunting through the footer.
 */
export default function ContactScreen({ navigation }) {
  const { t } = useI18n();
  const { textStart, isRTL } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();
  const toast = useToast();

  useDocumentHead({
    title: t('seo.contactTitle'),
    description: t('seo.contactDescription'),
    path: '/contact',
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('contact.title') });
  }, [navigation, t]);

  const openLink = useCallback(
    (url) => {
      Linking.openURL(url).catch(() => {
        toast.error(`${t('contact.openError')} ${CONTACT_PHONE_DISPLAY}.`);
      });
    },
    [toast, t]
  );

  const whatsappUrl = useMemo(
    () =>
      `${WHATSAPP_CHAT_URL}?text=${encodeURIComponent(
        t('contact.whatsappMessage')
      )}`,
    [t]
  );

  const methods = [
    {
      key: 'phone',
      icon: 'call-outline',
      iconColor: Colors.primary,
      iconBg: Colors.primaryLight,
      label: t('contact.phoneLabel'),
      value: CONTACT_PHONE_DISPLAY,
      hint: t('contact.phoneHint'),
      cta: t('contact.callNow'),
      onPress: () => openLink(CONTACT_TEL_URL),
    },
    {
      key: 'email',
      icon: 'mail-outline',
      iconColor: Colors.info,
      iconBg: Colors.infoContainer,
      label: t('contact.emailLabel'),
      value: CONTACT_EMAIL,
      hint: t('contact.emailHint'),
      cta: t('contact.emailNow'),
      onPress: () => openLink(CONTACT_MAILTO_URL),
    },
    {
      key: 'whatsapp',
      icon: 'logo-whatsapp',
      iconColor: Colors.success,
      iconBg: Colors.successContainer,
      label: t('contact.whatsappLabel'),
      value: CONTACT_PHONE_DISPLAY,
      hint: t('contact.whatsappHint'),
      cta: t('contact.messageNow'),
      badge: t('contact.fastest'),
      onPress: () => openLink(whatsappUrl),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageFill}>
          <Container>
            <View style={[styles.page, showDesktopChrome && styles.pageDesktop]}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, showDesktopChrome && styles.heroDesktop]}
              >
                <View pointerEvents="none" style={styles.heroOrbOne} />
                <View pointerEvents="none" style={styles.heroOrbTwo} />

                <View style={styles.heroCopy}>
                  <View style={styles.heroEyebrow}>
                    <View style={styles.heroEyebrowIcon}>
                      <Icon name="headset-outline" size={14} color={Colors.primaryDark} />
                    </View>
                    <Text style={[styles.heroEyebrowText, textStart]}>
                      {t('contact.eyebrow')}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.heroTitle,
                      showDesktopChrome && styles.heroTitleDesktop,
                      textStart,
                    ]}
                  >
                    {t('contact.title')}
                  </Text>
                  <Text
                    style={[
                      styles.heroSubtitle,
                      showDesktopChrome && styles.heroSubtitleDesktop,
                      textStart,
                    ]}
                  >
                    {t('contact.subtitle')}
                  </Text>

                  <View style={styles.heroActions}>
                    <Pressable
                      onPress={() => openLink(whatsappUrl)}
                      style={({ pressed }) => [
                        styles.heroPrimary,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="link"
                      accessibilityLabel={t('contact.messageNow')}
                    >
                      <Icon name="logo-whatsapp" size={18} color={Colors.primaryDark} />
                      <Text style={[styles.heroPrimaryText, textStart]}>
                        {t('contact.messageNow')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openLink(CONTACT_TEL_URL)}
                      style={({ pressed }) => [
                        styles.heroSecondary,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="link"
                      accessibilityLabel={t('contact.callNow')}
                    >
                      <Icon name="call-outline" size={17} color="#FFFFFF" />
                      <Text style={[styles.heroSecondaryText, textStart]}>
                        {t('contact.callNow')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.sectionHeading}>
                <Text style={[styles.sectionTitle, textStart]}>
                  {t('contact.channelsTitle')}
                </Text>
                <Text style={[styles.sectionSubtitle, textStart]}>
                  {t('contact.channelsSubtitle')}
                </Text>
              </View>

              <View style={styles.methodsGrid}>
                {methods.map((method) => (
                  <MethodCard
                    key={method.key}
                    method={method}
                    desktop={showDesktopChrome}
                    textStart={textStart}
                    isRTL={isRTL}
                  />
                ))}
              </View>

              <View style={styles.tipCard}>
                <View style={styles.tipIcon}>
                  <Icon name="receipt-outline" size={20} color={Colors.secondaryDark} />
                </View>
                <View style={styles.tipCopy}>
                  <Text style={[styles.tipTitle, textStart]}>{t('contact.tipTitle')}</Text>
                  <Text style={[styles.tipText, textStart]}>{t('contact.tipText')}</Text>
                </View>
              </View>

              <View style={[styles.sectionHeading, styles.policiesHeading]}>
                <Text style={[styles.sectionTitle, textStart]}>
                  {t('contact.policiesTitle')}
                </Text>
                <Text style={[styles.sectionSubtitle, textStart]}>
                  {t('contact.policiesSubtitle')}
                </Text>
              </View>

              <View style={styles.policiesGrid}>
                <PolicyCard
                  icon="shield-checkmark-outline"
                  title={t('contact.privacyTitle')}
                  description={t('contact.privacyText')}
                  cta={t('contact.readPolicy')}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                  desktop={showDesktopChrome}
                  textStart={textStart}
                  isRTL={isRTL}
                />
                <PolicyCard
                  icon="refresh-circle-outline"
                  title={t('contact.returnsTitle')}
                  description={t('contact.returnsText')}
                  cta={t('contact.readPolicy')}
                  onPress={() => navigation.navigate('ReturnPolicy')}
                  desktop={showDesktopChrome}
                  textStart={textStart}
                  isRTL={isRTL}
                />
              </View>
            </View>
          </Container>
        </View>

        <PageFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

function MethodCard({ method, desktop, textStart, isRTL }) {
  return (
    <Pressable
      onPress={method.onPress}
      className={desktop ? 'hover-lift' : undefined}
      style={({ pressed }) => [
        styles.methodCard,
        desktop && styles.methodCardDesktop,
        method.key === 'whatsapp' && styles.methodCardWhatsApp,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`${method.label}: ${method.value}`}
    >
      <View style={styles.methodTop}>
        <View style={[styles.methodIcon, { backgroundColor: method.iconBg }]}>
          <Icon name={method.icon} size={23} color={method.iconColor} />
        </View>
        {method.badge ? (
          <View style={styles.methodBadge}>
            <Text style={[styles.methodBadgeText, textStart]}>{method.badge}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.methodLabel, textStart]}>{method.label}</Text>
      <Text
        style={[
          styles.methodValue,
          textStart,
          styles.methodValueLtr,
          method.key === 'email' && styles.methodValueEmail,
        ]}
        numberOfLines={1}
      >
        {method.value}
      </Text>
      <Text style={[styles.methodHint, textStart]}>{method.hint}</Text>

      <View style={styles.methodCta}>
        <Text style={[styles.methodCtaText, textStart]}>{method.cta}</Text>
        <Icon
          name={isRTL ? 'arrow-back' : 'arrow-forward'}
          size={15}
          color={Colors.primary}
        />
      </View>
    </Pressable>
  );
}

function PolicyCard({ icon, title, description, cta, onPress, desktop, textStart, isRTL }) {
  return (
    <Pressable
      onPress={onPress}
      className={desktop ? 'hover-tint' : undefined}
      style={({ pressed }) => [
        styles.policyCard,
        desktop && styles.policyCardDesktop,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={title}
    >
      <View style={styles.policyIcon}>
        <Icon name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.policyCopy}>
        <Text style={[styles.policyTitle, textStart]}>{title}</Text>
        <Text style={[styles.policyDescription, textStart]}>{description}</Text>
        <View style={styles.policyCta}>
          <Text style={[styles.policyCtaText, textStart]}>{cta}</Text>
          <Icon
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={Colors.primary}
          />
        </View>
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.72,
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.xxl,
    padding: 24,
  },
  heroDesktop: {
    paddingHorizontal: 48,
    paddingVertical: 46,
  },
  heroOrbOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -130,
    right: -60,
  },
  heroOrbTwo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(249,115,22,0.16)',
    bottom: -100,
    left: 80,
  },
  heroCopy: {
    position: 'relative',
    maxWidth: 710,
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroEyebrowIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrowText: {
    fontSize: Typography.sizes.labelMd,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Typography.fontFamilyBold,
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 36,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamilyExtraBold,
  },
  heroTitleDesktop: {
    fontSize: 38,
    lineHeight: 50,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: Typography.sizes.bodyMd,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
    fontFamily: Typography.fontFamilyRegular,
  },
  heroSubtitleDesktop: {
    fontSize: Typography.sizes.bodyLg,
    lineHeight: 28,
    maxWidth: 620,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  heroPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    height: 46,
    ...Shadows.sm,
  },
  heroPrimaryText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.primaryDark,
    fontFamily: Typography.fontFamilyBold,
  },
  heroSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    height: 46,
  },
  heroSecondaryText: {
    fontSize: Typography.sizes.labelLg,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamilySemiBold,
  },

  sectionHeading: {
    marginTop: 32,
    marginBottom: 14,
  },
  policiesHeading: {
    marginTop: 34,
  },
  sectionTitle: {
    fontSize: Typography.sizes.headlineMd,
    lineHeight: 30,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyExtraBold,
  },
  sectionSubtitle: {
    marginTop: 5,
    fontSize: Typography.sizes.bodyMd,
    lineHeight: 22,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },

  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  methodCard: {
    flexBasis: '100%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 18,
    ...Shadows.sm,
  },
  methodCardDesktop: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 220,
  },
  methodCardWhatsApp: {
    borderColor: Colors.success,
    backgroundColor: '#F7FCF9',
  },
  methodTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  methodIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBadge: {
    backgroundColor: Colors.successContainer,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  methodBadgeText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.success,
    fontFamily: Typography.fontFamilyBold,
  },
  methodLabel: {
    fontSize: Typography.sizes.labelMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilySemiBold,
  },
  methodValue: {
    marginTop: 3,
    fontSize: Typography.sizes.titleMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyBold,
  },
  methodValueLtr: {
    writingDirection: 'ltr',
  },
  methodValueEmail: {
    fontSize: Typography.sizes.titleSm,
  },
  methodHint: {
    marginTop: 6,
    fontSize: Typography.sizes.bodySm,
    lineHeight: 19,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },
  methodCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  methodCtaText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 18,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: Radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.onSecondaryContainer,
    fontFamily: Typography.fontFamilyBold,
  },
  tipText: {
    marginTop: 3,
    fontSize: Typography.sizes.bodySm,
    lineHeight: 19,
    color: Colors.onSecondaryContainer,
    fontFamily: Typography.fontFamilyRegular,
  },

  policiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  policyCard: {
    flexBasis: '100%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 20,
    ...Shadows.xs,
  },
  policyCardDesktop: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 300,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopy: {
    flex: 1,
  },
  policyTitle: {
    fontSize: Typography.sizes.titleMd,
    color: Colors.onSurface,
    fontFamily: Typography.fontFamilyBold,
  },
  policyDescription: {
    marginTop: 4,
    fontSize: Typography.sizes.bodySm,
    lineHeight: 20,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyRegular,
  },
  policyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  policyCtaText: {
    fontSize: Typography.sizes.labelLg,
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
});
