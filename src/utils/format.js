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
  if (!originalPrice || originalPrice <= currentPrice){ 
    return null;
  }
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
 * Format a result count as a short Arabic noun phrase.
 *
 * Arabic counts nouns by number, so "1 منتج / 2 منتج / 3 منتجات" cannot be
 * produced by appending a suffix. Reporting every count as "منتج" reads as a
 * translation bug in a list the user is actively scanning.
 *
 * @param {number} count
 * @param {string} [noun] singular noun, e.g. 'منتج'
 * @param {string} [dual] dual form, e.g. 'منتجان'
 * @param {string} [plural] plural form, e.g. 'منتجات'
 * @returns {string}
 */
export function formatCount(count, noun = 'منتج', dual = 'منتجان', plural = 'منتجات') {
  const raw = Number(count);
  if (!Number.isFinite(raw) || raw < 0) return '';

  // A count is always whole: rendering "3.7 منتجات" is nonsense, and flooring
  // also keeps the 1 / 2 / 3-10 / 11+ branches below on integer inputs.
  const n = Math.floor(raw);
  if (n === 0) return `لا ${plural}`;
  if (n === 1) return `${noun} واحد`;
  if (n === 2) return `${dual}`;
  if (n <= 10) return `${n} ${plural}`;

  // 11+ takes the accusative singular.
  return `${n} ${noun}اً`;
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
