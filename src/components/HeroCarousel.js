import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import ProductImage from './ProductImage';
import { Colors } from '../theme/colors';
import { Radius, Shadows } from '../theme/spacing';

/** How long a banner stays on screen before the next one slides in. */
const AUTOPLAY_MS = 5000;

/**
 * Banner shape as width / height.
 *
 * 2.0 (1200x600) is the ratio `Webshop Settings` recommends next to the table.
 * The frame is fixed and the photo is `cover`-cropped into it, so a carousel
 * that mixes uploads of different sizes still finds one row of page-aligned
 * slides instead of a hero whose height jumps as each banner comes round.
 */
const BANNER_ASPECT = 2.0;

/** Gap between the banner and the screen edge — the static hero's own gutter. */
const GUTTER = 16;

/** Widest a banner ever gets, so a desktop window gets a band, not a poster. */
const MAX_BANNER_WIDTH = 960;

/** Read out for a banner the merchant left untitled. */
const AD_LABEL = 'إعلان';

/**
 * HeroCarousel — the merchant's advertising banners, in the home hero.
 *
 * Manual swiping and autoplay with no dependency: `pagingEnabled` provides the
 * snap-to-page behaviour and the timer simply asks for the next page. A banner
 * may open a product, an item group or an external link; one with no target is
 * still shown, just not pressable.
 *
 * ## The web/RTL trap, and why the track is forced LTR
 *
 * In an RTL document a browser's `scrollLeft` counts *backwards*: the start of
 * the track is `0` and going forward means going **negative**. React Native
 * Web's `scrollTo` writes a positive offset, which an RTL container clamps to
 * `0` — so the carousel silently refused to move. Dragging still worked,
 * because the browser handles a pointer drag itself, and switching the site to
 * English worked, because the container became LTR. That was the whole bug.
 *
 * The fix is to make the *track* LTR on the web build. The banner is a picture
 * in a fixed-width frame, so the slide order inside it does not affect the
 * page layout, and the dots are moved into the same LTR frame so the active
 * dot keeps pointing at the visible banner.
 *
 * ## The rest of the load-bearing details
 *
 *   1. The current page is read back from the scroll offset (`onScroll`), not
 *      from what the timer asked for, so the dots can never disagree with the
 *      banner on screen — on any platform, and whether the move came from the
 *      timer or from a finger.
 *   2. A drag pauses the timer and the end of the gesture restarts it, so a
 *      banner is never yanked out from under a finger.
 *   3. Nothing runs while the screen is blurred or the app is in the
 *      background, so an off-screen carousel is not a five-second timer burning
 *      battery behind a product page.
 *   4. Reduced motion turns autoplay off entirely. Swiping still works.
 *   5. The next two banners are fetched in the background while the current
 *      one is on screen, so a rotation never reveals an empty frame, and a
 *      banner that cannot be fetched falls back to a neutral placeholder
 *      instead of a spinner that never resolves.
 */
