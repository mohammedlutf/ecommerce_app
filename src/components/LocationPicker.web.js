import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import * as ExpoLocation from 'expo-location';
import Icon from './Icon';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius } from '../theme/spacing';
import { DEFAULT_REGION, buildPlaceLabel } from '../utils/geo';
import useDirectional from '../hooks/useDirectional';

const MAP_HEIGHT = 340;
const PIN_VIEW_ZOOM = 16;
const CDN_STYLE = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const CDN_SCRIPT = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

/**
 * Load Leaflet from a CDN exactly once per page.
 *
 * Web only, so this is deliberately *not* an npm dependency: adding `leaflet`
 * would pull a DOM-only library into the native Metro graph and require the
 * bundler to inline a stylesheet. Loading it at runtime keeps the native bundle
 * untouched and means a CDN outage degrades to the manual picker instead of
 * breaking the whole build.
 */
let leafletPromise = null;
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('no window'));
      return;
    }
    if (window.L) {
      resolve(window.L);
      return;
    }
    if (!document.querySelector(`link[href="${CDN_STYLE}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CDN_STYLE;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = CDN_SCRIPT;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('leaflet missing')));
    script.onerror = () => reject(new Error('could not load leaflet'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

/**
 * LocationPicker — web version.
 *
 * `react-native-maps` has no web renderer (it resolves to react-native-web's
 * `UnimplementedView`, i.e. a red "not implemented" box), so the map is Leaflet
 * with OpenStreetMap tiles. Same contract as the native picker: the pin is
 * authoritative, `onChange` reports `{ latitude, longitude, placeName }`, and
 * `placeName` is best-effort so a failed geocode never blocks picking a spot.
 *
 * If Leaflet cannot load, the manual coordinate inputs below still work — losing
 * the map must not cost the customer the ability to set a delivery address.
 */
export default function LocationPicker({ value, onChange, onError, disabled = false }) {
  const { textStart } = useDirectional();
  const { insetEnd } = useDirectional();
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [mapState, setMapState] = useState('loading'); // loading | ready | failed
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [hasPin, setHasPin] = useState(
    () => !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
  );
  const [manual, setManual] = useState({ lat: '', lng: '' });

  // Reverse-geocode token: a slow geocode for an old point must not land after a
  // newer one and label the wrong pin.
  const geocodeTokenRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const placePin = useCallback(
    async (latitude, longitude) => {
      const coords = {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
      };
      setHasPin(true);
      setManual({ lat: String(coords.latitude), lng: String(coords.longitude) });
      onChangeRef.current({ ...coords, placeName: '' });

      const token = ++geocodeTokenRef.current;
      setGeocoding(true);
      try {
        const results = await ExpoLocation.reverseGeocodeAsync(coords);
        if (!mountedRef.current || token !== geocodeTokenRef.current) return;
        onChangeRef.current({ ...coords, placeName: buildPlaceLabel(results && results[0]) });
      } catch {
        if (!mountedRef.current || token !== geocodeTokenRef.current) return;
        onChangeRef.current({ ...coords, placeName: '' });
      } finally {
        if (mountedRef.current && token === geocodeTokenRef.current) setGeocoding(false);
      }
    },
    []
  );

  // Build the map once the host element exists.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !hostRef.current || mapRef.current) return;

        const start = hasPin
          ? [value.latitude, value.longitude]
          : [DEFAULT_REGION.latitude, DEFAULT_REGION.longitude];

        const map = L.map(hostRef.current, {
          center: start,
          zoom: hasPin ? PIN_VIEW_ZOOM : 12,
          zoomControl: true,
          attributionControl: true,
        });
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        const icon = L.divIcon({
          className: '',
          html: '<div style="width:18px;height:18px;border-radius:50%;background:#F97316;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker(start, { icon, draggable: true }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          placePin(pos.lat, pos.lng);
        });

        map.on('click', (event) => {
          if (disabled) return;
          marker.setLatLng(event.latlng);
          placePin(event.latlng.lat, event.latlng.lng);
        });

        setMapState('ready');
      })
      .catch(() => {
        if (!cancelled) setMapState('failed');
      });

    return () => {
      cancelled = true;
      // Leaflet leaks its listeners and DOM if the map is not torn down when the
      // picker unmounts, so the instance is destroyed explicitly.
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Mount-only: the map is created once and then driven imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centre on a pin that arrived from outside, e.g. a saved address the form
  // seeded after mount.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !hasPin) return;
    const pos = [value.latitude, value.longitude];
    markerRef.current.setLatLng(pos);
    mapRef.current.setView(pos, PIN_VIEW_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPin]);

  const locateMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mountedRef.current && onError) {
          onError('Location permission was not granted. You can pick a spot on the map instead.');
        }
        return;
      }
      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;
      const { latitude, longitude } = position.coords;
      if (mapRef.current) mapRef.current.setView([latitude, longitude], PIN_VIEW_ZOOM);
      if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
      await placePin(latitude, longitude);
    } catch (err) {
      if (mountedRef.current && onError) {
        onError('Could not determine your location. Please enable location services and retry.');
      }
    } finally {
      if (mountedRef.current) setLocating(false);
    }
  }, [locating, onError, placePin]);

  const applyManual = useCallback(() => {
    const lat = parseFloat(manual.lat);
    const lng = parseFloat(manual.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (mapRef.current) mapRef.current.setView([lat, lng], PIN_VIEW_ZOOM);
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    placePin(lat, lng);
  }, [manual, placePin]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapFrame}>
        <View ref={hostRef} style={styles.map} />

        {mapState === 'loading' ? (
          <View style={styles.mapOverlay} pointerEvents="none">
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null}

        {mapState === 'failed' ? (
          <View style={styles.mapFallback}>
            <Icon name="map-outline" size={26} color={Colors.textMuted} />
            <Text style={styles.mapFallbackText}>
              Could not load the map. Enter the coordinates below instead.
            </Text>
          </View>
        ) : null}

        {geocoding ? (
          <View style={[styles.geocodeBadge, insetEnd(8)]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : null}
      </View>

      <Pressable
        disabled={disabled || locating}
        onPress={locateMe}
        style={({ pressed }) => [styles.locateRow, pressed && styles.pressed]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Icon name="locate" size={18} color={Colors.primary} />
        )}
        <Text style={[styles.locateText, textStart]}>
          {locating ? 'Finding your location...' : 'Use my current location'}
        </Text>
      </Pressable>

      {mapState === 'failed' ? (
        <View style={styles.manualRow}>
          <View style={styles.manualField}>
            <Text style={[styles.manualLabel, textStart]}>Latitude</Text>
            <TextInput
              value={manual.lat}
              onChangeText={(lat) => setManual((m) => ({ ...m, lat }))}
              placeholder="15.3694"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={styles.manualInput}
            />
          </View>
          <View style={styles.manualField}>
            <Text style={[styles.manualLabel, textStart]}>Longitude</Text>
            <TextInput
              value={manual.lng}
              onChangeText={(lng) => setManual((m) => ({ ...m, lng }))}
              placeholder="49.1233"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={styles.manualInput}
            />
          </View>
          <Pressable onPress={applyManual} style={styles.manualApply}>
            <Text style={[styles.manualApplyText, textStart]}>Set</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  mapFrame: {
    height: MAP_HEIGHT,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
  },
  mapFallbackText: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.textMuted,
    textAlign: 'center',
    fontFamily: Typography.fontFamilyRegular,
  },
  geocodeBadge: {
    position: 'absolute',
    top: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 6,
    elevation: 2,
  },
  locateRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryContainer,
  },
  locateText: {
    flex: 1,
    fontSize: Typography.sizes.labelLg,
    color: Colors.onPrimaryContainer,
    fontFamily: Typography.fontFamilySemiBold,
  },
  pressed: { opacity: 0.7 },
  manualRow: { marginTop: 10, gap: 8 },
  manualField: { gap: 4 },
  manualLabel: {
    fontSize: Typography.sizes.labelSm,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: Typography.sizes.bodyMd,
    color: Colors.onSurface,
    backgroundColor: Colors.surface,
    fontFamily: Typography.fontFamilyRegular,
  },
  manualApply: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualApplyText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: Typography.sizes.labelLg,
  },
});