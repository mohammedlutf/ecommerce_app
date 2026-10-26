import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SITE, absoluteUrl } from './siteConfig';
import { LOCALE_CODES, DEFAULT_LOCALE, pathWithLocale, stripLocaleFromPath } from '../i18n/locales';

/**
 * Document head management for the web build.
 *
 * ## Why this is imperative DOM rather than a Helmet
 *
 * There is no server rendering here, so nothing can emit a `<head>` per route —
 * the crawler receives one static `index.html` and then runs the app. The only
 * way a crawler can see a per-product title or canonical URL is if the app writes
 * them into `document.head` after mount. Every tag below is therefore upserted
 * by a stable `key`, never appended, or a re-render would leave duplicates and
 * Google would read whichever it found first.
 *
 * ## No-op on native
 *
 * `document` does not exist there, so the hook returns early. Screens call it
 * unconditionally.
 */

const MANAGED = 'data-seo-managed';

function upsertMeta(doc, attr, key, value) {
  let tag = doc.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = doc.createElement('meta');
    tag.setAttribute(attr, key);
    tag.setAttribute(MANAGED, 'true');
    doc.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
  return tag;
}

function upsertLink(doc, rel, href, hreflang) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let tag = doc.head.querySelector(selector);
  if (!tag) {
    tag = doc.createElement('link');
    tag.setAttribute('rel', rel);
    if (hreflang) tag.setAttribute('hreflang', hreflang);
    tag.setAttribute(MANAGED, 'true');
    doc.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
  return tag;
}

/** Remove a managed JSON-LD block by id. */
function removeJsonLd(doc, id) {
  const existing = doc.getElementById(id);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

/**
 * Publish metadata for one screen.
 *
 * @param {object} head
 * @param {string} [head.title] Already-localised page title, without the site suffix.
 * @param {string} [head.description] Already-localised meta description.
 * @param {string} [head.path] Site-relative path *without* a locale prefix, e.g. `/product/ABC-1`.
 *   The locale is applied here, so callers never build a locale path by hand.
 * @param {string} [head.image] Absolute or site-relative social image.
 * @param {string} [head.type] Open Graph type. `product` for a product page.
 * @param {object|object[]} [head.jsonLd] Schema.org graph node(s).
 * @param {boolean} [head.noindex] Keep the page out of the index (cart, account).
 */
export default function useDocumentHead({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  jsonLd,
  noindex = false,
} = {}) {
  const locale = typeof document !== 'undefined' ? currentLocaleFromDom() : DEFAULT_LOCALE;
  const siteLocale = locale === 'ar' ? SITE.locale : SITE.localeEn;
  const siteName = locale === 'ar' ? SITE.name : SITE.nameEn;
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const canonicalPath = pathWithLocale(locale, path);
  const ogImage = absoluteUrl(image || '/assets/rtlrecologo.png');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const doc = document;

    doc.title = fullTitle;
    upsertMeta(doc, 'name', 'description', description || '');
    upsertMeta(doc, 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta(doc, 'property', 'og:title', fullTitle);
    upsertMeta(doc, 'property', 'og:description', description || '');
    upsertMeta(doc, 'property', 'og:type', type);
    upsertMeta(doc, 'property', 'og:url', absoluteUrl(canonicalPath));
    upsertMeta(doc, 'property', 'og:site_name', siteName);
    upsertMeta(doc, 'property', 'og:image', ogImage);
    upsertMeta(doc, 'property', 'og:locale', siteLocale);
    upsertMeta(doc, 'name', 'twitter:card', 'summary_large_image');
    upsertMeta(doc, 'name', 'twitter:title', fullTitle);
    upsertMeta(doc, 'name', 'twitter:description', description || '');
    upsertMeta(doc, 'name', 'twitter:image', ogImage);

    // Canonical points at the locale actually being viewed. hreflang pairs point
    // at both, so a crawler can find the English page from the Arabic one and
    // treat them as translations of each other rather than duplicates.
    upsertLink(doc, 'canonical', absoluteUrl(canonicalPath));
    const stripped = stripLocaleFromPath(path);
    for (const code of LOCALE_CODES) {
      upsertLink(doc, 'alternate', absoluteUrl(pathWithLocale(code, stripped)), code);
    }
    upsertLink(doc, 'alternate', absoluteUrl(pathWithLocale(DEFAULT_LOCALE, stripped)), 'x-default');

    return undefined;
    // `locale` is derived from the DOM rather than state, so it is not a
    // dependency; the provider re-renders children on a language change anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTitle, description, canonicalPath, ogImage, type, noindex, siteName]);

  /**
   * Structured data.
   *
   * Written as one `<script type="application/ld+json">` containing an `@graph`
   * so Organization, BreadcrumbList and Product can be cross-referenced by
   * `@id` — which is how a product's price and availability end up attached to
   * the business in rich results rather than as unrelated islands.
   *
   * The previous block is removed first: JSON-LD accumulates silently otherwise,
   * and a stale price left in the page is worse than no structured data at all.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const id = 'seo-jsonld';
    removeJsonLd(document, id);
    if (!jsonLd) return undefined;

    const nodes = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    if (nodes.length === 0) return undefined;

    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.setAttribute(MANAGED, 'true');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': nodes,
    });
    document.head.appendChild(script);

    return () => removeJsonLd(document, id);
  }, [jsonLd]);
}

function currentLocaleFromDom() {
  const lang = document.documentElement.getAttribute('lang');
  return lang === 'en' ? 'en' : DEFAULT_LOCALE;
}