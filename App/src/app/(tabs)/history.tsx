import { router } from 'expo-router';

import { HistoryRow } from '@/components/analysis/history-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-view';
import { useAsync } from '@/hooks/use-async';
import { analysisService } from '@/services/analysis-service';

const loadHistory = () => analysisService.getHistory();

export default function HistoryScreen() {
  const { data, error, loading, reload } = useAsync(loadHistory, { refetchOnFocus: true });

  return (
    <Screen inTabs refreshing={loading && !!data} onRefresh={reload}>
      <ThemedText type="subtitle">History</ThemedText>

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.length === 0 ? (
        <EmptyState
          title="No analyses yet"
          message="Your past resume analyses will show up here."
          actionTitle="Analyze a resume"
          onAction={() => router.push('/analyze')}
        />
      ) : null}
      {data?.map((item) => <HistoryRow key={item.id} item={item} />)}
    </Screen>
  );
}
