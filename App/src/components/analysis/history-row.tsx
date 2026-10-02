import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScoreBadge } from '@/components/analysis/score-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { AnalysisHistoryItem } from '@/types/analysis';
import { formatDate, scoreLabel } from '@/utils/format';

export function HistoryRow({ item }: { item: AnalysisHistoryItem }) {
  return (
    <Link href={{ pathname: '/analysis/[id]', params: { id: item.id } }} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ScoreBadge score={item.overall_score} size={48} />
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {item.resume_filename}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {scoreLabel(item.overall_score)} · {formatDate(item.created_at)}
            </ThemedText>
          </View>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  text: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.7 },
});
