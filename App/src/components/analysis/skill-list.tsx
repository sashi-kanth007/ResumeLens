import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';

type SkillListProps = {
  skills: string[];
  color: string;
  emptyText: string;
};

export function SkillList({ skills, color, emptyText }: SkillListProps) {
  if (skills.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {emptyText}
      </ThemedText>
    );
  }
  return (
    <View style={styles.wrap}>
      {skills.map((skill) => (
        <Chip key={skill} label={skill} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
