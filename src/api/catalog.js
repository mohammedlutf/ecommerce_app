import { frappeCall } from './client';

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

    try {
      return await frappeCall('ecommerce.api.catalog', args, 'GET');
    } catch {
      // Fallback method name
      return await frappeCall('ecommerce.api.catalog', args, 'GET');
    }
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

    try {
      return await frappeCall('ecommerce.api.item', args, 'GET');
    } catch {
      return await frappeCall('ecommerce.api.item', args, 'GET');
    }
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
    try {
      return await frappeCall('ecommerce.api.reviews', args, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.reviews', args, 'POST');
    }
  },
};

export default CatalogAPI;
