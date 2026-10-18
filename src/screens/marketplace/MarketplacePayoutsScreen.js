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
import { Radius } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';
import { payoutStatus } from '../../components/vendor/vendorStatus';

const PAGE_SIZE = 12;

const FILTER_STATUSES = ['All', 'Draft', 'Submitted', 'Paid', 'Cancelled'];

const STATUS_LABEL = {
  All: 'الكل',
  Draft: 'مسودة',
  Submitted: 'بانتظار الدفع',
  Paid: 'مدفوع',
  Cancelled: 'ملغى',
};

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * MarketplacePayoutsScreen — settlements across every shop.
 *
 * Creating a payout is deliberately two steps: preview, then commit. The panel
 * asks the backend what the period *would* include and shows the totals before
 * anything is written, so an admin cannot discover a mistyped date range by
 * having already drafted a settlement for it.
 */
export default function MarketplacePayoutsScreen() {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const { isAdmin } = useAdmin();

  const [filter, setFilter] = useState('All');
  const [payouts, setPayouts] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detailName, setDetailName] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const requestRef = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const countRef = useRef(0);
  countRef.current = payouts.length;

  const load = useCallback(
    async ({ start = 0, append = false, showSpinner = true, status = filterRef.current } = {}) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await MarketplaceAdminAPI.listPayouts({ status, start, limit: PAGE_SIZE });
        if (requestId !== requestRef.current) return;
        if (status !== filterRef.current) return;

        const rows = Array.isArray(data?.payouts) ? data.payouts : [];
        setPayouts((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(data?.total) || 0);
        setHasMore(!!data?.has_more);
      } catch (err) {
        if (requestId === requestRef.current) toast.error(err?.message || 'تعذر تحميل المستحقات');
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
      load({ showSpinner: payouts.length === 0 });
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, load])
  );

  function handleFilterChange(next) {
    setFilter(next);
    filterRef.current = next;
    setPayouts([]);
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

  function currentQuery() {
    return { status: filterRef.current, start: 0 };
  }

  return (
    <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTER_STATUSES.map((status) => {
            const active = filter === status;
            return (
              <TouchableOpacity
                key={status}
                activeOpacity={0.8}
                onPress={() => handleFilterChange(status)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, textStart, active && styles.chipTextActive]}>
                  {STATUS_LABEL[status] || status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={vendorStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={vendorStyles.column}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setCreateOpen(true)}
            style={vendorStyles.primaryBtn}
          >
            <Icon name="add-circle-outline" size={19} color={Colors.onPrimary} />
            <Text style={[vendorStyles.primaryBtnText, textStart]}>إنشاء كشف مستحقات</Text>
          </TouchableOpacity>

          <Text style={[vendorStyles.hint, textStart, { marginTop: 16 }]}>{total} كشف</Text>

          {loading && payouts.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل المستحقات...</Text>
            </View>
          ) : payouts.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="لا توجد كشوف"
              description={
                filter === 'All'
                  ? 'أنشئ كشف مستحقات لتسوية طلبات البائع المسلّمة.'
                  : 'لا توجد كشوف بهذه الحالة.'
              }
            />
          ) : (
            <>
              {payouts.map((payout) => {
                const info = payoutStatus(payout.status);
                return (
                  <TouchableOpacity
                    key={payout.name}
                    activeOpacity={0.85}
                    onPress={() => setDetailName(payout.name)}
                    style={vendorStyles.listItem}
                  >
                    <View style={vendorStyles.rowBetween}>
                      <View style={vendorStyles.flex1}>
                        <Text style={[vendorStyles.value, textStart]} numberOfLines={1}>
                          {payout.shop_name || payout.shop || payout.name}
                        </Text>
                        <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
                          {formatDate(payout.from_date)} — {formatDate(payout.to_date)}
                        </Text>
                      </View>
                      <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                        <Icon name={info.icon} size={13} color={info.fg} />
                        <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                      </View>
                    </View>
                    <View style={[vendorStyles.rowBetween, { marginTop: 12 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>
                        {payout.name}
                      </Text>
                      <Text style={[styles.netValue, textStart]}>{formatCurrency(payout.total_net)}</Text>
                    </View>
                  </TouchableOpacity>
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
                      عرض المزيد ({payouts.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <AdminPayoutDetailModal
        visible={!!detailName}
        payoutName={detailName}
        onClose={() => setDetailName(null)}
        onChanged={() => load({ showSpinner: false })}
      />

      <AdminCreatePayoutModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load({ showSpinner: false })}
      />

      {confirmDialog}
    </SafeAreaView>
  );
}

/**
 * AdminPayoutDetailModal — one settlement, its orders and its lifecycle actions.
 *
 * The actions offered are exactly those the backend will accept for the current
 * state, so the panel cannot present a "submit" button on an already-submitted
 * payout: a control that always fails is worse than no control.
 */
function AdminPayoutDetailModal({ visible, payoutName, onClose, onChanged }) {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payout, setPayout] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    if (!payoutName) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await MarketplaceAdminAPI.getPayout(payoutName);
      setPayout(data || null);
      setReference(data?.payment_reference || '');
    } catch (err) {
      setLoadError(err?.message || 'تعذر تحميل الكشف');
    } finally {
      setLoading(false);
    }
  }, [payoutName]);

  React.useEffect(() => {
    if (!visible) return undefined;
    load();
    return undefined;
  }, [visible, load]);

  async function run(fn, successMessage) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      await load();
      onChanged && onChanged();
    } catch (err) {
      toast.error(err?.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit() {
    confirm({
      title: 'اعتماد الكشف',
      message: 'سيتم اعتماد الكشف وربط الطلبات المشمولة به، ولن يمكن تعديله بعد ذلك.',
      confirmLabel: 'نعم، اعتماد',
      cancelLabel: 'تراجع',
      onConfirm: () => run(() => MarketplaceAdminAPI.submitPayout(payoutName), 'تم اعتماد الكشف'),
    });
  }

  function handleCancel() {
    confirm({
      title: 'إلغاء الكشف',
      message: 'سيتم إلغاء الكشف وإعادة طلباته إلى قائمة المستحقات غير المدفوعة.',
      confirmLabel: 'نعم، إلغاء الكشف',
      cancelLabel: 'تراجع',
      tone: 'destructive',
      onConfirm: () => run(() => MarketplaceAdminAPI.cancelPayout(payoutName), 'تم إلغاء الكشف'),
    });
  }

  function handleMarkPaid() {
    confirm({
      title: 'تأكيد الدفع',
      message: 'سيتم وسم الكشف كمدفوع. تأكد من تنفيذ التحويل فعلياً قبل المتابعة.',
      confirmLabel: 'نعم، تم الدفع',
      cancelLabel: 'تراجع',
      onConfirm: () =>
        run(
          () => MarketplaceAdminAPI.markPayoutPaid(payoutName, reference.trim() || null),
          'تم وسم الكشف كمدفوع'
        ),
    });
  }

  const info = payout ? payoutStatus(payout.status) : payoutStatus(null);
  const docstatus = payout?.docstatus;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <View style={vendorStyles.flex1}>
            <Text style={[styles.detailTitle, textStart]}>كشف المستحقات</Text>
            <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
              {payout?.shop_name || payoutName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Icon name="close" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={vendorStyles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={vendorStyles.column}>
            {loading && !payout ? (
              <View style={vendorStyles.centre}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : loadError ? (
              <View style={vendorStyles.centre}>
                <Icon name="alert-circle-outline" size={40} color={Colors.error} />
                <Text style={vendorStyles.centreText}>{loadError}</Text>
                <TouchableOpacity onPress={load} style={vendorStyles.secondaryBtn}>
                  <Text style={[vendorStyles.secondaryBtnText, textStart]}>إعادة المحاولة</Text>
                </TouchableOpacity>
              </View>
            ) : payout ? (
              <>
                <View style={vendorStyles.card}>
                  <View style={vendorStyles.rowBetween}>
                    <Text style={[vendorStyles.strong, textStart]}>{payout.name}</Text>
                    <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                      <Icon name={info.icon} size={13} color={info.fg} />
                      <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                    </View>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 12 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>المتجر</Text>
                    <Text style={[vendorStyles.value, textStart]}>{payout.shop_name || payout.shop || '—'}</Text>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>الفترة</Text>
                    <Text style={[vendorStyles.value, textStart]}>
                      {formatDate(payout.from_date)} — {formatDate(payout.to_date)}
                    </Text>
                  </View>
                  {payout.paid_on ? (
                    <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>تاريخ الدفع</Text>
                      <Text style={[vendorStyles.value, textStart]}>{formatDate(payout.paid_on)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={vendorStyles.card}>
                  <Text style={[vendorStyles.cardTitle, textStart]}>الملخّص</Text>
                  <View style={styles.totalRow}>
                    <Text style={[vendorStyles.muted, textStart]}>إجمالي المبيعات</Text>
                    <Text style={[vendorStyles.value, textStart]}>{formatCurrency(payout.total_gross)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[vendorStyles.muted, textStart]}>عمولة المنصة</Text>
                    <Text style={[styles.commission, textStart]}>
                      - {formatCurrency(payout.total_commission)}
                    </Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandRow]}>
                    <Text style={[vendorStyles.strong, textStart]}>صافي المستحق</Text>
                    <Text style={[vendorStyles.money, textStart]}>{formatCurrency(payout.total_net)}</Text>
                  </View>
                </View>

                <View style={vendorStyles.card}>
                  <Text style={[vendorStyles.cardTitle, textStart]}>
                    الطلبات ({(payout.orders || []).length})
                  </Text>
                  {(payout.orders || []).map((row, idx) => (
                    <View key={`${row.sales_order}-${idx}`} style={styles.orderRow}>
                      <View style={vendorStyles.flex1}>
                        <Text style={[vendorStyles.value, textStart]}>#{row.sales_order}</Text>
                        <Text style={[vendorStyles.muted, textStart]}>
                          {formatDate(row.order_date)}
                          {row.customer ? ` · ${row.customer}` : ''}
                        </Text>
                      </View>
                      <View style={styles.orderAmounts}>
                        <Text style={[styles.orderNet, textStart]}>{formatCurrency(row.net_amount)}</Text>
                        {Number(row.commission_amount) > 0 ? (
                          <Text style={[vendorStyles.muted, textStart, { textAlign: 'right' }]}>
                            عمولة {formatCurrency(row.commission_amount)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                {docstatus === 0 ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={busy}
                      onPress={handleSubmit}
                      style={[vendorStyles.primaryBtn, busy && vendorStyles.disabled]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={Colors.onPrimary} />
                      ) : (
                        <>
                          <Icon name="checkmark-circle-outline" size={18} color={Colors.onPrimary} />
                          <Text style={[vendorStyles.primaryBtnText, textStart]}>اعتماد الكشف</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={busy}
                      onPress={handleCancel}
                      style={[vendorStyles.dangerBtn, { marginTop: 12 }, busy && vendorStyles.disabled]}
                    >
                      <Icon name="close-outline" size={18} color={Colors.error} />
                      <Text style={[vendorStyles.dangerBtnText, textStart]}>إلغاء الكشف</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {docstatus === 1 && !payout.paid_on ? (
                  <View style={vendorStyles.card}>
                    <Text style={[vendorStyles.cardTitle, textStart]}>تسجيل الدفع</Text>
                    <View style={vendorStyles.field}>
                      <Text style={[vendorStyles.label, textStart]}>مرجع الدفع (اختياري)</Text>
                      <TextInput
                        style={vendorStyles.input}
                        value={reference}
                        onChangeText={setReference}
                        placeholder="رقم الحوالة أو ملاحظة"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={busy}
                      onPress={handleMarkPaid}
                      style={[vendorStyles.primaryBtn, busy && vendorStyles.disabled]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={Colors.onPrimary} />
                      ) : (
                        <>
                          <Icon name="cash-outline" size={18} color={Colors.onPrimary} />
                          <Text style={[vendorStyles.primaryBtnText, textStart]}>وسم كمدفوع</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={busy}
                      onPress={handleCancel}
                      style={[vendorStyles.dangerBtn, { marginTop: 12 }, busy && vendorStyles.disabled]}
                    >
                      <Icon name="close-outline" size={18} color={Colors.error} />
                      <Text style={[vendorStyles.dangerBtnText, textStart]}>إلغاء الكشف</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {docstatus === 1 && payout.paid_on ? (
                  <View style={vendorStyles.card}>
                    <View style={vendorStyles.row}>
                      <Icon name="checkmark-circle" size={18} color={Colors.success} />
                      <Text style={[vendorStyles.value, textStart]}>
                        تم دفع هذا الكشف{payout.payment_reference ? ` (${payout.payment_reference})` : ''}.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {docstatus === 2 ? (
                  <Text style={[vendorStyles.muted, textStart, { textAlign: 'center' }]}>
                    هذا الكشف ملغى وطلباته متاحة للتسوية من جديد.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * AdminCreatePayoutModal — pick a shop and a period, preview, then create.
 *
 * The shop list is loaded once on open and filtered as a text list rather than a
 * searchable remote picker: approved shops are few, and a local filter is
 * instant. The preview is the point of this screen — it is the only chance to
 * notice that a date range includes the wrong orders before they are tied up in
 * a settlement.
 */
function AdminCreatePayoutModal({ visible, onClose, onCreated }) {
  const { textStart } = useDirectional();
  const toast = useToast();

  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shop, setShop] = useState(null); // {name, label}
  const [shopQuery, setShopQuery] = useState('');
  const [showShopList, setShowShopList] = useState(false);

  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(daysAgo(0));

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  React.useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setShopsLoading(true);
    setPreview(null);
    setShop(null);
    setShopQuery('');
    setFromDate(daysAgo(30));
    setToDate(daysAgo(0));
    MarketplaceAdminAPI.listShops({ status: 'Approved', limit: 100 })
      .then((data) => {
        if (cancelled) return;
        const rows = (data?.shops || []).filter((s) => Number(s.is_platform) !== 1);
        setShops(rows);
      })
      .catch(() => {
        if (!cancelled) setShops([]);
      })
      .finally(() => {
        if (!cancelled) setShopsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filteredShops = shopQuery.trim()
    ? shops.filter((s) =>
        String(s.shop_name || s.name).toLowerCase().includes(shopQuery.trim().toLowerCase())
      )
    : shops;

  function handlePreview() {
    if (!shop) {
      toast.error('اختر المتجر أولاً');
      return;
    }
    if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
      toast.error('أدخل التاريخ بصيغة YYYY-MM-DD');
      return;
    }
    if (fromDate > toDate) {
      toast.error('تاريخ البداية يجب أن يسبق تاريخ النهاية');
      return;
    }

    setPreviewing(true);
    MarketplaceAdminAPI.getEligibleOrders(shop.name, fromDate, toDate)
      .then((data) => setPreview(data || { orders: [], total_gross: 0, total_commission: 0, total_net: 0 }))
      .catch((err) => {
        toast.error(err?.message || 'تعذر جلب الطلبات المؤهلة');
        setPreview(null);
      })
      .finally(() => setPreviewing(false));
  }

  async function handleCreate() {
    if (!preview || !(preview.orders || []).length) {
      toast.error('لا توجد طلبات مؤهلة في هذه الفترة');
      return;
    }
    setCreating(true);
    try {
      await MarketplaceAdminAPI.createPayout(shop.name, fromDate, toDate);
      toast.success('تم إنشاء الكشف');
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      toast.error(err?.message || 'تعذر إنشاء الكشف');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <View style={vendorStyles.flex1}>
            <Text style={[styles.detailTitle, textStart]}>إنشاء كشف مستحقات</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Icon name="close" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={vendorStyles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={vendorStyles.column}>
            <View style={vendorStyles.card}>
              <Text style={[vendorStyles.cardTitle, textStart]}>المتجر</Text>

              {shop ? (
                <View style={[vendorStyles.rowBetween, { marginBottom: 10 }]}>
                  <View style={vendorStyles.row}>
                    <Icon name="storefront-outline" size={17} color={Colors.primary} />
                    <Text style={[vendorStyles.value, textStart, { marginHorizontal: 6 }]}>{shop.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShop(null)} activeOpacity={0.8}>
                    <Text style={styles.changeLink}>تغيير</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.searchBox}>
                    <Icon name="search-outline" size={18} color={Colors.textMuted} />
                    <TextInput
                      style={styles.searchInput}
                      value={shopQuery}
                      onChangeText={(text) => {
                        setShopQuery(text);
                        setShowShopList(true);
                      }}
                      onFocus={() => setShowShopList(true)}
                      placeholder="ابحث عن متجر معتمد..."
                      placeholderTextColor={Colors.textMuted}
                      autoCorrect={false}
                    />
                  </View>

                  {shopsLoading ? (
                    <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />
                  ) : showShopList ? (
                    filteredShops.length === 0 ? (
                      <Text style={[vendorStyles.muted, textStart, { marginTop: 12 }]}>
                        لا توجد متاجر معتمدة مطابقة.
                      </Text>
                    ) : (
                      filteredShops.slice(0, 30).map((s) => (
                        <TouchableOpacity
                          key={s.name}
                          activeOpacity={0.8}
                          onPress={() => {
                            setShop({ name: s.name, label: s.shop_name || s.name });
                            setShowShopList(false);
                          }}
                          style={styles.shopOption}
                        >
                          <Text style={[vendorStyles.value, textStart]}>{s.shop_name || s.name}</Text>
                          <Text style={[vendorStyles.muted, textStart]}>
                            {s.product_count != null ? `${s.product_count} منتج` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )
                  ) : null}
                </>
              )}
            </View>

            <View style={vendorStyles.card}>
              <Text style={[vendorStyles.cardTitle, textStart]}>الفترة</Text>
              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>من تاريخ (YYYY-MM-DD)</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="2026-01-01"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={vendorStyles.field}>
                <Text style={[vendorStyles.label, textStart]}>إلى تاريخ (YYYY-MM-DD)</Text>
                <TextInput
                  style={vendorStyles.input}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="2026-01-31"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={[vendorStyles.hint, textStart, { marginBottom: 0 }]}>
                تشمل الكشوف الطلبات المسلّمة وغير المدفوعة خلال هذه الفترة.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={previewing || !shop}
              onPress={handlePreview}
              style={[vendorStyles.secondaryBtn, (previewing || !shop) && vendorStyles.disabled]}
            >
              {previewing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Icon name="search-outline" size={17} color={Colors.primary} />
                  <Text style={[vendorStyles.secondaryBtnText, textStart]}>معاينة الطلبات المؤهلة</Text>
                </>
              )}
            </TouchableOpacity>

            {preview ? (
              <View style={[vendorStyles.card, { marginTop: 16 }]}>
                <Text style={[vendorStyles.cardTitle, textStart]}>
                  الطلبات المؤهلة ({(preview.orders || []).length})
                </Text>

                {(preview.orders || []).length === 0 ? (
                  <Text style={[vendorStyles.muted, textStart]}>
                    لا توجد طلبات مسلّمة وغير مدفوعة في هذه الفترة.
                  </Text>
                ) : (
                  <>
                    {preview.orders.map((row, idx) => (
                      <View key={`${row.sales_order}-${idx}`} style={styles.orderRow}>
                        <View style={vendorStyles.flex1}>
                          <Text style={[vendorStyles.value, textStart]}>#{row.sales_order}</Text>
                          <Text style={[vendorStyles.muted, textStart]}>{formatDate(row.order_date)}</Text>
                        </View>
                        <Text style={[styles.orderNet, textStart]}>{formatCurrency(row.net_amount)}</Text>
                      </View>
                    ))}

                    <View style={[styles.totalRow, { marginTop: 10 }]}>
                      <Text style={[vendorStyles.muted, textStart]}>إجمالي المبيعات</Text>
                      <Text style={[vendorStyles.value, textStart]}>
                        {formatCurrency(preview.total_gross)}
                      </Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={[vendorStyles.muted, textStart]}>عمولة المنصة</Text>
                      <Text style={[styles.commission, textStart]}>
                        - {formatCurrency(preview.total_commission)}
                      </Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandRow]}>
                      <Text style={[vendorStyles.strong, textStart]}>صافي المستحق</Text>
                      <Text style={[vendorStyles.money, textStart]}>{formatCurrency(preview.total_net)}</Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={creating}
                      onPress={handleCreate}
                      style={[vendorStyles.primaryBtn, { marginTop: 16 }, creating && vendorStyles.disabled]}
                    >
                      {creating ? (
                        <ActivityIndicator size="small" color={Colors.onPrimary} />
                      ) : (
                        <>
                          <Icon name="checkmark-circle-outline" size={18} color={Colors.onPrimary} />
                          <Text style={[vendorStyles.primaryBtnText, textStart]}>إنشاء الكشف</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  netValue: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  grandRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: 6,
    paddingTop: 12,
  },
  commission: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.error,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  orderAmounts: { alignItems: 'flex-end' },
  orderNet: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
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
  shopOption: {
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  changeLink: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
});
