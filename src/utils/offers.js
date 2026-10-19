/**
 * Offer helpers — turn a Website Item's `offers` table into what a card or the
 * product page renders: the offer title, the discount percentage, the
 * struck-through original price and the wholesale label.
 *
 * The merchant configures all of this on the Website Item in the ERPNext desk.
 * Each half (title, discount) can be switched off per offer row, a row can
 * target one UOM or the product as a whole, and a UOM can be a wholesale price
 * either by the price/conversion-factor rule the backend applies
 * (`uoms[].is_wholesale`) or by an explicit tick on the offer row.
 */
import { calculateDiscount } from './format';

export const WHOLESALE_LABEL_FALLBACK = 'السعر بالجمله';

function asNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = parseFloat(value);
  return Number.isNaN(n) ? NaN : n;
}

function asText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Every offer row on a product, in the merchant's own order. */
export function resolveOffers(product) {
  const rows = product && Array.isArray(product.offers) ? product.offers : [];
  return rows.filter(Boolean);
}

/**
 * The offer row that applies to `uom`: an exact UOM match wins, otherwise the
 * row with no UOM — which applies to every UOM. The merchant's first matching
 * row wins, so a specific row always beats the catch-all one.
 */
export function offerForUom(product, uom) {
  const offers = resolveOffers(product);
  if (!offers.length) return null;
  const exact = offers.find((offer) => asText(offer.uom) && asText(offer.uom) === uom);
  if (exact) return exact;
  return offers.find((offer) => !asText(offer.uom)) || null;
}

/** The label a wholesale price is shown with: the item's own, or the default. */
export function wholesaleLabel(product) {
  return asText(product && product.wholesale_label) || WHOLESALE_LABEL_FALLBACK;
}

/**
 * Is this UOM's price a wholesale price?
 *
 * `uoms[].is_wholesale` is the backend's own price/conversion-factor rule
 * (switchable per item); `offer.is_wholesale` is the merchant's explicit tick,
 * which also covers a product whose UOM payload is missing.
 */
export function isWholesaleUom(product, uom) {
  const list = product && Array.isArray(product.uoms) ? product.uoms : [];
  const entry = list.find((item) => item && item.uom === uom);
  if (entry && entry.is_wholesale) return true;
  const offer = offerForUom(product, uom);
  return !!(offer && offer.is_wholesale);
}

/**
 * Everything the product page or a card shows for the selected UOM.
 *
 * Returns null when there is nothing to show, so callers can skip the block
 * instead of rendering an empty row. `originalPrice` is only filled in when it
 * is genuinely above the live price — `calculateDiscount` returns null
 * otherwise — because a stale original price would render a struck-through
 * figure that is higher than the price being charged.
 */
export function offerView(product, uom, currentRate) {
  const offer = offerForUom(product, uom);
  const wholesale = isWholesaleUom(product, uom);

  const rate = asNumber(currentRate);
  const original = offer ? asNumber(offer.original_price) : NaN;
  // A live price is required as well as an original one: with no price there is
  // no discount to compute, and `calculateDiscount` compares against `NaN`
  // rather than rejecting it. So the guard is explicit rather than delegated.
  const percent = rate > 0 && !Number.isNaN(original) && original > 0
    ? calculateDiscount(rate, original)
    : null;
  const validPercent = percent != null && !Number.isNaN(percent);

  const title = offer ? asText(offer.offer_title) : '';
  const subtitle = offer ? asText(offer.offer_subtitle) : '';
  const details = offer ? asText(offer.offer_details) : '';

  // Fail open on a missing flag (an older cached payload): the row exists, so
  // the merchant's title and discount are shown unless switched off explicitly.
  const showTitle = !!offer && offer.show_offer_title !== false && !!title;
  const showDiscount = !!offer && offer.show_discount_percent !== false && validPercent;

  if (!wholesale && !showTitle && !showDiscount && !validPercent) return null;

  return {
    title,
    subtitle,
    details,
    showTitle,
    showDiscount,
    percent: validPercent ? percent : null,
    titleBeforeDiscount: !!(offer && offer.title_before_discount),
    originalPrice: validPercent ? original : null,
    isWholesale: wholesale,
    wholesaleLabel: wholesaleLabel(product),
  };
}

export default {
  WHOLESALE_LABEL_FALLBACK,
  resolveOffers,
  offerForUom,
  wholesaleLabel,
  isWholesaleUom,
  offerView,
};
