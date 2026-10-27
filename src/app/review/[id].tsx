import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, CircleCheck, Plus, Quote, Search, Trash2, TriangleAlert, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { FieldRow } from '../../components/FieldRow';
import { ROLE_ICONS, UNKNOWN_ROLE_ICON } from '../../components/icons';
import { SourceText } from '../../components/SourceText';
import { ATTENTION_COLORS, COLORS, FONT, RADIUS, SPACING } from '../../components/theme';
import { todayInKolkata } from '../../domain/dates';
import { ROLE_LABELS, ROLES, type Role } from '../../domain/taxonomy';
import type { Booking, IsoDate, LineItem } from '../../domain/types';
import { addLineItem, confirmCancel, removeBudget, removeLineItem, updateLineItem } from '../../parse/edit';
import {
  attentionOf,
  formatRowValue,
  readback,
  reviewProgress,
  rowAttention,
  sortedRows,
  whoText,
  type ReviewProgress,
} from '../../parse/review';
import { MAX_LINE_ITEMS } from '../../parse/validate';
import { useStore } from '../../state/store';

function evidenceOf(booking: Booking): string[] {
  const fields = booking.lineItems.flatMap((item) => [
    item.role, item.subcategory, item.count, item.dates, item.startTime, item.endTime, item.location,
  ]);
  return [...fields, booking.budget].map((field) => field.evidence).filter((e): e is string => e !== null);
}

function buttonLabel({ toFix, toCheck }: ReviewProgress): string {
  if (toFix > 0) return `Answer ${toFix} more ${toFix === 1 ? 'item' : 'items'}`;
  if (toCheck > 0) return `Check ${toCheck} more ${toCheck === 1 ? 'item' : 'items'}`;
  return 'Find partners';
}

function ProgressBanner({ progress }: { progress: ReviewProgress }) {
  if (progress.toFix === 0 && progress.toCheck === 0) {
    return (
      <View style={[styles.banner, { backgroundColor: ATTENTION_COLORS.done.background }]}>
        <CircleCheck size={18} color={ATTENTION_COLORS.done.text} />
        <Text style={[styles.bannerText, { color: ATTENTION_COLORS.done.text }]}>All set. Ready to find partners.</Text>
      </View>
    );
  }
  const parts = [
    progress.toFix > 0 && `${progress.toFix} to answer`,
    progress.toCheck > 0 && `${progress.toCheck} to check`,
  ].filter(Boolean);
  const tone = progress.toFix > 0 ? ATTENTION_COLORS.fix : ATTENTION_COLORS.check;
  return (
    <View style={[styles.banner, { backgroundColor: tone.background }]}>
      <TriangleAlert size={18} color={tone.text} />
      <Text style={[styles.bannerText, { color: tone.text }]}>
        {`${parts.join(' · ')}. We only ask about what we couldn't be sure of.`}
      </Text>
    </View>
  );
}

interface LineItemCardProps {
  item: LineItem;
  index: number;
  total: number;
  today: IsoDate;
  expanded: string | null;
  setExpanded: (key: string | null) => void;
  onChange: (item: LineItem) => void;
  /** Null for the only requirement, which can't be removed. */
  onRemove: (() => void) | null;
}

