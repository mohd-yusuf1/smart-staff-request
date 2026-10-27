// Between review and matching: a reviewed line item becomes scorer input, and
// the owner's picks decide whether the booking is fully or partly confirmed.
import type { BookedSlot, Booking, BookingStatus, Budget, LineItem, MatchRequest } from '../domain/types';

/** The top of the ranking the owner chooses from, as the assignment asks. */
export const PARTNERS_SHOWN = 5;

/** Null if a required field is still empty, which the review screen prevents. */
export function toMatchRequest(item: LineItem, budget: Budget | null): MatchRequest | null {
  const { role, subcategory, dates, startTime, endTime, location } = item;
  if (!role.value || !dates.value?.length || !startTime.value || !endTime.value || !location.value) return null;
  return {
    role: role.value,
    subcategory: subcategory.value,
    dates: dates.value,
    startTime: startTime.value,
    endTime: endTime.value,
    location: location.value,
    budget,
  };
}

/**
 * Partners' time on confirmed and partly confirmed requests. `ignoredIds` are
 * the request being matched and the one it will cancel, whose partners are
 * freed when this one is confirmed.
 */
export function bookedSlots(bookings: readonly Booking[], ignoredIds: readonly (string | null)[]): BookedSlot[] {
  const active = bookings.filter(
    (b) => !ignoredIds.includes(b.id) && (b.status === 'confirmed' || b.status === 'partially_confirmed'),
  );
  return active.flatMap((booking) =>
    booking.lineItems.flatMap((item) => {
      const dates = item.dates.value;
      const start = item.startTime.value;
      const end = item.endTime.value;
      if (!dates || !start || !end) return [];
      return (booking.assignments[item.id] ?? []).flatMap((partnerId) =>
        dates.map((date) => ({ partnerId, date, start, end })),
      );
    }),
  );
}

/** Confirmed only when every requirement has as many partners as were asked for. */
export function finalStatus(booking: Booking, assignments: Record<string, string[]>): BookingStatus {
  const complete = booking.lineItems.every((item) => (assignments[item.id]?.length ?? 0) >= (item.count.value ?? 1));
  return complete ? 'confirmed' : 'partially_confirmed';
}
