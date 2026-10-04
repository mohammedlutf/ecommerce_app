/**
 * Locale definitions and URL helpers.
 *
 * The site is reachable at two parallel URL trees — `/ar/...` and `/en/...` —
 * which is what makes the pages indexable and linkable per language. A locale
 * is therefore part of the *path*, not a runtime toggle.
 */

export const DEFAULT_LOCALE = 'ar';

export const LOCALES = {
  ar: {
    code: 'ar',
    /** BCP-47 tag used for `<html lang>`. */
    htmlLang: 'ar',
    /** Drives `<html dir>`, flexbox ordering and text alignment. */
    dir: 'rtl',
    isRTL: true,
    /** Endonym — always shown in its own language, never translated. */
    label: 'العربية',
    /** Short label for the cramped header switcher. */
    shortLabel: 'ع',
    /** `Intl` locale for number/currency/date formatting. */
    intlLocale: 'ar',
  },
  en: {
    code: 'en',
    htmlLang: 'en',
    dir: 'ltr',
    isRTL: false,
    label: 'English',
    shortLabel: 'EN',
    intlLocale: 'en-GB',
  },
};

export const LOCALE_CODES = Object.keys(LOCALES);

export function isSupportedLocale(code) {
  return !!LOCALE_CODES.includes(code);
}

/**
 * Read the locale out of a pathname.
 *
 * Tolerates a missing prefix (`/products` → default locale) and an unknown one
 * (`/fr/products` → default locale) so a mistyped or crawled URL still renders
 * real content instead of a dead end.
 */
export function localeFromPath(pathname) {
  const segment = String(pathname || '').split('?')[0].split('/')[1];
  return isSupportedLocale(segment) ? segment : DEFAULT_LOCALE;
}

/** Strip a leading locale segment, returning the app-relative remainder. */
export function stripLocaleFromPath(pathname) {
  const parts = String(pathname || '').split('?')[0].split('/');
  if (isSupportedLocale(parts[1])) parts.splice(1, 1);
  const rest = parts.join('/');
  return rest === '' ? '/' : rest;
}

/**
 * Prefix an app-relative path with a locale.
 *
 * Idempotent: re-prefixing a path that already carries a locale replaces it,
 * which is what the language switcher needs.
 */
export function pathWithLocale(locale, path) {
  const rest = stripLocaleFromPath(path || '/');
  const suffix = rest === '/' ? '' : rest;
  return `/${isSupportedLocale(locale) ? locale : DEFAULT_LOCALE}${suffix}`;
}

/** Swap the locale of a full URL, keeping the rest of the path intact. */
export function switchLocaleInPath(pathname, nextLocale) {
  return pathWithLocale(nextLocale, pathname);
}

/** The sibling-language URL for hreflang tags. */
export function alternatePathFor(pathname, locale) {
  return pathWithLocale(locale, pathname);
}

export function directionOf(locale) {
  return (isSupportedLocale(locale) ? LOCALES[locale] : LOCALES[DEFAULT_LOCALE]).dir;
}

export function isRTLLocale(locale) {
  return (isSupportedLocale(locale) ? LOCALES[locale] : LOCALES[DEFAULT_LOCALE]).isRTL;
}

export function intlLocaleOf(locale) {
  return (isSupportedLocale(locale) ? LOCALES[locale] : LOCALES[DEFAULT_LOCALE]).intlLocale;
}