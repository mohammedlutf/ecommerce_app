import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import VendorAPI from '../api/vendor';
import { useAuth } from './AuthContext';

const VendorContext = createContext(null);

const EMPTY_STATE = {
  is_vendor: false,
  status: null,
  shop: null,
  application: null,
};

/**
 * Answers one question for the whole app: what is the signed-in account on the
 * marketplace — shopper, applicant under review, approved vendor, or suspended?
 *
 * The backend answers all four in a single `vendor_state` round trip, so it is
 * fetched once per session here rather than once per screen. It is re-checked
 * whenever the signed-in user changes: signing out and back in as somebody else
 * must not inherit the previous account's shop, which is exactly the stale flag
 * that would hand one vendor another's dashboard.
 */
export function VendorProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(EMPTY_STATE);
  const [checked, setChecked] = useState(false);

  const userKey = (user && user.email) || null;

  useEffect(() => {
    let cancelled = false;

    // Reset first: until the new answer arrives, the honest state is "not a
    // vendor", not "whatever the previous user was".
    setState(EMPTY_STATE);
    setChecked(false);

    if (!userKey) {
      setChecked(true);
      return undefined;
    }

    VendorAPI.getState().then((next) => {
      if (!cancelled) {
        setState(next || EMPTY_STATE);
        setChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userKey]);

  /**
   * Re-read the marketplace state from the server.
   *
   * Called after applying, editing the shop, or being approved, because those
   * all change which UI the account should see next.
   */
  const refresh = useCallback(async () => {
    if (!userKey) {
      setState(EMPTY_STATE);
      setChecked(true);
      return EMPTY_STATE;
    }
    const next = await VendorAPI.getState();
    setState(next || EMPTY_STATE);
    setChecked(true);
    return next || EMPTY_STATE;
  }, [userKey]);

  const value = {
    state,
    checked,
    refresh,
    isVendor: !!state.is_vendor,
    isApproved: state.status === 'Approved' && !!state.is_vendor,
    shop: state.shop,
    application: state.application,
    status: state.status,
  };

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

export function useVendor() {
  const context = useContext(VendorContext);
  // Defaulting rather than throwing: the vendor entry on the account screen
  // renders in trees that may not be wrapped, and a missing provider must hide
  // the entry, not take down the account screen.
  return (
    context || {
      state: EMPTY_STATE,
      checked: false,
      refresh: async () => EMPTY_STATE,
      isVendor: false,
      isApproved: false,
      shop: null,
      application: null,
      status: null,
    }
  );
}

export default VendorContext;
