import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { API_URL, USE_MOCKS } from '@/config/env';
import { Spacing } from '@/constants/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <Screen inTabs>
      <ThemedText type="subtitle">Settings</ThemedText>

      <Card title="Backend">
        <Row label="Mode" value={USE_MOCKS ? 'Demo data' : 'Live API'} />
        <Row label="API URL" value={API_URL || 'Not set'} />
      </Card>

      <Card title="About">
        <Row label="App" value="ResumeLens" />
        <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { flexShrink: 1, textAlign: 'right' },
});
