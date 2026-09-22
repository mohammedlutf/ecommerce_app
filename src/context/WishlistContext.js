import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import WishlistAPI from '../api/wishlist';
import { useAuth } from './AuthContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await WishlistAPI.getWishlistItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load wishlist:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    } else {
      setItems([]);
    }
  }, [isAuthenticated, fetchWishlist]);

  // Keep the wishlist in sync when the app returns to the foreground.
  useLiveRefresh(fetchWishlist, { intervalMs: 0, isEnabled: isAuthenticated });

  function isWishlisted(itemCode) {
    if (!itemCode) return false;
    return items.some((item) => {
      const code = typeof item === 'string' ? item : (item.item_code || item.name);
      return code === itemCode;
    });
  }

  async function toggleWishlist(itemCode) {
    try {
      const res = await WishlistAPI.toggleWishlist(itemCode);
      // Refresh items list
      await fetchWishlist();
      return res;
    } catch (err) {
      throw err;
    }
  }

  return (
    <WishlistContext.Provider
      value={{
        items,
        count: items.length,
        loading,
        fetchWishlist,
        toggleWishlist,
        isWishlisted,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

export default WishlistContext;
