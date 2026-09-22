import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProductsScreen from '../../screens/products/ProductsScreen';
import ProductDetailScreen from '../../screens/products/ProductDetailScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function ProductsStack() {
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
        name="Products"
        component={ProductsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'تفاصيل المنتج' }}
      />
    </Stack.Navigator>
  );
}
