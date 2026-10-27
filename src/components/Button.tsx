import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, FONT, RADIUS, SPACING } from './theme';

type Variant = 'primary' | 'secondary';

interface Props {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', disabled = false, loading = false, compact = false }: Props) {
  const primary = variant === 'primary';
  const color = primary ? COLORS.primaryText : COLORS.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {Icon && <Icon size={compact ? 16 : 20} color={color} />}
          <Text style={[styles.label, compact && styles.compactLabel, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    borderRadius: RADIUS.m,
    paddingVertical: SPACING.l,
    paddingHorizontal: SPACING.l,
  },
  compact: { alignSelf: 'flex-start', paddingVertical: SPACING.s, paddingHorizontal: SPACING.m },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.primarySoft },
  disabled: { backgroundColor: COLORS.disabled },
  pressed: { opacity: 0.75 },
  label: { fontSize: FONT.title, fontWeight: '700' },
  compactLabel: { fontSize: FONT.body, fontWeight: '600' },
});
