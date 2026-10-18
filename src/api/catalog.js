import { frappeCall, getImageUrl } from './client';

const GROUPS_CACHE_TTL = 5 * 60 * 1000;
const GROUPS_FAIL_TTL = 30 * 1000;
let groupsCache = null;
let groupsCacheAt = 0;

const SETTINGS_CACHE_TTL = 10 * 60 * 1000;
let settingsCache = null;
let settingsCacheAt = 0;

/**
 * Home-hero banners, as the screens want them.
 *
 * This layer is the only one that knows about transport, so the relative
 * `/files/...` path the server stores is turned into a full URI here — the same
 * deal the item-group images get — and screens never have to know what
 * `getImageUrl` is. A row without an image is dropped rather than rendered as an
 * empty slide, so the carousel can trust that every entry has something to draw.
 */
function normalizeHomepageAds(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.image)
    .map((row) => ({
      image: getImageUrl(row.image),
      title: row.title || '',
      itemGroup: row.item_group || '',
      itemCode: row.item_code || '',
      url: row.url || '',
    }));
}

export const CatalogAPI = {
  /**
   * Fetch product catalog with categories
   *
   * Browsing only: this deliberately has no `search` parameter. Group browsing
   * and searching are mutually exclusive, and sharing one request builder for
   * both is what allowed a group chip to silently narrow a search (or a live
   * search term to leak into the browsed group's page).
   *
   * @param {Object} params
   * @param {string} [params.itemGroup]
   * @param {number} [params.limit]
   * @param {number} [params.offset]
   */
  async getCatalog({ itemGroup = null, shop = null, limit = 20, offset = 0 } = {}) {
    const args = { limit };
    if (offset > 0) args.offset = offset;
    if (itemGroup && itemGroup !== 'all') args.item_group = itemGroup;
    if (shop) args.shop = shop;
    return frappeCall('webshop.my_api.api.catalog', args, 'GET');
  },

  /**
   * Search the whole catalog.
   *
   * `item_group` is never sent, by construction: a query spans every item
   * regardless of which group chip happens to be selected. There is no
   * `itemGroup` parameter to pass, so the scoping bug cannot come back.
   *
   * An empty term short-circuits instead of hitting the server, so a cleared
   * search field never fires a "match everything" query.
   */
  async searchItems({ search, shop = null, limit = 20, offset = 0 } = {}) {
    const term = String(search || '').trim();
    if (!term) return { items: [], groups: [] };

    const args = { search: term, limit };
    if (offset > 0) args.offset = offset;
    if (shop) args.shop = shop;
    return frappeCall('webshop.my_api.api.catalog', args, 'GET');
  },

  /**
   * Fetch single product details (UOMs, description, images, reviews)
   * @param {string} itemCode
   * @param {string} [route]
   */
  async getItem(itemCode, route = null) {
    const args = {};
    if (itemCode) args.item_code = itemCode;
    if (route) args.route = route;
    return frappeCall('webshop.my_api.api.item', args, 'GET');
  },

  /**
   * Submit item review
   */
  async addReview({ websiteItem, rating, reviewTitle, comment }) {
    const args = {
      website_item: websiteItem,
      rating: Math.max(1, Math.min(rating, 5)),
      review_title: reviewTitle || 'تقييم المنتج',
      comment: comment || '',
    };
    return frappeCall('webshop.my_api.api.reviews', args, 'POST');
  },

  /**
   * The storefront's public configuration, from `Webshop Settings` via the
   * whitelisted `webshop.my_api.api.webshop_settings`: the feature switches, the
   * merchant's home-hero banners and whether the home screen draws the shop rail.
   *
   * Cached because this is site-wide configuration that changes a handful of
   * times a year, while it is read on every product page. `force` exists for the
   * home screen's pull-to-refresh, where the shopper has explicitly asked for
   * fresh content and a ten-minute-old banner list — or a shops switch flipped a
   * minute ago — would look like a refresh that did nothing.
   *
   * Fails OPEN (both switches true, no banners, shops shown) when the endpoint is
   * unreachable. Hiding a section the merchant turned on is a worse mistake than
   * showing one they turned off, and a settings call that fails must not take
   * the whole product page down with it. No banners is the safe fallback for the
   * hero: the home screen then renders exactly what it rendered before the
   * advertising table existed.
   */
  async getWebshopSettings({ force = false } = {}) {
    const elapsed = Date.now() - settingsCacheAt;
    if (!force && settingsCache && elapsed < SETTINGS_CACHE_TTL) return settingsCache;

    try {
      const raw = await frappeCall('webshop.my_api.api.webshop_settings', {}, 'GET');
      settingsCache = {
        enableReviews: !!(raw && raw.enable_reviews),
        enableRecommendations: !!(raw && raw.enable_recommendations),
        // Only an explicit `false` from the server hides the rail. An older
        // server that does not send the key at all keeps the shopper's home
        // screen exactly as it was, shops and all.
        showShopsOnHome: !(raw && raw.show_shops_on_homescreen === false),
        homepageAds: normalizeHomepageAds(raw && raw.homepage_ads),
      };
    } catch (err) {
      console.warn('Could not load webshop settings:', err.message);
      settingsCache = {
        enableReviews: true,
        enableRecommendations: true,
        showShopsOnHome: true,
        homepageAds: [],
      };
    }
    settingsCacheAt = Date.now();
    return settingsCache;
  },

  /**
   * Load the two-level Item Group nav from `webshop.my_api.api.get_group_hierarchy`.
   *
   * The tree is built and ranked SERVER-side. It used to be assembled here from
   * the flat leaf list returned by `get_groups`, but that list holds only
   * `is_group = 0` rows, so a parent's own `website_ranking` was never in the
   * payload. No amount of sorting on this side could then honour it, and the
   * parent order silently stayed whatever order the leaves arrived in.
   *
   * Both levels arrive already ordered by `website_ranking desc`, so callers get
   * the merchant's order for the parent tabs and the child chips alike.
   *
   * Returns null on failure so callers can fall back to the flat groups from the
   * catalog call.
   */
  async getItemGroupHierarchy() {
    const elapsed = Date.now() - groupsCacheAt;
    if (groupsCache && elapsed < GROUPS_CACHE_TTL) return groupsCache;
    if (groupsCache === null && elapsed < GROUPS_FAIL_TTL) return null;

    try {
      const raw = await frappeCall('webshop.my_api.api.get_group_hierarchy', {}, 'GET');
      if (!Array.isArray(raw) || raw.length === 0) {
        groupsCache = null;
        groupsCacheAt = Date.now();
        return null;
      }

      // Only the image paths need resolving; `website_ranking` rides along
      // untouched so the ranking that produced this order stays inspectable.
      const result = raw.map((parent) => ({
        ...parent,
        image: parent.image ? getImageUrl(parent.image) : '',
        children: (parent.children || []).map((child) => ({
          ...child,
          image: child.image ? getImageUrl(child.image) : '',
        })),
      }));

      groupsCache = result;
      groupsCacheAt = Date.now();
      return result;
    } catch (err) {
      console.warn('Could not load item group hierarchy:', err.message);
      groupsCache = null;
      groupsCacheAt = Date.now();
      return null;
    }
  },
};

export default CatalogAPI;