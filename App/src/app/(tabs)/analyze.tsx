import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analysisService } from '@/services/analysis-service';
import type { ResumeFile } from '@/types/analysis';
import { getErrorMessage } from '@/utils/format';

export default function AnalyzeScreen() {
  const theme = useTheme();
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = resume !== null && jobDescription.trim().length > 0 && !submitting;

  async function pickResume() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    setResume({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/pdf',
      file: asset.file,
    });
    setError(null);
  }

  async function submit() {
    if (!resume) return;
    setSubmitting(true);
    setError(null);
    try {
      const analysis = await analysisService.createAnalysis({
        resume,
        jobDescription: jobDescription.trim(),
      });
      setResume(null);
      setJobDescription('');
      router.push({ pathname: '/analysis/[id]', params: { id: analysis.id } });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen inTabs>
      <ThemedText type="subtitle">Analyze</ThemedText>

      <Card title="1. Resume (PDF)">
        <ThemedText type="small" themeColor={resume ? 'text' : 'textSecondary'} numberOfLines={1}>
          {resume ? resume.name : 'No file selected'}
        </ThemedText>
        <Button
          title={resume ? 'Choose a different file' : 'Choose PDF'}
          variant="secondary"
          onPress={pickResume}
          disabled={submitting}
        />
      </Card>

      <Card title="2. Job description">
        <TextInput
          value={jobDescription}
          onChangeText={setJobDescription}
          placeholder="Paste the full job posting here…"
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
          editable={!submitting}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
        />
      </Card>

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}

      <Button title="Analyze match" onPress={submit} loading={submitting} disabled={!canSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
});
