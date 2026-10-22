import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import AddressCard from '../../components/AddressCard';
import AddressFormModal from '../../components/AddressFormModal';
import EmptyState from '../../components/EmptyState';
import PageFooter from '../../components/layout/PageFooter';
import useConfirm from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSiteChrome } from '../../hooks/useResponsive';
import useDirectional from '../../hooks/useDirectional';
import useDocumentHead from '../../seo/useDocumentHead';
import AddressAPI from '../../api/address';
import LoginScreen from '../auth/LoginScreen';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius } from '../../theme/spacing';

/**
 * My addresses — the shopper's saved delivery addresses, on its own screen.
 *
 * Split out of the account hub for the same reason as the orders list: the hub
 * is a directory of destinations, not a form plus a list. Create, edit, delete
 * and set-primary all live here, backed by the same `AddressAPI` and the shared
 * `AddressFormModal` the cart uses.
 */
export default function MyAddressesScreen({ navigation }) {
  const { textStart } = useDirectional();
  const { showDesktopChrome } = useSiteChrome();
  useDocumentHead({ title: 'عناويني', path: '/account/addresses', noindex: true });

  const { user, isAuthenticated } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const toast = useToast();

  // Scope addresses to the signed-in customer, not merely to "logged in", so a
  // logout → login as somebody else starts from a clean slate.
  const userKey = (user && user.email) || null;

  // The address form offers the customer's own number as the default recipient
  // phone. These accounts are registered by phone number, so the local part of
  // the login address is used when `mobile_no` was never filled in on the User
  // document — the same fallback the server applies.
  const defaultPhone =
    (user && user.mobileNo) || (userKey ? userKey.split('@')[0].replace(/[^\d]/g, '') : '');

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);

  // Bumped on every request; a response whose id is stale (user switched, a
  // newer request started) is dropped instead of overwriting state.
  const requestRef = useRef(0);
  const userKeyRef = useRef(userKey);
  userKeyRef.current = userKey;
  const addressesRef = useRef(addresses);
  addressesRef.current = addresses;
  const hasLoadedRef = useRef(false);

  const loadAddresses = useCallback(async ({ showSpinner = true } = {}) => {
    const requestId = ++requestRef.current;
    const requestedUser = userKeyRef.current;
    if (!requestedUser) return;

    if (showSpinner) setLoading(true);
    try {
      const data = await AddressAPI.getAddresses();
      if (requestId !== requestRef.current) return;
      if (requestedUser !== userKeyRef.current) return;
      setAddresses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Error loading addresses:', err);
    } finally {
      if (requestId === requestRef.current) {
        if (showSpinner) setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // A different user (or a logout) must never see the previous customer's
  // addresses. Clear the cached list and invalidate any in-flight request.
  useEffect(() => {
    ++requestRef.current;
    hasLoadedRef.current = false;
    setAddresses([]);
    // A request dropped by the bump above will never reach its own `finally`,
    // so clear its spinners here or they spin forever.
    setLoading(false);
    setRefreshing(false);
  }, [userKey]);

  // Refresh whenever this screen regains focus — an address added in the cart
  // must be here when the shopper taps through from the account hub.
  useFocusEffect(
    useCallback(() => {
      if (!userKeyRef.current) return undefined;
      const showSpinner = !hasLoadedRef.current || addressesRef.current.length === 0;
      hasLoadedRef.current = true;
      loadAddresses({ showSpinner });
      return undefined;
    }, [loadAddresses])
  );

  function handleRefresh() {
    setRefreshing(true);
    loadAddresses({ showSpinner: false });
  }

  // --- Create / edit -------------------------------------------------------
  // `editingAddress` drives one modal for both create and edit; keeping them
  // separate meant the two forms could validate and send different payloads.
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  function handleAddAddressPress() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function handleEditAddress(address) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  function handleCloseForm() {
    if (savingAddress) return;
    setFormOpen(false);
    setEditingAddress(null);
  }

  async function handleSubmitAddress(values) {
    setSavingAddress(true);
    try {
      if (editingAddress) {
        await AddressAPI.updateAddress({
          addressName: editingAddress.name,
          ...values,
        });
        toast.success('تم تحديث العنوان');
      } else {
        await AddressAPI.addAddress(values);
        toast.success('تم إضافة العنوان');
      }
      setFormOpen(false);
      setEditingAddress(null);
      // Reload without a spinner: the list is already on screen, and blanking it
      // for a fraction of a second reads as a glitch.
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || (editingAddress ? 'تعذر تحديث العنوان' : 'تعذر إضافة العنوان'));
    } finally {
      setSavingAddress(false);
    }
  }

  function handleDeleteAddress(address) {
    confirm({
      title: 'حذف العنوان',
      message: `سيتم حذف "${address.address_title || 'عنوان التوصيل'}" نهائياً. هل أنت متأكد؟`,
      confirmLabel: 'نعم، احذف',
      cancelLabel: 'تراجع',
      tone: 'destructive',
      onConfirm: () => deleteAddress(address),
    });
  }

  async function deleteAddress(address) {
    setAddressBusy(true);
    try {
      await AddressAPI.deleteAddress(address.name);
      toast.success('تم حذف العنوان');
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر حذف العنوان');
    } finally {
      setAddressBusy(false);
    }
  }

  async function handleSetDefaultAddress(address) {
    setAddressBusy(true);
    try {
      await AddressAPI.setDefaultAddress(address.name);
      toast.success('تم تعيين العنوان الأساسي');
      await loadAddresses({ showSpinner: false });
    } catch (err) {
      toast.error(err?.message || 'تعذر تعيين العنوان الأساسي');
    } finally {
      setAddressBusy(false);
    }
  }

  if (!isAuthenticated) {
    return <LoginScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, showDesktopChrome && styles.scrollContentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primaryContainer]}
          />
        }
      >
        <View style={[styles.column, showDesktopChrome && styles.columnWide]}>
          {showDesktopChrome ? null : (
            <View style={styles.headerRow}>
              <Text style={[styles.title, textStart]}>عناويني ({addresses.length})</Text>
            </View>
          )}

          {/* The add button is always reachable, including when the list is
              empty — an empty state that only points at the cart is a dead end
              for someone who came here to manage their addresses. */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAddAddressPress}
            style={({ pressed }) => [styles.addAddressBtn, pressed && styles.addAddressBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="إضافة عنوان جديد"
          >
            <Icon name="add" size={20} color={Colors.onPrimary} />
            <Text style={[styles.addAddressBtnText, textStart]}>إضافة عنوان جديد</Text>
          </TouchableOpacity>

          {loading && !refreshing ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="large" color={Colors.primaryContainer} />
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.addressesEmpty}>
              <EmptyState
                icon="location-outline"
                title="لا توجد عناوين مسجلة"
                description="أضف عنوان التسليم الخاص بك لتوصيل طلباتك بسهولة، أو حدّد موقعك على الخريطة."
                actionLabel="إضافة عنوان"
                onAction={handleAddAddressPress}
              />
            </View>
          ) : (
            <View style={[styles.cardGrid, showDesktopChrome && styles.cardGridWide]}>
              {addresses.map((addr) => (
                <View
                  key={addr.name}
                  style={showDesktopChrome ? styles.cardGridCell : styles.cardGridCellFull}
                >
                  <AddressCard
                    address={addr}
                    isSelected={false}
                    onEdit={handleEditAddress}
                    onDelete={handleDeleteAddress}
                    onSetDefault={handleSetDefaultAddress}
                    busy={addressBusy || savingAddress}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Desktop-only site footer; must live inside the ScrollView. */}
        <PageFooter />
      </ScrollView>

      <AddressFormModal
        visible={formOpen}
        initial={editingAddress}
        defaultPhone={defaultPhone}
        saving={savingAddress}
        onClose={handleCloseForm}
        onSubmit={handleSubmitAddress}
      />

      {/* Web confirm dialog for address deletion. */}
      {confirmDialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentWide: {
    maxWidth: 1080,
    alignSelf: 'center',
    width: '100%',
  },
  column: {
    width: '100%',
  },
  columnWide: {
    maxWidth: 1080,
    alignSelf: 'center',
  },
  headerRow: {
    marginBottom: 14,
  },
  title: {
    fontSize: Typography.sizes.headlineSm,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  // `cardGridCellFull` is the plain mobile case: a plain block so the vertical
  // `gap` on each card still applies. `cardGridCell` is only used on wide
  // screens, where the row gap takes over.
  cardGrid: {
    width: '100%',
  },
  cardGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardGridCellFull: {
    width: '100%',
  },
  cardGridCell: {
    // Just under 50% so two cells plus the row gap always fit without wrapping
    // a third, at any width in the capped column.
    flexBasis: '48.5%',
    flexGrow: 1,
    maxWidth: '100%',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    marginBottom: 14,
  },
  addAddressBtnPressed: {
    backgroundColor: Colors.primaryPress,
  },
  addAddressBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
  },
  loadingWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  addressesEmpty: {
    marginBottom: 8,
  },
});
