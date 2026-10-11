import { Platform } from 'react-native';

/**
 * Cairo — modern geometric Arabic + Latin typeface (bundled via @expo-google-fonts).
 * Weights map to explicit font files so RTL text renders crisply everywhere.
 */
const font = (name) => Platform.select({ ios: name, android: name, default: name });

export const Fonts = {
  regular: font('Cairo_400Regular'),
  medium: font('Cairo_500Medium'),
  semibold: font('Cairo_600SemiBold'),
  bold: font('Cairo_700Bold'),
  extrabold: font('Cairo_800ExtraBold'),
};

export const Typography = {
  fontFamily: Fonts.regular,
  fontFamilyRegular: Fonts.regular,
  fontFamilyMedium: Fonts.medium,
  fontFamilySemiBold: Fonts.semibold,
  fontFamilyBold: Fonts.bold,
  fontFamilyExtraBold: Fonts.extrabold,

  // Font Sizes
  sizes: {
    displayLg: 34,
    headlineLg: 26,
    headlineMd: 21,
    headlineSm: 18,
    titleLg: 17,
    titleMd: 16,
    titleSm: 14,
    bodyLg: 16,
    bodyMd: 14,
    bodySm: 12,
    labelLg: 13,
    labelMd: 12,
    labelSm: 11,
    priceLg: 24,
    priceMd: 19,
  },

  // Line Heights — paired with sizes for consistent vertical rhythm in Arabic text
  lineHeights: {
    displayLg: 44,
    headlineLg: 36,
    headlineMd: 30,
    headlineSm: 26,
    titleLg: 24,
    titleMd: 23,
    titleSm: 21,
    bodyLg: 24,
    bodyMd: 22,
    bodySm: 18,
    labelLg: 18,
    labelMd: 17,
    labelSm: 16,
    priceLg: 32,
    priceMd: 26,
  },

  // Letter Spacing — Arabic benefits from slightly looser tracking at small sizes
  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.2,
    wider: 0.4,
  },

  // Font Weights (used as fallback when a specific font file is unnecessary)
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // ─── Semantic Presets ───────────────────────────────────────────────────
  // Use these instead of assembling fontSize + fontFamily + lineHeight ad-hoc.
  heading: {
    lg: { fontSize: 26, lineHeight: 36, fontFamily: Fonts.extrabold },
    md: { fontSize: 21, lineHeight: 30, fontFamily: Fonts.extrabold },
    sm: { fontSize: 18, lineHeight: 26, fontFamily: Fonts.extrabold },
  },
  title: {
    lg: { fontSize: 17, lineHeight: 24, fontFamily: Fonts.bold },
    md: { fontSize: 16, lineHeight: 23, fontFamily: Fonts.bold },
    sm: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.semibold },
  },
  body: {
    lg: { fontSize: 16, lineHeight: 24, fontFamily: Fonts.regular },
    md: { fontSize: 14, lineHeight: 22, fontFamily: Fonts.regular },
    sm: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular },
  },
  label: {
    lg: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.semibold },
    md: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.medium },
    sm: { fontSize: 11, lineHeight: 16, fontFamily: Fonts.medium },
  },
  price: {
    lg: { fontSize: 24, lineHeight: 32, fontFamily: Fonts.extrabold },
    md: { fontSize: 19, lineHeight: 26, fontFamily: Fonts.extrabold },
  },
};

export default Typography;