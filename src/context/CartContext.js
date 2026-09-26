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
import { useAuth } from './AuthContext';
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

function resolveLineBaseRate(line) {
  const uoms = line.uoms || [];
  if (line.stock_uom) {
    const stock = uoms.find((u) => (u && (u.uom || u)) === line.stock_uom);
    const stockRate = stock ? parseFloat(stock.rate) : NaN;
    if (!Number.isNaN(stockRate)) return stockRate;
    if (line.uom === line.stock_uom) return parseFloat(line.rate) || 0;
  }
  return parseFloat(line.rate) || 0;
}

function optimisticUom(current = [], { itemCode, newUom, previousUom }) {
  return current.map((line) => {
    if (
      line.item_code === itemCode &&
      (line.uom === previousUom || (!previousUom && line.uom === newUom))
    ) {
      const next = { ...line, uom: newUom };
      const baseRate = resolveLineBaseRate(line);
      const productLike = {
        rate: baseRate,
        price: baseRate,
        stock_uom: line.stock_uom || line.uom,
        uoms: line.uoms || [],
      };
      next.rate = rateForUom(productLike, newUom);
      next.amount = (parseFloat(next.rate) || 0) * (parseFloat(line.qty) || 0);
      return next;
    }
    return line;
  });
}

function optimisticRemove(current = [], { itemCode, uom }) {
  // The same item_code can exist as multiple cart lines under different UOMs,
  // so removal must target the exact line (item_code + uom), never all of them.
  return current.filter(
    (line) =>
      !(line.item_code === itemCode && (line.uom === uom || (!uom && !line.uom)))
  );
}

function computeTotal(items) {
  return items.reduce(
    (sum, line) => sum + (parseFloat(line.rate) || 0) * (parseFloat(line.qty) || 0),
    0
  );
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  // Identity of the signed-in customer. Every cart read is scoped to this, so
  // logging out and back in as somebody else must never reuse the previous
  // user's cart (the server derives the cart from the session, but our local
  // state would otherwise keep showing the old lines).
  const userKey = user?.email || null;

  const [items, setItems] = useState([]);
  const [currency, setCurrency] = useState('ر.ي');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Version counter: any mutation bumps it. A fetch that started before a
  // mutation must NOT overwrite the newer (optimistic) state when it lands.
  const mutationVersion = useRef(0);

  // The identity a fetch was started for. Any response that lands after the
  // user changed belongs to the old session and must be dropped, otherwise
  // user B briefly (or permanently) sees user A's cart.
  const fetchUserRef = useRef(userKey);

  const fetchCart = useCallback(async (silent = false) => {
    const requestedUser = fetchUserRef.current;
    if (!requestedUser) return; // no session → nothing to fetch
    if (!silent) setLoading(true);
    const startedVersion = mutationVersion.current;
    try {
      const data = await CartAPI.getCart();
      // Stale response: a mutation landed, or the user changed mid-flight.
      if (startedVersion !== mutationVersion.current) return;
      if (requestedUser !== fetchUserRef.current) return;
      if (data && Array.isArray(data.items)) {
        setItems(data.items);
        if (data.currency) setCurrency(data.currency);
      }
    } catch (err) {
      console.warn('Could not fetch cart:', err.message);
    } finally {
      if (!silent && requestedUser === fetchUserRef.current) setLoading(false);
    }
  }, []);

  // Identity change (login as another user, or logout): invalidate every
  // in-flight response, wipe the previous user's lines immediately, then load
  // the new session's cart. Doing it in this order is what stops the old data
  // from flashing or persisting.
  useEffect(() => {
    fetchUserRef.current = userKey;
    ++mutationVersion.current;
    setItems([]);
    setCurrency('ر.ي');
    setActionLoading(false);
    if (userKey) fetchCart();
  }, [userKey, fetchCart]);

  // Foreground sync: re-fetch the cart once when the app returns to the
  // foreground. No background polling — data loads on mount and on explicit
  // user actions only.
  useLiveRefresh(() => fetchCart(true), { intervalMs: 0, isEnabled: !!userKey });

  // Apply a locally-computed next cart immediately (optimistic UI). Updates are
  // always functional (`setItems(prev => ...)`) so rapid taps build on the
  // latest state instead of stale closures.
  function applyOptimistic(updateFn, payload) {
    setItems((cur) => updateFn(cur, payload));
  }

  // Reconcile after an API mutation. A mutation response can arrive before the
  // server's quote document is fully recomputed, so we NEVER replace the local
  // (optimistically applied) cart from a mutation response — doing so made items
  // visually "snap back", forced double taps, and resurrected deleted lines.
  // The local cart is the source of truth during a session; it is reconciled
  // with the server on initial mount / foreground refresh instead.
  function reconcile(data, startedVersion) {
    if (startedVersion !== mutationVersion.current) return;
    if (data && data.currency) setCurrency(data.currency);
  }

  // Apply a mutation optimistically to the local cart instantly, then run the
  // network request concurrently in the background. If it fails, the exact
  // pre-mutation snapshot is restored — no extra network round-trip required.
  async function runMutation(updateFn, payload, apiFn) {
    setActionLoading(true);
    const snapshot = items;
    const version = ++mutationVersion.current;
    applyOptimistic(updateFn, payload);
    try {
      await apiFn();
      return;
    } catch (err) {
      // Only roll back if no newer mutation built on top of ours.
      if (mutationVersion.current === version) {
        setItems(snapshot);
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  function addToCart(itemCode, qty = 1, uom = null, product = null) {
    return runMutation(
      optimisticAdd,
      { itemCode, qty, uom, product },
      () => CartAPI.addToCart(itemCode, qty, uom)
    );
  }

  function updateQuantity(itemCode, qty, uom = null) {
    return runMutation(
      optimisticQuantity,
      { itemCode, qty, uom },
      () => CartAPI.updateCartLine(itemCode, qty, uom)
    );
  }

  function updateUOM(itemCode, newUom, previousUom) {
    const line = items.find(
      (i) => i.item_code === itemCode && (i.uom === previousUom || !previousUom)
    );
    const qty = line ? line.qty : 1;
    return runMutation(
      optimisticUom,
      { itemCode, newUom, previousUom },
      () => CartAPI.updateCartLine(itemCode, qty, newUom, previousUom)
    );
  }

  function removeItem(itemCode, uom = null) {
    return runMutation(
      optimisticRemove,
      { itemCode, uom },
      () => CartAPI.removeFromCart(itemCode, uom)
    );
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