/**
 * Catalog helpers — normalize product UOM + rate data consistently so a UOM
 * switch always reflects the correct price on cards, detail and cart.
 *
 * Server UOM payloads are inconsistent: sometimes [{uom, rate}], sometimes
 * just strings, sometimes rates missing but conversion_factor present. This
 * resolves every case against the product base rate.
 */

export function resolveUoms(product) {
  const list =
    product && Array.isArray(product.uoms) && product.uoms.length
      ? product.uoms
      : [];
  const baseRate = product ? parseFloat(product.rate || product.price) || 0 : 0;
  const baseUom = product ? product.stock_uom : null;

  const normalized = list.map((u) => {
    const uomName = typeof u === 'string' ? u : u && u.uom ? u.uom : '';
    const explicitRate =
      u && typeof u.rate !== 'undefined' && u.rate !== null
        ? parseFloat(u.rate)
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
  const baseRate = parseFloat(product.rate || product.price) || 0;
  const uoms = resolveUoms(product);
  const found = uoms.find((u) => u.uom === uom);
  if (found && typeof found.rate === 'number' && found.rate) {
    return found.rate;
  }
  return baseRate;
}

export default { resolveUoms, rateForUom };