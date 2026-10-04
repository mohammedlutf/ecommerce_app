import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ar from './strings/ar';
import en from './strings/en';
import {
  DEFAULT_LOCALE,
  LOCALES,
  isSupportedLocale,
  isRTLLocale,
  intlLocaleOf,
  pathWithLocale,
} from './locales';
import { formatCount, formatCurrency } from '../utils/format';

const CATALOGS = { ar, en };

const I18nContext = createContext(null);

/** Latin digits in both locales — mixed digit sets across a price list read as a bug. */
const INTL_LOCALES = { ar: 'ar-YE-u-nu-latn', en: 'en-GB' };

/** Where the native language choice lives; the web keeps it in the URL instead. */
export const LOCALE_STORAGE_KEY = 'i18n:locale';

/**
 * Resolve the locale we should start in.
 *
 * On the web the URL is the source of truth (`/en/...`), because the path is
 * what gets shared, cached and indexed. Native has no URL to read and stays on
 * the default Arabic locale — the mobile app is Arabic-only.
 */
export function detectInitialLocale() {
  if (Platform.OS !== 'web') return DEFAULT_LOCALE;
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const segment = window.location.pathname.split('/')[1];
  return isSupportedLocale(segment) ? segment : DEFAULT_LOCALE;
}

function lookup(catalog, key) {
  const value = key.split('.').reduce((node, part) => {
    return node && typeof node === 'object' ? node[part] : undefined;
  }, catalog);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Interpolate `{placeholder}` tokens.
 *
 * Deliberately minimal: a missing token is left verbatim rather than blanked,
 * so a typo shows up as `{foo}` in the UI instead of a silent hole in a sentence.
 */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitialLocale);
  const active = LOCALES[locale] ? locale : DEFAULT_LOCALE;
  const dir = LOCALES[active].dir;
  const isRTL = LOCALES[active].isRTL;
  const intlLocale = INTL_LOCALES[active] || intlLocaleOf(active);

  /**
   * Hydrate the stored language on native.
   *
   * `detectInitialLocale` cannot read storage synchronously, so on the very first
   * frame the app renders `DEFAULT_LOCALE` — Arabic, hence RTL — and this effect
   * corrects it a tick later if the shopper previously chose English. Rendering
   * Arabic first also means a cold start never flashes LTR English.
   */
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let alive = true;
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (alive && isSupportedLocale(stored)) setLocaleState(stored);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Publish direction to the document.
   *
   * This is the whole mechanism for web RTL: react-native-web has no
   * I18nManager, but `dir` on `<html>` flips CSS flexbox ordering and text
   * alignment, which is what the layout is actually built from. Physical
   * properties (`marginLeft`, `right: 8`) are *not* flipped — anything that needs
   * to hug a leading/trailing edge must go through `useDirectional` instead.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', LOCALES[active].htmlLang);
  }, [dir, active]);

  const t = useCallback(
    (key, fallback, params) => {
      const template = lookup(CATALOGS[active], key);
      if (template !== undefined) return interpolate(template, params);
      if (fallback !== undefined) return interpolate(fallback, params);
      if (__DEV__) {
        console.warn(`[i18n] missing ${active} translation for "${key}"`);
      }
      return key;
    },
    [active]
  );

  /**
   * Change locale, and on the web keep the URL in step.
   *
   * `replace` rather than `push` so switching language does not bury the page
   * the shopper was reading under a dozen back-presses. The path suffix is
   * preserved, so `/en/products/dairy` becomes `/ar/products/dairy`.
   */
  const setLocale = useCallback(
    (next, { syncUrl = true } = {}) => {
      const target = isSupportedLocale(next) ? next : DEFAULT_LOCALE;
      setLocaleState(target);
      // Native has no URL to carry the language, so the choice has to be stored
      // or it is lost on every launch and the app silently reverts to Arabic.
      if (Platform.OS !== 'web') {
        AsyncStorage.setItem(LOCALE_STORAGE_KEY, target).catch(() => {});
      }
      if (syncUrl && Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
        const target2 = pathWithLocale(target, window.location.pathname);
        if (target2 !== window.location.pathname) {
          window.history.replaceState(window.history.state, '', target2 + window.location.search);
        }
      }
    },
    []
  );

  const toggleLocale = useCallback(() => {
    setLocale(active === 'ar' ? 'en' : 'ar');
  }, [active, setLocale]);

  /** Money in the active locale, keeping the Arabic form byte-identical to before. */
  const formatMoney = useCallback(
    (amount, currency) => {
      if (active === 'ar') return formatCurrency(amount, currency || 'ر.ي');
      const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (!Number.isFinite(numeric)) return `0 ${currency || 'YER'}`;
      return `${numeric.toLocaleString(intlLocale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} ${currency || 'YER'}`;
    },
    [active, intlLocale]
  );

  const formatNumber = useCallback(
    (value) => {
      const numeric = typeof value === 'string' ? parseFloat(value) : value;
      if (!Number.isFinite(numeric)) return '0';
      return numeric.toLocaleString(intlLocale, { maximumFractionDigits: 2 });
    },
    [intlLocale]
  );

  const formatDateValue = useCallback(
    (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString(intlLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    [intlLocale]
  );

  /**
   * A counted noun phrase.
   *
   * Arabic needs singular / dual / plural and an accusative for 11+, which
   * `formatCount` already handles. English only needs the one/plural split, so
   * it goes through Intl rather than being forced into the Arabic three-way
   * shape.
   */
  const count = useCallback(
    (value, nouns) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return '';
      if (active === 'ar') {
        return formatCount(
          n,
          nouns.singular || 'منتج',
          nouns.dual || 'منتجان',
          nouns.plural || 'منتجات'
        );
      }
      return new Intl.PluralRules(intlLocale, { type: 'cardinal' }).format(n);
    },
    [active, intlLocale]
  );

  /**
   * Pluralised noun without the count.
   *
   * Used for trailing text like "5 نتائج" / "5 results", where Arabic needs the
   * noun only and English needs the noun chosen by the number.
   */
  const pluralNoun = useCallback(
    (value, nouns) => {
      const n = Number(value);
      if (active === 'ar') return nouns.plural || nouns.singular || '';
      return new Intl.PluralRules(intlLocale, { type: 'cardinal' }).select(n);
    },
    [active, intlLocale]
  );

  const value = useMemo(
    () => ({
      locale: active,
      dir,
      isRTL,
      htmlLang: LOCALES[active].htmlLang,
      intlLocale,
      t,
      setLocale,
      toggleLocale,
      formatMoney,
      formatNumber,
      formatDate: formatDateValue,
      count,
      pluralNoun,
    }),
    [
      active,
      dir,
      isRTL,
      intlLocale,
      t,
      setLocale,
      toggleLocale,
      formatMoney,
      formatNumber,
      formatDateValue,
      count,
      pluralNoun,
    ]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for the common case of only needing the translator. */
export function useT() {
  return useI18n().t;
}

export { I18nContext };