// The app's one store: every request the owner has made, kept in memory.
// No backend or offline storage (out of scope), so it resets when the app closes.
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';

import type { Booking } from '../domain/types';

interface State {
  /** Newest first. */
  bookings: Booking[];
}

// Edits are computed by the pure functions in src/parse/edit.ts; the store
// only swaps in the new booking, so the reducer stays trivial to reason about.
type Action =
  | { type: 'added'; booking: Booking }
  | { type: 'changed'; booking: Booking }
  | { type: 'removed'; bookingId: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'added':
      return { bookings: [action.booking, ...state.bookings] };
    case 'changed':
      return { bookings: state.bookings.map((b) => (b.id === action.booking.id ? action.booking : b)) };
    case 'removed':
      return { bookings: state.bookings.filter((b) => b.id !== action.bookingId) };
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { bookings: [] });
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('useStore must be used inside StoreProvider.');
  return store;
}

/** The request "cancel my last request" refers to: the newest one not already cancelled. */
export function latestActiveBooking(bookings: Booking[]): Booking | null {
  return bookings.find((booking) => booking.status !== 'cancelled') ?? null;
}

export function createBookingId(): string {
  return `b${Date.now().toString(36)}`;
}
