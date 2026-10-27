import { router, Stack } from 'expo-router';
import { CircleAlert, PenLine, Send, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ROLE_ICONS } from '../components/icons';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { todayInKolkata } from '../domain/dates';
import { ROLE_LABELS, ROLES, SUBCATEGORY_LABELS, subcategoriesOf, type Role } from '../domain/taxonomy';
import type { Booking } from '../domain/types';
import { parseRequest } from '../llm/client';
import { setRole, updateLineItem } from '../parse/edit';
import { blankBooking, validateLlmOutput, type ValidationContext } from '../parse/validate';
import { createBookingId, latestActiveBooking, useStore } from '../state/store';

type Phase = { kind: 'typing' } | { kind: 'loading' } | { kind: 'failed'; message: string };

function RoleTile({ role, onPress }: { role: Role; onPress: () => void }) {
  const Icon: LucideIcon = ROLE_ICONS[role];
  const skills = subcategoriesOf(role).map((skill) => SUBCATEGORY_LABELS[skill]);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tileIcon}>
        <Icon size={28} color={COLORS.accent} />
      </View>
      <Text style={styles.tileTitle}>{ROLE_LABELS[role]}</Text>
      <Text style={styles.tileCaption} numberOfLines={2}>
        {skills.length > 1 ? skills.join(', ') : 'Tap to choose details'}
      </Text>
    </Pressable>
  );
}

export default function NewRequestScreen() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'typing' });

  const context = (sourceText: string): ValidationContext => {
    const previous = latestActiveBooking(state.bookings);
    return {
      sourceText,
      now: new Date(),
      bookingId: createBookingId(),
      fallbackLocation: previous?.lineItems[0]?.location.value ?? null,
    };
  };

  const openReview = (booking: Booking) => {
    // "Cancel my last request" points at the newest request that is still active.
    const previous = booking.intent === 'cancel_and_rebook' ? latestActiveBooking(state.bookings) : null;
    dispatch({ type: 'added', booking: { ...booking, cancelsBookingId: previous?.id ?? null } });
    router.replace(`/review/${booking.id}`);
  };

  const submit = async () => {
    const ctx = context(text.trim());
    if (!ctx.sourceText) return;
    setPhase({ kind: 'loading' });
    const reply = await parseRequest(ctx.sourceText, todayInKolkata(ctx.now));
    if (!reply.ok) {
      if (reply.error.detail) console.warn(`[llm] ${reply.error.kind}: ${reply.error.detail}`);
      setPhase({ kind: 'failed', message: reply.error.message });
      return;
    }
    const result = validateLlmOutput(reply.output, ctx);
    if (!result.ok) {
      setPhase({ kind: 'failed', message: result.error });
      return;
    }
    openReview(result.booking);
  };

  // No AI: the same review screen, with the staff type already chosen and
  // every other field asked as one-tap choices.
  const pickRole = (role: Role) => {
    const booking = blankBooking(context(''));
    openReview(updateLineItem(booking, booking.lineItems[0].id, (item) => setRole(item, role)));
  };

  // The way out when the AI is down or wrong: keep the text, ask every field.
  const fillManually = () => openReview(blankBooking(context(text.trim())));

  const loading = phase.kind === 'loading';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'New request' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.sectionHeader}>
            <PenLine size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Type what you need</Text>
          </View>
          <Text style={styles.hint}>English. Say who, when and where.</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="e.g. Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area."
            placeholderTextColor={COLORS.faint}
            multiline
            editable={!loading}
            textAlignVertical="top"
          />
          {phase.kind === 'failed' && (
            <View style={styles.errorBox}>
              <CircleAlert size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{phase.message}</Text>
            </View>
          )}
          <Button
            label={phase.kind === 'failed' ? 'Try again' : 'Read with AI'}
            icon={Send}
            onPress={submit}
            loading={loading}
            disabled={!text.trim()}
          />
          {loading && <Text style={styles.hint}>Reading your request…</Text>}
          {phase.kind === 'failed' && <Button variant="secondary" label="Fill it in myself" onPress={fillManually} />}
        </Card>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or pick, no typing</Text>
          <View style={styles.orLine} />
        </View>

        <View style={styles.tiles}>
          {ROLES.map((role) => (
            <RoleTile key={role} role={role} onPress={() => pickRole(role)} />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.l, gap: SPACING.l },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  sectionTitle: { fontSize: FONT.title, fontWeight: '700', color: COLORS.text },
  hint: { color: COLORS.muted, fontSize: FONT.body },
  input: {
    minHeight: 110,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    fontSize: FONT.title,
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: 'row',
    gap: SPACING.s,
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: FONT.body },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.muted, fontSize: FONT.small, textTransform: 'uppercase', letterSpacing: 0.5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.m },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: { opacity: 0.7 },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.s,
  },
  tileTitle: { fontSize: FONT.title, fontWeight: '700', color: COLORS.text },
  tileCaption: { fontSize: FONT.small, color: COLORS.muted },
});
