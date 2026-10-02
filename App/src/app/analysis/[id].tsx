import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { ScoreBadge, ScoreBar } from '@/components/analysis/score-badge';
import { SkillList } from '@/components/analysis/skill-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/state-view';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { analysisService } from '@/services/analysis-service';
import { formatDate, getErrorMessage, scoreLabel } from '@/utils/format';

function confirmDelete(onConfirm: () => void) {
  // Alert.alert has no buttons on web.
  if (Platform.OS === 'web') {
    if (window.confirm('Delete this analysis?')) onConfirm();
    return;
  }
  Alert.alert('Delete analysis?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function AnalysisDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const analysisId = Number(id);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => analysisService.getAnalysis(analysisId), [analysisId]);
  const { data, error, loading, reload } = useAsync(load);

  const handleDelete = () =>
    confirmDelete(async () => {
      setDeleting(true);
      try {
        await analysisService.deleteAnalysis(analysisId);
        router.back();
      } catch (e) {
        setDeleting(false);
        Alert.alert('Could not delete', getErrorMessage(e));
      }
    });

  if (loading && !data) {
    return <LoadingState message="Loading analysis…" />;
  }
  if (error || !data) {
    return <ErrorState message={error ?? 'Analysis not found.'} onRetry={reload} />;
  }

  const { result } = data;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: data.resume_filename }} />

      <Card style={styles.summary}>
        <ScoreBadge score={result.overall_score} size={96} />
        <View style={styles.summaryText}>
          <ThemedText type="smallBold">{scoreLabel(result.overall_score)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {data.resume_filename}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(data.created_at)}
          </ThemedText>
        </View>
      </Card>

      <Card title="Score breakdown">
        <ScoreBar label="Content similarity" score={result.semantic_score} />
        <ScoreBar label="Skill coverage" score={result.skill_score} />
      </Card>

      <Card title={`Matched skills (${result.matched_skills.length})`}>
        <SkillList skills={result.matched_skills} color={theme.success} emptyText="No matching skills found." />
      </Card>

      <Card title={`Missing skills (${result.missing_skills.length})`}>
        <SkillList skills={result.missing_skills} color={theme.danger} emptyText="Nothing missing — nice!" />
      </Card>

      <Card title="Recommendations">
        {result.recommendations.map((tip) => (
          <View key={tip} style={styles.tip}>
            <ThemedText type="small" themeColor="primary">
              •
            </ThemedText>
            <ThemedText type="small" style={styles.tipText}>
              {tip}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Button title="Delete analysis" variant="danger" onPress={handleDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  summaryText: { flex: 1, gap: Spacing.half },
  tip: { flexDirection: 'row', gap: Spacing.two },
  tipText: { flex: 1 },
});
