import { Check, ChevronDown, ChevronUp, MapPin, Plus, Star, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScoredPartner } from '../domain/types';
import type { BreakdownRow } from '../match/explain';
import { COLORS, FONT, RADIUS, SPACING } from './theme';

interface Props {
  scored: ScoredPartner;
  rank: number;
  /** Built by explain.ts from the score numbers. */
  explanation: string;
  /** The sum behind the score, also from explain.ts. */
  breakdown: BreakdownRow[];
  selected: boolean;
  /** Why this partner can't be picked right now, e.g. "Picked for requirement 1". */
  blockedReason: string | null;
  onPress: () => void;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function PartnerCard({ scored, rank, explanation, breakdown, selected, blockedReason, onPress }: Props) {
  const { partner } = scored;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const Chevron = showBreakdown ? ChevronUp : ChevronDown;
  const blocked = blockedReason !== null && !selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: blocked }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.selected, blocked && styles.blocked, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={[styles.avatar, selected && styles.avatarSelected]}>
          <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>{initials(partner.name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>
            #{rank} {partner.name}
          </Text>
          <View style={styles.meta}>
            <Star size={13} color={COLORS.accent} fill={COLORS.accent} />
            <Text style={styles.metaText}>{partner.reliability}</Text>
            <MapPin size={13} color={COLORS.muted} />
            <Text style={styles.metaText}>{scored.distanceKm.toFixed(1)} km</Text>
            <Wallet size={13} color={COLORS.muted} />
            <Text style={styles.metaText}>₹{partner.dayRateInr}/day</Text>
          </View>
        </View>
        {/* Its own button, so checking the sum doesn't pick the partner. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Score ${scored.total.toFixed(2)}, ${showBreakdown ? 'hide' : 'show'} how it was worked out`}
          hitSlop={SPACING.s}
          onPress={() => setShowBreakdown(!showBreakdown)}
          style={styles.score}
        >
          <Text style={styles.scoreValue}>{scored.total.toFixed(2)}</Text>
          <View style={styles.scoreLabelRow}>
            <Text style={styles.scoreLabel}>score</Text>
            <Chevron size={12} color={COLORS.muted} />
          </View>
        </Pressable>
      </View>

      <Text style={styles.explanation}>{explanation}</Text>

      {showBreakdown && (
        <View style={styles.breakdown}>
          {breakdown.map((row) => (
            <View key={row.label} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{row.label}</Text>
              <Text style={styles.breakdownSum}>
                {row.value.toFixed(2)} × {row.weight.toFixed(2)} = {row.points.toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownLabel}>Total</Text>
            <Text style={styles.breakdownTotalValue}>{scored.total.toFixed(2)}</Text>
          </View>
          {/* In about 3 of 10 breakdowns the rounded rows add up to 0.01 off the total. */}
          <Text style={styles.breakdownNote}>Each row is rounded; the total is worked out before rounding.</Text>
        </View>
      )}

      <View style={[styles.pick, selected && styles.pickSelected]}>
        {selected ? <Check size={16} color={COLORS.primaryText} /> : <Plus size={16} color={COLORS.primary} />}
        <Text style={[styles.pickText, selected && styles.pickTextSelected]}>
          {selected ? 'Picked' : (blockedReason ?? 'Pick')}
        </Text>
      </View>
    </Pressable>
  );
}

const AVATAR_SIZE = 42;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.m,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  selected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  blocked: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: { backgroundColor: COLORS.primary },
  avatarText: { color: COLORS.accent, fontWeight: '800' },
  avatarTextSelected: { color: COLORS.primaryText },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: FONT.title, fontWeight: '700', color: COLORS.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  metaText: { color: COLORS.muted, fontSize: FONT.small, marginRight: SPACING.xs },
  score: { alignItems: 'center' },
  scoreValue: { fontSize: FONT.title, fontWeight: '800', color: COLORS.primary },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreLabel: { fontSize: 10, color: COLORS.muted, textTransform: 'uppercase' },
  explanation: { color: COLORS.text, fontSize: FONT.body, lineHeight: 21 },
  breakdown: { backgroundColor: COLORS.surface, borderRadius: RADIUS.s, padding: SPACING.m, gap: SPACING.xs },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { color: COLORS.muted, fontSize: FONT.small },
  breakdownSum: { color: COLORS.text, fontSize: FONT.small, fontVariant: ['tabular-nums'] },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs },
  breakdownTotalValue: { color: COLORS.primary, fontSize: FONT.small, fontWeight: '800' },
  breakdownNote: { color: COLORS.faint, fontSize: 11 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.primarySoft,
  },
  pickSelected: { backgroundColor: COLORS.primary },
  pickText: { color: COLORS.primary, fontWeight: '700' },
  pickTextSelected: { color: COLORS.primaryText },
});
