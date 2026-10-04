import {
  getPathFromState as getPathFromStateDefault,
  getStateFromPath as getStateFromPathDefault,
} from '@react-navigation/core';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  pathWithLocale,
  stripLocaleFromPath,
} from '../i18n/locales';
import { SITE_URL } from './siteConfig';

/**
 * Params that must reach the navigator but must never reach the address bar.
 *
 * `seed` only exists to make two identical searches distinguishable in state.
 * `focusSearch` is one-shot UI state. Leaving either in a shareable URL is
 * noise, and `?seed=1750...` in a link a customer copies is worse than noise.
 * They are stripped from the state copy used to build the path; the navigator's
 * real state keeps them.
 */
const URL_HIDDEN_PARAMS = ['seed', 'focusSearch'];

/** True on the web build, where URL synchronisation applies. */
const isWeb = typeof document !== 'undefined';

/** The locale segment that currently prefixes every web URL. */
function currentLocale() {
  if (!isWeb) return DEFAULT_LOCALE;
  const seg = window.location.pathname.split('/')[1];
  return isSupportedLocale(seg) ? seg : DEFAULT_LOCALE;
}

/**
 * Prefix a path with the active locale, preserving the query string.
 *
 * `pathWithLocale` is not used directly here because it drops everything after
 * `?` (it splits the path to test the first segment). Search and category URLs
 * carry a query, so losing it here would silently drop `?search=...` from every
 * search address bar.
 *
 * The trailing slash is normalised away because an optional route param leaves
 * `products/` behind when it is absent. `/ar/products` and `/ar/products/` are
 * different URLs to a browser and to the prerenderer's static file layout, so
 * leaving both reachable splits page views and breaks canonical links.
 */
function prefixLocale(path) {
  const [rawPath, query] = String(path || '/').split('?');
  const withoutSlash = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const prefixed = pathWithLocale(currentLocale(), withoutSlash);
  return query ? `${prefixed}?${query}` : prefixed;
}

/** Inverse of `prefixLocale`: remove the locale segment, keep the query. */
function unprefixLocale(path) {
  const [pathname, query] = String(path || '/').split('?');
  const stripped = stripLocaleFromPath(pathname);
  return query ? `${stripped}?${query}` : stripped;
}

/** Drop `URL_HIDDEN_PARAMS` from a state copy, leaving the live state alone. */
function stripUrlHiddenParams(state) {
  if (!state || !Array.isArray(state.routes)) return state;
  let touched = false;
  const routes = state.routes.map((route) => {
    const next = { ...route };
    if (next.params && typeof next.params === 'object') {
      const params = { ...next.params };
      for (const key of URL_HIDDEN_PARAMS) delete params[key];
      next.params = params;
      touched = true;
    }
    if (next.state) {
      const child = stripUrlHiddenParams(next.state);
      if (child !== next.state) {
        next.state = child;
        touched = true;
      }
    }
    return next;
  });
  return touched ? { ...state, routes } : state;
}

/**
 * Turn navigator state into a locale-prefixed path.
 *
 * React Navigation's own `getPathFromState` returns a bare path such as
 * `/products/dairy` and writes that straight into the address bar. Our routes
 * are served from `/ar/...` and `/en/...` so each language has its own
 * addressable tree for the prerenderer and for hreflang, so the locale segment
 * has to be added here rather than left to the caller.
 *
 * The order matters: the hidden params are stripped from the *state* on the way
 * in. Applying that to the returned path would be a no-op, because by then the
 * query string has already been serialised into a string.
 */
function getPathFromState(state, config) {
  return prefixLocale(getPathFromStateDefault(stripUrlHiddenParams(state), config));
}

/**
 * Parse a locale-prefixed path back into navigator state.
 *
 * The counterpart to `getPathFromState`. `/ar/products/dairy` has to become
 * `products/dairy` before the default resolver sees it, otherwise no route in
 * `config` matches and a deep link lands on nothing.
 */
function getStateFromPath(path, config) {
  return getStateFromPathDefault(unprefixLocale(path), config);
}

/**
 * URL scheme for the web build.
 *
 * ## Why `ProductDetail` appears under one stack and not two
 *
 * `ProductDetail` is registered in both `HomeStack` and `ProductsStack` so that
 * a product can be opened from either tab without changing tabs on mobile. A
 * linking config is a flat map of path → route, so declaring `product/:itemCode`
 * twice is ambiguous and the resolver cannot decide which stack to open.
 *
 * Rather than break mobile navigation, only the `ProductsStack` copy is
 * addressable. `openProduct` below therefore routes through `linking.navigate`,
 * which resolves the URL first and then lets the navigator find its own route —
 * so a product opened from the home page on the web still lands on
 * `/ar/product/ABC-1` and is fully indexable. On native the same call site uses
 * plain `navigation.navigate`, leaving tab behaviour untouched.
 */
