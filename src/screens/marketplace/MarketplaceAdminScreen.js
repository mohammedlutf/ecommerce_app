import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import { useAdmin } from '../../context/AdminContext';
import { MarketplaceAdminAPI } from '../../api/marketplace';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';

const ENTRIES = [
  {
    route: 'MarketplaceShops',
    title: 'المتاجر',
    description: 'اعتماد المتاجر وإيقافها وتعديل نسب العمولة والتوصيل.',
    icon: 'storefront-outline',
  },
  {
    route: 'MarketplaceApplications',
    title: 'طلبات فتح المتاجر',
    description: 'مراجعة طلبات البائعين الجدد والبتّ فيها.',
    icon: 'document-text-outline',
  },
  {
    route: 'MarketplacePayouts',
    title: 'كشوف المستحقات',
    description: 'تسوية مستحقات البائعين عن الطلبات المسلّمة.',
    icon: 'wallet-outline',
  },
];

/**
 * MarketplaceAdminScreen — the desk's entry point into the marketplace.
 *
 * A hub rather than three tabs: shops, applications and payouts are different
 * jobs done at different times, and the landing page's only useful function is
 * to say how much work is waiting. The pending-application count is fetched here
 * so the badge is visible before the admin opens the queue.
 */
export default function MarketplaceAdminScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { isAdmin } = useAdmin();

  const [pendingApplications, setPendingApplications] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await MarketplaceAdminAPI.listApplications({ status: 'Pending', limit: 1 });
      setPendingApplications(Number(data?.pending_count) || 0);
    } catch (err) {
      console.warn('Could not load marketplace admin summary:', err.message);
      setPendingApplications(null);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return undefined;
      load({ showSpinner: pendingApplications === null });
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, load])
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={vendorStyles.centre}>
          <Icon name="lock-closed-outline" size={40} color={Colors.textMuted} />
          <Text style={vendorStyles.centreText}>هذه الصفحة متاحة لإدارة المنصة فقط.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={vendorStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={vendorStyles.column}>
          <Text style={[vendorStyles.pageTitle, textStart]}>إدارة المنصة</Text>
          <Text style={[vendorStyles.pageSubtitle, textStart]}>
            اعتماد البائعين، ضبط العمولات، وتسوية المستحقات.
          </Text>

          {loading && pendingApplications === null ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : null}

          {ENTRIES.map((entry) => (
            <TouchableOpacity
              key={entry.route}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(entry.route)}
              style={styles.entry}
            >
              <View style={styles.entryIcon}>
                <Icon name={entry.icon} size={22} color={Colors.primary} />
              </View>
              <View style={vendorStyles.flex1}>
                <Text style={[styles.entryTitle, textStart]}>{entry.title}</Text>
                <Text style={[vendorStyles.muted, textStart]}>{entry.description}</Text>
              </View>
              {entry.route === 'MarketplaceApplications' && pendingApplications > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{pendingApplications}</Text>
                </View>
              ) : null}
              <Icon name="chevron-back" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
    ...Shadows.xs,
  },
  entryIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyExtraBold,
  },
});
