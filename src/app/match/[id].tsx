import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BellRing, CircleCheck, House, Info, SearchX, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ROLE_ICONS, UNKNOWN_ROLE_ICON } from '../../components/icons';
import { PartnerCard } from '../../components/PartnerCard';
import { StatusChip } from '../../components/StatusChip';
import { COLORS, FONT, RADIUS, SPACING } from '../../components/theme';
import { PARTNERS } from '../../data/partners';
import type { BookedSlot, Booking, LineItem, MatchResult, ScoredPartner } from '../../domain/types';
import { bookedSlots, finalStatus, PARTNERS_SHOWN, toMatchRequest } from '../../match/booking';
import { explainExclusions, explainRanking, scoreBreakdown } from '../../match/explain';
import { rankPartners } from '../../match/score';
import { formatRowValue, whoText } from '../../parse/review';
import { useStore } from '../../state/store';

const PARTNER_BY_ID = new Map(PARTNERS.map((partner) => [partner.id, partner]));

type Picks = Record<string, string[]>;

interface Requirement {
  item: LineItem;
  result: MatchResult | null;
  shown: ScoredPartner[];
  explanations: string[];
  /** How many the owner must pick: the count asked for, or fewer if fewer are free. */
  needed: number;
}

function requirementsOf(booking: Booking, booked: readonly BookedSlot[]): Requirement[] {
  return booking.lineItems.map((item) => {
    const request = toMatchRequest(item, booking.budget.value);
    const count = item.count.value ?? 1;
    if (request === null) return { item, result: null, shown: [], explanations: [], needed: 0 };
    const result = rankPartners(request, PARTNERS, booked);
    const shown = result.ranked.slice(0, Math.max(PARTNERS_SHOWN, count));
    return { item, result, shown, explanations: explainRanking(shown, request.subcategory), needed: Math.min(count, shown.length) };
  });
}

function RequirementHeader({ item, index, total }: { item: LineItem; index: number; total: number }) {
  const RoleIcon = item.role.value ? ROLE_ICONS[item.role.value] : UNKNOWN_ROLE_ICON;
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <RoleIcon size={24} color={COLORS.primaryText} />
      </View>
      <View style={styles.headerText}>
        <Text style={styles.overline}>{total > 1 ? `Requirement ${index + 1} of ${total}` : 'Your requirement'}</Text>
        <Text style={styles.title}>{whoText(item)}</Text>
        <Text style={styles.subtitle}>
          {[formatRowValue(item, 'dates'), formatRowValue(item, 'time'), formatRowValue(item, 'location')].join(' · ')}
        </Text>
      </View>
    </View>
  );
}

