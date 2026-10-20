import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** How much of a modal's own height is never given up to the keyboard. */
const MIN_SHEET_VISIBLE = 200;

/**
 * Android's share of the reported keyboard height that is never trusted to be
 * the whole distance — see `useModalKeyboardLift`.
 */
const ANDROID_CLEARANCE_RATIO = 0.1;

/**
 * useKeyboardHeight — returns the on-screen keyboard height (0 when hidden).
 *
 * The plain number on its own is rarely what a caller wants inside a `<Modal>`:
 * padding by it unconditionally double-compensates wherever the platform resized
 * the window too. See `useModalKeyboardLift` below for the modal case.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // iOS fires the `Will*` events early enough to animate with the keyboard.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}

/**
 * useModalKeyboardLift — how far a `<Modal>` must lift its content so a sticky
 * footer clears the keyboard, net of whatever the platform already did.
 *
 * `useKeyboardHeight` alone is not enough here, and padding by it unconditionally
 * is what makes the same code work in one runtime and throw the sheet off-screen
 * in another. A React Native `<Modal>` is its own window, and whether that window
 * shrinks for the keyboard is a property of the runtime, not of the app: it does
 * in some (a development client, where the dialog inherits the activity's
 * `adjustResize`) and does not in others (a release build, where the dialog is
 * simply drawn under the IME). `KeyboardAvoidingView` cannot help either way,
 * because whether its own frame changes is exactly the thing that varies.
 *
 * So this measures the modal instead of trusting either behaviour: the part of
 * the keyboard the window has already given up does not need lifting twice.
 *
 *   lift = keyboardHeight - (tallestSeen - heightNow) - safeAreaStrip + clearance
 *
 * A window that shrank by the full keyboard height needs no lift at all; a
 * window that did not move needs the whole of it, plus Android's margin. That
 * remainder — the keyboard as yet uncovered — is what the terms below trade in.
 * `useKeyboardHeight` supplies the first term, the modal's own `onLayout` the
 * second.
 *
 * Returns `{ lift, onLayout }`: put `onLayout` on the modal's outermost view and
 * `lift` in that view's `paddingBottom`.
 */
export function useModalKeyboardLift() {
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const [sheetHeight, setSheetHeight] = useState(0);
  // The tallest the sheet has ever been measured — its height with nothing over
  // it. A ref because it is only ever a comparison target, never rendered.
  const tallestRef = useRef(0);

  const onLayout = useCallback((event) => {
    const height = event?.nativeEvent?.layout?.height || 0;
    if (!height) return;
    /*
     * Raise-only, and recorded here rather than from an effect keyed on
     * `keyboardHeight === 0`. That condition looks safe and is the exact fault:
     * where the runtime resizes for the keyboard, the dialog's own layout pass
     * lands a frame or two before the keyboard event reaches JS, so "the
     * keyboard is down" is momentarily true while the sheet is already at its
     * shrunken height. Recording that as the baseline makes the platform's own
     * shrink look like nothing, adds the whole keyboard on top of a window that
     * already gave it up, and leaves the footer floating in a gap the height of
     * the keyboard — the empty space this is being asked to fix. A baseline that
     * can only rise cannot make that mistake, and a sheet that grows back (the
     * keyboard closing, or opening during the first layout) repairs it alone.
     *
     * Portrait is locked app-wide, so nothing but the keyboard ever makes these
     * sheets shorter; a rotation with a modal open would need the baseline
     * re-established from a settled keyboard-down layout instead.
     */
    if (height > tallestRef.current) tallestRef.current = height;
    setSheetHeight(height);
  }, []);

  const alreadyLifted = Math.max(0, tallestRef.current - sheetHeight);

  /*
   * iOS: the keyboard's frame covers the home-indicator strip that the safe
   * area is already holding the footer clear of, so counting both would leave a
   * visible gap; subtracting it puts the footer's bottom edge exactly on the
   * keyboard's top edge. iOS reports the keyboard's settled frame, so the
   * number is the whole story there.
   *
   * Android clears instead of exacting. Two things keep it from landing flush:
   * the height is read from the activity's window while this dialog keeps its
   * own bottom edge, and it can be sampled while the keyboard is still rising,
   * which reads short by roughly a tenth of the keyboard. Either way the failure
   * is asymmetric — a strip of sheet colour under the buttons reads as padding,
   * whereas half a button behind the keyboard is broken, which is what is being
   * fixed. So Android adds the bottom system bar (what the keyboard overlays
   * that this window does not give up) or a tenth of the distance it is being
   * asked to cover, whichever is larger — but only over that uncovered distance,
   * and only while a keyboard is up: where the window already shrank by the full
   * keyboard there is nothing left to cover and the margin must be zero, and
   * with no keyboard up `wanted` must stay at zero or the safe-area strip would
   * be counted for as long as the modal is open.
   */
  const safeAreaStrip = Platform.OS === 'ios' ? insets.bottom : 0;
  // The keyboard the window has not already given up: the only part this lift is
  // responsible for, and the only place Android's margin belongs.
  const uncovered = Math.max(0, keyboardHeight - alreadyLifted);
  const clearance =
    Platform.OS === 'android' && uncovered > 0
      ? Math.max(insets.bottom, uncovered * ANDROID_CLEARANCE_RATIO)
      : 0;
  const wanted = uncovered - safeAreaStrip + clearance;

  /*
   * Never lift the footer past the top of the sheet. This is a guard rather than
   * a behaviour: it only bites when the two measurements disagree badly — a
   * sheet that mounted with the keyboard already up, say, so no un-shrunk height
   * was ever seen — and keeping the form visible then matters more than the
   * footer's exact seat. An unmeasured sheet (height 0, first frame, or web)
   * simply gets no lift.
   */
  const lift = Math.max(0, Math.min(wanted, sheetHeight - MIN_SHEET_VISIBLE));

  return { lift, onLayout };
}

export default useKeyboardHeight;
