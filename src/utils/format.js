/**
 * Utility functions for formatting currencies, numbers, dates in Yemeni context
 */

/**
 * Format price in Yemeni Riyal (ر.ي)
 * @param {number|string} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'ر.ي') {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `0 ${currency}`;
  }
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${numeric.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Calculate discount percentage between old and current price
 * @param {number} currentPrice
 * @param {number} originalPrice
 * @returns {number|null}
 */
export function calculateDiscount(currentPrice, originalPrice) {
  if (!originalPrice || originalPrice <= currentPrice) return null;
  const percent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  return percent > 0 ? percent : null;
}

/**
 * Format phone number to clean 9-digit format or display with Yemen code
 * @param {string} phone
 * @returns {string}
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '').slice(-9);
}

/**
 * Format ERPNext date to friendly Arabic string
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
