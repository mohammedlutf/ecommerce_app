import { frappeCall } from './client';

export const WishlistAPI = {
  /**
   * Get all wishlist items for logged in user
   */
  getWishlistItems() {
    return frappeCall('webshop.my_api.api.wishlist_items', {}, 'GET');
  },

  /**
   * Toggle item in wishlist (add if missing, remove if present)
   */
  toggleWishlist(itemCode) {
    return frappeCall('webshop.my_api.api.wishlist', { item_code: itemCode }, 'POST');
  },
};

export default WishlistAPI;