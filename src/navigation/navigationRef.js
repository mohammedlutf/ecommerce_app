import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Navigation handle for components that sit *outside* the navigator.
 *
 * `SiteHeader` and `PageFooter` are rendered by `AppShell` as flex siblings of
 * the navigator rather than as screens, so `useNavigation()` is not available to
 * them — that hook only resolves inside a navigator. A container ref is the
 * supported way to drive navigation from there, and it also survives the header
 * being rendered before the navigator has mounted.
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Navigate if the navigator is ready.
 *
 * `isReady()` is not optional. The header renders on the first frame while the
 * navigator is still mounting, and calling `navigate` on an unmounted container
 * throws — which during a cold start takes down the whole app rather than
 * failing one tap.
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }
  return false;
}

export default navigationRef;