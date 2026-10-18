import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AccountScreen from '../../screens/account/AccountScreen';
import LoginScreen from '../../screens/auth/LoginScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import VendorHomeScreen from '../../screens/vendor/VendorHomeScreen';
import VendorApplyScreen from '../../screens/vendor/VendorApplyScreen';
import VendorOrdersScreen from '../../screens/vendor/VendorOrdersScreen';
import VendorOrderDetailScreen from '../../screens/vendor/VendorOrderDetailScreen';
import VendorProductsScreen from '../../screens/vendor/VendorProductsScreen';
import VendorProductEditScreen from '../../screens/vendor/VendorProductEditScreen';
import VendorShopScreen from '../../screens/vendor/VendorShopScreen';
import VendorPayoutsScreen from '../../screens/vendor/VendorPayoutsScreen';
import MarketplaceAdminScreen from '../../screens/marketplace/MarketplaceAdminScreen';
import MarketplaceShopsScreen from '../../screens/marketplace/MarketplaceShopsScreen';
import MarketplaceApplicationsScreen from '../../screens/marketplace/MarketplaceApplicationsScreen';
import MarketplacePayoutsScreen from '../../screens/marketplace/MarketplacePayoutsScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function AccountStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: Colors.onSurface,
        headerStyle: { backgroundColor: Colors.surfaceContainerLowest },
        headerTitleAlign: 'center',
        headerBackTitle: 'رجوع',
      }}
    >
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'تسجيل الدخول' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'الإشعارات' }}
      />

      {/* --- Vendor dashboard ------------------------------------------------
          Reachable by everyone; every screen reads the vendor context itself and
          shows the application form (or a "pending" notice) when there is no
          approved shop, so there is nothing to gate at the navigator level. */}
      <Stack.Screen
        name="VendorHome"
        component={VendorHomeScreen}
        options={{ title: 'متجري' }}
      />
      <Stack.Screen
        name="VendorApply"
        component={VendorApplyScreen}
        options={{ title: 'طلب فتح متجر' }}
      />
      <Stack.Screen
        name="VendorOrders"
        component={VendorOrdersScreen}
        options={{ title: 'طلبات المتجر' }}
      />
      <Stack.Screen
        name="VendorOrderDetail"
        component={VendorOrderDetailScreen}
        options={{ title: 'تفاصيل الطلب' }}
      />
      <Stack.Screen
        name="VendorProducts"
        component={VendorProductsScreen}
        options={{ title: 'منتجات المتجر' }}
      />
      <Stack.Screen
        name="VendorProductEdit"
        component={VendorProductEditScreen}
        options={{ title: 'منتج' }}
      />
      <Stack.Screen
        name="VendorShop"
        component={VendorShopScreen}
        options={{ title: 'إعدادات المتجر' }}
      />
      <Stack.Screen
        name="VendorPayouts"
        component={VendorPayoutsScreen}
        options={{ title: 'المستحقات' }}
      />

      {/* --- Marketplace administration -------------------------------------
          Listed here for every user on purpose: there is no admin state to read
          while the navigator is constructed. The hub shows a "platform staff
          only" notice when the user is not an admin and is the only entry point
          to the sub-screens, which additionally skip loading for a non-admin.
          The server-side `_require_admin()` remains the real gate. */}
      <Stack.Screen
        name="MarketplaceAdmin"
        component={MarketplaceAdminScreen}
        options={{ title: 'إدارة السوق' }}
      />
      <Stack.Screen
        name="MarketplaceShops"
        component={MarketplaceShopsScreen}
        options={{ title: 'المتاجر' }}
      />
      <Stack.Screen
        name="MarketplaceApplications"
        component={MarketplaceApplicationsScreen}
        options={{ title: 'طلبات فتح المتاجر' }}
      />
      <Stack.Screen
        name="MarketplacePayouts"
        component={MarketplacePayoutsScreen}
        options={{ title: 'كشوف المستحقات' }}
      />
    </Stack.Navigator>
  );
}
