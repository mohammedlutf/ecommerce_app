import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import CartAPI from '../api/cart';
import { rateForUom } from '../utils/catalog';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const CartContext = createContext(null);

function buildLine(product, itemCode, uom, qty) {
  const rate = rateForUom(product, uom);
  return {
    item_code: itemCode,
    item_name: (product && (product.item_name || product.web_item_name)) || itemCode,
    uom: uom || (product && product.stock_uom) || 'حبة',
    uoms: (product && product.uoms) || [],
    rate,
    qty: parseFloat(qty) || 1,
    amount: rate * (parseFloat(qty) || 1),
    image: (product && (product.website_image || product.image)) || '',
    stock_uom: (product && product.stock_uom) || uom,
  };
}

function optimisticAdd(current = [], { itemCode, qty, uom, product }) {
  const q = parseFloat(qty) || 1;
  const existingIdx = current.findIndex(
    (i) => i.item_code === itemCode && (i.uom === uom || (!uom && !i.uom))
  );
  if (existingIdx >= 0) {
    const next = current.slice();
    const line = { ...next[existingIdx] };
    const newQty = (parseFloat(line.qty) || 0) + q;
    line.qty = newQty;
    line.amount = (parseFloat(line.rate) || 0) * newQty;
    next[existingIdx] = line;
    return next;
  }
  return [...current, buildLine(product, itemCode, uom, q)];
}

function optimisticQuantity(current = [], { itemCode, qty, uom }) {
  const q = parseFloat(qty) || 0;
  return current.map((line) => {
    if (line.item_code === itemCode && (line.uom === uom || (!uom && !line.uom))) {
      const next = { ...line, qty: q };
      next.amount = (parseFloat(line.rate) || 0) * q;
      return next;
    }
    return line;
  });
}

function optimisticUom(current = [], { itemCode, newUom, previousUom }) {
  return current.map((line) => {
    if (
      line.item_code === itemCode &&
      (line.uom === previousUom || (!previousUom && line.uom === newUom))
    ) {
      const next = { ...line, uom: newUom };
      const found = (line.uoms || []).find((u) => (u.uom || u) === newUom);
      if (found && typeof found.rate !== 'undefined' && found.rate) {
        next.rate = parseFloat(found.rate);
      }
      next.amount = (parseFloat(next.rate) || 0) * (parseFloat(line.qty) || 0);
      return next;
    }
    return line;
  });
}

function optimisticRemove(current = [], itemCode) {
  return current.filter((line) => line.item_code !== itemCode);
}

function computeTotal(items) {
  return items.reduce(
    (sum, line) => sum + (parseFloat(line.rate) || 0) * (parseFloat(line.qty) || 0),
    0
  );
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [currency, setCurrency] = useState('ر.ي');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Version counter: any mutation bumps it. A fetch that started before a
  // mutation must NOT overwrite the newer (optimistic) state when it lands.
  const mutationVersion = useRef(0);

  const fetchCart = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const startedVersion = mutationVersion.current;
    try {
      const data = await CartAPI.getCart();
      if (startedVersion !== mutationVersion.current) return; // stale response
      if (data && Array.isArray(data.items)) {
        setItems(data.items);
        if (data.currency) setCurrency(data.currency);
      }
    } catch (err) {
      console.warn('Could not fetch cart:', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Background sync: re-fetch when the app returns to the foreground and poll
  // quietly every 20s (never flashes the spinner, never clobbers a mutation).
  useLiveRefresh(() => fetchCart(true), { intervalMs: 20000, isEnabled: true });

  // Apply a locally-computed next cart immediately (optimistic UI), then let
  // the server round-trip reconcile with the authoritative payload.
  function applyOptimistic(updateFn, payload) {
    setItems((cur) => updateFn(cur, payload));
  }

  // Reconcile after an API mutation: apply a full cart payload when the server
  // returns one and no newer mutation happened in the meantime.
  function reconcile(data, startedVersion) {
    if (!data || !Array.isArray(data.items)) return;
    if (startedVersion !== mutationVersion.current) return;
    setItems(data.items);
    if (data.currency) setCurrency(data.currency);
  }

  async function addToCart(itemCode, qty = 1, uom = null, product = null) {
    setActionLoading(true);
    const version = ++mutationVersion.current;
    applyOptimistic(optimisticAdd, { itemCode, qty, uom, product });
    try {
      const data = await CartAPI.addToCart(itemCode, qty, uom);
      reconcile(data, version);
      return data;
    } catch (err) {
      try {
        await fetchCart(true);
      } catch (e) {
        /* ignore */
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function updateQuantity(itemCode, qty, uom = null) {
    setActionLoading(true);
    const version = ++mutationVersion.current;
    applyOptimistic(optimisticQuantity, { itemCode, qty, uom });
    try {
      const data = await CartAPI.updateCartLine(itemCode, qty, uom);
      reconcile(data, version);
      return data;
    } catch (err) {
      try {
        await fetchCart(true);
      } catch (e) {
        /* ignore */
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function updateUOM(itemCode, newUom, previousUom) {
    setActionLoading(true);
    const version = ++mutationVersion.current;
    applyOptimistic(optimisticUom, { itemCode, newUom, previousUom });
    try {
      const line = items.find(
        (i) => i.item_code === itemCode && (i.uom === previousUom || !previousUom)
      );
      const qty = line ? line.qty : 1;
      const data = await CartAPI.updateCartLine(itemCode, qty, newUom, previousUom);
      reconcile(data, version);
      return data;
    } catch (err) {
      try {
        await fetchCart(true);
      } catch (e) {
        /* ignore */
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function removeItem(itemCode) {
    setActionLoading(true);
    const version = ++mutationVersion.current;
    applyOptimistic(optimisticRemove, itemCode);
    try {
      const data = await CartAPI.removeFromCart(itemCode);
      reconcile(data, version);
      return data;
    } catch (err) {
      try {
        await fetchCart(true);
      } catch (e) {
        /* ignore */
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  const count = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const total = computeTotal(items);

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
          ++mutationVersion.current;
          setItems([]);
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