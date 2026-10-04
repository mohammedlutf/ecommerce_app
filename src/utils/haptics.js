import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

/**
 * Haptics that degrades safely.
 *
 * `expo-haptics` has no web implementation — its `build/` directory ships only
 * type declarations and no `.js`, so the browser build would resolve an import
 * with nothing behind it. Rather than branch at every call site (and risk
 * forgetting one), every effect goes through here: on web these are no-ops, on
 * device they behave exactly as before.
 *
 * Every call is also swallowed. A haptic is pure feedback — if the platform
 * refuses it (older Android, a device with no vibrator, a browser tab in the
 * background) the user's action must still complete.
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export function impactLight() {
  if (!isNative) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function impactMedium() {
  if (!isNative) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function notifySuccess() {
  if (!isNative) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notifyError() {
  if (!isNative) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error).catch(() => {});
}

export function selectionChanged() {
  if (!isNative) return;
  ExpoHaptics.selectionAsync().catch(() => {});
}

export default {
  impactLight,
  impactMedium,
  notifySuccess,
  notifyError,
  selectionChanged,
};