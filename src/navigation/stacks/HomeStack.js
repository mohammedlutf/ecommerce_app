import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../screens/home/HomeScreen';
import ProductDetailScreen from '../../screens/products/ProductDetailScreen';
import ShopDirectoryScreen from '../../screens/products/ShopDirectoryScreen';
import ShopScreen from '../../screens/products/ShopScreen';
import CategoriesScreen from '../../screens/categories/CategoriesScreen';
import ContactScreen from '../../screens/support/ContactScreen';
import PolicyScreen from '../../screens/support/PolicyScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
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
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'تفاصيل المنتج' }}
      />
      <Stack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: 'التصنيفات' }}
      />
      {/* Marketplace storefront: the directory of approved vendor shops, and one
          shop's own page. Both are public reads, so no gating here — the
          screens handle "no shops yet" themselves. */}
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
      {/* Public support pages. Registered here rather than under Account so they
          remain reachable while signed out, and so the website URL for each one
          has a single unambiguous route. */}
      <Stack.Screen
        name="Contact"
        component={ContactScreen}
        options={{ title: 'تواصل معنا' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PolicyScreen}
        initialParams={{ policy: 'privacy' }}
        options={{ title: 'سياسة الخصوصية' }}
      />
      <Stack.Screen
        name="ReturnPolicy"
        component={PolicyScreen}
        initialParams={{ policy: 'returns' }}
        options={{ title: 'سياسة الاسترجاع' }}
      />
    </Stack.Navigator>
  );
}
