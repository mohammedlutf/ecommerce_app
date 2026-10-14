import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import {
  NOTIFICATIONS_INBOX_KEY,
  PUSH_TOKEN_STORAGE_KEY,
} from '../api/sessionKeys';
import { registerDeviceToken } from '../api/notifications';
import { navigationRef } from '../navigation/navigationRef';

const NotificationContext = createContext(null);

/** Android notification channel every push is delivered through. */
const DEFAULT_CHANNEL_ID = 'default_v2';

/** The in-app inbox is capped so storage stays bounded on a phone. */
const MAX_INBOX_ITEMS = 100;

const isNative = Platform.OS !== 'web';

/**
 * Convert a received Expo notification into a persisted inbox record.
 *
 * `campaign_id` (sent by the backend in `data`) is the stable identity — the
 * native `request.identifier` is generated per-delivery, so relying on it
 * would let one campaign appear twice after a foreground + tap double-fire.
 */
function toInboxItem(notification, { read = false } = {}) {
  const request = notification && notification.request;
  const content = (request && request.content) || notification || {};
  const data = content.data || {};
  const value = data.campaign_id || data.doctype || (request && request.identifier) || '';
  const id =
    String(value || '') ||
    `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: content.title || data.title || 'تنبيه',
    body: content.body || data.body || '',
    data,
    receivedAt: Date.now(),
    read: Boolean(read),
  };
}

export function NotificationProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  // Registered users are keyed on their email; a guest has no user at all. The
  // identity drives re-registration so a login re-binds the same device row.
  const userKey = (user && user.email) || null;

  const [inbox, setInbox] = useState([]);
  const [pushToken, setPushToken] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [ready, setReady] = useState(isNative ? false : true);

  /* ---- inbox add / read helpers (persisted in the effect below) ---- */

  const addToInbox = useCallback((item, { read = false } = {}) => {
    setInbox((current) => {
      const existingIdx = current.findIndex((n) => n.id === item.id);
      if (existingIdx >= 0) {
        // Already stored. Only a tap (read) can change an existing record; a
        // re-delivered foreground copy must not duplicate it and must not mark
        // the previous copy read.
        if (!read) return current;
        return current.map((n, i) => (i === existingIdx ? { ...n, read: true } : n));
      }
      return [{ ...item, read }, ...current].slice(0, MAX_INBOX_ITEMS);
    });
  }, []);

  const markAsRead = useCallback((id) => {
    setInbox((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setInbox((current) =>
      current.some((n) => !n.read)
        ? current.map((n) => ({ ...n, read: true }))
        : current
    );
  }, []);

  /* ---- navigating to the inbox from anywhere in the app ---- */

  const openNotifications = useCallback(() => {
    // Safe on every mount state: during onboarding the Account tab does not
    // exist yet, so navigating is skipped (the same notification remains in
    // the OS tray until a later tap).
    try {
      if (navigationRef.isReady()) {
        navigationRef.navigate('AccountTab', {
          screen: 'Notifications',
        });
      }
    } catch (err) {
      console.warn('[push] could not open inbox from notification:', err);
    }
  }, []);

  /* ---- bootstrapping: channel, permission, Expo token, listeners ---- */

  useEffect(() => {
    if (!isNative) return undefined;
    let cancelled = false;

    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem(NOTIFICATIONS_INBOX_KEY);
        if (!cancelled && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setInbox(parsed.slice(0, MAX_INBOX_ITEMS));
          } catch {
            // A corrupt inbox is dropped, not fatal.
          }
        }
      } catch {
        // storage unavailable — start empty
      }

      // Foreground behaviour: Expo suppresses the OS banner by default while
      // the app is open, which makes a "received" push invisible. Windows over
      // it so the banner appears on any screen (both native platforms; the
      // web build never reaches this code path).
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      try {
        await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
          name: 'إشعارات زاد ماركت',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#004129',
        });
      } catch {
        // Android only; safe to ignore elsewhere
      }

      try {
        const token = await acquirePushToken();
        if (!cancelled) setPushToken(token);
      } catch (err) {
        console.warn('[push] token acquisition failed:', err);
      }

      if (!cancelled) setReady(true);
    }

    bootstrap();

    // Foreground deliveries land here (background/quit deliveries go straight
    // to the OS and only surface through the response listener below).
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      addToInbox(toInboxItem(notification));
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      // User tapped: keep the record, mark it read and take them to the inbox.
      const notification = response && response.notification;
      if (notification) {
        const item = toInboxItem(notification);
        addToInbox(item, { read: true });
        openNotifications();
      }
    });

    // Cold start: the app was launched by tapping a notification. Take the
    // user straight to the inbox like an in-app tap would.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response && response.notification) {
          const item = toInboxItem(response.notification, { read: true });
          addToInbox(item);
          openNotifications();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      receivedSub.remove();
      responseSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- persist the inbox whenever it changes ---- */

  useEffect(() => {
    if (!isNative) return undefined;
    AsyncStorage.setItem(NOTIFICATIONS_INBOX_KEY, JSON.stringify(inbox)).catch(() => {});
  }, [inbox]);

  /* ---- register the device once the session identity is known ---- */

  useEffect(() => {
    if (!isNative || authLoading) return undefined;
    let cancelled = false;

    (async () => {
      const token = pushToken || (await readCachedPushToken());
      if (!token || cancelled) return;
      try {
        await registerDeviceToken(token);
      } catch (err) {
        console.warn('[push] device registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNative, userKey, authLoading, pushToken]);

  /* ---- iOS app-icon badge mirrors the unread count ---- */

  useEffect(() => {
    if (!isNative || Platform.OS !== 'ios' || !hasPermission) return undefined;
    Notifications.setBadgeCountAsync(inbox.filter((n) => !n.read).length).catch(() => {});
  }, [inbox, hasPermission, isNative]);

  const unreadCount = useMemo(
    () => inbox.reduce((count, n) => (n.read ? count : count + 1), 0),
    [inbox]
  );

  const value = useMemo(
    () => ({
      inbox,
      unreadCount,
      ready,
      hasPermission,
      markAllRead,
      markAsRead,
      openNotifications,
    }),
    [inbox, unreadCount, ready, hasPermission, markAllRead, markAsRead, openNotifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Ask for permission, then resolve the Expo push token (cached on first use).
 *
 * Returns `null` when permissions were denied or the environment has no push
 * capability (simulator, Expo web).
 */
async function acquirePushToken() {
  const cached = await readCachedPushToken();

  let perms = await Notifications.getPermissionsAsync();
  if (perms && !perms.granted) {
    perms = await Notifications.requestPermissionsAsync();
  }
  const granted = !!(perms && perms.granted);

  if (!granted) return cached || null;
  if (cached) return cached;

  // Expo push simply does not exist on simulators/emulators.
  if (!Device.isDevice) return null;

  const projectId =
    (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas
      && Constants.expoConfig.extra.eas.projectId) ||
    (Constants.easConfig && Constants.easConfig.projectId);

  if (!projectId) {
    console.warn('[push] No EAS projectId in app.json extra.eas; cannot mint an Expo token.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = (tokenData && (tokenData.data || tokenData)) || null;

  if (token) {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token).catch(() => {});
  }
  return token;
}

async function readCachedPushToken() {
  try {
    return (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}

export default NotificationContext;