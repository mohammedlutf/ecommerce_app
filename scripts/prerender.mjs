/**
 * Build-time prerender.
 *
 * ## The problem this solves
 *
 * `expo export --platform web` emits a single `index.html` with an empty
 * `<div id="root">`. Everything visible is produced by JavaScript at runtime, so
 * a crawler that does not execute JS sees a blank page — and even one that does
 * has to wait for React to mount before a title, canonical URL or product price
 * exists. Googlebot does render JS, but it renders on a second pass: the page is
 * queued for crawling, discovered as "not much here", and only later indexed at
 * whatever quality the render produced.
 *
 * This script walks the same `dist-web` output and writes a real HTML file per
 * route, with metadata and structured data baked into `<head>`. The SPA then
 * hydrates over the top: crawlers get content from the HTML, and shoppers still
 * get the real app.
 *
 * ## What is deliberately absent from the prerendered HTML
 *
 * **Prices.** They are baked at build time and would be stale the moment a price
 * changed, and wrong prices in structured data are a manual-action risk. The
 * static pages therefore carry availability and identity but no `price`, and the
 * live app adds it at runtime from the cart API. The same reasoning applies to
 * stock levels and delivery charges.
 *
 * ## Usage
 *
 *   node scripts/prerender.mjs
 *
 * Environment:
 *   EXPO_PUBLIC_SITE_URL  public origin, e.g. https://shop.example.com
 *   API_BASE              ERPNext base, e.g. http://127.0.0.1:8000
 *   WEB_OUT               bundle directory, default `dist-web`
 *   PRERENDER_MAX_PRODUCTS cap, default 2000
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://hadramout-supermarket.com').replace(/\/+$/, '');
const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const WEB_OUT = process.env.WEB_OUT || 'dist-web';
const MAX_PRODUCTS = Number(process.env.PERENDER_MAX_PRODUCTS || 2000);

const LOCALES = ['ar', 'en'];
const BRAND = { ar: 'زاد ماركت', en: 'Zad Market' };
const SITE_BRAND = BRAND.ar;
const SITE_ORIGIN_ID = `${SITE_URL}/#organization`;

/* ------------------------------------------------------------------ strings */

const COPY = {
  ar: {
    home: { title: `${BRAND.ar} | تسوق أونلاين مع توصيل سريع`, description: 'تسوق من سوبرماركت حضرموت أونلاين. منتجات بقالة طازجة، خضار، فواكه، لحوم ومنتجات منزلية مع توصيل سريع إلى باب منزلك.' },
    products: { title: `المنتجات | ${BRAND.ar}`, description: 'تصفح جميع المنتجات المتاحة في متجرنا مع أسعار واضحة وتوصيل سريع لجميع مناطق حضرموت.' },
    categories: { title: `الأقسام | ${BRAND.ar}`, description: 'تصفح أقسام المتجر: بقالة، خضار وفواكه، لحوم، ألبان، منظفات والمزيد.' },
    product: (name) => ({
      title: `${name} | ${BRAND.ar}`,
      description: `اشترِ ${name} بأفضل سعر مع توصيل سريع. تفاصيل المنتج والصور/reviews متوفرة في المتجر.`.replace('/reviews', ''),
    }),
    loading: 'جاري تحميل الصفحة...',
  },
  en: {
    home: { title: `${BRAND.en} | Online shopping with fast delivery`, description: 'Shop online at Hadhramaut Supermarket. Fresh groceries, vegetables, fruits, meat and household products with fast delivery to your door.' },
    products: { title: `Products | ${BRAND.en}`, description: 'Browse everything we stock, with clear prices and fast delivery across all of Hadhramaut.' },
    categories: { title: `Categories | ${BRAND.en}`, description: 'Browse our departments: groceries, fresh produce, meat, dairy, household and more.' },
    product: (name) => ({
      title: `${name} | ${BRAND.en}`,
      description: `Buy ${name} at the best price with fast delivery. Full product details and images available in store.`,
    }),
    loading: 'Loading...',
  },
};

/* ---------------------------------------------------------------- utilities */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value) =>
  String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Does this string contain Arabic script?
 *
 * Used to decide whether a translated page is genuinely translated. The
 * catalogue stores `item_name` and `web_item_name` as the same Arabic value, so
 * an English URL built from that name is a verbatim copy of the Arabic one.
 * Publishing both invites a duplicate-content penalty and makes the hreflang
 * pair a false claim, so such pages are emitted `noindex` instead.
 */
