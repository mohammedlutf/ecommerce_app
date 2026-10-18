import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../screens/home/HomeScreen';
import ProductDetailScreen from '../../screens/products/ProductDetailScreen';
import ShopDirectoryScreen from '../../screens/products/ShopDirectoryScreen';
import ShopScreen from '../../screens/products/ShopScreen';
import CategoriesScreen from '../../screens/categories/CategoriesScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
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
    </Stack.Navigator>
  );
}
