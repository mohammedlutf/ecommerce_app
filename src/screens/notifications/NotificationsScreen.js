import React, { useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import useDocumentHead from '../../seo/useDocumentHead';
import { useI18n } from '../../i18n/I18nContext';
import { useNotifications } from '../../context/NotificationContext';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import useDirectional from '../../hooks/useDirectional';

/**
 * Relative timestamp, localised. "Just now" under a minute, then minutes,
 * hours and days — enough for a notification feed without pulling in a date
 * library.
 */
function timeAgo(ts, t, formatDate) {
  const diff = Math.max(0, Date.now() - Number(ts) || 0);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('notifications.justNow');
  if (minutes < 60) return t('notifications.minutesAgo', '', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', '', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo', '', { count: days });
  return formatDate(new Date(ts).toISOString());
}

export default function NotificationsScreen({ navigation }) {
  const { t, formatDate } = useI18n();
  const insets = useSafeAreaInsets();
  const { textStart } = useDirectional();
  const { inbox, unreadCount, markAllRead } = useNotifications();

  useDocumentHead({ title: t('notifications.title'), path: '/notifications', noindex: true });

  // Keep the native stack header in sync with the current language.
  useLayoutEffect(() => {
    navigation.setOptions({ title: t('notifications.title') });
  }, [navigation, t]);

  // The moment the user opens the inbox everything listed is being seen, so a
  // focus marks all as read. This also clears the badge when the app lands
  // here via a notification tap.
  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, textStart]}>{t('notifications.title')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={markAllRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.markAllBtn}
          >
            <Icon name="checkmark-done" size={16} color={Colors.primary} />
            <Text style={[styles.markAllText, textStart]}>
              {t('notifications.markAllRead')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          inbox.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.dotColumn, textStart]}>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.cardBody}>
              <Text
                style={[
                  styles.cardTitle,
                  textStart,
                  !item.read && styles.cardTitleUnread,
                ]}
              >
                {item.title}
              </Text>
              {item.body ? (
                <Text style={[styles.cardBodyText, textStart]}>{item.body}</Text>
              ) : null}
              <Text style={[styles.cardTime, textStart]}>
                {timeAgo(item.receivedAt, t, formatDate)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title={t('notifications.empty')}
            description={t('notifications.emptyHint')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerTitle: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  markAllText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    gap: 10,
    ...Shadows.xs,
  },
  dotColumn: {
    width: 12,
    paddingTop: 6,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  cardTitleUnread: {
    color: Colors.primary,
  },
  cardBodyText: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 21,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
  },
});