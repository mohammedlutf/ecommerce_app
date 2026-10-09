import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import CategoryCard from '../../components/CategoryCard';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import PageFooter from '../../components/layout/PageFooter';
import CatalogAPI from '../../api/catalog';
import { openProducts } from '../../seo/linking';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

const TILE_COLS = 3;
const TILE_HEIGHT = 102; // image 64 + label + gaps

function ParentSection({ parent, isExpanded, onToggle, onSelectChild }) {
  const { textStart } = useDirectional();
  const childCount = parent.children ? parent.children.length : 0;
  const rows = Math.max(1, Math.ceil(childCount / TILE_COLS));
  const targetHeight = 14 + rows * TILE_HEIGHT + 10;

  const bodyAnim = useRef(new Animated.Value(isExpanded ? targetHeight : 0)).current;
  const bodyOpacity = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const chevronRotate = bodyAnim.interpolate({
    inputRange: [0, targetHeight],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bodyAnim, {
        toValue: isExpanded ? targetHeight : 0,
        duration: 240,
        useNativeDriver: false,
      }),
      Animated.timing(bodyOpacity, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded, targetHeight, bodyAnim, bodyOpacity]);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => onToggle(parent.name)}
        style={styles.sectionHeader}
        android_ripple={{ color: Colors.surfaceContainerLow }}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.folderIcon}>
            <Icon name="folder-open-outline" size={18} color={Colors.primary} />
          </View>
          {/*
           * Aligned on the row, not only on the string: this is a full-width row
           * with a fixed icon and a count badge, so the name is positioned by the
           * leftover space and hugs whichever edge the icon is not on. The
           * `parentName` style already carries `flex: 1` and `textAlign` inherits
           * through it in CSS but not into `<Text>` on native, hence both.
           */}
          <Text style={[styles.parentName, textStart]} numberOfLines={1}>
            {parent.name}
          </Text>
          <View style={styles.countBadge}>
            <Text style={[styles.countBadgeText, textStart]}>{childCount}</Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Icon name="chevron-down" size={18} color={Colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={{ height: bodyAnim, opacity: bodyOpacity, overflow: 'hidden' }}>
        <View style={styles.childGrid}>
          {(parent.children || []).map((child) => (
            <View key={child.name} style={styles.childCell}>
              <CategoryCard
                category={child}
                variant="tile"
                onSelect={() => onSelectChild(child.name)}
              />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export default function CategoriesScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { t } = useI18n();
  useDocumentHead({
    title: t('seo.categoriesTitle'),
    description: t('seo.categoriesDescription'),
    path: '/categories',
  });
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await CatalogAPI.getItemGroupHierarchy();
      setHierarchy(h);
      /*
       * Every group starts collapsed.
       *
       * This used to auto-expand `h[0]`, which meant arriving from the home page
       * dropped the shopper straight into the first group with a tile grid already
       * open, hiding the fact that the other groups were sitting there to be
       * picked. The list of groups *is* the navigation on this screen, so it
       * opens by showing the navigation.
       *
       * Assigned rather than merged so re-running `load` (the retry button)
       * cannot leave a group stuck open after the shopper has collapsed it.
       */
      setExpanded({});
    } catch (err) {
      console.warn('Could not load categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(name) {
    setExpanded((cur) => ({ ...cur, [name]: !cur[name] }));
  }

  function selectChild(name) {
    // `search: undefined` clears any search left in the route params, otherwise
    // react-navigation's param merge would scope this group to that search.
    openProducts(navigation, { itemGroup: name, extra: { search: undefined } });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <LoadingSkeleton height={44} borderRadius={Radius.lg} />
              <View style={styles.skeletonGrid}>
                {[1, 2, 3].map((j) => (
                  <LoadingSkeleton key={j} width={64} height={80} borderRadius={Radius.xl} />
                ))}
              </View>
            </View>
          ))}
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.title, textStart]}>تصفح المتجر</Text>
          <Text style={[styles.subtitle, textStart]}>
            اختر القسم الرئيسي ثم استكشف التصنيفات الفرعية
          </Text>
        </View>

        {hierarchy.map((parent) => (
          <ParentSection
            key={parent.name}
            parent={parent}
            isExpanded={!!expanded[parent.name]}
            onToggle={toggle}
            onSelectChild={selectChild}
          />
        ))}

        {loading ? (
          <View style={styles.retryRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : null}

        {/* Desktop-only site footer; see HomeScreen for why it sits in the ScrollView. */}
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  headerBlock: {
    marginBottom: 4,
  },
  title: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    marginTop: 2,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentName: {
    flex: 1,
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.onSecondaryContainer,
    fontFamily: Typography.fontFamilyBold,
  },
  childGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 12,
  },
  childCell: {
    width: `${100 / TILE_COLS}%`,
    paddingVertical: 6,
    alignItems: 'center',
  },
  skeletonList: {
    padding: 16,
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  retryRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});
