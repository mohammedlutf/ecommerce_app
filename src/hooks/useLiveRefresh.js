import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * useLiveRefresh — keeps data fresh.
 *  - re-runs `refreshFn` whenever the app returns to the foreground
 *  - optionally polls `refreshFn` every `intervalMs` while the app is active
 *  - optionally disabled with `isEnabled` (e.g. when not authenticated)
 *
 * `refreshFn` is always read from a ref, so callers never need to memoize it.
 */
export function useLiveRefresh(refreshFn, { intervalMs = 0, isEnabled = true } = {}) {
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;
  const activeRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      activeRef.current = active;
      if (active && isEnabled) {
        refreshRef.current();
      }
    });
    return () => sub.remove();
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) return undefined;
    if (!(intervalMs > 0)) return undefined;

    const timer = setInterval(() => {
      if (activeRef.current) {
        refreshRef.current();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, isEnabled]);
}

export default useLiveRefresh;