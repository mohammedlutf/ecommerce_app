import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import DashboardShell from '../../components/layout/DashboardShell';
import { useAdmin } from '../../context/AdminContext';
import { MarketplaceAdminAPI } from '../../api/marketplace';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows, Spacing } from '../../theme/spacing';
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
 *
 * ## On the web
 *
 * The phone version is a list of three links. On a desktop that is a very thin
 * page, so the web build turns it into a console: a permanent rail with the
 * three sections on one side, and a summary of the outstanding work on the
 * other. The counts come from the same list endpoints the sections use — a
 * request with a limit of one — so nothing here is a second source of truth.
 */
export default function MarketplaceAdminScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { isAdmin } = useAdmin();

  const [pendingApplications, setPendingApplications] = useState(null);
  const [shopCount, setShopCount] = useState(null);
  const [payoutCount, setPayoutCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);

    /*
     * Each count is settled on its own.
     *
     * `Promise.all` would drop all three counts because one endpoint failed,
     * and the page would show nothing at all — even the sections that were
     * answering fine. A missing figure is shown as "—"; it does not take the
     * other two down with it.
     */
    const [apps, shops, payouts] = await Promise.allSettled([
      MarketplaceAdminAPI.listApplications({ status: 'Pending', limit: 1 }),
      MarketplaceAdminAPI.listShops({ limit: 1 }),
      MarketplaceAdminAPI.listPayouts({ limit: 1 }),
    ]);

    if (apps.status === 'fulfilled') {
      setPendingApplications(Number(apps.value?.pending_count) || 0);
    } else {
      setPendingApplications(null);
    }

    if (shops.status === 'fulfilled') {
      setShopCount(Number(shops.value?.total) || 0);
    } else {
      setShopCount(null);
    }

    if (payouts.status === 'fulfilled') {
      setPayoutCount(Number(payouts.value?.total) || 0);
    } else {
      setPayoutCount(null);
    }

    if (showSpinner) setLoading(false);
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
      <SafeAreaView style={vendorStyles.safeArea} edges={['left', 'right']}>
        <View style={vendorStyles.centre}>
          <Icon name="lock-closed-outline" size={40} color={Colors.textMuted} />
          <Text style={vendorStyles.centreText}>هذه الصفحة متاحة لإدارة المنصة فقط.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tiles = [
    {
      label: 'المتاجر المعتمدة',
      value: shopCount === null ? '—' : String(shopCount),
      icon: 'storefront-outline',
      tone: Colors.primary,
    },
    {
      label: 'طلبات بانتظار المراجعة',
      value: pendingApplications === null ? '—' : String(pendingApplications),
      icon: 'document-text-outline',
      tone: pendingApplications ? Colors.warning : Colors.textMuted,
    },
    {
      label: 'كشوف المستحقات',
      value: payoutCount === null ? '—' : String(payoutCount),
      icon: 'wallet-outline',
      tone: Colors.info,
    },
  ];

  return (
    <DashboardShell
      navItems={ENTRIES.map((entry) => ({
        route: entry.route,
        label: entry.title,
        icon: entry.icon,
        badge: entry.route === 'MarketplaceApplications' ? pendingApplications : 0,
      }))}
      activeRoute="MarketplaceAdmin"
      onNavigate={(route) => navigation.navigate(route)}
      brand="إدارة المنصة"
      brandSub="متجر البائعين والمستحقات"
      contentStyle={vendorStyles.scrollContent}
    >
      <Text style={[vendorStyles.pageTitle, textStart]}>إدارة المنصة</Text>
      <Text style={[vendorStyles.pageSubtitle, textStart]}>
        اعتماد البائعين، ضبط العمولات، وتسوية المستحقات.
      </Text>

      {loading && pendingApplications === null ? (
        <View style={vendorStyles.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.tileGrid}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: `${tile.tone}1A` }]}>
                <Icon name={tile.icon} size={18} color={tile.tone} />
              </View>
              <Text style={[styles.tileValue, textStart]}>{tile.value}</Text>
              <Text style={[styles.tileLabel, textStart]}>{tile.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.entryGrid}>
        {ENTRIES.map((entry) => (
          <TouchableOpacity
            key={entry.route}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(entry.route)}
            className="hover-tint"
            style={styles.entry}
          >
            <View style={styles.entryIcon}>
              <Icon name={entry.icon} size={22} color={Colors.primary} />
            </View>
            <View style={vendorStyles.flex1}>
              <Text style={[styles.entryTitle, textStart]}>{entry.title}</Text>
              <Text style={[styles.muted, textStart]}>{entry.description}</Text>
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
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
  },
  // --- Summary tiles --------------------------------------------------------
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 200,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    ...Shadows.xs,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  tileLabel: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // --- Entries --------------------------------------------------------------
  entryGrid: {
    gap: 12,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
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
