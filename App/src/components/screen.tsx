import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Tab screens reserve room for the tab bar; stack screens don't. */
  inTabs?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
};

/** Standard page wrapper: safe area, centered max-width column, optional scroll + pull-to-refresh. */
export function Screen({
  children,
  inTabs = false,
  scroll = true,
  refreshing = false,
  onRefresh,
  edges = ['top'],
}: ScreenProps) {
  const theme = useTheme();
  const padding = {
    paddingTop: Spacing.three + (inTabs ? TopTabInset : 0),
    paddingBottom: Spacing.four + (inTabs ? BottomTabInset : 0),
  };

  const content = <View style={[styles.column, padding]}>{children}</View>;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
              ) : undefined
            }>
            {content}
          </ScrollView>
        ) : (
          <View style={styles.scrollContent}>{content}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
});
