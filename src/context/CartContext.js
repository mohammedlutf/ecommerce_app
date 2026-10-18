import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import CartAPI from '../api/cart';
import { rateForUom } from '../utils/catalog';
import {
  saveCartSnapshot,
  readCartSnapshot,
  clearCartSnapshot,
} from '../utils/cartRecovery';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const CartContext = createContext(null);

function buildLine(product, itemCode, uom, qty) {
  const rate = rateForUom(product, uom);
  // The shop a line belongs to, keyed the same way the server keys it: the
  // doctype name of the Marketplace Shop. `product.shop` is the public dict
  // from the catalogue (`{name, shop_name, ...}`); older payloads may carry
  // the bare name as a string. An unknown shop buckets as "" (the platform
  // catch-all) until the next server read fills the real value in.
  const productShop = product && product.shop;
  const shop =
    typeof productShop === 'string'
      ? productShop
      : (productShop && productShop.name) || '';
  return {
    item_code: itemCode,
    shop,
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
  // `{[shopName]: {shop_name, logo, is_platform}}` for every shop that has lines
  // in the cart. The lines themselves only carry the shop's name; the display
  // name and logo come from the server's `groups` (or, optimistically, from the
  // product the shopper just added).
  const [shopMeta, setShopMeta] = useState({});
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

  // Mirror of `items` so the identity-change effect can read the outgoing cart
  // without taking `items` as a dependency (which would re-run that effect on
  // every quantity change and refetch the cart in a loop).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // A recovery is attempted at most once per customer per login, so a
  // permanently failing restore can never be retried on every cart refresh.
  const recoveryAttemptedRef = useRef(new Set());

  // Held in a ref: the toast context object is recreated on every toast render,
  // and depending on it would make fetchCart unstable and refetch the cart
  // whenever a toast appeared.
  const toastApi = useToast();
  const toastRef = useRef(toastApi);
  toastRef.current = toastApi;

  /**
   * The server cart is bound to the session, so it does not survive a logout.
   * When the server comes back empty for a customer who has just signed in,
   * re-push the snapshot taken when they left so the server rebuilds it.
   * Returns true when at least one line made it back.
   */
  const rebuildFromSnapshot = useCallback(async (targetUser) => {
    if (!targetUser) return false;
    if (recoveryAttemptedRef.current.has(targetUser)) return false;
    recoveryAttemptedRef.current.add(targetUser);

    const snapshot = await readCartSnapshot(targetUser);
    if (!snapshot) return false;

    let pushed = 0;
    for (const line of snapshot.lines) {
      try {
        await CartAPI.addToCart(line.item_code, line.qty, line.uom);
        pushed += 1;
      } catch (err) {
        // A single item that is no longer sellable must not abandon the rest.
        console.warn('cartRecovery: could not restore', line.item_code, err?.message);
      }
    }

    if (!pushed) return false;

    // Only drop the snapshot once something actually landed, so a failed run
    // can still be retried on the next login.
    await clearCartSnapshot(targetUser);
    return true;
  }, []);

  const fetchCart = useCallback(
    async (silent = false) => {
      const requestedUser = fetchUserRef.current;
      if (!requestedUser) return; // no session → nothing to fetch
      if (!silent) setLoading(true);
      const startedVersion = mutationVersion.current;

      // Stale response: a mutation landed, or the user changed mid-flight.
      const stillRelevant = () =>
        startedVersion === mutationVersion.current && requestedUser === fetchUserRef.current;

      try {
        let data = await CartAPI.getCart();
        if (!stillRelevant()) return;

        if (data && Array.isArray(data.items)) {
          if (data.items.length === 0) {
            const rebuilt = await rebuildFromSnapshot(requestedUser);
            if (rebuilt && stillRelevant()) {
              // Re-read so the server re-prices the rebuilt cart instead of us
              // inventing rates locally.
              data = await CartAPI.getCart();
              if (!stillRelevant()) return;
              toastRef.current?.info('رجعنا سلة التسوق السابقة إلى جهازك', 3600);
            }
          } else if (data.items.length > 0) {
            // The server has the real cart, so any snapshot is obsolete.
            clearCartSnapshot(requestedUser);
          }
        }

        if (data && Array.isArray(data.items)) {
          setItems(data.items);
          if (data.currency) setCurrency(data.currency);
          // The server's per-shop grouping carries the display names and logos
          // that the cart lines themselves do not. Keeping them here is what
          // lets the cart render per-vendor sections (and the checkout quote
          // per-vendor delivery) without a second request per line.
          if (Array.isArray(data.groups)) {
            const meta = {};
            data.groups.forEach((row) => {
              if (row && row.shop) {
                meta[row.shop] = {
                  shop_name: row.shop_name || '',
                  logo: row.logo || '',
                  is_platform: !!row.is_platform,
                };
              }
            });
            setShopMeta(meta);
          }
        }
      } catch (err) {
        console.warn('Could not fetch cart:', err.message);
      } finally {
        if (!silent && requestedUser === fetchUserRef.current) setLoading(false);
      }
    },
    [rebuildFromSnapshot]
  );

  // Identity change (login as another user, or logout): invalidate every
  // in-flight response, wipe the previous user's lines immediately, then load
  // the new session's cart. Doing it in this order is what stops the old data
  // from flashing or persisting.
  useEffect(() => {
    const previousUser = fetchUserRef.current;

    // Snapshot the outgoing cart before it is wiped. The server copy will not
    // outlive the session, so this is what makes the next login feel continuous.
    if (previousUser && !userKey && itemsRef.current.length) {
      saveCartSnapshot(previousUser, itemsRef.current);
    }
    // Allow one recovery attempt per login, not per app launch.
    if (previousUser && !userKey) {
      recoveryAttemptedRef.current.delete(previousUser);
    }

    fetchUserRef.current = userKey;
    ++mutationVersion.current;
    setItems([]);
    setShopMeta({});
    setCurrency('ر.ي');
    setActionLoading(false);
    if (userKey) fetchCart();
  }, [userKey, fetchCart]);

  // Foreground sync: re-fetch the cart once when the app returns to the
  // foreground. No background polling — data loads on mount and on explicit
  // user actions only.
  useLiveRefresh(() => fetchCart(true), { intervalMs: 0, isEnabled: !!userKey });

  // Apply a mutation optimistically to the local cart instantly, then run the
  // network request concurrently in the background. If it fails, the exact
  // pre-mutation snapshot is restored — no extra network round-trip required.
  //
  // Stable across renders (mutable reads go through refs) so the action
  // functions can be memoized: a consumer that only calls `addToCart` then does
  // not re-render just because the provider re-rendered for another reason.
  const runMutation = useCallback(async (updateFn, payload, apiFn) => {
    setActionLoading(true);
    const snapshot = itemsRef.current;
    const version = ++mutationVersion.current;
    // Functional update so rapid taps build on the latest state, not a stale
    // closure captured when the callback was created.
    setItems((cur) => updateFn(cur, payload));
    try {
      await apiFn();
    } catch (err) {
      // Only roll back if no newer mutation built on top of ours.
      if (mutationVersion.current === version) {
        setItems(snapshot);
      }
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const addToCart = useCallback(
    (itemCode, qty = 1, uom = null, product = null) => {
      // Optimistically record the shop's display details straight from the
      // product the shopper tapped, so a multi-shop cart already has names and
      // logos on its very first render — the authoritative copy lands on the
      // next server fetch.
      const productShop = product && product.shop;
      if (productShop && typeof productShop === 'object' && productShop.name) {
        setShopMeta((cur) =>
          cur[productShop.name]
            ? cur
            : {
                ...cur,
                [productShop.name]: {
                  shop_name: productShop.shop_name || '',
                  logo: productShop.logo || '',
                  is_platform: !!productShop.is_platform,
                },
              }
        );
      }
      return runMutation(
        optimisticAdd,
        { itemCode, qty, uom, product },
        () => CartAPI.addToCart(itemCode, qty, uom)
      );
    },
    [runMutation]
  );

  const updateQuantity = useCallback(
    (itemCode, qty, uom = null) =>
      runMutation(
        optimisticQuantity,
        { itemCode, qty, uom },
        () => CartAPI.updateCartLine(itemCode, qty, uom)
      ),
    [runMutation]
  );

  const updateUOM = useCallback(
    (itemCode, newUom, previousUom) => {
      const line = itemsRef.current.find(
        (i) => i.item_code === itemCode && (i.uom === previousUom || !previousUom)
      );
      const qty = line ? line.qty : 1;
      return runMutation(
        optimisticUom,
        { itemCode, newUom, previousUom },
        () => CartAPI.updateCartLine(itemCode, qty, newUom, previousUom)
      );
    },
    [runMutation]
  );

  const removeItem = useCallback(
    (itemCode, uom = null) =>
      runMutation(
        optimisticRemove,
        { itemCode, uom },
        () => CartAPI.removeFromCart(itemCode, uom)
      ),
    [runMutation]
  );

  const clearCart = useCallback(() => {
    ++mutationVersion.current;
    setItems([]);
  }, []);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0),
    [items]
  );
  const total = useMemo(() => computeTotal(items), [items]);

  // The cart bucketed by shop, shaped exactly like the server's `groups` rows
  // (`{shop, shop_name, logo, is_platform, items, count, subtotal}`) so the
  // cart screen renders one shape whether the grouping is optimistic (just
  // after adding) or authoritative (after a fetch). Ordering mirrors the
  // server too: named shops first, alphabetically; the unnamed catch-all
  // bucket last.
  const groups = useMemo(() => {
    const buckets = new Map();
    items.forEach((line) => {
      const key = typeof line.shop === 'string' ? line.shop : '';
      const bucket = buckets.get(key);
      if (bucket) bucket.push(line);
      else buckets.set(key, [line]);
    });

    const rows = Array.from(buckets.entries()).map(([shop, lines]) => {
      const meta = shopMeta[shop] || {};
      return {
        shop,
        shop_name: meta.shop_name || '',
        logo: meta.logo || '',
        is_platform: !!meta.is_platform,
        items: lines,
        count: lines.reduce((sum, line) => sum + (parseFloat(line.qty) || 0), 0),
        subtotal: lines.reduce(
          (sum, line) => sum + (parseFloat(line.rate) || 0) * (parseFloat(line.qty) || 0),
          0
        ),
      };
    });

    rows.sort((a, b) => {
      if (!a.shop && !b.shop) return 0;
      if (!a.shop) return 1; // catch-all bucket last
      if (!b.shop) return -1;
      return (a.shop_name || a.shop).localeCompare(b.shop_name || b.shop);
    });
    return rows;
  }, [items, shopMeta]);

  // Memoised so consumers re-render only when something they can read actually
  // changed, not on every state update anywhere in the provider.
  const value = useMemo(
    () => ({
      items,
      groups,
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
      clearCart,
    }),
    [
      items,
      groups,
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
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;