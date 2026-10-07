import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AdminAPI from '../api/admin';
import AdminItemModal from '../components/admin/AdminItemModal';
import { useAuth } from './AuthContext';

const AdminContext = createContext(null);

/**
 * Answers one question for the whole app: may this session edit the catalogue?
 *
 * Kept as a context rather than fetched per screen so the answer is requested
 * once per session instead of once per ProductCard render. It is re-checked
 * whenever the signed-in user changes, so signing out and back in as somebody
 * else cannot inherit the previous answer — that stale flag is what would leave
 * admin controls visible to a customer.
 *
 * The editor sheet is hosted here, the same way ToastProvider hosts toasts. Any
 * ProductCard can then open it with `openEditor(itemCode)` without every list
 * screen carrying its own modal instance and its own copy of the "which product
 * am I editing" state.
 */
export function AdminProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [savedTick, setSavedTick] = useState(0);

  const userKey = (user && user.email) || null;

  useEffect(() => {
    let cancelled = false;

    // Reset first: until the new answer arrives, the honest state is "not an
    // admin", not "whatever the previous user was allowed to do".
    setIsAdmin(false);
    setChecked(false);
    // Close any open editor on sign-out. Leaving it mounted would show one
    // user's catalogue editor to whoever signs in next.
    setEditingItem(null);

    if (!userKey) {
      setChecked(true);
      return undefined;
    }

    AdminAPI.isAdmin().then((allowed) => {
      if (!cancelled) {
        setIsAdmin(allowed);
        setChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const refresh = useCallback(async () => {
    const allowed = await AdminAPI.isAdmin();
    setIsAdmin(allowed);
    setChecked(true);
    return allowed;
  }, []);

  const openEditor = useCallback(
    (itemCode) => {
      // Guarded even though every caller is already admin-gated: this is the
      // boundary where a shopper-facing screen hands over a product code. The
      // backend would reject it anyway; better not to open a sheet at all.
      if (!isAdmin || !itemCode) return;
      setEditingItem(itemCode);
    },
    [isAdmin]
  );

  const closeEditor = useCallback(() => setEditingItem(null), []);

  const handleSaved = useCallback((result) => {
    // A counter rather than a broadcast: list screens already know how to reload,
    // and this keeps each of them from reimplementing a subscription.
    setSavedTick((n) => n + 1);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, checked, refresh, openEditor, savedTick }}>
      {children}
      <AdminItemModal
        visible={!!editingItem}
        itemCode={editingItem}
        onClose={closeEditor}
        onSaved={handleSaved}
      />
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  // Defaulting rather than throwing: ProductCard renders inside trees that may
  // not be wrapped, and a missing provider should hide admin controls, not take
  // down the catalogue.
  return (
    context || {
      isAdmin: false,
      checked: false,
      refresh: async () => false,
      openEditor: () => {},
      savedTick: 0,
    }
  );
}

export default AdminContext;
