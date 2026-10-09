import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../../screens/onboarding/WelcomeScreen';
import RegisterScreen from '../../screens/onboarding/RegisterScreen';
import { Colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

/**
 * The first-launch flow (native only). Both screens are full-bleed cards over
 * the brand gradient with their own headers, so the navigator stays invisible:
 * `headerShown: false` everywhere and a crisp slide transition between the two
 * pages.
 */
export default function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}