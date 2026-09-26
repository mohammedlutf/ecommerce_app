import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * useKeyboardHeight — returns the on-screen keyboard height (0 when hidden).
 *
 * Why this exists: a React Native `<Modal>` creates its own window. On Android
 * that window does not resize for the keyboard, so `KeyboardAvoidingView`
 * inside a modal cannot compensate (its frame never changes). The only
 * reliable fix is to read the keyboard height ourselves and pad the modal
 * content by exactly that amount.
 *
 * On iOS the modal does resize and `KeyboardAvoidingView` handles it, but this
 * hook still reports the correct height, so callers can use it uniformly.
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

export default useKeyboardHeight;
