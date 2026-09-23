import { frappeCall, getImageUrl } from './client';

const GROUPS_CACHE_TTL = 5 * 60 * 1000;
const GROUPS_FAIL_TTL = 30 * 1000;
let groupsCache = null;
let groupsCacheAt = 0;

export const CatalogAPI = {
  /**
   * Fetch product catalog with categories
   * @param {Object} params
   * @param {string} [params.item_group]
   * @param {string} [params.search]
   * @param {number} [params.limit]
   */
  async getCatalog({ itemGroup = null, search = null, limit = 20, offset = 0 } = {}) {
    const args = { limit };
    if (offset > 0) args.offset = offset;
    if (itemGroup && itemGroup !== 'all') args.item_group = itemGroup;
    if (search) args.search = search;
    return frappeCall('ecommerce.api.catalog', args, 'GET');
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
    return frappeCall('ecommerce.api.item', args, 'GET');
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
    return frappeCall('ecommerce.api.reviews', args, 'POST');
  },

  /**
   * Load the parent/child Item Group structure from the backend's whitelisted
   * `ecommerce.api.get_groups` (leaf groups only: is_group=0, show_in_website=1).
   *
   * Returns a normalized hierarchy:
   *   [{ name, image, children: [{ name, image }] }]
   *
   * Parent groups are derived by grouping the leaf rows on `parent_item_group`,
   * mirroring the website's `groupby('parent_item_group')` nav. Returns null on
   * failure so callers can fall back to the flat groups from the catalog call.
   */
  async getItemGroupHierarchy() {
    const elapsed = Date.now() - groupsCacheAt;
    if (groupsCache && elapsed < GROUPS_CACHE_TTL) return groupsCache;
    if (groupsCache === null && elapsed < GROUPS_FAIL_TTL) return null;

    try {
      const leaves = await frappeCall('ecommerce.api.get_groups', {}, 'GET');
      if (!Array.isArray(leaves) || leaves.length === 0) {
        groupsCache = null;
        groupsCacheAt = Date.now();
        return null;
      }

      const byParent = {};
      const parentsOrder = [];
      for (const leaf of leaves) {
        const parent = (leaf && leaf.parent_item_group || '').trim();
        if (!parent) continue;
        if (!byParent[parent]) {
          byParent[parent] = { name: parent, image: '', children: [] };
          parentsOrder.push(parent);
        }
        byParent[parent].children.push({
          name: leaf.name,
          image: leaf.image ? getImageUrl(leaf.image) : '',
        });
      }

      const result = parentsOrder.map((name) => byParent[name]);
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