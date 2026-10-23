import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Shadows } from '../../theme/spacing';

/**
 * DialogSheet — the web presentation of a modal.
 *
 * ## Why this exists
 *
 * Every modal in the app was written for a phone: a panel that fills the
 * screen, pinned to the bottom, with the primary action in a sticky footer.
 * That is right on a handset and wrong on a desktop browser, where a modal
 * that fills a 1920px window is not a dialog at all — it is a second page
 * wearing a dialog's clothes. The old workarounds were per-screen: a `maxWidth`
 * here, a dimmed backdrop there, a sheet that only sometimes got a close
 * button. The result was that no two dialogs looked alike.
 *
 * This component is the single place that decides what a dialog looks like on
 * the web: a dimmed, blurred backdrop; a card centred in the viewport with a
 * maximum width; rounded corners and a real shadow; and an optional click
 * outside to dismiss.
 *
 * ## What it does *not* do
 *
 * It does not touch the phone layout. On native it renders its children
 * unchanged, so a sheet that fills the screen still fills the screen and the
 * keyboard-lift logic in `useModalKeyboardLift` still measures the same
 * window. Nothing about the mobile build changes.
 *
 * @param {React.ReactNode} children The dialog body.
 * @param {number} [maxWidth] Widest the card may get, in pixels.
 * @param {Function} [onPressBackdrop] Called when the backdrop is clicked.
 *   Without it the backdrop swallows the click, so a form cannot be lost to a
 *   stray tap.
 * @param {object} [contentStyle] Extra style for the card.
 * @param {object} [style] Extra style for the backdrop.
 */
export default function DialogSheet({
  children,
  maxWidth = 560,
  onPressBackdrop,
  contentStyle,
  style,
}) {
  // The phone build keeps its own layout entirely.
  if (Platform.OS !== 'web') return children;

  return (
    <View style={[styles.backdrop, style]} className="modal-backdrop">
      {onPressBackdrop ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPressBackdrop}
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
        />
      ) : null}

      <View style={[styles.card, { maxWidth }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11, 18, 32, 0.55)',
  },
  card: {
    width: '100%',
    // A dialog must never be taller than the window, and it must never be a
    // full-bleed sheet with a title bar at the top of the screen.
    maxHeight: '92%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadows.lg,
  },
});
