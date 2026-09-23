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

  // Foreground sync: re-fetch the cart once when the app returns to the
  // foreground. No background polling — data loads on mount and on explicit
  // user actions only.
  useLiveRefresh(() => fetchCart(true), { intervalMs: 0, isEnabled: true });

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

  // Apply a mutation optimistically to the local cart instantly, then reconcile
  // with the server response when it lands. If the request fails, the exact
  // pre-mutation snapshot is restored — no extra network round-trip required.
  async function runMutation(updateFn, payload, apiFn) {
    setActionLoading(true);
    const snapshot = items;
    const version = ++mutationVersion.current;
    applyOptimistic(updateFn, payload);
    try {
      const data = await apiFn();
      reconcile(data, version);
      return data;
    } catch (err) {
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

  function removeItem(itemCode) {
    return runMutation(
      optimisticRemove,
      itemCode,
      () => CartAPI.removeFromCart(itemCode)
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