import { SITE, absoluteUrl } from './siteConfig';
import { pathWithLocale } from '../i18n/locales';

/**
 * Schema.org node builders.
 *
 * Each returns a node with a stable `@id`. The `@id`s are what let the graph
 * hang together: a product's `offer.seller` can point at the Organization node,
 * and the breadcrumb trail's last item can point at the very same Product node.
 * Emitting disconnected blobs instead produces rich results that Google silently
 * ignores.
 */

const ORGANIZATION_ID = `${SITE.origin}/#organization`;
const WEBSITE_ID = `${SITE.origin}/#website`;

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    alternateName: SITE.nameEn,
    url: SITE.origin,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/og-image.png'),
    },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE.origin,
    name: SITE.name,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'ar',
  };
}

/**
 * Product node for a single item.
 *
 * Deliberately omits `aggregateRating` and `review` unless real data is passed:
 * self-serving review markup on a page with no visible reviews is a manual
 * action risk, and the ratings are only included when the product genuinely
 * carries them.
 */
export function productNode(product, { locale = 'ar', url } = {}) {
  if (!product || !product.item_code) return null;

  const productUrl = absoluteUrl(url || pathWithLocale(locale, `/product/${product.item_code}`));
  const image = product.website_image || product.image;
  const offers = {
    '@type': 'Offer',
    url: productUrl,
    // Price availability is unknown until the cart API confirms stock, so the
    // offer is declared without a price rather than with a fabricated zero.
    availability: product.in_stock === false
      ? 'https://schema.org/OutOfStock'
      : 'https://schema.org/InStock',
    priceCurrency: product.currency || 'YER',
    seller: { '@id': ORGANIZATION_ID },
  };
  if (product.price !== undefined && product.price !== null && product.price !== '') {
    offers.price = String(product.price);
  }

  const node = {
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.item_name || product.web_item_name || product.item_code,
    sku: product.item_code,
    url: productUrl,
    // Real payload fields are `short_description` / `web_long_description`;
    // `description` is not present on the ecommerce response.
    description: stripHtml(
      product.short_description || product.web_long_description || product.description
    ),
    brand: { '@type': 'Brand', name: product.brand || SITE.name },
    offers,
  };

  if (image) node.image = [absoluteUrl(image)];
  if (Array.isArray(product.uoms) && product.uoms.length > 0) {
    // The ecommerce payload names the per-UOM price `price_list_rate`; `rate`
    // does not exist, and reading it would emit `price: "undefined"`.
    node.hasVariant = product.uoms
      .filter((uom) => uom.price_list_rate !== undefined && uom.price_list_rate !== null)
      .map((uom) => ({
        '@type': 'Product',
        name: uom.uom,
        sku: `${product.item_code}-${uom.uom}`,
        offers: {
          '@type': 'Offer',
          price: String(uom.price_list_rate),
          priceCurrency: uom.currency || product.currency || 'YER',
          availability: offers.availability,
        },
      }));
    if (node.hasVariant.length === 0) delete node.hasVariant;
  }

  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  if (reviews.length > 0) {
    node.review = reviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(review.rating || 0),
        bestRating: '5',
        worstRating: '1',
      },
      author: { '@type': 'Person', name: review.user || 'Customer' },
      reviewBody: review.comment || '',
      datePublished: review.published_on || review.creation || undefined,
    }));

    const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: String(reviews.length),
      bestRating: '5',
      worstRating: '1',
    };
  }

  return node;
}

/**
 * Breadcrumb trail.
 *
 * `items` are `{ name, path }` in order, root first, excluding the current page.
 */
export function breadcrumbNode(items, locale = 'ar') {
  const list = [{ name: 'Home', path: '/' }, ...(items || [])];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(pathWithLocale(locale, list[list.length - 1].path))}#breadcrumb`,
    itemListElement: list.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(pathWithLocale(locale, crumb.path)),
    })),
  };
}

/** Item list, for category pages. */
export function itemListNode(products, { locale = 'ar', path = '/products' } = {}) {
  return {
    '@type': 'ItemList',
    itemListElement: (products || []).slice(0, 24).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(pathWithLocale(locale, `/product/${product.item_code}`)),
      name: product.item_name || product.item_code,
    })),
    numberOfItems: (products || []).length,
  };
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}