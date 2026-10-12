import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Shadows } from '../theme/spacing';
import useDirectional from '../hooks/useDirectional';

const ToastContext = createContext(null);

const TOAST_TYPES = {
  success: {
    icon: 'checkmark-circle',
    iconColor: Colors.success,
    bg: Colors.successContainer,
    textColor: '#0F7A3D',
  },
  error: {
    icon: 'alert-circle',
    iconColor: Colors.error,
    bg: Colors.errorContainer,
    textColor: '#C52A2D',
  },
  info: {
    icon: 'information-circle',
    iconColor: Colors.info,
    bg: Colors.infoContainer,
    textColor: '#2563EB',
  },
};

let toastCounter = 0;

function ToastItem({ toast, onDone }) {
  const { textStart } = useDirectional();
  const progress = useRef(new Animated.Value(0)).current;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
  });
  const opacity = useRef(new Animated.Value(0)).current;

  const config = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  const dismiss = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onDone(toast.id));
  }, [opacity, onDone, toast.id]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(progress, {
        toValue: 1,
        damping: 15,
        stiffness: 150,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(dismiss, toast.duration || 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.accentIndicator, { backgroundColor: config.iconColor }]} />
      <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
        <Icon name={config.icon} size={20} color={config.iconColor} />
      </View>
      <Text style={[styles.toastText, textStart, { color: Colors.onSurface }]}>
        {toast.text}
      </Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
        <Icon name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const insets = useSafeAreaInsets();

  const removeToast = useCallback((id) => {
    // Functional update — never reads a possibly-stale closure array, and a
    // dismissed toast is gone from state for good (no ghost reappears).
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type = 'info', text, duration = 3200) => {
    const id = ++toastCounter;
    // Functional update so rapid toasts never race; keep only the latest few
    // (oldest is overwritten instead of stacking).
    setToasts((current) => [...current, { id, type, text, duration }].slice(-3));
  }, []);

  const success = useCallback((text, duration) => show('success', text, duration), [show]);
  const error = useCallback((text, duration) => show('error', text, duration), [show]);
  const info = useCallback((text, duration) => show('info', text, duration), [show]);

  // Memoize the context value so a toast banner re-render (or any unrelated
  // provider re-render) does not invalidate every consumer's subscriptions.
  const value = useMemo(
    () => ({ show, success, error, info, dismiss: removeToast }),
    [show, success, error, info, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <View
          pointerEvents="box-none"
          style={[styles.container, { top: insets.top + 8 }]}
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDone={removeToast} />
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastContext;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 1000,
    gap: 8,
    elevation: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadows.md,
  },
  accentIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    lineHeight: 20,
  },
  closeBtn: {
    padding: 2,
  },
});
