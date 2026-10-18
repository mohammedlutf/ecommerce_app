import { Colors } from '../../theme/colors';

/**
 * Status presentation for vendor orders and payouts.
 *
 * Centralised because the same word appears on the orders list, the order
 * detail sheet, the dashboard and the payout rows — and if each screen picked
 * its own colour, a "Delivered" order would eventually be green on one and grey
 * on another. Every map here is total: an unknown value falls back rather than
 * rendering `undefined` into a badge.
 */
const VENDOR_ORDER_STATUS = {
  New: { label: 'جديد', bg: Colors.primaryContainer, fg: Colors.primaryDark, icon: 'sparkles-outline' },
  Processing: { label: 'قيد المعالجة', bg: Colors.infoContainer, fg: Colors.info, icon: 'sync-outline' },
  Ready: { label: 'جاهز للتسليم', bg: Colors.warningContainer, fg: Colors.warning, icon: 'cube-outline' },
  Delivered: { label: 'تم التسليم', bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Cancelled: { label: 'ملغى', bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
};

const CUSTOMER_ORDER_STATUS = {
  New: { label: 'قيد المراجعة', bg: Colors.primaryContainer, fg: Colors.primaryDark, icon: 'sparkles-outline' },
  Processing: { label: 'قيد المعالجة', bg: Colors.infoContainer, fg: Colors.info, icon: 'sync-outline' },
  Ready: { label: 'جاهز للتسليم', bg: Colors.warningContainer, fg: Colors.warning, icon: 'cube-outline' },
  Delivered: { label: 'تم التسليم', bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Cancelled: { label: 'ملغى', bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
};

const PAYOUT_STATUS = {
  Draft: { label: 'مسودة', bg: Colors.surfaceContainer, fg: Colors.onSurfaceVariant, icon: 'document-outline' },
  Submitted: { label: 'بانتظار الدفع', bg: Colors.warningContainer, fg: Colors.warning, icon: 'time-outline' },
  Paid: { label: 'مدفوع', bg: Colors.successContainer, fg: Colors.success, icon: 'checkmark-circle' },
  Cancelled: { label: 'ملغى', bg: Colors.errorContainer, fg: Colors.error, icon: 'close-circle' },
};

const UNKNOWN = { label: '—', bg: Colors.surfaceContainer, fg: Colors.onSurfaceVariant, icon: 'help-circle-outline' };

export function vendorOrderStatus(status) {
  return VENDOR_ORDER_STATUS[status] || { ...UNKNOWN, label: status || '—' };
}

export function customerOrderStatus(status) {
  return CUSTOMER_ORDER_STATUS[status] || { ...UNKNOWN, label: status || '—' };
}

export function payoutStatus(status) {
  return PAYOUT_STATUS[status] || { ...UNKNOWN, label: status || '—' };
}

/** The statuses a vendor may set, in the order the fulfilment flow advances. */
export const VENDOR_SETTABLE_STATUSES = ['Processing', 'Ready', 'Delivered', 'Cancelled'];

/** Statuses offered as list filters, newest state first. */
export const VENDOR_FILTER_STATUSES = ['All', 'New', 'Processing', 'Ready', 'Delivered', 'Cancelled'];

export default vendorOrderStatus;
