import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IsoDate, LineItem } from '../domain/types';
import { confirmRow } from '../parse/edit';
import { QUESTIONS } from '../parse/questions';
import {
  fieldsOfRow,
  formatRowValue,
  ROW_LABELS,
  rowAttention,
  rowReason,
  type Attention,
  type RowKey,
} from '../parse/review';
import { Button } from './Button';
import { FieldEditor } from './FieldEditor';
import { ROW_ICONS } from './icons';
import { ATTENTION_COLORS, COLORS, FONT, RADIUS, SPACING } from './theme';

const STATUS_ICONS: Record<Attention, LucideIcon> = {
  fix: CircleAlert,
  check: TriangleAlert,
  done: CircleCheck,
};

interface Props {
  item: LineItem;
  rowKey: RowKey;
  today: IsoDate;
  expanded: boolean;
  onToggle: () => void;
  onChange: (item: LineItem) => void;
}

export function FieldRow({ item, rowKey, today, expanded, onToggle, onChange }: Props) {
  const attention = rowAttention(item, rowKey);
  const colors = ATTENTION_COLORS[attention];
  const reason = rowReason(item, rowKey);
  const RowIcon = ROW_ICONS[rowKey];
  const StatusIcon = STATUS_ICONS[attention];
  const hasAlternatives = fieldsOfRow(item, rowKey).some((field) => field.alternatives.length > 0);
  // Red rows show their answers straight away, and so do amber rows that come
  // with a ready alternative ("Sat 31 Oct?"): the fix is one tap, not two.
  const showEditor = expanded || attention === 'fix' || (attention === 'check' && hasAlternatives);

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
          <RowIcon size={18} color={colors.text} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.label}>{ROW_LABELS[rowKey]}</Text>
          <Text style={styles.value}>{formatRowValue(item, rowKey)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.background }]}>
          <StatusIcon size={13} color={colors.text} />
          <Text style={[styles.badgeText, { color: colors.text }]}>{colors.label}</Text>
        </View>
      </Pressable>

      {(attention !== 'done' || showEditor) && (
        <View style={styles.body}>
          {attention !== 'done' && reason && <Text style={styles.reason}>{reason}</Text>}
          {attention === 'fix' && <Text style={styles.question}>{QUESTIONS[rowKey]}</Text>}
          {attention === 'check' && (
            <View style={styles.actions}>
              <Button compact label="Looks right" onPress={() => onChange(confirmRow(item, rowKey))} />
              {!showEditor && <Button compact variant="secondary" label="Change" onPress={onToggle} />}
            </View>
          )}
          {showEditor && (
            <View style={styles.editor}>
              <FieldEditor item={item} rowKey={rowKey} today={today} onChange={onChange} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const ICON_SIZE = 36;

const styles = StyleSheet.create({
  row: { paddingVertical: SPACING.m, gap: SPACING.s },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  label: { color: COLORS.muted, fontSize: FONT.small },
  value: { color: COLORS.text, fontSize: FONT.title, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  badgeText: { fontSize: FONT.small, fontWeight: '700' },
  // Lines the details up under the label, past the icon.
  body: { marginLeft: ICON_SIZE + SPACING.m, gap: SPACING.s },
  reason: { color: COLORS.muted, fontSize: FONT.body },
  question: { color: COLORS.text, fontSize: FONT.body, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: SPACING.s },
  editor: { backgroundColor: COLORS.surface, borderRadius: RADIUS.m, padding: SPACING.m },
});
