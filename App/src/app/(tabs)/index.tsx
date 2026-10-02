import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HistoryRow } from '@/components/analysis/history-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/state-view';
import { USE_MOCKS } from '@/config/env';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { analysisService } from '@/services/analysis-service';

const loadRecent = () => analysisService.getHistory(3);

const STEPS = [
  { title: 'Upload your resume', body: 'Pick a PDF from your device.' },
  { title: 'Paste the job description', body: 'The full posting gives the best results.' },
  { title: 'Get your match score', body: 'See matched and missing skills, plus tips.' },
];

export default function HomeScreen() {
  const recent = useAsync(loadRecent, { refetchOnFocus: true });

  return (
    <Screen inTabs>
      <View style={styles.hero}>
        <ThemedText type="subtitle">ResumeLens</ThemedText>
        <ThemedText themeColor="textSecondary">
          See how well your resume matches a job before you apply.
        </ThemedText>
      </View>

      {USE_MOCKS ? (
        <Card>
          <ThemedText type="small" themeColor="warning">
            Demo mode: showing sample data. Set EXPO_PUBLIC_API_URL to connect to the backend.
          </ThemedText>
        </Card>
      ) : null}

      <Button title="Analyze a resume" onPress={() => router.push('/analyze')} />

      <Card title="How it works">
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <ThemedText type="smallBold" themeColor="primary">
              {index + 1}
            </ThemedText>
            <View style={styles.stepText}>
              <ThemedText type="small">{step.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {step.body}
              </ThemedText>
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Recent analyses</ThemedText>
        <ThemedText type="linkPrimary" onPress={() => router.push('/history')}>
          See all
        </ThemedText>
      </View>

      {recent.loading && !recent.data ? <LoadingState /> : null}
      {recent.error ? (
        <ThemedText type="small" themeColor="danger">
          {recent.error}
        </ThemedText>
      ) : null}
      {recent.data?.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No analyses yet.
        </ThemedText>
      ) : null}
      {recent.data?.map((item) => <HistoryRow key={item.id} item={item} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.two, paddingVertical: Spacing.three },
  step: { flexDirection: 'row', gap: Spacing.three },
  stepText: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
