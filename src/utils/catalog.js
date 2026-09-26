/**
 * Catalog helpers — normalize product UOM + rate data consistently so a UOM
 * switch always reflects the correct price on cards, detail and cart.
 *
 * Server UOM payloads are inconsistent: sometimes [{uom, rate}], sometimes
 * just strings, sometimes rates missing but conversion_factor present. This
 * resolves every case against the product base rate.
 */

function toRate(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = parseFloat(value);
  return Number.isNaN(n) ? NaN : n;
}

function pickRate(...values) {
  for (const value of values) {
    const n = toRate(value);
    if (!Number.isNaN(n)) return n;
  }
  return NaN;
}

export function resolveUoms(product) {
  const list =
    product && Array.isArray(product.uoms) && product.uoms.length
      ? product.uoms
      : [];
  const baseRate = product ? pickRate(product.rate, product.price, product.price_list_rate) || 0 : 0;
  const baseUom = product ? product.stock_uom : null;

  const normalized = list.map((u) => {
    const uomName = typeof u === 'string' ? u : u && u.uom ? u.uom : '';
    const explicitRate =
      u && typeof u === 'object'
        ? pickRate(u.rate, u.price, u.price_list_rate)
        : NaN;
    const factor =
      u && u.conversion_factor ? parseFloat(u.conversion_factor) : NaN;
    const rate = !Number.isNaN(explicitRate)
      ? explicitRate
      : !Number.isNaN(factor) && baseRate
        ? baseRate * factor
        : baseRate;
    return {
      uom: uomName,
      rate,
      conversion_factor: Number.isNaN(factor) ? null : factor,
    };
  });

  if (normalized.length === 0 && baseUom) {
    normalized.push({ uom: baseUom, rate: baseRate, conversion_factor: null });
  }
  return normalized;
}

export function rateForUom(product, uom) {
  if (!product) return 0;
  const baseRate = pickRate(product.rate, product.price, product.price_list_rate) || 0;
  const uoms = resolveUoms(product);
  const found = uoms.find((u) => u.uom === uom);

  if (found) {
    const parsedRate = toRate(found.rate);
    if (!Number.isNaN(parsedRate)) {
      return parsedRate;
    }
  }
  return baseRate;
}

/**
 * normalizeGroupName — canonical form of an Item Group name for comparisons.
 *
 * Frappe stores the same Arabic name with inconsistent spacing/diacritics
 * ("العروض " vs "العروض", "الألبان" vs "الالبان"), and those strings travel
 * through deep links, so `===` is too strict to match a tapped group with the
 * group in the catalog.
 */
export function normalizeGroupName(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0640]/g, '') // harakat + tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // آ أ إ ٱ -> ا
    .replace(/[\u0629\u0649]/g, '\u0647') // ة ى -> ه
    .replace(/[\u0624\u0626]/g, '\u0648') // ؤ ئ -> و
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default { resolveUoms, rateForUom, normalizeGroupName };


