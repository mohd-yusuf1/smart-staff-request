import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, FONT, RADIUS, SPACING } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  selected?: boolean;
}

/** A one-tap answer. */
export function Chip({ label, onPress, selected = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      {selected && <Check size={14} color={COLORS.primaryText} />}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.background,
  },
  selected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pressed: { opacity: 0.6 },
  label: { color: COLORS.text, fontSize: FONT.body },
  selectedLabel: { color: COLORS.primaryText, fontWeight: '600' },
});
