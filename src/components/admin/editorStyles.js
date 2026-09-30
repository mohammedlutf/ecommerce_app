import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Radius, Shadows, Spacing } from '../../theme/spacing';

/**
 * Styles for the admin product editor.
 *
 * Split out of the component because the sheet is large enough that the
 * component's real logic — the change diff, the UOM arithmetic, the validation
 * — gets lost at the bottom of a few hundred lines of `StyleSheet.create`.
 */
export default StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTitle: {
    fontSize: Typography.sizes.titleLg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'left',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },

  section: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  sectionHint: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'left',
  },

  /* Image ---------------------------------------------------------------- */
  imageFrame: {
    height: 170,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  imageBadgeText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyBold,
  },
  imageActions: { flexDirection: 'row', gap: Spacing.sm },
  imageAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  imageActionText: {
    color: Colors.primary,
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyBold,
  },

  /* Fields ---------------------------------------------------------------- */
  label: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
    textAlign: 'left',
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  inputError: { borderColor: Colors.error, borderWidth: 1.5 },
  errorText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.error,
    marginTop: 4,
    textAlign: 'left',
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  chipSelected: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  chipText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurfaceVariant,
  },
  chipTextSelected: { color: Colors.onPrimaryContainer, fontFamily: Typography.fontFamilyBold },

  /* Units ----------------------------------------------------------------- */
  uomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  uomHeaderLabel: {
    flex: 1,
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textMuted,
    textAlign: 'left',
  },
  uomRow: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  uomRowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  uomName: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  uomTag: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  uomTagDerived: {
    color: Colors.warning,
    backgroundColor: Colors.warningContainer,
  },
  uomFieldsRow: { flexDirection: 'row', gap: Spacing.sm },
  uomField: { flex: 1 },
  uomFieldLabel: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    marginBottom: 4,
    textAlign: 'left',
  },
  uomInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 9,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorContainer,
  },

  /* Recommended ----------------------------------------------------------- */
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  listRowText: {
    flex: 1,
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },

  /* Visibility ------------------------------------------------------------ */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  switchCopy: { flex: 1 },
  switchTitle: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.onSurface,
    textAlign: 'left',
  },
  switchHint: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'left',
  },

  /* Footer ---------------------------------------------------------------- */
  warnings: {
    backgroundColor: Colors.warningContainer,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  warningText: {
    fontSize: Typography.sizes.labelSm,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.onSecondaryContainer,
    lineHeight: 18,
    textAlign: 'left',
  },
  banner: {
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: {
    fontSize: Typography.sizes.labelMd,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.error,
    textAlign: 'left',
  },

  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cancelText: {
    color: Colors.onSurface,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilySemiBold,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.titleSm,
    fontFamily: Typography.fontFamilyBold,
  },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  centreText: {
    fontSize: Typography.sizes.bodyMd,
    fontFamily: Typography.fontFamilyRegular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