export default function HeroCarousel({ ads, onPressAd }) {
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const isWeb = Platform.OS === 'web';

  const scrollRef = useRef(null);
  // Held in a ref as well as in state: the autoplay timer reads the current
  // page, but must not be torn down and rebuilt every time the page changes, or
  // the interval would restart at zero before it could ever fire.
  const indexRef = useRef(0);

  /*
   * The banner's width, capped and centred.
   *
   * Measured from the full-width block rather than derived from the window: the
   * desktop shell and the window are not always the same width, and a phone in
   * landscape is not either. The window value is the first guess, so the very
   * first frame cannot render a zero-width banner; `onLayout` then corrects it.
   * The cap is applied here rather than with a `maxWidth` on the measured view,
   * because an auto-sized node would otherwise take its width from the slides
   * (n * banner) and overflow the screen.
   */
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const available = measuredWidth > 0 ? measuredWidth : windowWidth;
  const width = Math.max(240, Math.min(available - GUTTER * 2, MAX_BANNER_WIDTH));
  const height = Math.round(width / BANNER_ASPECT);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(!!enabled);
      })
      .catch(() => {
        // A platform without the query (or a denied one) means "no preference",
        // and autoplay is the default, so nothing to do.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) =>
      setReduceMotion(!!enabled)
    );

    return () => {
      mounted = false;
      if (subscription && typeof subscription.remove === 'function') subscription.remove();
    };
  }, []);

  /**
   * Move to a page.
   *
   * `animated` is false for the corrective moves (a new banner list, a width
   * change), where an animated scroll would show the shopper sliding through
   * banners nobody asked for.
   */
  const goTo = useCallback(
    (next, animated = true) => {
      const count = ads.length;
      if (!count || width <= 0) return;

      const target = ((Math.round(next) % count) + count) % count;
      indexRef.current = target;
      setIndex(target);

      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: target * width, y: 0, animated });
      }
    },
    [ads.length, width]
  );

  /**
   * The page the track is actually showing, read from the offset.
   *
   * The absolute value normalises the two conventions in play: an LTR web
   * container reports a positive offset, an RTL native one may report it
   * mirrored. Either way the magnitude is the distance from the first page.
   */
  const syncIndexFromOffset = useCallback(
    (offsetX) => {
      if (width <= 0 || !ads.length) return;
      const raw = Math.abs(offsetX) / width;
      const next = Math.min(Math.max(Math.round(raw), 0), ads.length - 1);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    },
    [ads.length, width]
  );

  // Autoplay. Skipped for a single banner, which needs no rotation, and for a
  // page the shopper is not looking at.
  useEffect(() => {
    if (!isFocused || dragging || reduceMotion || ads.length < 2) return undefined;
    const timer = setInterval(() => {
      goTo(indexRef.current + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [ads.length, dragging, goTo, isFocused, reduceMotion]);

  // A new banner list, or a width correction from `onLayout`, re-aligns page 0
  // to the viewport instead of leaving the track at a stale offset.
  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    if (scrollRef.current) scrollRef.current.scrollTo({ x: 0, y: 0, animated: false });
  }, [ads.length, width]);

  const handleScroll = useCallback(
    (event) => {
      const offset = event && event.nativeEvent && event.nativeEvent.contentOffset;
      if (offset && typeof offset.x === 'number') syncIndexFromOffset(offset.x);
    },
    [syncIndexFromOffset]
  );

  const handleMomentumEnd = useCallback(
    (event) => {
      setDragging(false);
      const offset = event && event.nativeEvent && event.nativeEvent.contentOffset;
      if (offset && typeof offset.x === 'number') syncIndexFromOffset(offset.x);
    },
    [syncIndexFromOffset]
  );

  /**
   * The banners to fetch ahead of time.
   *
   * The next two are enough: one is the slide the shopper is about to see, the
   * one after it is what the rotation will reach while this one is still on
   * screen. Fetching them as ordinary images puts them in the browser's cache,
   * so the swap is instant instead of a frame of empty box.
   */
  const preload = useMemo(() => {
    if (!ads.length) return [];
    const out = [];
    for (let step = 1; step <= 2; step += 1) {
      const ad = ads[(index + step) % ads.length];
      if (ad && ad.image) out.push(ad.image);
    }
    return out;
  }, [ads, index]);

  function renderSlide(ad, i) {
    const key = `${ad.image}-${i}`;
    const slideStyle = [styles.slide, { width, height }];
    const image = (
      <ProductImage
        source={ad.image}
        style={styles.slideImage}
        resizeMode="cover"
        fallbackIcon="image-outline"
        fallbackIconSize={30}
      />
    );

    if (!ad.itemCode && !ad.itemGroup && !ad.url) {
      return (
        <View
          key={key}
          style={slideStyle}
          accessibilityRole="image"
          accessibilityLabel={ad.title || AD_LABEL}
        >
          {image}
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.9}
        onPress={() => onPressAd && onPressAd(ad)}
        style={slideStyle}
        accessibilityRole="button"
        accessibilityLabel={ad.title || AD_LABEL}
      >
        {image}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={styles.block}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {/* The rounded, clipping frame is a separate view from the one carrying
          the shadow: on iOS a single view with `overflow: hidden` loses its
          shadow entirely. */}
      <View style={[styles.shadow, { width }]}>
        {/* `direction: 'ltr'` on the web build only. See the note at the top of
            this file: an RTL scroll container refuses a positive `scrollTo`,
            which is what stopped the carousel from ever moving. The frame holds
            the track *and* the dots, so both agree on which direction "next" is. */}
        <View style={[styles.frame, isWeb && styles.frameLTR]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => setDragging(true)}
            onScrollEndDrag={() => setDragging(false)}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumEnd}
            style={{ height }}
            contentContainerStyle={isWeb ? styles.trackLTR : undefined}
          >
            {ads.map(renderSlide)}
          </ScrollView>

          {ads.length > 1 ? (
            <View style={styles.dotsLayer} pointerEvents="none">
              <View style={styles.dotsPill}>
                {ads.map((ad, i) => (
                  <View
                    key={`${ad.image}-dot-${i}`}
                    style={[styles.dot, i === index && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/*
            Warm the cache for the next banners. These are real images at 1x1,
            absolutely positioned and invisible: the browser fetches and decodes
            them, so the rotation never uncovers an empty frame.
          */}
          {preload.map((uri) => (
            <Image key={`preload-${uri}`} source={{ uri }} style={styles.preload} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: GUTTER,
  },
  shadow: {
    alignSelf: 'center',
    borderRadius: Radius.xxl,
    ...Shadows.md,
  },
  frame: {
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerLow,
  },
  // The web track counts forwards. Applied to the frame so the slides and the
  // dots share one direction and cannot disagree about which banner is active.
  frameLTR: {
    direction: 'ltr',
  },
  trackLTR: {
    direction: 'ltr',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  dotsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  dotsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    // A scrim, because banner artwork is usually light and the dots sit on top
    // of whatever the merchant uploaded.
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#ffffff',
  },
  preload: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
