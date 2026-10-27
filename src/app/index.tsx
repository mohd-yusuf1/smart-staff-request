import { router, Stack } from 'expo-router';
import { CalendarDays, ChevronRight, CircleX, Clock, Inbox, MapPin, Plus, Trash2, type LucideIcon } from 'lucide-react-native';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ROLE_ICONS, UNKNOWN_ROLE_ICON } from '../components/icons';
import { StatusChip } from '../components/StatusChip';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { PARTNERS } from '../data/partners';
import type { Booking, LineItem } from '../domain/types';
import { formatRowValue, whoText } from '../parse/review';
import { useStore } from '../state/store';

const PARTNER_BY_ID = new Map(PARTNERS.map((partner) => [partner.id, partner]));

function bookedNames(booking: Booking): string[] {
  return Object.values(booking.assignments)
    .flat()
    .map((partnerId) => PARTNER_BY_ID.get(partnerId)?.name)
    .filter((name): name is string => name !== undefined);
}

function openBooking(booking: Booking) {
  router.push(booking.status === 'draft' ? `/review/${booking.id}` : `/match/${booking.id}`);
}

function Detail({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <View style={styles.detail}>
      <Icon size={14} color={COLORS.muted} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

function LineItemSummary({ item }: { item: LineItem }) {
  const RoleIcon = item.role.value ? ROLE_ICONS[item.role.value] : UNKNOWN_ROLE_ICON;
  return (
    <View style={styles.lineItem}>
      <View style={styles.roleTile}>
        <RoleIcon size={22} color={COLORS.accent} />
      </View>
      <View style={styles.lineItemText}>
        <Text style={styles.who}>{whoText(item)}</Text>
        <Detail icon={CalendarDays} text={formatRowValue(item, 'dates')} />
        <Detail icon={Clock} text={formatRowValue(item, 'time')} />
        <Detail icon={MapPin} text={formatRowValue(item, 'location')} />
      </View>
    </View>
  );
}

interface BookingCardProps {
  booking: Booking;
  onDelete: () => void;
  onCancel: () => void;
}

function CardAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={SPACING.s} onPress={onPress} style={styles.action}>
      <Icon size={16} color={COLORS.danger} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function BookingCard({ booking, onDelete, onCancel }: BookingCardProps) {
  // Partners were told about a confirmed booking, so it is cancelled (and they
  // are told again), not silently deleted. Drafts and cancelled ones can go.
  const booked = booking.status === 'confirmed' || booking.status === 'partially_confirmed';
  return (
    <Pressable accessibilityRole="button" onPress={() => openBooking(booking)}>
      {({ pressed }) => (
        <Card style={[styles.card, pressed && styles.pressed, booking.status === 'cancelled' && styles.cancelled]}>
          <View style={styles.cardTop}>
            <StatusChip status={booking.status} />
            <ChevronRight size={20} color={COLORS.faint} />
          </View>
          {booking.lineItems.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <View style={styles.divider} />}
              <LineItemSummary item={item} />
            </View>
          ))}
          {booking.sourceText !== '' && (
            <Text style={styles.source} numberOfLines={1}>
              “{booking.sourceText}”
            </Text>
          )}
          <View style={styles.actions}>
            {booked ? (
              <CardAction icon={CircleX} label="Cancel booking" onPress={onCancel} />
            ) : (
              <CardAction icon={Trash2} label="Delete" onPress={onDelete} />
            )}
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Inbox size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No requests yet</Text>
      <Text style={styles.emptyText}>Tell us what staff you need, in your own words or by picking.</Text>
    </View>
  );
}

export default function RequestsScreen() {
  const { state, dispatch } = useStore();

  const askDelete = (booking: Booking) =>
    Alert.alert('Delete this request?', 'It will be removed from your list.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'removed', bookingId: booking.id }) },
    ]);

  const askCancel = (booking: Booking) => {
    const names = bookedNames(booking);
    Alert.alert('Cancel this booking?', `${names.join(', ')} will be told it is off.`, [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'changed', booking: { ...booking, status: 'cancelled' } });
          // Real push notifications are out of scope: this log line stands in for one.
          console.log(`[mock push] Booking ${booking.id} cancelled: notified ${names.join(', ')}`);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'My requests' }} />
      <FlatList
        data={state.bookings}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <BookingCard booking={item} onDelete={() => askDelete(item)} onCancel={() => askCancel(item)} />
        )}
      />
      <View style={styles.footer}>
        <Button label="New request" icon={Plus} onPress={() => router.push('/new')} />
      </View>
    </View>
  );
}

const ROLE_TILE_SIZE = 44;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  list: { padding: SPACING.l, gap: SPACING.l, flexGrow: 1 },
  card: { gap: SPACING.m },
  pressed: { opacity: 0.8 },
  cancelled: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineItem: { flexDirection: 'row', gap: SPACING.m },
  roleTile: {
    width: ROLE_TILE_SIZE,
    height: ROLE_TILE_SIZE,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemText: { flex: 1, gap: 3 },
  who: { fontSize: FONT.title, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  detailText: { color: COLORS.muted, fontSize: FONT.body },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.m },
  source: { color: COLORS.faint, fontSize: FONT.small, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionText: { color: COLORS.danger, fontSize: FONT.body, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.s, padding: SPACING.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.s,
  },
  emptyTitle: { fontSize: FONT.heading, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.muted, textAlign: 'center', fontSize: FONT.body },
  footer: { padding: SPACING.l, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
});
