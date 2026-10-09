import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

/**
 * AnimatedSplash — the full-bleed launch screen.
 *
 * Why this is drawn by us and not left to the OS: from Android 12 the platform
 * *will not* show a full-screen splash image. It renders the app icon centred on
 * a flat colour and drops everything else, so an image configured in app.json is
 * cropped into a small logo on that platform. The only way to keep the artwork
 * edge to edge is to hold the native splash open with `preventAutoHideAsync()`,
 * paint the same backdrop underneath it in JS and reveal that instead.
 *
 * The screen is a flat brand-colour field plus a Lottie animation
 * (`artwork`), which loops in place until the app is ready to take over. Two
 * motions, both on the native driver:
 *   - entrance: the animation fades up while settling from a slight zoom
 *   - exit: fade with a small push forward, so the app appears to come out of
 *     the splash rather than being cross-faded with it.
 *
 * Timing is anchored to the *reveal*, not to this component's mount: the OS
 * splash is what the user sees until App.js drops it, so a floor measured from
 * mount would be spent looking at the OS's flat colour rather than at the
 * animation. Two gates therefore decide when the exit starts — `revealed` (the
 * animation owns the screen) and `visible` (fonts, session and onboarding are
 * all resolved) — and neither may fire the exit on its own.
 */

const MIN_VISIBLE_MS = 700;
const ENTER_MS = 500;
const EXIT_MS = 420;
// Grace after `visible` before the fade begins. `visible` only means the state
// has flipped; the navigator still needs a few frames to lay out and paint
// behind the opaque backdrop, otherwise the fade reveals a half-composed screen.
const SETTLE_MS = 300;

// The backdrop's edge colours, matched to the app's primary/brand surface so a
// reveal that lands a frame before the Lottie is drawn still shows the right
// field rather than the OS splash's flat white or an empty frame.
const ART_TOP = '#FFFFFF';
const ART_BOTTOM = '#E7F6EC';

export default function AnimatedSplash({ visible, revealed, artwork, onPainted, onHidden }) {
  const [mounted, setMounted] = useState(true);
  // Flips once the animation has been loaded *and* committed to a frame, which
  // is the earliest moment it is safe to drop the native splash.
  const [painted, setPainted] = useState(false);

  // Entrance
  const fade = useRef(new Animated.Value(0)).current;
  const artScale = useRef(new Animated.Value(1.06)).current;

  // Exit
  const exitFade = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  // When the animation took over from the native splash, and when the app became
  // ready — the exit waits out both clocks.
  const revealedAt = useRef(null);
  const readyAt = useRef(null);
  const exitTimer = useRef(null);

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
    ]).start();

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [fade, artScale]);

  // Hand the "you may go now" signal to App.js the moment the animation is
  // actually on screen. Two frames after the Lottie signals it has loaded the
  // animation is through a commit, so the reveal cannot land on a frame where
  // only the backdrop below it has been drawn.
  useEffect(() => {
    if (!painted || !onPainted) return;
    onPainted();
  }, [painted, onPainted]);

  // Exit, gated on the animation owning the screen and on the app being ready.
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
    // Hold the animation for the floor after the reveal, and never start the
    // fade until the freshly mounted navigator has had a moment to paint behind
    // it.
    const wait = Math.max(MIN_VISIBLE_MS - sinceReveal, SETTLE_MS - sinceReady, 0);

    exitTimer.current = setTimeout(() => {
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

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: exitFade }]}>
      {/* Backdrop first, opaque, in the brand's own edge colours, so a reveal that
          lands a frame before the Lottie draws still shows the correct field
          rather than the app (or the OS splash's flat white) underneath. */}
      <LinearGradient
        colors={[ART_TOP, ART_BOTTOM]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View
        style={[
          styles.stage,
          {
            opacity: fade,
            transform: [{ scale: artScale }, { scale: exitScale }],
          },
        ]}
      >
        <LottieView
          source={artwork}
          autoPlay
          loop
          style={styles.animation}
          renderMode="HARDWARE"
          // The Lottie equivalent of the old artwork's `onLoad`: a failed or
          // missing load is not fatal — App.js falls back to revealing once the
          // app is ready.
          onAnimationLoaded={() => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setPainted(true))
            );
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: '78%',
    aspectRatio: 1,
    maxWidth: 380,
  },
});