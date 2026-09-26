import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import WishlistAPI from '../api/wishlist';
import { useAuth } from './AuthContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  // Scope the wishlist to the signed-in customer, not merely to "logged in".
  // Two different users are both logged in at different times, and the old
  // boolean dependency never fired when one replaced the other.
  const userKey = user?.email || null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // The identity each fetch was started for, so a response that arrives after a
  // user switch is discarded instead of overwriting the new user's list.
  const fetchUserRef = useRef(userKey);

  const fetchWishlist = useCallback(async () => {
    const requestedUser = fetchUserRef.current;
    if (!requestedUser) return;
    setLoading(true);
    try {
      const data = await WishlistAPI.getWishlistItems();
      if (requestedUser !== fetchUserRef.current) return;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load wishlist:', err.message);
    } finally {
      if (requestedUser === fetchUserRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRef.current = userKey;
    setItems([]);
    if (userKey) fetchWishlist();
  }, [userKey, fetchWishlist]);

  // Keep the wishlist in sync when the app returns to the foreground.
  useLiveRefresh(fetchWishlist, { intervalMs: 0, isEnabled: !!userKey });

  function isWishlisted(itemCode) {
    if (!itemCode) return false;
    return items.some((item) => {
      const code = typeof item === 'string' ? item : (item.item_code || item.name);
      return code === itemCode;
    });
  }

  async function toggleWishlist(itemCode) {
    if (!itemCode) return null;
    const item = {
      item_code: itemCode,
      name: itemCode,
      _optimistic: true,
    };
    const currently = isWishlisted(itemCode);

    // Optimistic: flip the heart instantly, reconcile with the server after.
    setItems((cur) =>
      currently
        ? cur.filter((item_) => {
            const code =
              typeof item_ === 'string' ? item_ : item_.item_code || item_.name;
            return code !== itemCode;
          })
        : [...cur, item]
    );

    try {
      const res = await WishlistAPI.toggleWishlist(itemCode);
      // Reconcile with the authoritative list (quietly).
      try {
        const data = await WishlistAPI.getWishlistItems();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        /* keep optimistic state */
      }
      return res;
    } catch (err) {
      // Revert optimistic change on failure.
      setItems((cur) =>
        currently
          ? [...cur, item]
          : cur.filter((item_) => {
              const code =
                typeof item_ === 'string' ? item_ : item_.item_code || item_.name;
              return code !== itemCode;
            })
      );
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
