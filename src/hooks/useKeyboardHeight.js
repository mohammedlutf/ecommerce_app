import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** How much of a modal's own height is never given up to the keyboard. */
const MIN_SHEET_VISIBLE = 200;

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
 *   lift = keyboardHeight - (heightWithoutKeyboard - heightNow)
 *
 * A window that shrank by the full keyboard height yields 0; a window that did
 * not move yields the full height. `useKeyboardHeight` supplies the first term,
 * the modal's own `onLayout` supplies the second.
 *
 * Returns `{ lift, onLayout }`: put `onLayout` on the modal's outermost view and
 * `lift` in that view's `paddingBottom`.
 */
export function useModalKeyboardLift() {
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const [sheetHeight, setSheetHeight] = useState(0);
  // The height the sheet has while no keyboard is up. A ref because it is only
  // ever a comparison target, never rendered.
  const baseHeightRef = useRef(0);

  const onLayout = useCallback((event) => {
    const height = event?.nativeEvent?.layout?.height || 0;
    if (height) setSheetHeight(height);
  }, []);

  useEffect(() => {
    if (keyboardHeight === 0 && sheetHeight > 0) baseHeightRef.current = sheetHeight;
  }, [keyboardHeight, sheetHeight]);

  const alreadyLifted = Math.max(0, baseHeightRef.current - sheetHeight);

  /*
   * iOS reports the keyboard frame including the home-indicator strip that the
   * safe area is already holding the footer clear of, so counting both would
   * leave a visible gap; subtracting it there puts the footer's bottom edge
   * exactly on the keyboard's top edge.
   *
   * Android is left with the full reported height on purpose. What it reports is
   * the window's loss, which includes the navigation-bar strip in some
   * configurations and not in others, and there is no reliable way to tell which
   * from inside a modal. Taking the full height is the safe half of that bet: at
   * worst the footer floats a navigation bar above the keyboard, where
   * subtracting a strip that was never lost would tuck the buttons underneath
   * it — which is the bug this replaces.
   */
  const inset = Platform.OS === 'ios' ? insets.bottom : 0;
  const wanted = keyboardHeight - alreadyLifted - inset;

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
