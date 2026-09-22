import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import CartAPI from '../api/cart';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState('ر.ي');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const data = await CartAPI.getCart();
      applyCartData(data);
    } catch (err) {
      console.warn('Could not fetch cart:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Live sync: refresh the cart when the app returns to the foreground and
  // poll quietly every 45s while it is open.
  useLiveRefresh(fetchCart, { intervalMs: 45000, isEnabled: true });

  function applyCartData(data) {
    if (!data) return;
    const cartItems = data.items || [];
    setItems(cartItems);
    setTotal(data.total || 0);
    if (data.currency) setCurrency(data.currency);
  }

  async function addToCart(itemCode, qty = 1, uom = null) {
    setActionLoading(true);
    try {
      const data = await CartAPI.addToCart(itemCode, qty, uom);
      applyCartData(data);
      return data;
    } finally {
      setActionLoading(false);
    }
  }

  async function updateQuantity(itemCode, qty, uom = null) {
    setActionLoading(true);
    try {
      const data = await CartAPI.updateCartLine(itemCode, qty, uom);
      applyCartData(data);
      return data;
    } finally {
      setActionLoading(false);
    }
  }

  async function updateUOM(itemCode, newUom, previousUom) {
    setActionLoading(true);
    try {
      // Find current quantity for this line
      const line = items.find(i => i.item_code === itemCode && (i.uom === previousUom || !previousUom));
      const qty = line ? line.qty : 1;
      const data = await CartAPI.updateCartLine(itemCode, qty, newUom, previousUom);
      applyCartData(data);
      return data;
    } finally {
      setActionLoading(false);
    }
  }

  async function removeItem(itemCode) {
    setActionLoading(true);
    try {
      const data = await CartAPI.removeFromCart(itemCode);
      applyCartData(data);
      return data;
    } finally {
      setActionLoading(false);
    }
  }

  const count = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        total,
        count,
        currency,
        loading,
        actionLoading,
        fetchCart,
        addToCart,
        updateQuantity,
        updateUOM,
        removeItem,
        clearCart: () => {
          setItems([]);
          setTotal(0);
        },
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
