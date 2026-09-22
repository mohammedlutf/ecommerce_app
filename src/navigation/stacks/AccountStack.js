import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AccountScreen from '../../screens/account/AccountScreen';
import LoginScreen from '../../screens/auth/LoginScreen';
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
    </Stack.Navigator>
  );
}
