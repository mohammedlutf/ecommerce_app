import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows, Spacing } from '../../theme/spacing';
import { MAX_CONTENT_WIDTH } from '../../theme/responsive';

/**
 * Shared styles for the vendor and marketplace-management screens.
 *
 * These screens are back-office surfaces rather than storefront ones, but they
 * are built from the same tokens as the rest of the app so they read as part of
 * the same product: the same emerald, the same card radius, the same Cairo
 * weights and the same small, letter-spaced section headers the admin editor
 * uses.
 *
 * Keeping them here instead of copying a `StyleSheet.create` into every screen
 * is what stops the vendor dashboard and the vendor orders list from drifting
 * into two slightly different shades of "grey card".
 */
export const vendorStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /*
   * The body of a detail dialog on the web.
   *
   * The card it sits in is capped by `maxHeight`, so this frame has to be
   * allowed to shrink below its content — otherwise the form inside pushes
   * the card past the cap and the dialog runs off the bottom of the window
   * instead of scrolling.
   */
  dialogFill: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  // Caps the content column so a desktop window does not stretch a dashboard
  // into a very long line with the numbers pinned to opposite edges.
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  pageTitle: {
    fontSize: Typography.sizes.headlineMd,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.onSurface,
  },
  pageSubtitle: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.lg,
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  flex1: { flex: 1 },

  // --- Text ---------------------------------------------------------------
  label: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  hint: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  muted: {
    fontSize: Typography.sizes.bodySm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
  },
  value: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
  },
  strong: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  money: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyExtraBold,
    color: Colors.primary,
  },

  // --- Forms --------------------------------------------------------------
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  field: { marginBottom: Spacing.md },

  // --- Buttons ------------------------------------------------------------
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...Shadows.sm,
  },
  primaryBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dangerBtnText: {
    color: Colors.error,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallBtnText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },
  disabled: { opacity: 0.55 },

  // --- Badges -------------------------------------------------------------
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },

  // --- Lists --------------------------------------------------------------
  listItem: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: Spacing.md,
  },
  loadMoreBtn: {
    paddingVertical: 13,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    color: Colors.primary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilyBold,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  centreText: {
    fontSize: Typography.sizes.bodyMd,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'center',
  },
});

export default vendorStyles;
