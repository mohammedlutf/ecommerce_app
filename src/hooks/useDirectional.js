import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useI18n } from '../i18n/I18nContext';

/**
 * Direction-aware style helpers.
 *
 * ## Why this exists
 *
 * Setting `dir="rtl"` on `<html>` makes CSS flip *flexbox ordering* — so a plain
 * `flexDirection: 'row'` already lays out right-to-left on web, and
 * `I18nManager.forceRTL` does the same on native. Neither flips **physical**
 * properties: `marginLeft`, `right: 8`, `borderTopLeftRadius` and
 * `textAlign: 'right'` all mean the same thing in both directions.
 *
 * That is the actual source of RTL bugs in this codebase. `marginLeft: 12`
 * beside a row that has just reversed puts the gap on the wrong side, and it
 * looks correct in English while being visibly broken in Arabic.
 *
 * The fix is to use **logical** properties — `marginStart`, `marginEnd`, `start`,
 * `end`, `textAlign: 'start'` — which react-native-web maps to CSS
 * `margin-inline-*` / `inset-inline-*` and React Native maps through
 * `I18nManager`. Both engines then resolve them from the current direction, so
 * one stylesheet serves both languages with no branching.
 *
 * Prefer these over `marginLeft`/`marginRight` in anything new. Where an
 * existing physical property genuinely means "the visual left/right edge"
 * (a back arrow, a chevron, a progress bar), keep it physical deliberately.
 *
 * @returns {{
 *   isRTL: boolean,
 *   dir: 'rtl'|'ltr',
 *   textStart: object,
 *   textEnd: object,
 *   row: object,
 *   marginStart: (n: number) => object,
 *   marginEnd: (n: number) => object,
 *   paddingStart: (n: number) => object,
 *   paddingEnd: (n: number) => object,
 *   insetStart: (n: number) => object,
 *   insetEnd: (n: number) => object,
 *   borderStart: (n: number) => object,
 *   borderEnd: (n: number) => object,
 *   alignStart: object,
 * }}
 */
export default function useDirectional() {
  let isRTL = false;
  let dir = 'ltr';
  try {
    const i18n = useI18n();
    isRTL = i18n?.isRTL || false;
    dir = i18n?.dir || (isRTL ? 'rtl' : 'ltr');
  } catch {
    isRTL = false;
    dir = 'ltr';
  }

  /**
   * The direction text *aligns* to, which on native is deliberately not the
   * locale's.
   *
   * The mobile build is a left-to-right interface even in Arabic: copy is meant
   * to start from the left edge regardless of the language it is written in.
   * Only alignment is affected. `writingDirection` below still follows the
   * locale, so Arabic runs are still ordered by the bidi algorithm instead of
   * being naively reversed character by character — that is the difference
   * between "aligned left" and "Arabic rendered wrong".
   *
   * Web is excluded on purpose: there `dir="rtl"` on `<html>` is what the browser
   * honours, and the whole stylesheet is already written to mirror around it, so
   * forcing left there would fight the user agent rather than express a design
   * decision.
   */
  const textIsRTL = Platform.OS === 'web' && isRTL;

  return useMemo(
    () => ({
      isRTL,
      dir,

/**
       * A row that does **not** flip with the writing direction.
       *
       * Under `dir="rtl"` (web) or `I18nManager.isRTL` (native) a plain `row`
       * reverses its visual order, so a source order of `[icon][text]` renders as
       * icon-on-the-right / text-on-the-left. For an icon-and-copy pair that is
       * the wrong shape: the copy has to stay on the leading edge and the icon
       * beside it, which means cancelling the flip with `row-reverse`.
       *
       * Use this only where the icon should stay visually first in *both*
       * languages. Rows that mirror a reading order — a list, a card header whose
       * trailing action belongs on the opposite side — want plain `row`.
       */
      rowFixed: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' },

      /**
       * Plain `row`: follows the inline axis, so it mirrors with the language.
       */
      row: { flexDirection: 'row', alignItems: 'center' },

/**
       * `textAlign: 'start'` is valid CSS but *not* a value React Native
       * accepts on device (native takes left/right/center/auto only), so it has
       * to be resolved here rather than handed to the style object. Everything
       * else in this hook stays logical because react-native-web translates it
       * to CSS logical properties and native translates it via I18nManager.
       *
       * `writingDirection` tells the native text layout engine which paragraph
       * direction to use for the bidi algorithm. Without it, mixed
       * Arabic/Latin runs can reorder incorrectly even when textAlign is set —
       * which is why it still follows `isRTL` while `textAlign` follows
       * `textIsRTL`.
       */
      textStart: { textAlign: textIsRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
      textEnd: { textAlign: textIsRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' },

      /*
       * `marginStart`/`paddingStart` and friends are also logical-only.
       * react-native-web ships the translation table for them, but only applies
       * it when an app registers `StyleSheet.setStyleSheetPreprocessor`, which
       * nothing here does — so they compile to nothing and the property is
       * silently dropped, in *both* languages. Resolving against `isRTL` keeps
       * one stylesheet correct on native and web without depending on that
       * opt-in step.
       */
      marginStart: (n) => (isRTL ? { marginRight: n } : { marginLeft: n }),
      marginEnd: (n) => (isRTL ? { marginLeft: n } : { marginRight: n }),
      paddingStart: (n) => (isRTL ? { paddingRight: n } : { paddingLeft: n }),
      paddingEnd: (n) => (isRTL ? { paddingLeft: n } : { paddingRight: n }),

      /**
       * Absolute positioning that follows the writing direction, for the same
       * reason: `start`/`end` are logical-only and dropped on web without the
       * preprocessor.
       */
      insetStart: (n) => (isRTL ? { right: n } : { left: n }),
      insetEnd: (n) => (isRTL ? { left: n } : { right: n }),

      borderStart: (n) => (isRTL ? { borderRightWidth: n } : { borderLeftWidth: n }),
      borderEnd: (n) => (isRTL ? { borderLeftWidth: n } : { borderRightWidth: n }),

      /**
       * `alignSelf: 'flex-start'` hugs the cross-axis leading edge. Like
       * `flex-start` it is resolved by Yoga against the *layout* direction on
       * native, but resolving it here keeps it tied to the active locale rather
       * than to the boot-time `I18nManager` flag.
       */
alignStart: isRTL ? { alignSelf: 'flex-end' } : {},
    }),
    [isRTL, dir, textIsRTL]
  );
}