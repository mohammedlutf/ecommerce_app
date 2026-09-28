import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — mirrors `value`, but only after it has stopped changing
 * for `delay` ms.
 *
 * Search-as-you-type fires a request per keystroke otherwise, and because a
 * filtered query is slower than an unfiltered one the responses can land out of
 * order — the results for "chee" overwrite the results for "cheese". Debouncing
 * keeps one request in flight per settled query, which both fixes that and cuts
 * the number of server-side scans.
 *
 * Pass `delay = 0` to opt out.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (!(delay > 0)) {
      setDebounced(value);
      return undefined;
    }

    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
