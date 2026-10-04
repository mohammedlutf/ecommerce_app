/**
 * Site-level SEO configuration.
 *
 * `SITE_URL` must be the public origin the site is served from, with no trailing
 * slash and no path. It is the single input to canonical URLs, hreflang pairs,
 * Open Graph tags, the sitemap and `robots.txt`, so an incorrect value here
 * quietly produces wrong metadata on every page rather than failing loudly.
 *
 * Override per environment with `EXPO_PUBLIC_SITE_URL` at build time:
 *
 *   EXPO_PUBLIC_SITE_URL=https://shop.example.com npx expo export -p web
 */
const RAW_SITE_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_SITE_URL) || '';

export const SITE_URL = (RAW_SITE_URL || 'https://hadramout-supermarket.com').replace(/\/+$/, '');

export const SITE = {
  origin: SITE_URL,
  /** Brand as it appears in titles, without the store suffix appended separately. */
  name: 'زاد ماركت',
  nameEn: 'Zad Market',
  /** Social preview image, absolute URL. 1200x630 is what the major crawlers crop to. */
  ogImage: `${SITE_URL}/og-image.png`,
  twitter: '@hadramoutmarket',
  locale: 'ar_YE',
  localeEn: 'en_GB',
};

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}