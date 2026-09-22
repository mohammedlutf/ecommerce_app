import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CartScreen from '../../screens/cart/CartScreen';
import OrderConfirmationScreen from '../../screens/cart/OrderConfirmationScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function CartStack() {
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
        name="Cart"
        component={CartScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrderConfirmation"
        component={OrderConfirmationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
