import { createContext, useContext } from 'react';

/**
 * Lets a screen ask the shell to get the desktop site header out of the way.
 *
 * The header lives in `AppShell`, as a flex sibling of the navigator, so a
 * screen cannot reach it directly. Products uses this to collapse the header
 * while the shopper scrolls down the catalogue, giving the grid the full height
 * of the window; scrolling up (or returning to the top) brings it back.
 *
 * The default is a no-op so screens can render outside the shell — tests, the
 * onboarding stack — without crashing.
 */
export const SiteHeaderVisibilityContext = createContext({
  setHeaderHidden: () => {},
});

export function useSiteHeaderVisibility() {
  return useContext(SiteHeaderVisibilityContext);
}
