import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStack from './stacks/HomeStack';
import ProductsStack from './stacks/ProductsStack';
import CartStack from './stacks/CartStack';
import AccountStack from './stacks/AccountStack';
import WishlistScreen from '../screens/wishlist/WishlistScreen';
import Icon from '../components/Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import useDirectional from '../hooks/useDirectional';

const Tab = createBottomTabNavigator();

/**
 * Tab bar height excluding the system navigation bar.
 *
 * Android builds run edge-to-edge (`edgeToEdgeEnabled=true`), so the window
 * extends behind the gesture pill / 3-button bar. A fixed height therefore
 * dropped the bottom inset and let the system bar draw straight over the tabs —
 * the inset has to be added back on top of these numbers.
 */
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_BAR_PADDING_BOTTOM = 8;

/**
 * @param {boolean} [hideTabBar] Desktop renders a header nav instead of the
 *   bottom strip, so the bar is removed entirely rather than merely restyled.
 */
export default function AppTabs({ hideTabBar = false }) {
  const { textStart } = useDirectional();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.outline,
        // The desktop shell moves navigation into the header, and the bottom
        // strip on a 1440px window is pure dead space.
        tabBarStyle: hideTabBar
          ? { display: 'none' }
          : [
              styles.tabBar,
              {
                height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
                paddingBottom: TAB_BAR_PADDING_BOTTOM + insets.bottom,
              },
            ],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="ProductsTab"
        component={ProductsStack}
        options={{
          tabBarLabel: 'المنتجات',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Icon name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="WishlistTab"
        component={WishlistScreen}
        options={{
          tabBarLabel: 'المفضلة',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Icon name={focused ? 'heart' : 'heart-outline'} size={22} color={color} />
              {wishlistCount > 0 && (
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, textStart]}>{wishlistCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="CartTab"
        component={CartStack}
        options={{
          tabBarLabel: 'السلة',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Icon name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
              {cartCount > 0 && (
                <View style={[styles.badge, styles.cartBadge]}>
                  <Text style={[styles.badgeText, textStart]}>{cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="AccountTab"
        component={AccountStack}
        options={{
          tabBarLabel: 'حسابي',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Icon name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontSize: Typography.sizes.labelSm,
    fontWeight: '700',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadge: {
    backgroundColor: Colors.secondary,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
});
