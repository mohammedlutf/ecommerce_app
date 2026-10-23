import React, { useCallback, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Radius, Shadows, Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import useDirectional from '../hooks/useDirectional';

/**
 * A confirmation dialog that works on native *and* on the web.
 *
 * This replaces `Alert.alert`, which was used for logout and order cancellation.
 * React Native Web ships an `Alert` module whose `alert` method is empty, so
 * every one of those calls did nothing at all on the website: pressing "log out"
 * left the customer signed in with no feedback, which reads as a broken button
 * rather than as a missing feature.
 *
 * On native the platform dialog is still the better control, so `useConfirm`
 * keeps using `Alert` there and renders this modal only on the web. Call sites
 * do not branch: they get one `confirm()` function and one element to render.
 */

const TONE_ICONS = {
  destructive: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

const TONE_COLORS = {
  destructive: Colors.error,
  warning: Colors.warning,
  info: Colors.primary,
};

function ConfirmDialog({ options, onClose }) {
  const { textStart } = useDirectional();
  const {
    title,
    message,
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    tone = 'destructive',
    onConfirm,
  } = options;

  const accent = TONE_COLORS[tone] || TONE_COLORS.info;
  const iconName = TONE_ICONS[tone] || TONE_ICONS.info;

  const confirm = () => {
    onClose();
    onConfirm();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} className="modal-backdrop">
        {/*
          Clicking the backdrop cancels, the way a web dialog is expected to.
          The card below swallows presses so that releasing a drag just outside
          the text does not discard a decision the shopper has not made.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          style={styles.card}
          onStartShouldSetResponder={() => true}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View style={[styles.iconWrap, { backgroundColor: `${accent}1A` }]}>
            <Icon name={iconName} size={26} color={accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.button, styles.buttonGhost, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonGhostText, textStart]}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={confirm}
              style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonSolidText, textStart]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Ask the shopper to confirm something.
 *
 * Renders `confirmDialog` once, near the root of the calling screen. The modal
 * portals over the whole document, so its position in the tree does not matter
 * and it is unaffected by the `overflow: hidden` body that makes each screen
 * own its own scrolling.
 *
 * @returns {{confirm: Function, confirmDialog: React.ReactNode}}
 */
export default function useConfirm() {
  const [options, setOptions] = useState(null);

  const confirm = useCallback(
    (opts) => {
      const {
        title,
        message,
        confirmLabel = 'تأكيد',
        cancelLabel = 'إلغاء',
        tone = 'destructive',
        onConfirm,
      } = opts;

      if (Platform.OS !== 'web') {
        Alert.alert(title, message, [
          { text: cancelLabel, style: 'cancel' },
          {
            text: confirmLabel,
            style: tone === 'destructive' ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ]);
        return;
      }

      setOptions({ title, message, confirmLabel, cancelLabel, tone, onConfirm });
    },
    []
  );

  const close = useCallback(() => setOptions(null), []);

  const confirmDialog = options ? <ConfirmDialog options={options} onClose={close} /> : null;

  return { confirm, confirmDialog };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    // A dialog must not stretch across a 1440px monitor.
    maxWidth: 420,
    backgroundColor: Colors.surfaceContainerLowest || Colors.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.xl || 24,
    alignItems: 'center',
    ...Shadows.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.subtitle,
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    ...Typography.body,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl || 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    backgroundColor: Colors.surfaceContainerHigh || Colors.surfaceContainerHighest,
  },
  buttonGhostText: {
    ...Typography.button,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  buttonSolidText: {
    ...Typography.button,
    fontFamily: Typography.fontFamilyBold,
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});