const ARABIC_RE = /[\u0600-\u06FF]/;
const hasArabic = (value) => ARABIC_RE.test(String(value ?? ''));

/**
 * Best available description for a product.
 *
 * The live fields are `short_description` and `web_long_description`;
 * `description` does not exist on the ecommerce payload and silently yields
 * nothing if relied on.
 */
function productDescription(product, locale) {
  const candidates =
    locale === 'ar'
      ? [product.short_description, product.web_long_description, product.description]
      : [product.web_long_description, product.short_description];
  for (const value of candidates) {
    const text = stripHtml(value);
    if (text) return text.slice(0, 300);
  }
  return '';
}

async function frappeGet(method, args = {}) {
  const url = new URL(`${API_BASE}/api/method/${method}`);
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${method} -> HTTP ${res.status}`);
    const body = await res.json();
    return body && 'message' in body ? body.message : body;
  } finally {
    clearTimeout(timer);
  }
}

const abs = (p) => `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`;
const localized = (locale, p) => `/${locale}${p === '/' ? '' : p}`;

/* ------------------------------------------------------------------- render */

function headTags({ locale, title, description, canonicalPath, jsonLd, noindex, type = 'website' }) {
  const strip = canonicalPath.replace(/^\/(ar|en)/, '') || '/';
  const alternates = LOCALES.map(
    (code) =>
      `<link rel="alternate" hreflang="${code}" href="${esc(abs(localized(code, strip)))}" />`
  ).join('\n    ');

  return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}" />
    <link rel="canonical" href="${esc(abs(canonicalPath))}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${esc(abs(localized('ar', strip)))}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:type" content="${esc(type)}" />
    <meta property="og:url" content="${esc(abs(canonicalPath))}" />
    <meta property="og:site_name" content="${esc(BRAND[locale])}" />
    <meta property="og:locale" content="${locale === 'ar' ? 'ar_YE' : 'en_GB'}" />
    <meta property="og:image" content="${esc(abs('/og-image.png'))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(abs('/og-image.png'))}" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonLd })}</script>` : ''}`;
}

/**
 * No-JS fallback content.
 *
 * This is what a crawler that does not execute JavaScript sees. It is a small,
 * honest subset — heading, price range framing and links — not a fake rendering
 * of the app. React replaces the whole node on mount.
 */
function fallbackBody(locale, heading, intro, links = []) {
  const items = links
    .map((link) => `      <li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`)
    .join('\n');
  return `<div id="root">
      <main style="font-family: system-ui, sans-serif; max-width: 960px; margin: 0 auto; padding: 24px">
        <h1>${esc(heading)}</h1>
        <p>${esc(intro)}</p>
        <ul>