function LineItemCard({ item, index, total, today, expanded, setExpanded, onChange, onRemove }: LineItemCardProps) {
  const [showDone, setShowDone] = useState(false);
  const RoleIcon = item.role.value ? ROLE_ICONS[item.role.value] : UNKNOWN_ROLE_ICON;
  const rows = sortedRows(item);
  const open = rows.filter((key) => rowAttention(item, key) !== 'done');
  const done = rows.filter((key) => rowAttention(item, key) === 'done');
  const visible = showDone ? [...open, ...done] : open;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemIcon}>
          <RoleIcon size={24} color={COLORS.primaryText} />
        </View>
        <View style={styles.itemHeaderText}>
          <Text style={styles.overline}>{total > 1 ? `Requirement ${index + 1} of ${total}` : 'Your requirement'}</Text>
          <Text style={styles.itemTitle}>{whoText(item)}</Text>
          <Text style={styles.itemSubtitle}>
            {[formatRowValue(item, 'dates'), formatRowValue(item, 'time'), formatRowValue(item, 'location')].join(' · ')}
          </Text>
        </View>
        {onRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${whoText(item)}`}
            hitSlop={SPACING.s}
            onPress={onRemove}
            style={styles.remove}
          >
            <Trash2 size={18} color={COLORS.danger} />
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.rows}>
        {visible.map((key, i) => {
          const id = `${item.id}:${key}`;
          return (
            <View key={key}>
              {i > 0 && <View style={styles.divider} />}
              <FieldRow
                item={item}
                rowKey={key}
                today={today}
                expanded={expanded === id}
                onToggle={() => setExpanded(expanded === id ? null : id)}
                onChange={onChange}
              />
            </View>
          );
        })}
      </View>

      {/* Fields that need nothing stay folded, so attention goes to the ones that do. */}
      {done.length > 0 && (
        <Pressable accessibilityRole="button" onPress={() => setShowDone(!showDone)} style={styles.doneToggle}>
          {showDone ? <ChevronUp size={16} color={COLORS.primary} /> : <ChevronDown size={16} color={COLORS.primary} />}
          <Text style={styles.doneToggleText}>
            {showDone ? 'Hide' : 'Show'} {done.length} {done.length === 1 ? 'field' : 'fields'} that look right
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

// Two taps: open, then pick the staff type. The new card's other fields start
// red, so they are asked rather than copied from another card.
function AddRequirement({ onAdd }: { onAdd: (role: Role) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <Button variant="secondary" label="Add another requirement" icon={Plus} onPress={() => setOpen(true)} />;
  }
  return (
    <Card>
      <Text style={styles.addTitle}>Who else do you need?</Text>
      <View style={styles.chips}>
        {ROLES.map((role) => (
          <Chip
            key={role}
            label={ROLE_LABELS[role]}
            onPress={() => {
              onAdd(role);
              setOpen(false);
            }}
          />
        ))}
      </View>
      <Button compact variant="secondary" label="Never mind" onPress={() => setOpen(false)} />
    </Card>
  );
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const booking = state.bookings.find((b) => b.id === id);
  if (!booking) {
    return <Text style={styles.missing}>This request no longer exists.</Text>;
  }
  // A confirmed or cancelled booking is no longer editable (e.g. after pressing back).
  if (booking.status !== 'draft') return <Redirect href={`/match/${booking.id}`} />;

  const today = todayInKolkata(new Date());
  const progress = reviewProgress(booking);
  const ready = progress.toFix === 0 && progress.toCheck === 0;
  const previous = state.bookings.find((b) => b.id === booking.cancelsBookingId);
  const save = (next: Booking) => dispatch({ type: 'changed', booking: next });
  const saveItem = (item: LineItem) => save(updateLineItem(booking, item.id, () => item));
  // Asks first: a removed card takes the owner's answers with it.
  const askRemove = (item: LineItem) =>
    Alert.alert('Remove this requirement?', readback(item), [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => save(removeLineItem(booking, item.id)) },
    ]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Check your request' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProgressBanner progress={progress} />

        {booking.sourceText !== '' && (
          <Card>
            <View style={styles.sectionHeader}>
              <Quote size={16} color={COLORS.muted} />
              <Text style={styles.caption}>You wrote</Text>
            </View>
            <SourceText text={booking.sourceText} evidence={evidenceOf(booking)} />
            <Text style={styles.legend}>Highlighted words are what we read.</Text>
          </Card>
        )}

        {booking.intent === 'cancel_and_rebook' && (
          <Card style={styles.cancelCard}>
            {previous ? (
              <>
                <Text style={styles.cancelTitle}>This will cancel your earlier request</Text>
                {previous.lineItems.map((item) => (
                  <Text key={item.id} style={styles.cancelText}>{readback(item)}</Text>
                ))}
                {booking.cancelCheckedByOwner ? (
                  <View style={styles.sectionHeader}>
                    <CircleCheck size={16} color={COLORS.success} />
                    <Text style={styles.cancelDone}>It will be cancelled when you confirm.</Text>
                  </View>
                ) : (
                  <Button compact label="Yes, cancel it" onPress={() => save(confirmCancel(booking))} />
                )}
              </>
            ) : (
              <Text style={styles.cancelText}>No earlier request to cancel, so this will be booked as a new request.</Text>
            )}
          </Card>
        )}

        {booking.lineItems.map((item, index) => (
          <LineItemCard
            key={item.id}
            item={item}
            index={index}
            total={booking.lineItems.length}
            today={today}
            expanded={expanded}
            setExpanded={setExpanded}
            onChange={saveItem}
            onRemove={booking.lineItems.length > 1 ? () => askRemove(item) : null}
          />
        ))}
        {booking.lineItems.length < MAX_LINE_ITEMS && (
          <AddRequirement onAdd={(role) => save(addLineItem(booking, role, new Date()))} />
        )}

        {booking.budget.value && (
          <Card>
            <View style={styles.sectionHeader}>
              <Wallet size={18} color={COLORS.primary} />
              <Text style={styles.budgetText}>
                Budget: up to ₹{booking.budget.value.amountInr} per {booking.budget.value.per}
              </Text>
            </View>
          </Card>
        )}
        {attentionOf(booking.budget) === 'fix' && (
          <Card style={{ backgroundColor: ATTENTION_COLORS.fix.background }}>
            <Text style={{ color: ATTENTION_COLORS.fix.text }}>{booking.budget.reason}</Text>
            <Button compact label="Book without a budget" onPress={() => save(removeBudget(booking))} />
          </Card>
        )}
        {booking.notes && <Text style={styles.notes}>Notes: {booking.notes}</Text>}
      </ScrollView>

      {/* Confirm stays blocked until every red row is answered and every amber row checked. */}
      <View style={styles.footer}>
        <Button
          label={buttonLabel(progress)}
          icon={ready ? Search : undefined}
          disabled={!ready}
          onPress={() => router.push(`/match/${booking.id}`)}
        />
      </View>
    </View>
  );
}

const ITEM_ICON_SIZE = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.l, gap: SPACING.l, paddingBottom: SPACING.xxl },
  missing: { padding: SPACING.l, color: COLORS.muted },
  banner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s, borderRadius: RADIUS.m, padding: SPACING.m },
  bannerText: { flex: 1, fontSize: FONT.body, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  caption: { color: COLORS.muted, fontSize: FONT.small, textTransform: 'uppercase', letterSpacing: 0.5 },
  legend: { color: COLORS.faint, fontSize: FONT.small },
  cancelCard: { borderWidth: 1.5, borderColor: COLORS.danger, gap: SPACING.s },
  cancelTitle: { color: COLORS.danger, fontWeight: '700', fontSize: FONT.title },
  cancelText: { color: COLORS.text, fontSize: FONT.body },
  cancelDone: { color: COLORS.success, fontWeight: '600' },
  itemCard: { padding: 0, overflow: 'hidden', gap: 0 },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    backgroundColor: COLORS.primarySoft,
    padding: SPACING.l,
  },
  itemIcon: {
    width: ITEM_ICON_SIZE,
    height: ITEM_ICON_SIZE,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemHeaderText: { flex: 1, gap: 2 },
  remove: { alignItems: 'center', gap: 2 },
  removeText: { color: COLORS.danger, fontSize: FONT.small, fontWeight: '600' },
  addTitle: { color: COLORS.text, fontSize: FONT.title, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  overline: { color: COLORS.primary, fontSize: FONT.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemTitle: { color: COLORS.text, fontSize: FONT.heading, fontWeight: '800' },
  itemSubtitle: { color: COLORS.muted, fontSize: FONT.body },
  rows: { paddingHorizontal: SPACING.l, paddingTop: SPACING.xs },
  divider: { height: 1, backgroundColor: COLORS.border },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  doneToggleText: { color: COLORS.primary, fontWeight: '600', fontSize: FONT.body },
  budgetText: { color: COLORS.text, fontSize: FONT.body, fontWeight: '600' },
  notes: { color: COLORS.muted, fontSize: FONT.body },
  footer: { padding: SPACING.l, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
});
