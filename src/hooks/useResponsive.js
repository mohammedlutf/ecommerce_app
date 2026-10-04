import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  BREAKPOINT_KEYS,
  DESKTOP_BREAKPOINT,
  GUTTER,
  GRID_COLUMNS,
  GRID_GAP,
  MAX_CONTENT_WIDTH,
  SUBHEADER_HEIGHT,
  HEADER_HEIGHT,
  breakpointFor,
} from '../theme/responsive';

/**
 * Single source of truth for "how wide is the screen right now".
 *
 * Backed by `useWindowDimensions` rather than a media query so the same hook
 * answers correctly on native and on react-native-web, where a window resize
 * (or an orientation change) is what we actually need to react to.
 *
 * @returns {{
 *   width: number,
 *   height: number,
 *   breakpoint: string,
 *   isMobile: boolean,
 *   isTablet: boolean,
 *   isDesktop: boolean,
 *   isWide: boolean,
 *   columns: number,
 *   gutter: number,
 *   gridGap: number,
 *   maxWidth: number,
 *   headerHeight: number,
 * }}
 */
export default function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const breakpoint = breakpointFor(width);
    return {
      width,
      height,
      breakpoint,
      /** Below the desktop breakpoint: phone layout, bottom tab bar. */
      isMobile: width < DESKTOP_BREAKPOINT,
      /** md and up: the desktop shell with a header nav replaces the tab bar. */
      isDesktop: width >= DESKTOP_BREAKPOINT,
      isTablet: width >= DESKTOP_BREAKPOINT && width < 1280,
      isWide: width >= 1536,
      columns: GRID_COLUMNS[breakpoint],
      gutter: GUTTER[breakpoint],
      gridGap: GRID_GAP[breakpoint],
      maxWidth: MAX_CONTENT_WIDTH,
      headerHeight: HEADER_HEIGHT,
      subheaderHeight: SUBHEADER_HEIGHT,
    };
  }, [width, height]);
}

/**
 * Which navigation chrome to render.
 *
 * Deliberately *not* the same thing as `useResponsive().isDesktop`. Width alone
 * cannot answer it: a native tablet, or a phone held in landscape, is wider than
 * `DESKTOP_BREAKPOINT`, so a width-only test hands it the web header — a bar of
 * links with no working search and no cart badge, sitting on top of a bottom tab
 * bar that is still there too. Chrome is a platform decision first and a width
 * decision second.
 *
 * Every screen that hides or shows header-level UI must ask here rather than
 * calling `useResponsive`, so the rule stays in one place. A screen that uses the
 * width directly will eventually disagree with the shell.
 *
 * @returns {{
 *   showDesktopChrome: boolean, Site header + footer, no bottom tab bar
 *   showTabBar: boolean, Bottom tab bar on phone and narrow web
 * }}
 */
export function useSiteChrome() {
  const { isDesktop } = useResponsive();

  return useMemo(() => {
    // Only the web build has a mouse, a hover menu and a document to scroll. A
    // header nav on a touch device is worse than the tab bar it would replace:
    // it cannot be reached with a thumb and its dropdowns open on hover.
    const showDesktopChrome = Platform.OS === 'web' && isDesktop;
    return { showDesktopChrome, showTabBar: !showDesktopChrome };
  }, [isDesktop]);
}

/**
 * Column count and cell metrics for a product grid.
 *
 * Shared by `ProductGrid` and the screens that hand-roll their own `FlatList`
 * rows, so a card measured by one and a card measured by the other come out the
 * same width. Two grids that disagree by a few pixels are immediately visible
 * when a shopper navigates between them.
 *
 * @param {object} [opts]
 * @param {number} [opts.minCardWidth] Narrowest acceptable card, in points.
 *   Below this the price row stops being legible.
 * @param {number} [opts.gap] Overrides the breakpoint gutter.
 * @param {number} [opts.columns] Pins the column count, bypassing the breakpoint.
 * @param {number} [opts.imageRatio] Image height as a fraction of card width.
 * @returns {{columns: number, gap: number, cellStyle: object, rowStyle: object, imageHeight: number}}
 */
export function useGridMetrics({
  minCardWidth = 150,
  gap: gapOverride,
  columns: columnsOverride,
  imageRatio = 0.78,
} = {}) {
  const { width, columns: responsiveColumns, gridGap } = useResponsive();

  /*
   * Both tokens are indexed by breakpoint, so a breakpoint missing from either
   * map used to hand back `undefined` and turn the arithmetic below into `NaN`.
   * `NaN > 1` is false, which react-native-web reads as "single column", and it
   * then threw because `columnWrapperStyle` was still set — the Products screen
   * died on any window 1536px or wider. Every step is now guarded so the worst
   * case is a slightly wrong column count, never `NaN`.
   */
  const gapCandidate = gapOverride ?? gridGap;
  const gap = Number.isFinite(gapCandidate) && gapCandidate > 0 ? gapCandidate : GRID_GAP.xs;

  const columns = useMemo(() => {
    const base = Number.isFinite(columnsOverride)
      ? columnsOverride
      : Number.isFinite(responsiveColumns)
        ? responsiveColumns
        : 2;

    const cardMin = Number.isFinite(minCardWidth) && minCardWidth > 0 ? minCardWidth : 150;
    const maxByWidth = Math.floor(width / (cardMin + gap));

    // `Math.min`/`Math.max` propagate NaN, so the finite checks above are what
    // keep this a number. Clamped to >= 2 because a 1-column product grid is
    // never the intent here, and FlatList rejects `columnWrapperStyle` there.
    const next = Math.min(base, maxByWidth);
    return Number.isFinite(next) ? Math.max(2, next) : 2;
  }, [columnsOverride, responsiveColumns, width, minCardWidth, gap]);

  // Cells are percentage-width because FlatList ignores a child's width and
  // distributes its `numColumns` children evenly. The gutter therefore comes from
  // padding inside each cell, with a matching negative margin on the row to pull
  // the outer edges back flush. Sizing cells with flex instead would make the
  // last row's cells stretch to fill, which reads as a broken grid whenever the
  // item count is not a multiple of the column count.
  const cellStyle = useMemo(
    () => ({ width: `${100 / columns}%`, paddingHorizontal: gap / 2, paddingBottom: gap }),
    [columns, gap]
  );

  const rowStyle = useMemo(() => ({ marginHorizontal: -gap / 2 }), [gap]);

  const imageHeight = useMemo(() => {
    const cardWidth = (width - gap * 2) / columns - gap;
    return Math.max(110, Math.round(cardWidth * imageRatio));
  }, [width, columns, gap, imageRatio]);

  return { columns, gap, cellStyle, rowStyle, imageHeight };
}

/**
 * Build a `numColumns` + `columnWrapperStyle` pair for a `FlatList`.
 *
 * Superseded by `useGridMetrics` for product grids, which also needs the cell
 * width and image height. Kept for simpler lists that only need a column count.
 */
export function useGrid({ minCardWidth = 210, maxColumns = 5 } = {}) {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    // How many cards of at least `minCardWidth` fit, accounting for gutters.
    const fit = Math.floor(width / (minCardWidth + 12));
    const columns = Math.max(2, Math.min(maxColumns, fit || 2));
    return { columns };
  }, [width, minCardWidth, maxColumns]);
}