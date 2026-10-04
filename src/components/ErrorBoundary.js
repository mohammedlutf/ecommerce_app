import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Spacing } from '../theme/spacing';
import useDirectional from '../hooks/useDirectional';

/**
 * Last line of defence against a blank page.
 *
 * React unmounts the *entire* tree when a render throws and nothing catches it.
 * On the web that presents as a blank white screen with nothing in the console
 * for a shopper to act on, and every render error so far has looked identical
 * from the outside — the `t is not defined` crash in `MegaPanel` and the
 * `linking is undefined` crash in the SEO config both produced a white page.
 *
 * A boundary converts that into a legible message plus a way out, which is the
 * difference between a five-second fix and an unreproducible bug report.
 */
function ErrorBoundaryFallback({ error, onReset }) {
  const { textStart, alignStart } = useDirectional();

  const details = __DEV__
    ? `${error?.message ?? error}`
    : 'Something went wrong while loading this page.';

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={[styles.title, textStart]}>
          {Platform.OS === 'web' ? 'This page ran into a problem' : 'حدث خطأ'}
        </Text>
        <Text style={[styles.body, textStart]}>{details}</Text>

        {/*
         * A plain reload is the only universally safe recovery: the failure may
         * be a bad cached response or a half-initialised provider, and
         * re-running effects in place would just reproduce it.
         */}
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.button, alignStart, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, textStart]}>
            {Platform.OS === 'web' ? 'Reload the page' : 'إعادة المحاولة'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console: the boundary is for the shopper, this is
    // for whoever has to fix it.
    console.error('[ErrorBoundary] render failed', error, info?.componentStack);
  }

  handleReset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorBoundaryFallback error={error} onReset={this.handleReset} />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.titleMd,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.onSurface,
  },
  body: {
    fontSize: Typography.sizes.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 21,
  },
  button: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: Typography.sizes.labelLg,
    fontFamily: Typography.fontFamilySemiBold,
  },
});