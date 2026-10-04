/**
 * Breakpoints and responsive layout tokens.
 *
 * The `md` boundary at 768 is the one that matters: below it we keep the phone
 * layout (bottom tabs, 2-up grid, single-column checkout), at or above it we
 * switch to the desktop shell (header nav, multi-column grid, checkout with an
 * order-summary rail).
 */
export const Breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
};

/** Order of keys matters — `minWidth` resolves against the widest match. */
export const BREAKPOINT_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

/** First breakpoint at which the desktop shell takes over from the phone layout. */
export const DESKTOP_BREAKPOINT = Breakpoints.md;

/**
 * Content never stretches wider than this.
 *
 * Without a cap, a 2560px monitor renders one enormous product card per row and
 * forces the eye to travel the whole viewport between the logo and the cart.
 */
export const MAX_CONTENT_WIDTH = 1320;

/**
 * Per-breakpoint tokens.
 *
 * Every map here MUST carry a key for every name in `BREAKPOINT_KEYS`, not just
 * the ones that look relevant. `GRID_GAP` used to stop at `xl`, so at `xxl`
 * (>= 1536px) `GRID_GAP[breakpoint]` was `undefined`, which propagated into
 * `useGridMetrics` as `width / (minCardWidth + undefined)` -> `NaN` columns ->
 * `numColumns={NaN}`. react-native-web reads `NaN > 1` as false, so it took the
 * single-column branch and threw "columnWrapperStyle not supported for single
 * column lists", taking the whole Products screen down on any large monitor.
 *
 * `assertResponsiveTokens()` below turns that class of omission into a failing
 * check instead of a runtime crash.
 */
export const GUTTER = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
};

/** Desktop header height, offset by the sticky offset of the category bar. */
export const HEADER_HEIGHT = 72;
export const SUBHEADER_HEIGHT = 52;

/**
 * Product grid columns per breakpoint.
 *
 * Counts climb with width but card width is capped in `ProductCard` itself, so
 * the grid never degenerates into slivers.
 */
export const GRID_COLUMNS = {
  xs: 2,
  sm: 3,
  md: 3,
  lg: 4,
  xl: 4,
  xxl: 5,
};

/** Gutter between grid cells. Keyed to every entry in `BREAKPOINT_KEYS`. */
export const GRID_GAP = {
  xs: 10,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
};

/**
 * Resolve the active breakpoint name for a width.
 *
 * Boundaries are `>=`, so `width: 768` is `md` rather than the top of `sm`.
 */
export function breakpointFor(width) {
  let current = 'xs';
  for (const key of BREAKPOINT_KEYS) {
    if (width >= Breakpoints[key]) current = key;
  }
  return current;
}

/** Maps that are indexed by breakpoint and must stay in step with it. */
export const RESPONSIVE_TOKEN_MAPS = { GUTTER, GRID_GAP, GRID_COLUMNS };

/**
 * Every breakpoint-keyed map must define every breakpoint.
 *
 * Called from `scripts/.verify-scope.cjs`, which already walks the source, so a
 * token added to one map and forgotten in another fails the check rather than
 * reaching a shopper as a blank page. The maps are exported for that purpose;
 * nothing in the app should call this at runtime.
 *
 * @returns {string[]} Human-readable problems; empty when the tokens line up.
 */
export function assertResponsiveTokens() {
  const problems = [];
  for (const [name, map] of Object.entries(RESPONSIVE_TOKEN_MAPS)) {
    for (const key of BREAKPOINT_KEYS) {
      const value = map[key];
      if (value === undefined) {
        problems.push(`${name} is missing the "${key}" breakpoint`);
      } else if (!Number.isFinite(value) || value <= 0) {
        problems.push(`${name}.${key} must be a positive finite number, got ${value}`);
      }
    }
  }
  return problems;
}