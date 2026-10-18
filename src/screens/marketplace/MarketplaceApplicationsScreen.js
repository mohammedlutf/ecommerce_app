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
import { formatDate } from '../../utils/format';
import useDirectional from '../../hooks/useDirectional';
import vendorStyles from '../../components/vendor/vendorStyles';

const PAGE_SIZE = 20;

const FILTER_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'];

const APPLICATION_STATUS = {
  Pending: { label: 'قيد المراجعة', bg: Colors.warningContainer, fg: Colors.warning, icon: 'time-outline' },
  Approved: { label: 'معتمد', bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Rejected: { label: 'مرفوض', bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
  Cancelled: { label: 'ملغى', bg: Colors.surfaceContainer, fg: Colors.onSurfaceVariant, icon: 'ban-outline' },
};

function applicationStatus(status) {
  return (
    APPLICATION_STATUS[status] || {
      label: status || '—',
      bg: Colors.surfaceContainer,
      fg: Colors.onSurfaceVariant,
      icon: 'help-circle-outline',
    }
  );
}

const STATUS_LABEL = {
  Pending: 'قيد المراجعة',
  Approved: 'معتمد',
  Rejected: 'مرفوض',
  Cancelled: 'ملغى',
  All: 'الكل',
};

/**
 * MarketplaceApplicationsScreen — the vendor review queue.
 *
 * Pending first and by default: an application that has been sitting unread is
 * the only thing here with a clock on it. Approving creates the shop (and its
 * Supplier) in one server-side transaction, so this screen shows the decision
 * and nothing else — there is no "create shop" step to forget.
 */
export default function MarketplaceApplicationsScreen() {
  const { textStart } = useDirectional();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const { isAdmin } = useAdmin();

  const [filter, setFilter] = useState('Pending');
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState(null);

  const [reviewName, setReviewName] = useState(null);

  const requestRef = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const countRef = useRef(0);
  countRef.current = applications.length;

  const load = useCallback(
    async ({ start = 0, append = false, showSpinner = true, status = filterRef.current } = {}) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else if (showSpinner) setLoading(true);

      try {
        const data = await MarketplaceAdminAPI.listApplications({ status, start, limit: PAGE_SIZE });
        if (requestId !== requestRef.current) return;
        if (status !== filterRef.current) return;

        const rows = Array.isArray(data?.applications) ? data.applications : [];
        setApplications((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(data?.total) || 0);
        setHasMore(!!data?.has_more);
      } catch (err) {
        if (requestId === requestRef.current) toast.error(err?.message || 'تعذر تحميل الطلبات');
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
      load({ showSpinner: applications.length === 0 });
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, load])
  );

  function handleFilterChange(next) {
    setFilter(next);
    filterRef.current = next;
    setApplications([]);
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

  async function approve(name) {
    setActioning(name);
    try {
      await MarketplaceAdminAPI.approveApplication(name);
      toast.success('تم اعتماد الطلب وإنشاء المتجر');
      setReviewName(null);
      await load({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر اعتماد الطلب');
    } finally {
      setActioning(null);
    }
  }

  function confirmApprove(app) {
    confirm({
      title: 'اعتماد الطلب',
      message: `سيتم فتح متجر «${app.shop_name}» لحساب ${app.applicant_fullname || app.applicant} وإنشاء مورد مرتبط به.`,
      confirmLabel: 'نعم، اعتماد',
      cancelLabel: 'تراجع',
      onConfirm: () => approve(app.name),
    });
  }

  async function reject(name, reason) {
    setActioning(name);
    try {
      await MarketplaceAdminAPI.rejectApplication(name, reason || null);
      toast.success('تم رفض الطلب');
      setReviewName(null);
      await load({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر رفض الطلب');
    } finally {
      setActioning(null);
    }
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
          <Text style={[vendorStyles.hint, textStart]}>{total} طلب</Text>

          {loading && applications.length === 0 ? (
            <View style={vendorStyles.centre}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={vendorStyles.centreText}>جاري تحميل الطلبات...</Text>
            </View>
          ) : applications.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="لا توجد طلبات"
              description={
                filter === 'Pending'
                  ? 'لا توجد طلبات بانتظار المراجعة حالياً.'
                  : 'لا توجد طلبات بهذه الحالة.'
              }
            />
          ) : (
            <>
              {applications.map((app) => {
                const info = applicationStatus(app.status);
                const busy = actioning === app.name;
                return (
                  <TouchableOpacity
                    key={app.name}
                    activeOpacity={0.85}
                    onPress={() => setReviewName(app.name)}
                    style={vendorStyles.listItem}
                  >
                    <View style={vendorStyles.rowBetween}>
                      <View style={vendorStyles.flex1}>
                        <Text style={[vendorStyles.value, textStart]} numberOfLines={1}>
                          {app.shop_name || app.name}
                        </Text>
                        <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
                          {app.applicant_fullname || app.full_name || app.applicant}
                          {app.phone ? ` · ${app.phone}` : ''}
                        </Text>
                      </View>
                      <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                        <Icon name={info.icon} size={13} color={info.fg} />
                        <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                      </View>
                    </View>

                    <Text style={[vendorStyles.muted, textStart, { marginTop: 8 }]}>
                      {formatDate(app.creation)}
                    </Text>

                    {app.status === 'Pending' ? (
                      <View style={[vendorStyles.rowWrap, { marginTop: 12 }]}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={busy}
                          onPress={() => confirmApprove(app)}
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
                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={busy}
                          onPress={() => setReviewName(app.name)}
                          style={[vendorStyles.dangerBtn, { paddingVertical: 8 }, busy && vendorStyles.disabled]}
                        >
                          <Icon name="close" size={15} color={Colors.error} />
                          <Text style={[vendorStyles.dangerBtnText, textStart]}>رفض</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
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
                      عرض المزيد ({applications.length} من {total})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <ApplicationReviewModal
        visible={!!reviewName}
        applicationName={reviewName}
        onClose={() => setReviewName(null)}
        onApprove={confirmApprove}
        onReject={reject}
        busy={!!actioning}
      />

      {confirmDialog}
    </SafeAreaView>
  );
}

/**
 * ApplicationReviewModal — read one application, then approve or reject it.
 *
 * Rejecting is the only decision that needs a reason, so the reason field only
 * appears once the admin commits to rejecting. Asking for a note up front makes
 * rejecting look like the default outcome.
 */
function ApplicationReviewModal({ visible, applicationName, onClose, onApprove, onReject, busy }) {
  const { textStart } = useDirectional();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [application, setApplication] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (!visible || !applicationName) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setRejecting(false);
    setReason('');
    MarketplaceAdminAPI.getApplication(applicationName)
      .then((data) => {
        if (!cancelled) setApplication(data || null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'تعذر تحميل الطلب');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, applicationName]);

  const info = application ? applicationStatus(application.status) : applicationStatus(null);
  const isPending = !!application && application.status === 'Pending';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={vendorStyles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <View style={vendorStyles.flex1}>
            <Text style={[styles.detailTitle, textStart]}>مراجعة طلب</Text>
            <Text style={[vendorStyles.muted, textStart]} numberOfLines={1}>
              {application?.shop_name || applicationName}
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
            ) : application ? (
              <>
                <View style={vendorStyles.card}>
                  <View style={vendorStyles.rowBetween}>
                    <Text style={[vendorStyles.strong, textStart]}>{application.shop_name}</Text>
                    <View style={[vendorStyles.badge, { backgroundColor: info.bg }]}>
                      <Icon name={info.icon} size={13} color={info.fg} />
                      <Text style={[vendorStyles.badgeText, textStart, { color: info.fg }]}>{info.label}</Text>
                    </View>
                  </View>

                  <View style={[vendorStyles.rowBetween, { marginTop: 14 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>مقدّم الطلب</Text>
                    <Text style={[vendorStyles.value, textStart]}>
                      {application.applicant_fullname || application.full_name || '—'}
                    </Text>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>رقم الهاتف</Text>
                    <Text style={[vendorStyles.value, textStart]}>{application.phone || '—'}</Text>
                  </View>
                  <View style={[vendorStyles.rowBetween, { marginTop: 10 }]}>
                    <Text style={[vendorStyles.muted, textStart]}>تاريخ التقديم</Text>
                    <Text style={[vendorStyles.value, textStart]}>{formatDate(application.creation)}</Text>
                  </View>

                  {application.description ? (
                    <View style={styles.descBox}>
                      <Text style={[vendorStyles.label, textStart]}>نبذة المتجر</Text>
                      <Text style={[vendorStyles.muted, textStart]}>{application.description}</Text>
                    </View>
                  ) : null}

                  {application.review_note ? (
                    <View style={[styles.descBox, { backgroundColor: Colors.errorContainer }]}>
                      <Text style={[vendorStyles.label, textStart]}>سبب الرفض</Text>
                      <Text style={[vendorStyles.muted, textStart]}>{application.review_note}</Text>
                    </View>
                  ) : null}
                </View>

                {isPending ? (
                  rejecting ? (
                    <View style={vendorStyles.card}>
                      <Text style={[vendorStyles.cardTitle, textStart]}>سبب الرفض</Text>
                      <TextInput
                        style={[vendorStyles.input, vendorStyles.inputMultiline]}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="اكتب سبباً واضحاً يظهر للبائع."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        maxLength={500}
                      />
                      <View style={[vendorStyles.row, { gap: 10, marginTop: 12 }]}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          disabled={busy}
                          onPress={() => onReject(application.name, reason.trim())}
                          style={[styles.dangerSolidBtn, vendorStyles.flex1, busy && vendorStyles.disabled]}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={Colors.onPrimary} />
                          ) : (
                            <>
                              <Icon name="close-circle-outline" size={17} color={Colors.onPrimary} />
                              <Text style={[styles.dangerSolidText, textStart]}>تأكيد الرفض</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={busy}
                          onPress={() => setRejecting(false)}
                          style={[vendorStyles.secondaryBtn, vendorStyles.flex1]}
                        >
                          <Text style={[vendorStyles.secondaryBtnText, textStart]}>تراجع</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        disabled={busy}
                        onPress={() => onApprove(application)}
                        style={[vendorStyles.primaryBtn, busy && vendorStyles.disabled]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={Colors.onPrimary} />
                        ) : (
                          <>
                            <Icon name="checkmark-circle-outline" size={18} color={Colors.onPrimary} />
                            <Text style={[vendorStyles.primaryBtnText, textStart]}>اعتماد وفتح المتجر</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={busy}
                        onPress={() => setRejecting(true)}
                        style={[vendorStyles.dangerBtn, { marginTop: 12 }, busy && vendorStyles.disabled]}
                      >
                        <Icon name="close-outline" size={18} color={Colors.error} />
                        <Text style={[vendorStyles.dangerBtnText, textStart]}>رفض الطلب</Text>
                      </TouchableOpacity>
                    </>
                  )
                ) : (
                  <Text style={[vendorStyles.muted, textStart, { textAlign: 'center' }]}>
                    تمت مراجعة هذا الطلب ولم يعد قابلاً للتغيير.
                  </Text>
                )}
              </>
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
  descBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
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
  dangerSolidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dangerSolidText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
});
