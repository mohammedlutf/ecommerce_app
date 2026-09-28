/**
 * Geo helpers for the address form.
 *
 * The pin is persisted as a single "lat,lng" string in Address.address_line2,
 * so parsing and formatting live here rather than being sprinkled through the
 * components — a malformed coordinate silently becomes a delivery the driver
 * cannot find, which is why the parsers are strict and return null instead of
 * NaN-laden objects.
 */

const COORD_PRECISION = 6;

/** Yemen, used as the map's opening view before a pin is chosen. */
export const DEFAULT_REGION = {
  latitude: 15.3694,
  longitude: 44.191,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/**
 * Format a coordinate for storage in `address_line2`.
 *
 * @param {{latitude: number, longitude: number}|null} coords
 * @returns {string} "17.615140,44.191500", or '' when there is no usable pin
 */
export function formatCoords(coords) {
  if (!coords) return '';
  const { latitude, longitude } = coords;
  if (!isValidCoordPair(latitude, longitude)) return '';
  return `${latitude.toFixed(COORD_PRECISION)},${longitude.toFixed(COORD_PRECISION)}`;
}

/**
 * Parse an `address_line2` value back into a coordinate.
 *
 * Tolerates spaces and a missing sign (Frappe stores what it is given), but
 * rejects anything out of range so a bad row cannot put the map in the ocean
 * or, worse, at 0,0 somewhere off the coast of Africa.
 *
 * @param {string|null|undefined} value
 * @returns {{latitude: number, longitude: number}|null}
 */
export function parseCoords(value) {
  if (typeof value !== 'string') return null;

  const parts = value.split(',').map((p) => p.trim());
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!isValidCoordPair(latitude, longitude)) return null;

  return { latitude, longitude };
}

function isValidCoordPair(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** True when the value looks like a real, in-range coordinate. */
export function isValidCoords(coords) {
  return !!coords && isValidCoordPair(coords.latitude, coords.longitude);
}

/**
 * Build a short, human-readable place label from a platform geocode result.
 *
 * `expo-location` returns a bag of overlapping administrative levels (a street
 * name often repeats the district, and `name` is frequently just the city), so
 * the parts are de-duplicated rather than concatenated blindly — otherwise every
 * address reads "صنعاء، صنعاء، صنعاء".
 *
 * @param {object|null} geocode
 * @param {number} [maxLength] cap, so the label fits its destination field
 * @returns {string}
 */
export function buildPlaceLabel(geocode, maxLength = 140) {
  if (!geocode || typeof geocode !== 'object') return '';

  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  const houseNumber = clean(geocode.streetNumber);
  const street = clean(geocode.street);

  const parts = [];
  const covered = new Set();

  // Most specific first, so a later, vaguer duplicate is recognised as such and
  // dropped instead of being appended. A candidate is skipped when it is already
  // contained in what was emitted — geocoders repeat "صنعاء" across `name`,
  // `city` and `region`, and concatenating those yields "صنعاء، صنعاء، صنعاء".
  const add = (value) => {
    const part = clean(value);
    if (!part) return;
    const key = part.toLowerCase();
    if (covered.has(key)) return;
    if (parts.some((p) => p.toLowerCase().includes(key))) return;
    covered.add(key);
    parts.push(part);
  };

  // A house number is meaningless without its street, so the two are emitted as
  // one unit and emitted BEFORE `name`/`street`. Doing it the other way round
  // made the "45 شارع الزبيري" candidate look redundant against the already
  // emitted "شارع الزبيري" and silently threw the number away.
  if (houseNumber && street) {
    add(`${houseNumber} ${street}`);
    covered.add(street.toLowerCase());
  }

  add(geocode.name);
  add(street);
  add(geocode.district);
  add(geocode.subregion);
  add(geocode.city);
  add(geocode.region);
  add(geocode.country);

  const label = parts.join('، ').trim();
  return label.length > maxLength ? label.slice(0, maxLength - 1).trim() + '…' : label;
}

/** Human-readable coordinates for the confirmation chip, e.g. "17.6151, 44.1910". */
export function formatCoordsForDisplay(coords) {
  if (!isValidCoords(coords)) return '';
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

export default {
  DEFAULT_REGION,
  formatCoords,
  parseCoords,
  isValidCoords,
  buildPlaceLabel,
  formatCoordsForDisplay,
};
