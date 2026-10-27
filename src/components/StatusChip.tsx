import { Ban, CircleCheck, CircleDashed, PenLine, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { BookingStatus } from '../domain/types';
import { FONT, RADIUS, SPACING } from './theme';

const STATUS_STYLES: Record<BookingStatus, { label: string; text: string; background: string; icon: LucideIcon }> = {
  draft: { label: 'Needs review', text: '#9a5b00', background: '#fff4e0', icon: PenLine },
  confirmed: { label: 'Confirmed', text: '#15803d', background: '#e8f6ec', icon: CircleCheck },
  partially_confirmed: { label: 'Partly confirmed', text: '#4338ca', background: '#eef0ff', icon: CircleDashed },
  cancelled: { label: 'Cancelled', text: '#6b7280', background: '#eeeff2', icon: Ban },
};

export function StatusChip({ status }: { status: BookingStatus }) {
  const { label, text, background, icon: Icon } = STATUS_STYLES[status];
  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Icon size={13} color={text} />
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  text: { fontSize: FONT.small, fontWeight: '700' },
});