export const linking = {
  prefixes: [SITE_URL, 'https://hadramout-supermarket.com', 'http://localhost:8081'],

  // Locale-aware in both directions, so the address bar and the navigator can
  // never disagree about which language tree is showing.
  getStateFromPath,
  getPathFromState,

  /**
   * The app is served from `/ar/...` and `/en/...` so each language has its own
   * addressable tree. `initialRouteName` is the bare root, which the language
   * provider resolves from the URL and then prefixes via `replace`.
   */
  config: {
    screens: {
      HomeTab: {
        screens: {
          Home: '',
          Categories: 'categories',
        },
      },
      ProductsTab: {
        screens: {
          /*
           * `:itemGroup?` is optional so `/products` and `/products/dairy` are
           * both addressable. The prerenderer emits a page per category, so a
           * config that only matched the bare `products` would let those URLs
           * 404 on a cold load and on Back — the resolver would find no route
           * and leave the navigator where it was.
           */
          Products: 'products/:itemGroup?',
          ProductDetail: 'product/:itemCode',
        },
      },
      WishlistTab: {
        screens: {
          WishlistScreen: 'wishlist',
        },
      },
      CartTab: {
        screens: {
          Cart: 'cart',
          OrderConfirmation: 'order/:orderId',
        },
      },
      AccountTab: {
        screens: {
          Account: 'account',
          Login: 'login',
        },
      },
    },
  },
};

/** True on the web build, where URL synchronisation applies. */
// `isWeb`, `currentLocale`, `prefixLocale` and friends are defined above, ahead
// of this config, because `getPathFromState` needs them.

/**
 * Open the product list, optionally scoped to a category or search term.
 *
 * Both platforms navigate; only the web build also rewrites the address bar.
 * That rewrite is not this function's job — `getPathFromState` above does it
 * whenever state changes, so the URL always matches `config.screens`. Driving
 * the URL by hand here would let the two diverge.
 *
 * `seed` makes two identical searches distinguishable. Re-running the same query
 * has to re-fire the request; without a changing seed the products screen sees
 * params that compare equal, treats it as a no-op and leaves stale results up.
 *
 * `extra` carries params that are deliberately *not* part of the URL — one-shot
 * UI state such as `focusSearch`, which must not become a shareable link.
 */
export function openProducts(navigation, { itemGroup, search, extra } = {}) {
  const params = { ...(extra || {}) };
  if (itemGroup) params.itemGroup = itemGroup;
  if (search) {
    params.search = search;
    params.seed = Date.now();
  }
  navigation.navigate('ProductsTab', { screen: 'Products', params });
}

/**
 * Open a product, keeping the address bar correct.
 *
 * `method: 'push'` exists so backing out of a related-product rail returns to
 * the product being read instead of leaving the page. That only works on the
 * stack that owns the addressable route: `push` on any other stack would produce
 * a `ProductDetail` path no config entry matches. On the web build every product
 * is opened through `ProductsStack` (see `navigate` below), so `push` is always
 * applied to the right stack. On native the caller's ordinary
 * `navigation.navigate`/`push` is used, leaving tab behaviour untouched.
 *
 * @param {object} navigation React Navigation object from the calling screen.
 * @param {string} itemCode
 * @param {object} [options]
 * @param {'push'|'navigate'} [options.method] `push` for related-product rails.
 */
export function openProduct(navigation, itemCode, { method = 'navigate' } = {}) {
  if (!itemCode) return;

  if (!isWeb) {
    if (method === 'push') navigation.push('ProductDetail', { itemCode });
    else navigation.navigate('ProductDetail', { itemCode });
    return;
  }

  /*
   * Web: always address the product through `ProductsStack`.
   *
   * `ProductDetail` is registered in `HomeStack` too so a product can open
   * without switching tabs on a phone. A linking config is a flat map of
   * path -> route, so `product/:itemCode` can only be declared once, and it is
   * declared under `ProductsStack`. Navigating to `HomeStack`'s copy would emit
   * a bare `ProductDetail` segment instead of `/product/ABC-1`.
   *
   * `push` is left alone: the only caller that asks for it is the
   * recommendations rail, which by then is sitting inside `ProductsStack`, so the
   * push lands on the stack whose route is addressable and the back button
   * returns to the product being read.
   */
  if (method === 'push') {
    navigation.push('ProductDetail', { itemCode });
    return;
  }
  navigation.navigate('ProductsTab', { screen: 'ProductDetail', params: { itemCode } });
}

export default linking;