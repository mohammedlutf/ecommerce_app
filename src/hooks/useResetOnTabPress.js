import { useEffect } from 'react';

/**
 * useResetOnTabPress — makes a nested stack always land on its FIRST screen
 * when its tab is pressed (even if the tab is already focused deeper in the
 * stack). Without this, pressing "المنتجات" while on a product detail returns
 * to the same detail screen, and re-opening the cart after checkout shows the
 * old order confirmation.
 *
 * Call it from the root screen of a stack with the matching tab name.
 */
export function useResetOnTabPress(navigation, tabName) {
  useEffect(() => {
    if (!tabName || !navigation || typeof navigation.getParent !== 'function') {
      return undefined;
    }
    const parent = navigation.getParent();
    if (!parent || typeof parent.addListener !== 'function') return undefined;

    const unsubscribe = parent.addListener('tabPress', (e) => {
      if (e.target && typeof e.target === 'string' && !e.target.includes(tabName)) {
        return;
      }
      navigation.popToTop();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigation, tabName]);
}

export default useResetOnTabPress;