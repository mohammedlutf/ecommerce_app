import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import useConfirm from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useAdmin } from '../../context/AdminContext';
import { MarketplaceAdminAPI } from '../../api/marketplace';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import { normaliseDecimalInput, parseDecimal } from '../../utils/numbers';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';

const PAGE_SIZE = 20;

const FILTER_STATUSES = ['All', 'Pending', 'Approved', 'Suspended', 'Rejected'];

const SHOP_STATUS = {
  Pending: { label: 'قيد المراجعة', bg: Colors.warningContainer, fg: Colors.warning, icon: 'time-outline' },
  Approved: { label: 'معتمد', bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Suspended: { label: 'موقوف', bg: Colors.errorContainer, fg: Colors.error, icon: 'ban-outline' },
  Rejected: { label: 'مرفوض', bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
};

function shopStatus(status) {
  return (
    SHOP_STATUS[status] || {
      label: status || '—',
      bg: Colors.surfaceContainer,
      fg: Colors.onSurfaceVariant,
      icon: 'help-circle-outline',
    }
  );
}

/**
 * MarketplaceShopsScreen — every vendor shop, with the controls the desk needs.
 *
 * The row carries the two decisions that are made constantly (approve / suspend)
 * so common work takes one tap; the detail sheet is for the rarer job of editing
 * a shop's commercial terms. Rates are edited there rather than inline because a
 * mistyped commission is not obvious until a payout is wrong weeks later, and a
 * sheet with a labelled field and a save button is harder to fat-finger than a
 * bare inline box.
 */
export default function MarketplaceShopsScreen() {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const { isAdmin } = useAdmin();

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [shops, setShops] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState(null);

  const [detailName, setDetailName] = useState(null);

  const requestRef = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const searchRef = useRef('');
  searchRef.current = debouncedSearch;
  const countRef = useRef(0);
  countRef.current = shops.length;

  const load = useCallback(
    async ({
      start = 0,
      append = false,
      showSpinner = true,
      status = filterRef.current,
      term = searchRef.current,
    } = {}) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await MarketplaceAdminAPI.listShops({
          status,
          search: term || null,
          start,
          limit: PAGE_SIZE,
        });
        if (requestId !== requestRef.current) return;
        if (status !== filterRef.current || term !== searchRef.current) return;

        const rows = Array.isArray(data?.shops) ? data.shops : [];
        setShops((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(data?.total) || 0);
        setHasMore(!!data?.has_more);
      } catch (err) {
        if (requestId === requestRef.current) toast.error(err?.message || 'تعذر تحميل المتاجر');
      } finally {
        if (requestId === requestRef.current) {
          if (append) setLoadingMore(false);
          else if (showSpinner) setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [toast]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return undefined;
      load({ showSpinner: shops.length === 0 });
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, load])
  );

  // Re-query from the top whenever the settled search term changes.
  React.useEffect(() => {
    if (!isAdmin) return;
    searchRef.current = debouncedSearch;
    load({ start: 0, showSpinner: true, term: debouncedSearch });
  }, [debouncedSearch, isAdmin, load]);

  function handleFilterChange(next) {
    setFilter(next);
    filterRef.current = next;
    setShops([]);
    setHasMore(false);
    load({ start: 0, showSpinner: true, status: next });
  }

  function handleRefresh() {
    setRefreshing(true);
    load({ showSpinner: false });
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    load({ start: countRef.current, append: true, showSpinner: false });
  }

  async function runAction(name, action) {
    setActioning(name);
    try {
      if (action === 'approve') await MarketplaceAdminAPI.approveShop(name);
      else if (action === 'suspend') await MarketplaceAdminAPI.suspendShop(name);
      else if (action === 'reinstate') await MarketplaceAdminAPI.reinstateShop(name);
      toast.success(
        action === 'approve'
          ? 'تم اعتماد المتجر'
          : action === 'suspend'
            ? 'تم إيقاف المتجر'
            : 'تم إعادة تفعيل المتجر'
      );
      await load({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setActioning(null);
    }
  }

  function confirmAction(shop, action) {
    const verb =
      action === 'approve' ? 'اعتماد' : action === 'suspend' ? 'إيقاف' : 'إعادة تفعيل';
    confirm({
      title: `${verb} المتجر`,
      message:
        action === 'suspend'
          ? `سيتم إيقاف «${shop.shop_name}» وإخفاء منتجاته عن العملاء.`
          : action === 'approve'
            ? `سيتم اعتماد «${shop.shop_name}» وإنشاء مورد مرتبط به تلقائياً.`
            : `سيتم إعادة تفعيل «${shop.shop_name}» وظهور منتجاته للعملاء.`,
      confirmLabel: `نعم، ${verb}`,
      cancelLabel: 'تراجع',
      tone: action === 'suspend' ? 'destructive' : 'default',
      onConfirm: () => runAction(shop.name, action),
    });
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث باسم المتجر أو البائع..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTER_STATUSES.map((status) => {
            const active = filter === status;
            const label =
              status === 'All'
                ? 'الكل'
                : status === 'Pending'
                  ? 'قيد المراجعة'
                  : shopStatus(status).label;
            return (
              <TouchableOpacity
                key={status}
                activeOpacity={0.8}
                onPress={() => handleFilterChange(status)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, textStart, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={vendorStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={vendorStyles.column}>
          <Text style={[vendorStyles.hint, textStart]}>{total} متجر</Text>

          {loading && shops.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل المتاجر...</Text>
            </View>
          ) : shops.length === 0 ? (
            <EmptyState
              icon="storefront-outline"
              title="لا توجد متاجر"
              description={search ? 'جرّب كلمة بحث أخرى.' : 'لم يتقدّم أي بائع بعد.'}
            />
          ) : (
            <>
              {shops.map((shop) => {
                const info = shopStatus(shop.status);
                const busy = actioning === shop.name;
                return (
                  <View key={shop.name} style={vendorStyles.listItem}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setDetailName(shop.name)}
                      style={vendorStyles.rowBetween}
                    >
                      <View style={vendorStyles.flex1}>
                        <View style={[vendorStyles.row, { gap: 6 }]}>
                          <Text style={[vendorStyles.value, textStart]} numberOfLines={1}>
                            {shop.shop_name || shop.name}
                          </Text>
                          {Number(shop.is_platform) === 1 ? (
                            <View style={[vendorStyles.badge, { backgroundColor: Colors.primaryContainer }]}>
                              <Text style={[vendorStyles.badgeText, textStart, { color: Colors.primaryDark }]}>
                                المنصة
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
                          {shop.vendor_user_fullname || shop.vendor_user || '—'}
                          {shop.product_count != null ? ` · ${shop.product_count} منتج` : ''}
                          {shop.order_count != null ? ` · ${shop.order_count} طلب` : ''}
                        </Text>
                      </View>
                      <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                        <Icon name={info.icon} size={13} color={info.fg} />
                        <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                      </View>
                    </TouchableOpacity>

                    {shop.supplier_missing ? (
                      <View style={styles.warnRow}>
                        <Icon name="warning-outline" size={14} color={Colors.warning} />
                        <Text style={[styles.warnText, textStart]}>
                          لا يوجد مورد مرتبط؛ إعادة الاعتماد ستنشئه.
                        </Text>
                      </View>
                    ) : null}

                    {Number(shop.is_platform) === 1 ? (
                      <Text style={[vendorStyles.muted, textStart, { marginTop: 10 }]}>
                        متجر المنصة الافتراضي؛ لا يمكن إيقافه.
                      </Text>
                    ) : (
                      <View style={[vendorStyles.rowWrap, { marginTop: 12 }]}>
                        {shop.status !== 'Approved' ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={busy}
                            onPress={() => confirmAction(shop, 'approve')}
                            style={[vendorStyles.smallBtn, busy && vendorStyles.disabled]}
                          >
                            {busy ? (
                              <ActivityIndicator size="small" color={Colors.onPrimary} />
                            ) : (
                              <>
                                <Icon name="checkmark" size={15} color={Colors.onPrimary} />
                                <Text style={[vendorStyles.smallBtnText, textStart]}>اعتماد</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={busy}
                            onPress={() => confirmAction(shop, 'suspend')}
                            style={[styles.suspendBtn, busy && vendorStyles.disabled]}
                          >
                            {busy ? (
                              <ActivityIndicator size="small" color={Colors.error} />
                            ) : (
                              <>
                                <Icon name="ban-outline" size={15} color={Colors.error} />
                                <Text style={[styles.suspendBtnText, textStart]}>إيقاف</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                        {shop.status === 'Suspended' ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={busy}
                            onPress={() => confirmAction(shop, 'reinstate')}
                            style={[vendorStyles.secondaryBtn, { paddingVertical: 8 }, busy && vendorStyles.disabled]}
                          >
                            <Icon name="refresh-outline" size={15} color={Colors.primary} />
                            <Text style={[vendorStyles.secondaryBtnText, textStart]}>إعادة تفعيل</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setDetailName(shop.name)}
                          style={[vendorStyles.secondaryBtn, { paddingVertical: 8 }]}
                        >
                          <Icon name="create-outline" size={15} color={Colors.primary} />
                          <Text style={[vendorStyles.secondaryBtnText, textStart]}>تفاصيل</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {hasMore ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={vendorStyles.loadMoreBtn}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={[vendorStyles.loadMoreText, textStart]}>
                      عرض المزيد ({shops.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <ShopDetailModal
        visible={!!detailName}
        shopName={detailName}
        onClose={() => setDetailName(null)}
        onSaved={() => load({ showSpinner: false })}
      />

      {confirmDialog}
    </SafeAreaView>
  );
}

/**
 * ShopDetailModal — edit a shop's commercial terms.
 *
 * Reads the shop fresh on each open (the list row is a projection and may be
 * stale), and sends only the fields the admin actually changed — the same
 * "nothing silently overwritten" rule the product editor follows.
 */
function ShopDetailModal({ visible, shopName, onClose, onSaved }) {
  const { textStart } = useDirectional();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [shop, setShop] = useState(null);

  const [commission, setCommission] = useState('');
  const [delivery, setDelivery] = useState('');
  const [description, setDescription] = useState('');
  const [original, setOriginal] = useState(null);

  React.useEffect(() => {
    if (!visible || !shopName) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    MarketplaceAdminAPI.getShop(shopName)
      .then((data) => {
        if (cancelled) return;
        setShop(data || null);
        setCommission(data?.commission_rate != null ? String(data.commission_rate) : '');
        setDelivery(data?.delivery_rate != null ? String(data.delivery_rate) : '0');
        setDescription(data?.description || '');
        setOriginal({
          commission: data?.commission_rate != null ? Number(data.commission_rate) : null,
          delivery: Number(data?.delivery_rate || 0),
          description: data?.description || '',
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'تعذر تحميل بيانات المتجر');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, shopName]);

  async function handleSave() {
    if (!original) return;
    const payload = {};

    const commissionValue = parseDecimal(commission);
    if (commissionValue !== null && commissionValue !== original.commission) {
      if (commissionValue < 0 || commissionValue > 100) {
        toast.error('نسبة العمولة يجب أن تكون بين 0 و 100');
        return;
      }
      payload.commission_rate = commissionValue;
    }

    const deliveryValue = parseDecimal(delivery);
    if (deliveryValue !== null && deliveryValue !== original.delivery) {
      if (deliveryValue < 0) {
        toast.error('رسوم التوصيل لا يمكن أن تكون سالبة');
        return;
      }
      payload.delivery_rate = deliveryValue;
    }

    if (description !== original.description) payload.description = description;

    if (Object.keys(payload).length === 0) {
      toast.success('لا توجد تغييرات لحفظها');
      return;
    }

    setSaving(true);
    try {
      await MarketplaceAdminAPI.updateShop(shopName, payload);
      toast.success('تم حفظ بيانات المتجر');
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      toast.error(err?.message || 'تعذر حفظ البيانات');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <View style={vendorStyles.flex1}>
            <Text style={[styles.detailTitle, textStart]}>بيانات المتجر</Text>
            <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
              {shop?.shop_name || shopName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Icon name="close" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={vendorStyles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={vendorStyles.column}>
            {loading ? (
              <View style={vendorStyles.centre}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : loadError ? (
              <View style={vendorStyles.centre}>
                <Icon name="alert-circle-outline" size={40} color={Colors.error} />
                <Text style={vendorStyles.centreText}>{loadError}</Text>
              </View>
            ) : shop ? (
              <>
                <View style={vendorStyles.card}>
                  <View style={vendorStyles.rowBetween}>
                    <Text style={[vendorStyles.muted, textStart]}>الحالة</Text>
                    <View style={[vendorStyles.badge, { backgroundColor: shopStatus(shop.status).bg }]}>
                      <Text
                        style={[vendorStyles.badgeText, textStart, { color: shopStatus(shop.status).fg }]}
                      >
                        {shopStatus(shop.status).label}
                      </Text>
                    </View>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>البائع</Text>
                    <Text style={[vendorStyles.value, textStart]}>
                      {shop.vendor_user_fullname || shop.vendor_user || '—'}
                    </Text>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>المنتجات</Text>
                    <Text style={[vendorStyles.value, textStart]}>{shop.product_count ?? '—'}</Text>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>الطلبات</Text>
                    <Text style={[vendorStyles.value, textStart]}>{shop.order_count ?? '—'}</Text>
                  </View>
                  {shop.supplier ? (
                    <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>المورد المرتبط</Text>
                      <Text style={[vendorStyles.value, textStart]}>{shop.supplier}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={vendorStyles.card}>
                  <Text style={[vendorStyles.cardTitle, textStart]}>الشروط التجارية</Text>

                  <View style={vendorStyles.field}>
                    <Text style={[vendorStyles.label, textStart]}>نسبة العمولة (%)</Text>
                    <TextInput
                      style={vendorStyles.input}
                      value={commission}
                      onChangeText={(text) => setCommission(normaliseDecimalInput(text))}
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={vendorStyles.field}>
                    <Text style={[vendorStyles.label, textStart]}>رسوم التوصيل</Text>
                    <TextInput
                      style={vendorStyles.input}
                      value={delivery}
                      onChangeText={(text) => setDelivery(normaliseDecimalInput(text))}
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={vendorStyles.field}>
                    <Text style={[vendorStyles.label, textStart]}>وصف المتجر</Text>
                    <TextInput
                      style={[vendorStyles.input, vendorStyles.inputMultiline]}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      maxLength={1000}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                {shop.bank_name || shop.account_number ? (
                  <View style={vendorStyles.card}>
                    <Text style={[vendorStyles.cardTitle, textStart]}>بيانات الحساب البنكي</Text>
                    <View style={vendorStyles.rowBetween}>
                      <Text style={[vendorStyles.muted, textStart]}>البنك</Text>
                      <Text style={[vendorStyles.value, textStart]}>{shop.bank_name || '—'}</Text>
                    </View>
                    <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>صاحب الحساب</Text>
                      <Text style={[vendorStyles.value, textStart]}>{shop.account_holder || '—'}</Text>
                    </View>
                    <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>رقم الحساب</Text>
                      <Text style={[vendorStyles.value, textStart]}>{shop.account_number || '—'}</Text>
                    </View>
                  </View>
                ) : null}

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
                      <Text style={[vendorStyles.primaryBtnText, textStart]}>حفظ التعديلات</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
    padding: 0,
  },
  filterBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: Colors.onPrimary,
    fontFamily: Typography.fontFamilyBold,
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  suspendBtnText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.error,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.warningContainer,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warnText: {
    flex: 1,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  detailTitle: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
});
