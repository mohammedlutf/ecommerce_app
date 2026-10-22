import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProductsScreen from '../../screens/products/ProductsScreen';
import ProductDetailScreen from '../../screens/products/ProductDetailScreen';
import ShopDirectoryScreen from '../../screens/products/ShopDirectoryScreen';
import ShopScreen from '../../screens/products/ShopScreen';
import AdminNewItemScreen from '../../screens/admin/AdminNewItemScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function ProductsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: Platform.OS !== 'web',
        headerTintColor: Colors.onSurface,
        headerStyle: { backgroundColor: Colors.surfaceContainerLowest },
        headerTitleAlign: 'center',
        headerBackTitle: 'رجوع',
      }}
    >
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'تفاصيل المنتج' }}
      />
      {/* Registered in both tab stacks: each tab owns its own navigator, and a
          route only resolves inside the navigator that declared it. */}
      <Stack.Screen
        name="ShopDirectory"
        component={ShopDirectoryScreen}
        options={{ title: 'متاجر المنصة' }}
      />
      <Stack.Screen
        name="Shop"
        component={ShopScreen}
        options={{ title: 'المتجر' }}
      />
      {/* Admin-only, but not admin-gated here on purpose: the screen itself
          redirects a non-admin straight back, so the route existing for a
          non-admin is harmless and there is no admin state to read during
          navigator construction. */}
      <Stack.Screen
        name="AdminNewItem"
        component={AdminNewItemScreen}
        options={{ title: 'إضافة منتج جديد' }}
      />
    </Stack.Navigator>
  );
}
