import { Platform } from 'react-native';

/**
 * Global CSS for the web build.
 *
 * Injected once, at runtime, from `App.js` on web only.
 *
 * ## Why a stylesheet rather than StyleSheet
 *
 * Everything react-native-web renders is inline styles generated from
 * `StyleSheet.create`, which gives no hook for pseudo-classes or descendant
 * selectors. A real stylesheet is the only way to get `:hover`, `:focus-visible`
 * and `:active` — the states that make a site feel responsive under the cursor
 * rather than merely functional.
 *
 * ## What is deliberately *not* here
 *
 * No change to `body { overflow: hidden }`. Expo's web reset disables document
 * scrolling because the app is built from `ScrollView`s, and that model is
 * load-bearing: screens own their own scroll container, which is why the footer
 * has to be appended inside each screen's `ScrollView` rather than placed once
 * in the shell. Switching to document scrolling would nest two vertical scrollers
 * and make the sticky header fight the page. The app-shell model stays.
 */

const STYLE_ID = 'app-web-styles';

const CSS = `
/* Tabular figures everywhere money or counts are shown, so columns of prices
   align and a changing total does not shift the layout as digits change. */
.tabular { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }

/* Hover lift for cards and buttons. Only under a fine pointer — a touch device
   has no hover, and leaving the card lifted after a tap reads as stuck. */
@media (hover: hover) and (pointer: fine) {
  .hover-lift { transition: transform 160ms ease, box-shadow 160ms ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15, 30, 45, 0.12); }
  .hover-underline:hover { text-decoration: underline; }
  .hover-tint:hover { filter: brightness(0.97); }
}

/* Keyboard focus must be visible; react-native-web suppresses the UA ring. */
:focus-visible { outline: 2px solid #0F7A3D; outline-offset: 2px; border-radius: 4px; }

::selection { background: #E7F6EC; color: #004129; }

/* Slim scrollbars so nested ScrollViews do not eat a card's worth of width. */
* { scrollbar-width: thin; scrollbar-color: #C3CDD6 transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: #C3CDD6; border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
*::-webkit-scrollbar-thumb:hover { background: #9AA6B2; background-clip: content-box; }

/* Leaflet renders real DOM nodes inside our View tree; without this they pick
   up the RNW text reset and the attribution becomes unreadable. */
.leaflet-container { font: inherit; background: #ECF1EE; }
.leaflet-container a { color: #0F7A3D; }
`;

/**
 * Add the stylesheet. Idempotent — safe to call on every re-render, and a no-op
 * on native so callers never have to check the platform.
 */
export function injectWebStyles() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export default injectWebStyles;