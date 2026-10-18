import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
 * 2.4 (1200x500) is the ratio `Webshop Settings` recommends next to the table.
 * The frame is fixed and the photo is `cover`-cropped into it, so a carousel
 * that mixes uploads of different sizes still finds one row of page-aligned
 * slides instead of a hero whose height jumps as each banner comes round.
 */
const BANNER_ASPECT = 2.4;

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
 * Four details are load-bearing:
 *
 *   1. The current page is read back from the scroll offset
 *      (`onMomentumScrollEnd`) rather than trusting what the timer asked for.
 *      Under RTL the content is laid out right-to-left; the offset is the one
 *      value that means the same thing on every platform, so autoplay keeps
 *      advancing from wherever the shopper actually left it and the dots can
 *      never disagree with the banner on screen.
 *   2. A drag pauses the timer and the end of the gesture restarts it, so a
 *      banner is never yanked out from under a finger.
 *   3. Nothing runs while the screen is blurred or the app is in the
 *      background, so an off-screen carousel is not a five-second timer burning
 *      battery behind a product page.
 *   4. Reduced motion turns autoplay off entirely. Swiping still works.
 */
export default function HeroCarousel({ ads, onPressAd }) {
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();

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

  const goTo = useCallback(
    (next) => {
      indexRef.current = next;
      setIndex(next);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: next * width, y: 0, animated: true });
      }
    },
    [width]
  );

  // Autoplay. Skipped for a single banner, which needs no rotation, and for a
  // page the shopper is not looking at.
  useEffect(() => {
    if (!isFocused || dragging || reduceMotion || ads.length < 2) return undefined;
    const timer = setInterval(() => {
      goTo((indexRef.current + 1) % ads.length);
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

  const handleMomentumEnd = useCallback(
    (event) => {
      setDragging(false);
      if (width <= 0) return;
      const raw = event.nativeEvent.contentOffset.x / width;
      const last = Math.max(ads.length - 1, 0);
      const next = Math.min(Math.max(Math.round(raw), 0), last);
      indexRef.current = next;
      setIndex(next);
    },
    [ads.length, width]
  );

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
        <View style={styles.frame}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => setDragging(true)}
            onScrollEndDrag={() => setDragging(false)}
            onMomentumScrollEnd={handleMomentumEnd}
            style={{ height }}
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
});
