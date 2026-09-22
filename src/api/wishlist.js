import { frappeCall } from './client';

export const WishlistAPI = {
  /**
   * Get all wishlist items for logged in user
   */
  async getWishlistItems() {
    try {
      return await frappeCall('ecommerce.api.wishlist_items', {}, 'GET');
    } catch {
      return await frappeCall('ecommerce.api.wishlist_items', {}, 'GET');
    }
  },

  /**
   * Toggle item in wishlist (add if missing, remove if present)
   */
  async toggleWishlist(itemCode) {
    try {
      return await frappeCall('ecommerce.api.wishlist', { item_code: itemCode }, 'POST');
    } catch {
      return await frappeCall('ecommerce.api.wishlist', { item_code: itemCode }, 'POST');
    }
  },
};

export default WishlistAPI;
