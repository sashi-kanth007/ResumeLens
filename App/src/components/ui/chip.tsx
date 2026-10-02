import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type ChipProps = {
  label: string;
  color: string;
};

export function Chip({ label, color }: ChipProps) {
  return (
    // 8-digit hex: the tone color at ~13% opacity for the fill.
    <View style={[styles.chip, { backgroundColor: `${color}22`, borderColor: color }]}>
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.half,
  },
});
