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

  // Font Weights (used as fallback when a specific font file is unnecessary)
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

export default Typography;