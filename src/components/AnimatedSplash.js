import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
 * Timing is anchored to the *reveal*, not to this component's mount: the OS
 * splash is what the user sees until App.js drops it, so a floor measured from
 * mount would be spent looking at the OS's square icon rather than at the
 * artwork. Two gates therefore decide when the exit starts — `revealed` (the
 * artwork owns the screen) and `visible` (fonts, session and onboarding are all
 * resolved) — and neither may fire the exit on its own.
 */

const MIN_VISIBLE_MS = 700;
const ENTER_MS = 620;
const EXIT_MS = 420;
// Grace after `ready` before the fade begins. `ready` only means the state has
// flipped; the navigator still needs a few frames to lay out and paint behind
// the opaque artwork, otherwise the fade reveals a half-composed screen.
const SETTLE_MS = 300;
const SHEEN_WIDTH = 260;
const AMBIENT_MS = 2600;

/**
 * The artwork's own top and bottom rows, sampled from the file: `#FFFFFF` along
 * the top edge and `#E7F6EC` along the bottom, with the left and right edges
 * identical at every height.
 *
 * The image is drawn with `cover`, so it fills the screen edge to edge exactly
 * as designed — no letterbox bands, no background colour showing around it.
 * Cropping is invisible by construction: the artwork's side edges are identical
 * at every height, so on a screen wider than the artwork only the matching
 * left/right edges are trimmed. The gradient below is what shows through that
 * first moment: the reveal is triggered by the bitmap's paint, so a frame where
 * the image has not landed yet still shows these exact edge colours rather than
 * the OS splash's flat white or the app underneath.
 *
 * Re-sample these if the artwork is ever replaced.
 */
const ART_TOP = '#FFFFFF';
const ART_BOTTOM = '#E7F6EC';

export default function AnimatedSplash({ visible, revealed, artwork, onPainted, onHidden }) {
  const [mounted, setMounted] = useState(true);
  // Flips once the artwork has been decoded *and* committed to a frame, which
  // is the earliest moment it is safe to drop the native splash.
  const [painted, setPainted] = useState(false);

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

  // When the artwork took over from the native splash, and when the app became
  // ready — the exit waits out both clocks.
  const revealedAt = useRef(null);
  const readyAt = useRef(null);
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

  // Hand the "you may go now" signal to App.js the moment the artwork is
  // actually on screen. Two frames after `onLoad` the bitmap has been through a
  // commit, so the reveal cannot land on a frame where only the backdrop below
  // it has been drawn.
  useEffect(() => {
    if (!painted || !onPainted) return;
    onPainted();
  }, [painted, onPainted]);

  // Exit, gated on the artwork owning the screen and on the app being ready.
  // Both stamps are taken in effects declared ahead of the exit effect, so when
  // the two flip in the same commit they are already recorded by the time the
  // exit effect reads them.
  useEffect(() => {
    if (revealed && revealedAt.current == null) revealedAt.current = Date.now();
  }, [revealed]);

  useEffect(() => {
    if (visible && readyAt.current == null) readyAt.current = Date.now();
  }, [visible]);

  useEffect(() => {
    if (!visible || !revealed) return undefined;

    const now = Date.now();
    const sinceReveal = revealedAt.current != null ? now - revealedAt.current : 0;
    const sinceReady = readyAt.current != null ? now - readyAt.current : 0;
    // Hold the artwork for the floor after the reveal, and never start the fade
    // until the freshly mounted navigator has had a moment to paint behind it.
    const wait = Math.max(MIN_VISIBLE_MS - sinceReveal, SETTLE_MS - sinceReady, 0);

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
  }, [visible, revealed, exitFade, exitScale, onHidden]);

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
      {/* Backdrop first, unscaled and opaque, in the artwork's own edge colours:
          a reveal that lands a frame before the bitmap is drawn still shows a
          white-to-mint field identical to the artwork's border rather than the
          app (or the OS splash's flat white) underneath. */}
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
        {/* `cover`, not `contain`: `contain` letterboxes the artwork against a
            backdrop colour, and the edges of that band are exactly what reads
            as "a background colour around the splash". `cover` fills the frame
            edge to edge (crop is invisible, see the artwork notes above). */}
        <Animated.Image
          source={artwork}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          // Kept under 1 until the entrance lifts it, so the art never flashes at
          // full opacity against the white window behind it.
          opacity={fade}
          // Two frames after the decode: this is what tells App.js it may drop
          // the native splash. A failed or missing `onLoad` is not fatal —
          // App.js falls back to revealing once the app is ready.
          onLoad={() => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setPainted(true))
            );
          }}
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
});