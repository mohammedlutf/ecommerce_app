import { I18nManager } from 'react-native';

/**
 * Native layout direction.
 *
 * The web gets this for free: `I18nContext` writes `dir="rtl"` onto `<html>` and
 * CSS flips both flexbox ordering *and* the default text alignment. React Native
 * has no equivalent — on device the layout direction is a process-wide flag owned
 * by `I18nManager`, and it defaults to LTR. Until it is actually set, every
 * `flexDirection: 'row'` lays out left-to-right and the default text alignment is
 * the left edge, which is exactly the "Arabic sits on the left" symptom.
 *
 * Two things make this awkward and are handled here:
 *
 * 1. `forceRTL` is read when the native view hierarchy is created, so changing it
 *    at runtime has no effect until the app restarts. `applyLayoutDirection`
 *    reports when a restart is needed instead of silently pretending it worked.
 * 2. It is a *global* flag, so it cannot express "the shopper switched to
 *    English" on its own — which is why the app resolves text alignment in JS
 *    (`useDirectional().textStart`) rather than relying on this flag alone.
 */

/** Storage key marking that we already restarted once to apply a direction. */
export const RESTART_FLAG_KEY = 'i18n:direction-restarted';

/**
 * Point the native layout direction at `rtl`.
 *
 * @param {boolean} rtl
 * @returns {boolean} true when the runtime already matches (no restart needed).
 */
export function applyLayoutDirection(rtl) {
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL === rtl) return true;
    I18nManager.forceRTL(rtl);
    return false;
  } catch (err) {
    console.warn('Could not configure layout direction:', err);
    return true;
  }
}

/**
 * Restart the app so a direction change takes effect, at most once per install.
 *
 * Android applies `I18nManager` when the native views are created, so without a
 * restart the flag we just wrote is never read and the UI stays LTR — which
 * looks identical to the bug we are fixing. Guarded by storage so a failed
 * reload cannot turn into a reload loop.
 *
 * @param {() => Promise<boolean>} alreadyRestarted Resolves true if we already tried.
 * @param {(k: string) => Promise<void>} remember
 */
export async function restartOnceForDirection(alreadyRestarted, remember) {
  try {
    if (await alreadyRestarted()) return false;
    await remember(RESTART_FLAG_KEY);
  } catch {
    return false;
  }

  try {
    // Standalone builds and dev clients with expo-updates can reload cleanly.
    const Updates = require('expo-updates');
    if (Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // fall through to the dev-only path
  }

  try {
    const { DevSettings } = require('react-native');
    if (__DEV__ && DevSettings?.reload) {
      DevSettings.reload();
      return true;
    }
  } catch {
    // fall through
  }

  return false;
}

export const isRTL = I18nManager.isRTL;