function ConfirmedView({ booking, notified }: { booking: Booking; notified: string[] | null }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.success}>
        <CircleCheck size={40} color={COLORS.success} />
        <Text style={styles.successTitle}>
          {booking.status === 'confirmed' ? 'Booking confirmed' : booking.status === 'cancelled' ? 'Request cancelled' : 'Partly confirmed'}
        </Text>
        <StatusChip status={booking.status} />
      </Card>

      {notified && notified.length > 0 && (
        <View style={styles.notice}>
          <BellRing size={18} color={COLORS.primary} />
          <Text style={styles.noticeText}>
            Notified {notified.join(', ')}. (Mock notification: real push messages are out of scope.)
          </Text>
        </View>
      )}

      {booking.lineItems.map((item, index) => {
        const picked = (booking.assignments[item.id] ?? []).map((id) => PARTNER_BY_ID.get(id)).filter((p) => p !== undefined);
        const count = item.count.value ?? 1;
        return (
          <Card key={item.id} style={styles.requirement}>
            <RequirementHeader item={item} index={index} total={booking.lineItems.length} />
            <View style={styles.body}>
              {picked.map((partner) => (
                <View key={partner.id} style={styles.pickedRow}>
                  <UserCheck size={18} color={COLORS.success} />
                  <Text style={styles.pickedName}>{partner.name}</Text>
                  <Text style={styles.pickedMeta}>★ {partner.reliability}</Text>
                </View>
              ))}
              {picked.length < count && (
                <Text style={styles.shortfall}>
                  {picked.length} of {count} booked: not enough partners were free for this one.
                </Text>
              )}
            </View>
          </Card>
        );
      })}

      <Button label="Back to my requests" icon={House} onPress={() => router.dismissTo('/')} />
    </ScrollView>
  );
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const booking = state.bookings.find((b) => b.id === id);
  const [picks, setPicks] = useState<Picks>(booking?.assignments ?? {});
  const [notified, setNotified] = useState<string[] | null>(null);

  if (!booking) return <Text style={styles.missing}>This request no longer exists.</Text>;

  if (booking.status !== 'draft') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Your booking' }} />
        <ConfirmedView booking={booking} notified={notified} />
      </View>
    );
  }

  const requirements = requirementsOf(booking, bookedSlots(state.bookings, [booking.id, booking.cancelsBookingId]));
  const remaining = requirements.reduce((sum, r) => sum + Math.max(0, r.needed - (picks[r.item.id]?.length ?? 0)), 0);
  const totalPicked = Object.values(picks).flat().length;
  const ready = remaining === 0 && totalPicked > 0;
  const short = requirements.some((r) => r.needed < (r.item.count.value ?? 1));

  const pickedElsewhere = (itemId: string, partnerId: string) =>
    booking.lineItems.findIndex((item) => item.id !== itemId && (picks[item.id] ?? []).includes(partnerId));

  const togglePick = (itemId: string, partnerId: string, count: number) => {
    setPicks((current) => {
      const list = current[itemId] ?? [];
      if (list.includes(partnerId)) return { ...current, [itemId]: list.filter((p) => p !== partnerId) };
      // With one person needed, a new tap swaps the pick instead of asking to unpick first.
      if (list.length >= count) return count === 1 ? { ...current, [itemId]: [partnerId] } : current;
      return { ...current, [itemId]: [...list, partnerId] };
    });
  };

  const confirm = () => {
    dispatch({ type: 'changed', booking: { ...booking, status: finalStatus(booking, picks), assignments: picks } });
    const previous = state.bookings.find((b) => b.id === booking.cancelsBookingId);
    if (previous && booking.cancelCheckedByOwner) dispatch({ type: 'changed', booking: { ...previous, status: 'cancelled' } });
    const names = Object.values(picks)
      .flat()
      .map((partnerId) => PARTNER_BY_ID.get(partnerId)?.name)
      .filter((name): name is string => name !== undefined);
    // Real push notifications are out of scope: this log line and the banner stand in for them.
    console.log(`[mock push] Booking ${booking.id}: notified ${names.join(', ')}`);
    setNotified(names);
  };

  let footerLabel = `Pick ${remaining} more`;
  if (ready) footerLabel = short ? 'Confirm what is available' : 'Confirm booking';
  if (totalPicked === 0 && remaining === 0) footerLabel = 'No partners available';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Pick partners' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {requirements.map(({ item, result, shown, explanations, needed }, index) => {
          const count = item.count.value ?? 1;
          const list = picks[item.id] ?? [];
          const exclusions = result ? explainExclusions(result.excluded) : null;
          return (
            <Card key={item.id} style={styles.requirement}>
              <RequirementHeader item={item} index={index} total={booking.lineItems.length} />
              <View style={styles.body}>
                {shown.length === 0 ? (
                  <View style={styles.noMatch}>
                    <SearchX size={28} color={COLORS.danger} />
                    <Text style={styles.noMatchTitle}>No partner matches this</Text>
                    {exclusions && <Text style={styles.muted}>{exclusions}</Text>}
                    <Text style={styles.muted}>Try another date or time.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.pickHint}>
                      Pick {needed} · {list.length} picked{needed < count ? ` · only ${shown.length} free of ${count} asked` : ''}
                    </Text>
                    {shown.map((scored, rank) => {
                      const selected = list.includes(scored.partner.id);
                      const elsewhere = pickedElsewhere(item.id, scored.partner.id);
                      let blockedReason: string | null = null;
                      if (elsewhere !== -1) blockedReason = `Picked for requirement ${elsewhere + 1}`;
                      else if (list.length >= count && count > 1) blockedReason = `${count} of ${count} picked`;
                      return (
                        <PartnerCard
                          key={scored.partner.id}
                          scored={scored}
                          rank={rank + 1}
                          explanation={explanations[rank]}
                          breakdown={scoreBreakdown(scored)}
                          selected={selected}
                          blockedReason={blockedReason}
                          onPress={() => togglePick(item.id, scored.partner.id, count)}
                        />
                      );
                    })}
                    {exclusions && (
                      <View style={styles.exclusions}>
                        <Info size={14} color={COLORS.muted} />
                        <Text style={styles.muted}>{exclusions}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </Card>
          );
        })}
        <Button variant="secondary" label="Back to review" icon={ArrowLeft} onPress={() => router.back()} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label={footerLabel} icon={ready ? CircleCheck : undefined} disabled={!ready} onPress={confirm} />
      </View>
    </View>
  );
}

const HEADER_ICON_SIZE = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.l, gap: SPACING.l, paddingBottom: SPACING.xxl },
  missing: { padding: SPACING.l, color: COLORS.muted },
  requirement: { padding: 0, overflow: 'hidden', gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m, backgroundColor: COLORS.primarySoft, padding: SPACING.l },
  headerIcon: {
    width: HEADER_ICON_SIZE,
    height: HEADER_ICON_SIZE,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  overline: { color: COLORS.primary, fontSize: FONT.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: COLORS.text, fontSize: FONT.heading, fontWeight: '800' },
  subtitle: { color: COLORS.muted, fontSize: FONT.body },
  body: { padding: SPACING.l, gap: SPACING.m },
  pickHint: { color: COLORS.text, fontWeight: '700', fontSize: FONT.body },
  exclusions: { flexDirection: 'row', gap: SPACING.s, alignItems: 'flex-start' },
  muted: { flex: 1, color: COLORS.muted, fontSize: FONT.body, textAlign: 'left' },
  noMatch: { alignItems: 'center', gap: SPACING.s, paddingVertical: SPACING.m },
  noMatchTitle: { fontSize: FONT.title, fontWeight: '700', color: COLORS.text },
  success: { alignItems: 'center', gap: SPACING.s, paddingVertical: SPACING.xl },
  successTitle: { fontSize: FONT.heading, fontWeight: '800', color: COLORS.text },
  notice: {
    flexDirection: 'row',
    gap: SPACING.s,
    alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
  },
  noticeText: { flex: 1, color: COLORS.primary, fontSize: FONT.body },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  pickedName: { flex: 1, fontSize: FONT.title, fontWeight: '600', color: COLORS.text },
  pickedMeta: { color: COLORS.muted },
  shortfall: { color: COLORS.danger, fontSize: FONT.body },
  footer: { padding: SPACING.l, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
});
