import { frappeCall, getImageUrl } from './client';

const GROUPS_CACHE_TTL = 5 * 60 * 1000;
const GROUPS_FAIL_TTL = 30 * 1000;
let groupsCache = null;
let groupsCacheAt = 0;

const SETTINGS_CACHE_TTL = 10 * 60 * 1000;
let settingsCache = null;
let settingsCacheAt = 0;

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
  async getCatalog({ itemGroup = null, limit = 20, offset = 0 } = {}) {
    const args = { limit };
    if (offset > 0) args.offset = offset;
    if (itemGroup && itemGroup !== 'all') args.item_group = itemGroup;
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
  async searchItems({ search, limit = 20, offset = 0 } = {}) {
    const term = String(search || '').trim();
    if (!term) return { items: [], groups: [] };

    const args = { search: term, limit };
    if (offset > 0) args.offset = offset;
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
   * The storefront's feature switches, from `Webshop Settings` via the
   * whitelisted `webshop.my_api.api.webshop_settings`.
   *
   * Cached because this is site-wide configuration that changes a handful of
   * times a year, while it is read on every product page.
   *
   * Fails OPEN (both switches true) when the endpoint is unreachable. Hiding a
   * section the merchant turned on is a worse mistake than showing one they
   * turned off, and a settings call that fails must not take the whole product
   * page down with it.
   */
  async getWebshopSettings() {
    const elapsed = Date.now() - settingsCacheAt;
    if (settingsCache && elapsed < SETTINGS_CACHE_TTL) return settingsCache;

    try {
      const raw = await frappeCall('webshop.my_api.api.webshop_settings', {}, 'GET');
      settingsCache = {
        enableReviews: !!(raw && raw.enable_reviews),
        enableRecommendations: !!(raw && raw.enable_recommendations),
      };
    } catch (err) {
      console.warn('Could not load webshop settings:', err.message);
      settingsCache = { enableReviews: true, enableRecommendations: true };
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