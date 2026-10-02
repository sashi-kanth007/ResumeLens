import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatScore, scoreTone } from '@/utils/format';

type ScoreBadgeProps = {
  score: number;
  size?: number;
};

/** Circular score, colored by how strong the match is. */
export function ScoreBadge({ score, size = 56 }: ScoreBadgeProps) {
  const theme = useTheme();
  const color = theme[scoreTone(score)];

  return (
    <View
      accessibilityLabel={`Score ${formatScore(score)}`}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(3, size / 14),
          borderColor: color,
        },
      ]}>
      <ThemedText style={{ color, fontSize: size * 0.3, lineHeight: size * 0.36, fontWeight: 700 }}>
        {formatScore(score)}
      </ThemedText>
    </View>
  );
}

type ScoreBarProps = {
  label: string;
  score: number;
};

/** Labeled horizontal bar for a sub-score. */
export function ScoreBar({ label, score }: ScoreBarProps) {
  const theme = useTheme();
  const color = theme[scoreTone(score)];
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="smallBold" style={{ color }}>
          {formatScore(score)}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  barRow: { gap: 4 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
