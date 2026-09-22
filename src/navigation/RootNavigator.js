import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppTabs from './AppTabs';

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <AppTabs />
    </NavigationContainer>
  );
}
