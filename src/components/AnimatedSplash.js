import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Radius, Spacing } from '../theme/spacing';

/**
 * AnimatedSplash — the full-bleed launch screen.
 *
 * Why this is drawn by us and not left to the OS: from Android 12 the platform
 * *will not* show a full-screen splash image. It renders the app icon centred on
 * a flat colour and drops everything else, so an image configured in app.json is
 * cropped into a small logo on that platform. The only way to get artwork edge to
 * edge is to keep the native splash open with `preventAutoHideAsync()`, paint the
 * same artwork underneath it in JS, and reveal that instead.
 *
 * The animation deliberately moves the *artwork* rather than drawing new elements
 * on top of it. A logo or title baked into the image cannot be detected from here,
 * so anything added on top risks stacking a second one on top of the first; moving
 * and lighting the artwork is safe whatever it contains.
 *
 * Three motions, all on the native driver:
 *   - entrance: the artwork settles from a slight zoom while fading up
 *   - ambient: a slow pulse behind the art, and a sheen that crosses it once
 *     every few seconds. Both loop, both `yoyo`, so there is no visible seam.
 *   - exit: fade with a small push forward, so the app appears to come out of
 *     the splash rather than being cross-faded with it.
 *
 * The minimum-visible floor matters more than it looks. The splash is held until
 * the fonts and the stored session are both ready, and on a warm start that can
 * be a few dozen milliseconds — enough for the entrance to be cut off mid-zoom,
 * which reads as a stutter rather than as an animation.
 */

const MIN_VISIBLE_MS = 700;
const ENTER_MS = 620;
const EXIT_MS = 420;
const SHEEN_WIDTH = 260;
const AMBIENT_MS = 2600;

/**
 * The artwork's own top and bottom rows, sampled from the file: `#FFFFFF` along
 * the top edge and `#E7F6EC` along the bottom, with the left and right edges
 * identical at every height. That last part is what makes an exact fit possible.
 *
 * The image is drawn with `contain`, so the whole artwork is always visible and
 * is never cropped — on a screen taller than the artwork's 1284x2778 there is a
 * band left over, and this gradient is what fills it. Because the two colours are
 * a pixel-match of the artwork's own vertical fade, the band is indistinguishable
 * from the image: there is no visible line where the picture stops.
 *
 * Re-sample these if the artwork is ever replaced.
 */
const ART_TOP = '#FFFFFF';
const ART_BOTTOM = '#E7F6EC';

export default function AnimatedSplash({ visible, artwork, onHidden }) {
  const [mounted, setMounted] = useState(true);

  // Entrance
  const fade = useRef(new Animated.Value(0)).current;
  const artScale = useRef(new Animated.Value(1.1)).current;

  // Ambient
  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const sheenX = useRef(new Animated.Value(0)).current;

  // Exit
  const exitFade = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  const mountedAt = useRef(Date.now());
  const exitTimer = useRef(null);
  const loops = useRef([]);

  const stopLoops = () => {
    loops.current.forEach((l) => l.stop());
    loops.current = [];
  };

  // Entrance, once per mount.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(artScale, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Started after the entrance so the first sweep does not fire into a fade-in
    // and read as a glitch.
    const sheen = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(sheenX, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.12,
          duration: AMBIENT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.9,
          duration: AMBIENT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loops.current = [sheen, pulse];
    sheen.start();
    pulse.start();

    return () => {
      stopLoops();
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [fade, artScale, glowOpacity, glowScale, sheenX]);

  // Exit, gated on the minimum-visible floor.
  useEffect(() => {
    if (!visible) return undefined;

    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    exitTimer.current = setTimeout(() => {
      stopLoops();
      Animated.parallel([
        Animated.timing(exitFade, {
          toValue: 0,
          duration: EXIT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.04,
          duration: EXIT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setMounted(false);
        if (onHidden) onHidden();
      });
    }, wait);

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [visible, exitFade, exitScale, onHidden]);

  if (!mounted) return null;

  // The sweep travels from just off the left edge to just off the right, so it is
  // a diagonal band rather than a full-width wash — a full-width one reads as the
  // screen flickering rather than as light moving across a surface.
  const sheenTranslate = sheenX.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHEEN_WIDTH * 2, SHEEN_WIDTH * 2],
  });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: exitFade }]}>
      {/* Backdrop first, unscaled, so it always reaches the screen edges however
          the artwork is letterboxed inside it. */}
      <LinearGradient
        colors={[ART_TOP, ART_BOTTOM]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ scale: exitScale }, { scale: artScale }],
          },
        ]}
      >
        {/* `contain`, not `cover`: `cover` would crop the artwork to fill, which
            is the opposite of showing it exactly as designed. */}
        <Animated.Image
          source={artwork}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          // Kept slightly under 1 until the entrance lifts it, so the art never
          // flashes at full opacity against the white window behind it.
          opacity={fade}
        />
      </Animated.View>

      {/* A warm glow that breathes behind the art. Kept low: the artwork is a light
          white-to-mint field, and a strong amber wash over it stops reading as
          light and starts reading as a colour cast. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { opacity: Animated.multiply(glowOpacity, 0.3), transform: [{ scale: glowScale }] },
        ]}
      >
        <LinearGradient
          colors={['rgba(249, 115, 22, 0.5)', 'rgba(249, 115, 22, 0)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.sheenWrap, { opacity: fade, transform: [{ translateX: sheenTranslate }, { rotate: '18deg' }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          style={styles.sheen}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>

      {/* The splash is held open while fonts and the stored session resolve, so
          this says so: a spinner with no explanation reads as a hung app. */}
      <SafeAreaView pointerEvents="none" style={styles.footer}>
        <View style={styles.busy}>
          <ActivityIndicator size="small" color={Colors.onPrimary} />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    left: '-35%',
    right: '-35%',
    top: '-15%',
    bottom: '-15%',
  },
  sheenWrap: {
    position: 'absolute',
    top: '-30%',
    bottom: '-30%',
    left: 0,
    right: 0,
  },
  sheen: {
    width: SHEEN_WIDTH,
    flex: 1,
  },
  footer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Spacing.xxxl,
  },
  busy: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(11, 18, 32, 0.35)',
  },
});