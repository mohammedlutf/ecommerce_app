import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import CategoryCard from '../../components/CategoryCard';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ProductImage from '../../components/ProductImage';
import PageFooter from '../../components/layout/PageFooter';
import CatalogAPI from '../../api/catalog';
import { openProducts } from '../../seo/linking';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';
import { useSiteChrome } from '../../hooks/useResponsive';

/**
 * "n sub-categories", which Arabic declines in four forms rather than two.
 */
function childrenLabel(count) {
  if (count === 0) return 'لا توجد تصنيفات فرعية';
  if (count === 1) return 'تصنيف فرعي واحد';
  if (count === 2) return 'تصنيفان فرعيان';
  if (count <= 10) return `${count} تصنيفات فرعية`;
  return `${count} تصنيفاً فرعياً`;
}

/**
 * One department in the rail.
 *
 * The rail is narrow (30% of the screen), so the tab stacks thumbnail, name and
 * count rather than sitting them in a row: three columns of text in ~100dp is
 * how a category list ends up with every second name truncated.
 */
function ParentTab({ parent, isActive, onPress }) {
  const { textStart } = useDirectional();
  const count = parent.children ? parent.children.length : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.tab,
        isActive && styles.tabActive,
        pressed && !isActive && styles.tabPressed,
      ]}
    >
      <View style={[styles.tabThumb, isActive && styles.tabThumbActive]}>
        <ProductImage
          source={parent.image}
          style={styles.tabThumbImage}
          fallbackIcon="pricetags-outline"
          fallbackIconSize={20}
          fallbackIconColor={isActive ? Colors.primary : Colors.textMuted}
        />
      </View>

      {/* Centred over the thumbnail, so `textStart` is spread first and then
          overridden: it still carries the bidi `writingDirection` for Arabic. */}
      <Text
        style={[styles.tabLabel, textStart, styles.centredText, isActive && styles.tabLabelActive]}
        numberOfLines={2}
      >
        {parent.name}
      </Text>

      {count > 0 ? (
        <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
          <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The pane beside the rail: the selected department's sub-categories.
 *
 * It owns its own scroll view, so switching departments never has to reset a
 * shared page offset — and so the rail stays where it is while a long grid of
 * sub-categories scrolls.
 */
function CategoryPane({ parent, columns, onOpenGroup, desktop }) {
  const { textStart, isRTL } = useDirectional();
  const children = parent.children || [];

  return (
    <View style={styles.pane}>
      <View style={styles.paneHeader}>
        <View style={styles.paneHeading}>
          <Text style={[styles.paneTitle, textStart]} numberOfLines={1}>
            {parent.name}
          </Text>
          <Text style={[styles.paneSubtitle, textStart]}>{childrenLabel(children.length)}</Text>
        </View>

        <Pressable
          onPress={() => onOpenGroup(parent.name)}
          accessibilityRole="button"
          accessibilityLabel={`عرض كل منتجات ${parent.name}`}
          style={({ pressed }) => [styles.paneAll, pressed && styles.paneAllPressed]}
        >
          <Text style={styles.paneAllText}>عرض الكل</Text>
          <Icon name={isRTL ? 'chevron-forward' : 'chevron-back'} size={13} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.paneContent}
        showsVerticalScrollIndicator={false}
      >
        {children.length === 0 ? (
          <View style={styles.paneEmpty}>
            <View style={styles.paneEmptyIcon}>
              <Icon name="pricetags-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={[styles.paneEmptyTitle, textStart, styles.centredText]}>
              لا توجد تصنيفات فرعية
            </Text>
            <Text style={[styles.paneEmptyText, textStart, styles.centredText]}>
              هذا القسم ليس مقسماً؛ يمكنك تصفح كل منتجاته مباشرة.
            </Text>
            <Pressable
              onPress={() => onOpenGroup(parent.name)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.paneEmptyBtn, pressed && styles.paneEmptyBtnPressed]}
            >
              <Text style={styles.paneEmptyBtnText}>تصفح منتجات القسم</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {children.map((child) => (
              <View key={child.name} style={[styles.gridCell, { width: `${100 / columns}%` }]}>
                <CategoryCard
                  category={child}
                  variant="tile"
                  onSelect={() => onOpenGroup(child.name)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Desktop-only site footer. It rides in the pane rather than after the
            split because the split fills the viewport, so there is no page flow
            left for it to sit at the end of. */}
        {desktop ? <PageFooter /> : null}
      </ScrollView>
    </View>
  );
}

export default function CategoriesScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  const { showDesktopChrome } = useSiteChrome();
  const { width: windowWidth } = useWindowDimensions();
  useDocumentHead({
    title: t('seo.categoriesTitle'),
    description: t('seo.categoriesDescription'),
    path: '/categories',
  });

  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await CatalogAPI.getItemGroupHierarchy();
      setHierarchy(h);
      /*
       * A department is always open.
       *
       * The screen is a browser: a rail of departments with nothing beside it
       * answers "what departments exist?" but not "what is in this shop?", and
       * the shopper would have to tap before seeing a single product group.
       * Kept if it is still in the new payload, so a retry does not jump back to
       * the first department.
       */
      setSelected((current) => {
        const names = (Array.isArray(h) ? h : []).map((group) => group.name);
        return names.includes(current) ? current : names[0] || null;
      });
    } catch (err) {
      console.warn('Could not load categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openGroup(name) {
    // `search: undefined` clears any search left in the route params, otherwise
    // react-navigation's param merge would scope this group to that search.
    openProducts(navigation, { itemGroup: name, extra: { search: undefined } });
  }

  // Column count follows the window, not the pane: the pane is a fixed share of
  // the window, so measuring the window is enough to stop 92dp tiles floating in
  // a sea of white on a desktop without pulling in an onLayout round trip.
  const columns =
    windowWidth >= 1200 ? 6 : windowWidth >= 1000 ? 5 : windowWidth >= 820 ? 4 : windowWidth >= 620 ? 3 : 2;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={styles.heroSkeleton}>
          <LoadingSkeleton height={72} borderRadius={Radius.xl} />
        </View>
        <View style={styles.split}>
          <View style={styles.rail}>
            <View style={styles.railContent}>
              {[1, 2, 3, 4].map((i) => (
                <LoadingSkeleton key={i} height={80} borderRadius={Radius.lg} />
              ))}
            </View>
          </View>
          <View style={styles.pane}>
            <View style={styles.paneHeader}>
              <LoadingSkeleton width={120} height={16} borderRadius={Radius.sm} />
              <LoadingSkeleton width={70} height={28} borderRadius={Radius.full} />
            </View>
            <View style={styles.paneContent}>
              <View style={styles.grid}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.gridCell, { width: '50%' }]}>
                    <View style={styles.gridSkeletonCell}>
                      <LoadingSkeleton width={92} height={92} borderRadius={Radius.xl} />
                      <LoadingSkeleton width={62} height={11} borderRadius={Radius.xs} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <EmptyState
          icon="pricetags-outline"
          title="تعذر تحميل التصنيفات"
          description="الرجاء التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      </SafeAreaView>
    );
  }

  const active = hierarchy.find((group) => group.name === selected) || hierarchy[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, textStart]}>تصفح المتجر</Text>
          <Text style={[styles.heroSub, textStart]}>
            اختر القسم من القائمة ثم استكشف تصنيفاته الفرعية
          </Text>
        </View>
        <View style={styles.heroBadge}>
          <Icon name="pricetags-outline" size={16} color={Colors.primary} />
          <Text style={styles.heroBadgeText}>{hierarchy.length}</Text>
        </View>
      </View>

      <View style={styles.split}>
        <View style={styles.rail}>
          <View style={styles.railHeader}>
            <Text style={[styles.railHeaderText, textStart, styles.centredText]}>الأقسام</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.railContent}
            showsVerticalScrollIndicator={false}
          >
            {hierarchy.map((parent) => (
              <ParentTab
                key={parent.name}
                parent={parent}
                isActive={parent.name === active.name}
                onPress={() => setSelected(parent.name)}
              />
            ))}
          </ScrollView>
        </View>

        <CategoryPane
          parent={active}
          columns={columns}
          onOpenGroup={openGroup}
          desktop={showDesktopChrome}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centredText: {
    textAlign: 'center',
  },

  // ---- Hero ---------------------------------------------------------------
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primaryDark,
  },
  heroSub: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onPrimaryContainer,
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.xs,
  },
  heroBadgeText: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  heroSkeleton: {
    marginHorizontal: 12,
    marginTop: 12,
  },

  // ---- Split --------------------------------------------------------------
  // `direction: 'ltr'` is deliberate and physical: the brief was the departments
  // down the left at 30% of the width, and the app's RTL layout direction would
  // otherwise mirror that to the right. Scoped to this container so nothing else
  // on the screen inherits it.
  split: {
    flex: 1,
    flexDirection: 'row',
    direction: 'ltr',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // ---- Rail ---------------------------------------------------------------
  rail: {
    width: '30%',
    // 30% of a desktop window is a corridor of empty space around each tab.
    maxWidth: 260,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  railHeader: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceContainerLow,
  },
  railHeaderText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  railContent: {
    padding: 6,
    gap: 6,
  },
  tab: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSubtle,
    // The accent sits on the edge of the tab that faces the pane it controls.
    borderRightWidth: 3,
    borderRightColor: Colors.primary,
    ...Shadows.sm,
  },
  tabPressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  tabThumb: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabThumbActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  tabThumbImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    width: '100%',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilyBold,
  },
  tabCount: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
  tabCountActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabCountText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textMuted,
  },
  tabCountTextActive: {
    color: Colors.primary,
  },

  // ---- Pane ---------------------------------------------------------------
  pane: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  paneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  paneHeading: {
    flex: 1,
  },
  paneTitle: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  paneSubtitle: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    marginTop: 1,
  },
  paneAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  paneAllPressed: {
    backgroundColor: Colors.primaryContainer,
  },
  paneAllText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  paneContent: {
    padding: 10,
    paddingBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  gridSkeletonCell: {
    alignItems: 'center',
    gap: 7,
  },
  paneEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30,
    paddingHorizontal: 12,
  },
  paneEmptyIcon: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  paneEmptyTitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  paneEmptyText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
  },
  paneEmptyBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  paneEmptyBtnPressed: {
    backgroundColor: Colors.primaryPress,
  },
  paneEmptyBtnText: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onPrimary,
  },
});