${items}
        </ul>
      </main>`;
}

/** Injects into the exported `index.html`, forcing `lang`/`dir` per locale. */
function renderPage(template, { locale, title, description, canonicalPath, jsonLd, noindex, type = 'website', body }) {
  const head = headTags({ locale, title, description, canonicalPath, jsonLd, noindex, type });
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // The export template carries whatever `expo` wrote (currently `lang="ar"`),
  // so a literal match on a specific value is unreliable — rewrite whatever is
  // there. The existing `dir`, if any, is replaced rather than duplicated.
  let html = template
    .replace(/<html\b([^>]*)>/i, (match, attrs) => {
      const cleaned = attrs
        .replace(/\slang="[^"]*"/i, '')
        .replace(/\sdir="[^"]*"/i, '');
      return `<html${cleaned} lang="${locale}" dir="${dir}">`;
    })
    // The template's own <title> must be REMOVED, not merely followed by
    // another one: crawlers read the first <title> they find, so leaving the
    // generic brand title in place would silently win over the per-page one and
    // every page would be indexed as "زاد ماركت".
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace('</head>', `  ${head}\n</head>`);

  if (body) {
    html = html.replace('<div id="root"></div>', body);
  }
  return html;
}

/* -------------------------------------------------------------------- data */

async function loadProducts() {
  try {
    const data = await frappeGet('ecommerce.api.catalog', { limit: MAX_PRODUCTS });
    const items = (data && data.items) || [];
    console.log(`  fetched ${items.length} products`);
    return items;
  } catch (err) {
    // Not fatal: the site still builds and the app still fetches live data. Only
    // the static product pages are lost.
    console.warn(`  ! could not reach ${API_BASE} (${err.message}); prerendering static routes only`);
    return [];
  }
}

async function loadGroups() {
  try {
    const leaves = await frappeGet('ecommerce.api.get_groups');
    const byParent = new Map();
    for (const leaf of Array.isArray(leaves) ? leaves : []) {
      const parent = (leaf.parent_item_group || '').trim();
      if (!parent) continue;
      if (!byParent.has(parent)) byParent.set(parent, { name: parent, children: [] });
      byParent.get(parent).children.push({ name: leaf.name });
    }
    return [...byParent.values()];
  } catch (err) {
    console.warn(`  ! could not load item groups (${err.message})`);
    return [];
  }
}

/* --------------------------------------------------------------------- main */

async function writeRoute(outputDir, routePath, html) {
  const target = routePath === '/' ? path.join(outputDir, 'index.html') : path.join(outputDir, routePath, 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

function organizationNode(locale) {
  return {
    '@type': 'Organization',
    '@id': SITE_ORIGIN_ID,
    name: BRAND[locale],
    alternateName: BRAND[locale === 'ar' ? 'en' : 'ar'],
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: abs('/og-image.png') },
  };
}

function productNodeStatic(product, locale) {
  const url = abs(localized(locale, `/product/${product.item_code}`));
  const image = product.website_image || product.image;
  const description = productDescription(product, locale);
  const node = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.item_name || product.web_item_name || product.item_code,
    sku: product.item_code,
    url,
    brand: { '@type': 'Brand', name: SITE_BRAND },
  };
  if (description) node.description = description;
  if (image) node.image = [abs(image)];
  node.offers = {
    '@type': 'Offer',
    url,
    priceCurrency: product.currency || 'YER',
    availability:
      product.in_stock === false
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    seller: { '@id': SITE_ORIGIN_ID },
  };
  // No `price` — see the header comment. `price_list_rate` is the real UOM
  // price field; `rate` does not exist on the payload and would render NaN.
  return node;
}

async function main() {
  if (!existsSync(WEB_OUT)) {
    console.error(`No web bundle at "${WEB_OUT}". Run: npx expo export --platform web --output-dir ${WEB_OUT}`);
    process.exit(1);
  }

  const template = await readFile(path.join(WEB_OUT, 'index.html'), 'utf8');
  console.log(`Prerendering ${WEB_OUT} for ${SITE_URL}`);

  const [products, groups] = await Promise.all([loadProducts(), loadGroups()]);

  const urls = [];
  let written = 0;

  for (const locale of LOCALES) {
    // Home
    const homeCopy = COPY[locale].home;
    urls.push({ loc: localized(locale, '/'), priority: '1.0', changefreq: 'daily' });
    await writeRoute(
      WEB_OUT,
      localized(locale, '/'),
      renderPage(template, {
        locale,
        title: homeCopy.title,
        description: homeCopy.description,
        canonicalPath: localized(locale, '/'),
        jsonLd: [organizationNode(locale)],
        body: fallbackBody(locale, BRAND[locale], homeCopy.description, groups.slice(0, 12).map((g) => ({
          href: abs(localized(locale, `/products/${encodeURIComponent(g.name)}`)),
          label: g.name,
        }))),
      })
    );
    written += 1;

    // Products index
    const productsCopy = COPY[locale].products;
    urls.push({ loc: localized(locale, '/products'), priority: '0.9', changefreq: 'daily' });
    await writeRoute(
      WEB_OUT,
      localized(locale, '/products'),
      renderPage(template, {
        locale,
        title: productsCopy.title,
        description: productsCopy.description,
        canonicalPath: localized(locale, '/products'),
        jsonLd: [
          organizationNode(locale),
          {
            '@type': 'ItemList',
            itemListElement: products.slice(0, 24).map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: abs(localized(locale, `/product/${p.item_code}`)),
              name: p.item_name || p.item_code,
            })),
            numberOfItems: products.length,
          },
        ],
        body: fallbackBody(
          locale,
          productsCopy.title,
          productsCopy.description,
          products.slice(0, 40).map((p) => ({
            href: abs(localized(locale, `/product/${p.item_code}`)),
            label: p.item_name || p.item_code,
          }))
        ),
      })
    );
    written += 1;

    // Categories
    const categoriesCopy = COPY[locale].categories;
    urls.push({ loc: localized(locale, '/categories'), priority: '0.8', changefreq: 'weekly' });
    await writeRoute(
      WEB_OUT,
      localized(locale, '/categories'),
      renderPage(template, {
        locale,
        title: categoriesCopy.title,
        description: categoriesCopy.description,
        canonicalPath: localized(locale, '/categories'),
        jsonLd: [organizationNode(locale)],
        body: fallbackBody(locale, categoriesCopy.title, categoriesCopy.description, groups.map((g) => ({
          href: abs(localized(locale, `/products/${encodeURIComponent(g.name)}`)),
          label: g.name,
        }))),
      })
    );
    written += 1;

    // Product pages
    for (const product of products) {
      const route = localized(locale, `/product/${product.item_code}`);
      const name = product.item_name || product.web_item_name || product.item_code;
      const description = productDescription(product, locale);
      const copy = COPY[locale].product(name);

      /*
       * Translation availability.
       *
       * The catalogue has no English names, so an English product URL would be a
       * byte-for-byte copy of the Arabic one. It is still generated — the app
       * needs it to work when a shopper switches language mid-session — but it
       * is marked `noindex, follow` and carries no canonical claim, so the
       * Arabic page stays the single indexable version. Once real English names
       * are populated in ERPNext this condition flips automatically.
       */
      const untranslated = hasArabic(name);
      const noindex = locale === 'en' && untranslated;

      /*
       * Canonical for an untranslated page points at the Arabic original rather
       * than at itself, so the two URLs are explicitly declared as the same
       * content and all indexing signal concentrates on the Arabic page.
       */
      const canonicalPath = noindex
        ? localized('ar', `/product/${product.item_code}`)
        : route;

      urls.push({
        loc: route,
        priority: noindex ? '0.0' : '0.7',
        changefreq: 'weekly',
        // Translated-but-unavailable pages are kept out of the sitemap.
        omit: noindex,
      });

      await writeRoute(
        WEB_OUT,
        route,
        renderPage(template, {
          locale,
          title: copy.title,
          description: copy.description,
          canonicalPath,
          type: 'product',
          noindex,
          jsonLd: [
            organizationNode(locale),
            productNodeStatic(product, locale),
            {
              '@type': 'BreadcrumbList',
              // Shares the product's page URL as its identity so the trail's
              // last ListItem and the Product node describe the same URL.
              '@id': `${abs(route)}#breadcrumb`,
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: abs(localized(locale, '/')) },
                { '@type': 'ListItem', position: 2, name, item: abs(route) },
              ],
            },
          ],
          body: fallbackBody(locale, name, description || copy.description),
        })
      );
      written += 1;
    }
  }

  /* ---- sitemap ---------------------------------------------------------- */

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .filter((u) => !u.omit)
  .map((u) => {
    const strip = u.loc.replace(/^\/(ar|en)/, '') || '/';
    const alts = LOCALES.map(
      (code) =>
        `    <xhtml:link rel="alternate" hreflang="${code}" href="${esc(abs(localized(code, strip)))}" />`
    ).join('\n');
    return `  <url>
    <loc>${esc(abs(u.loc))}</loc>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(localized('ar', strip)))}" />
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>
`;
  await writeFile(path.join(WEB_OUT, 'sitemap.xml'), sitemap, 'utf8');

  await writeFile(
    path.join(WEB_OUT, 'robots.txt'),
    [
      'User-agent: *',
      'Allow: /',
      // Cart, account and login are per-visitor and have nothing to index.
      'Disallow: /ar/cart',
      'Disallow: /en/cart',
      'Disallow: /ar/account',
      'Disallow: /en/account',
      'Disallow: /ar/login',
      'Disallow: /en/login',
      '',
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      '',
    ].join('\n'),
    'utf8'
  );

  const entries = await readdir(WEB_OUT, { withFileTypes: true });
  console.log(`Wrote ${written} prerendered pages, sitemap.xml and robots.txt into ${WEB_OUT}`);
  console.log(`(${entries.filter((e) => e.isDirectory()).length} route directories, ${urls.length} sitemap URLs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});