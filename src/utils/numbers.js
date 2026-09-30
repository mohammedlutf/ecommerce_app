/**
 * Decimal input handling for numeric fields.
 *
 * A plain `/[^0-9.]/g` strip is not enough on an Arabic phone keyboard:
 *
 *  - Arabic-Indic digits (٠-٩, U+0660–0669) are what an Arabic keyboard actually
 *    emits, and stripping them leaves an empty field that silently becomes 0.
 *  - `٫` (U+066B ARABIC DECIMAL SEPARATOR) and `,` are both used as the decimal
 *    mark, and stripping one turns "0٫5" into "05" — a plausible-looking number
 *    that is fifty times the intended value.
 *
 * Everything here returns a string (not a number) so the field can hold "0.5"
 * mid-typing. Converting to a number is the caller's job, at save time.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const LATIN_DIGITS = '0123456789';

const ARABIC_DECIMAL = '٫'; // ٫
const ARABIC_THOUSANDS = '٬'; // ٬
const ARABIC_ZERO = '٠';

/**
 * Normalise what a numeric keyboard produced into a plain `0.25`-style string.
 * Anything that cannot be part of a number is dropped.
 *
 * @param {string} text raw field text
 * @returns {string} digits and at most one dot
 */
export function normaliseDecimalInput(text) {
  if (text == null) return '';

  const raw = String(text);

  // Whether a comma means "decimal mark" or "thousands separator" is decided
  // from the whole string, not from the position it appears in. Deciding as we
  // walk made "1,250.5" become 1.2505, because the comma arrives before the dot
  // and had already claimed the decimal slot; the backend reads that same input
  // as 1250.5, so the number silently changed between typing and saving.
  const hasDot = raw.includes('.') || raw.includes(ARABIC_DECIMAL);
  const commaIsDecimal = !hasDot;

  let out = '';
  let seenDot = false;

  for (const char of raw) {
    const arabicIndex = ARABIC_INDIC.indexOf(char);
    if (arabicIndex !== -1) {
      out += LATIN_DIGITS[arabicIndex];
      continue;
    }

    if (char === ARABIC_DECIMAL || char === '.') {
      // A second separator is dropped rather than clamped, so "1.2.3" becomes
      // "1.23" instead of silently changing which digits survive.
      if (!seenDot) {
        seenDot = true;
        out += '.';
      }
      continue;
    }

    // U+066C is always a thousands separator. An ASCII comma is a decimal mark
    // only when the string holds no dot at all ("0,75"); otherwise it groups
    // thousands and is dropped ("1,250.5" -> 1250.5).
    if (char === ARABIC_THOUSANDS) continue;
    if (char === ',') {
      if (commaIsDecimal && !seenDot) {
        seenDot = true;
        out += '.';
      }
      continue;
    }

    if (char >= '0' && char <= '9') out += char;
  }

  // "." or "0." is a legitimate intermediate state while typing.
  return out;
}

/**
 * Parse a decimal field into a finite number, or `null` when the field is empty
 * or unusable.
 *
 * `null` is deliberately distinct from `0`: "the admin left this blank" and "the
 * admin typed zero" are different facts, and treating the first as the second is
 * how a real price or conversion factor gets wiped.
 *
 * @param {string|number|null|undefined} value
 * @returns {number|null}
 */
export function parseDecimal(value) {
  if (value == null) return null;

  const text = String(value).trim();
  if (text === '' || text === '.') return null;

  const normalised = normaliseDecimalInput(text);
  if (normalised === '' || normalised === '.') return null;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * True when the field holds a real, positive number.
 *
 * @param {string|number|null|undefined} value
 * @returns {boolean}
 */
export function isPositiveNumber(value) {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed > 0;
}

export { ARABIC_ZERO };
export default normaliseDecimalInput;
