import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import { DEFAULT_REGION, buildPlaceLabel, formatCoordsForDisplay } from '../utils/geo';

const MAP_HEIGHT = 220;
const GEOFENCE_METERS = 4000;

/**
 * LocationPicker — choose the delivery point on a map, or use the device's
 * current position.
 *
 * The pin is authoritative, so the form always opens on whatever is already
 * stored: editing an address must not silently re-aim it at the map's default
 * view. Three ways in, because that is what people actually try:
 *   - drag the marker
 *   - tap anywhere on the map
 *   - "موقعي الحالي" for the GPS fix
 *
 * `onChange` reports `{ latitude, longitude, placeName }`. `placeName` is a
 * best-effort reverse geocode: geocoding can fail or return nothing useful, and
 * that must never block choosing a location, so it is reported as '' and the
 * coordinates still stand on their own.
 */
export default function LocationPicker({
  value,
  onChange,
  onError,
  disabled = false,
}) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [region, setRegion] = useState(DEFAULT_REGION);
  // Whether the user has placed a pin yet. The map opening view and the
  // "locate me" animation must not fire on an edit that already has a pin.
  const hasPin = !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
  // `locating` is state, so a second tap landing in the same tick would still
  // read the old `false` and start a second GPS request. The ref is the guard
  // that is correct within a single frame.
  const locatingRef = useRef(false);

  // Reverse-geocode token, so a slow geocode for an old point cannot land after
  // a newer one and label the wrong pin.
  const geocodeTokenRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Move the pin and re-label it.
   *
   * The coordinates are reported to the parent immediately — they are the part
   * that must be exact — and the place name follows when the geocode resolves.
   */
  const placePin = useCallback(
    async (latitude, longitude, { recenter = true } = {}) => {
      const coords = { latitude, longitude };

      // Clear the old label so the UI never shows the previous address's name
      // next to the new pin while this one is being resolved.
      onChange({ ...coords, placeName: '' });
      if (recenter) {
        // The MapView is uncontrolled, so setting `region` alone only updates
        // our copy of it and leaves the camera where it was. Without the
        // explicit animation a GPS fix taken outside the opening view would
        // drop a pin the user cannot see.
        const nextRegion = {
          ...coords,
          latitudeDelta: GEOFENCE_METERS / 111320,
          longitudeDelta: GEOFENCE_METERS / 111320,
        };
        setRegion(nextRegion);
        if (mapRef.current) mapRef.current.animateToRegion(nextRegion, 350);
      }

      const token = ++geocodeTokenRef.current;
      setGeocoding(true);
      try {
        const results = await ExpoLocation.reverseGeocodeAsync(coords);
        if (!mountedRef.current || token !== geocodeTokenRef.current) return;
        const placeName = buildPlaceLabel(Array.isArray(results) ? results[0] : null);
        onChange({ ...coords, placeName });
      } catch {
        // No geocoder, no network, or an address the platform does not know.
        // The pin is already set, so this is not worth surfacing as an error.
        if (!mountedRef.current || token !== geocodeTokenRef.current) return;
        onChange({ ...coords, placeName: '' });
      } finally {
        if (mountedRef.current && token === geocodeTokenRef.current) setGeocoding(false);
      }
    },
    [onChange]
  );

  /** Ask for the foreground permission once per mount, quietly. */
  const ensurePermission = useCallback(async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (mountedRef.current && onError) onError('لم يتم منح إذن الوصول للموقع. يمكنك تحديد الموقع يدوياً على الخريطة.');
      return false;
    }
    return true;
  }, [onError]);

  const locateMe = useCallback(async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    try {
      if (!(await ensurePermission())) return;

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;

      const { latitude, longitude } = position.coords;
      await placePin(latitude, longitude);
    } catch (err) {
      if (mountedRef.current && onError) {
        onError('تعذر تحديد موقعك الحالي. تأكد من تفعيل خدمة الموقع ثم حاول مرة أخرى.');
      }
    } finally {
      locatingRef.current = false;
      if (mountedRef.current) setLocating(false);
    }
  }, [ensurePermission, placePin, onError]);

  // Offer the GPS fix up front on a NEW address, which is what most people want
  // and saves a trip through the map. Skipped when editing, so re-opening a form
  // never overrides a deliberately chosen pin.
  const offeredRef = useRef(false);
  useEffect(() => {
    if (hasPin || offeredRef.current) return;
    offeredRef.current = true;
    locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPin]);

  /** Dragging the marker, or tapping the map, both re-place the pin. */
  const handlePress = useCallback(
    (event) => {
      if (disabled) return;
      const { latitude, longitude } = event.nativeEvent.coordinate;
      placePin(latitude, longitude, { recenter: false });
    },
    [disabled, placePin]
  );

  const handleMarkerDrag = useCallback(
    (event) => {
      if (disabled) return;
      const { latitude, longitude } = event.nativeEvent.coordinate;
      placePin(latitude, longitude, { recenter: false });
    },
    [disabled, placePin]
  );

  /** Animate to the pin from the GPS button without re-asking for permission. */
  const recenter = useCallback(() => {
    if (!hasPin) return;
    const latDelta = Math.max(region.latitudeDelta || DEFAULT_REGION.latitudeDelta, 0.005);
    const lngDelta = Math.max(region.longitudeDelta || DEFAULT_REGION.longitudeDelta, 0.005);
    mapRef.current?.animateToRegion(
      { latitude: value.latitude, longitude: value.longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta },
      350
    );
  }, [hasPin, region.latitudeDelta, region.longitudeDelta, value]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapFrame}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={hasPin ? { ...value, latitudeDelta: 0.01, longitudeDelta: 0.01 } : DEFAULT_REGION}
          onMapReady={() => setMapReady(true)}
          onPress={handlePress}
          onRegionChangeComplete={setRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          scrollEnabled={!disabled}
          zoomEnabled={!disabled}
          pitchEnabled={false}
          rotateEnabled={false}
          mapType="standard"
        >
          {hasPin ? (
            <Marker
              coordinate={value}
              draggable={!disabled}
              onDragEnd={handleMarkerDrag}
              tracksViewChanges={false}
            />
          ) : null}
        </MapView>

        {!mapReady ? (
          <View style={styles.mapLoading} pointerEvents="none">
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null}

        <View style={styles.mapControls} pointerEvents="box-none">
          <Pressable
            onPress={locateMe}
            disabled={locating || disabled}
            accessibilityRole="button"
            accessibilityLabel="استخدم موقعي الحالي"
            style={({ pressed }) => [styles.mapBtn, pressed && styles.mapBtnPressed, (locating || disabled) && styles.mapBtnDisabled]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <Icon name="locate" size={20} color={Colors.onPrimary} />
            )}
          </Pressable>

          {hasPin ? (
            <Pressable
              onPress={recenter}
              accessibilityRole="button"
              accessibilityLabel="عرض الموقع المحدد"
              style={({ pressed }) => [styles.mapBtn, styles.mapBtnSmall, pressed && styles.mapBtnPressed]}
            >
              <Icon name="locate-outline" size={18} color={Colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Confirmation strip: the pin is only useful if the user can see that it
          was accepted, so this always reflects the current state. */}
      <View style={[styles.status, hasPin ? styles.statusSet : styles.statusEmpty]}>
        {geocoding ? (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.statusSpinner} />
        ) : (
          <Icon
            name={hasPin ? 'location' : 'location-outline'}
            size={16}
            color={hasPin ? Colors.success : Colors.textMuted}
          />
        )}

        <View style={styles.statusTextWrap}>
          {geocoding ? (
            <Text style={styles.statusTitle}>جارٍ تحديد وصف الموقع...</Text>
          ) : hasPin ? (
            <>
              <Text style={styles.statusTitle} numberOfLines={1}>
                {value.placeName || 'تم تحديد الموقع'}
              </Text>
              <Text style={styles.statusSub}>
                {`${formatCoordsForDisplay(value)}  •  اسحب المؤشر أو اضغط على الخريطة للتعديل`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.statusTitleMuted}>لم يتم تحديد الموقع بعد</Text>
              <Text style={styles.statusSubMuted}>
                اضغط على الخريطة أو اسحب المؤشر لاختيار موقع التسليم
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  mapFrame: {
    height: MAP_HEIGHT,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainer,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    left: 10,
    gap: 8,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnSmall: {
    width: 38,
    height: 38,
  },
  mapBtnPressed: {
    backgroundColor: Colors.primaryPress,
  },
  mapBtnDisabled: {
    opacity: 0.6,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  statusSet: {
    backgroundColor: Colors.successContainer,
    borderColor: Colors.success,
  },
  statusEmpty: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outlineVariant,
  },
  statusSpinner: {
    marginTop: 2,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSuccess,
  },
  statusTitleMuted: {
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textMuted,
  },
  statusSub: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSuccess,
    opacity: 0.85,
    marginTop: 2,
    textAlign: 'left',
  },
  statusSubMuted: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
