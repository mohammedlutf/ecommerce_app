import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows } from '../../theme/spacing';
import OrderCard from '../../components/OrderCard';
import AddressCard from '../../components/AddressCard';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useResetOnTabPress } from '../../hooks/useResetOnTabPress';
import OrdersAPI from '../../api/orders';
import AddressAPI from '../../api/address';
import LoginScreen from '../auth/LoginScreen';

export default function AccountScreen({ navigation }) {
  useResetOnTabPress(navigation, 'AccountTab');

  const { user, isAuthenticated, logout } = useAuth();
  const { fetchCart } = useCart();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'addresses'
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadAccountData();
    }
  }, [isAuthenticated, activeTab]);

  async function loadAccountData() {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const orderData = await OrdersAPI.getOrders();
        setOrders(Array.isArray(orderData) ? orderData : []);
      } else {
        const addrData = await AddressAPI.getAddresses();
        setAddresses(Array.isArray(addrData) ? addrData : []);
      }
    } catch (err) {
      console.warn('Error loading account data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleCancelOrder(orderName) {
    Alert.alert('تأكيد الإلغاء', `هل أنت متأكد من رغبتك في إلغاء الطلب #${orderName}؟`, [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'نعم، إلغاء',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await OrdersAPI.cancelOrder(orderName);
            toast.success('تم إلغاء الطلب بنجاح');
            await loadAccountData();
          } catch (err) {
            toast.error(err.message || 'تعذر إلغاء الطلب');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleReorder(orderName) {
    setActionLoading(true);
    try {
      await OrdersAPI.reorderOrder(orderName);
      await fetchCart();
      toast.success('تمت إضافة منتجات هذا الطلب إلى سلتك بنجاح!');
    } catch (err) {
      toast.error(err.message || 'تعذر إعادة الطلب');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  if (!isAuthenticated) {
    return <LoginScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAccountData();
            }}
            colors={[Colors.primaryContainer]}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || 'ع')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'مستخدم حضرموت'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="log-out-outline" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>

        {/* Segmented Section Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('orders')}
            style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.tabButtonTextActive]}>
              طلباتي ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('addresses')}
            style={[styles.tabButton, activeTab === 'addresses' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === 'addresses' && styles.tabButtonTextActive]}>
              عناويني المسجلة ({addresses.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content according to tab */}
        {loading && !refreshing ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={Colors.primaryContainer} />
          </View>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="لا توجد طلبات سابقة"
              description="لم تقم بإجراء أي طلبات حتى الآن. استمتع بتصفح المنتجات وأكمل طلبك الأول!"
              actionLabel="تسوق الآن"
              onAction={() => navigation.navigate('HomeTab')}
            />
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.name}
                order={order}
                actionLoading={actionLoading}
                onCancelOrder={handleCancelOrder}
                onReorder={handleReorder}
              />
            ))
          )
        ) : addresses.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="لا توجد عناوين مسجلة"
            description="يمكنك إضافة عناوين التوصيل أثناء تأكيد طلبك في السلة."
            actionLabel="تصفح السلة"
            onAction={() => navigation.navigate('CartTab')}
          />
        ) : (
          addresses.map((addr) => (
            <AddressCard
              key={addr.name}
              address={addr}
              isSelected={false}
              onSelect={() => {}}
            />
          ))
        )}

        {/* Logout Bottom Button */}
        <TouchableOpacity activeOpacity={0.8} onPress={handleLogout} style={styles.logoutBtn}>
          <Icon name="log-out-outline" size={16} color={Colors.error} />
          <Text style={styles.logoutBtnText}>تسجيل الخروج من الحساب</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: 20,
    ...Shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: Typography.sizes.titleSm,
    fontWeight: '800',
    color: Colors.onSurface,
    marginBottom: 2,
    textAlign: 'left',
  },
  profileEmail: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    textAlign: 'left',
  },
  logoutIconBtn: {
    padding: 8,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabButtonActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.sm,
  },
  tabButtonText: {
    fontSize: Typography.sizes.labelMd,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  loadingWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: Colors.error,
    fontSize: Typography.sizes.labelLg,
    fontWeight: '700',
  },
});
