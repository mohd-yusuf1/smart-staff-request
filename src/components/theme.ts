import { Platform, type ViewStyle } from 'react-native';

import type { Attention } from '../parse/review';

export const COLORS = {
  text: '#1f2430',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  background: '#ffffff',
  surface: '#f3f4f8',
  primary: '#4338ca',
  primarySoft: '#eef0ff',
  primaryText: '#ffffff',
  accent: '#f97316',
  accentSoft: '#fff1e6',
  disabled: '#c7cad1',
  highlight: '#fde68a',
  danger: '#b3261e',
  dangerSoft: '#fdecea',
  success: '#15803d',
  successSoft: '#e8f6ec',
};

export const SPACING = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const RADIUS = { s: 8, m: 12, l: 18, pill: 999 };

export const FONT = { small: 12, body: 15, title: 17, heading: 22 };

/** A soft card shadow that looks the same on iOS (shadow) and Android (elevation). */
export const SHADOW: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#1f2430', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 3 },
});

/** Red must be answered, amber needs one tap, green is quiet. */
export const ATTENTION_COLORS: Record<Attention, { text: string; background: string; label: string }> = {
  fix: { text: '#b3261e', background: '#fdecea', label: 'Needs answer' },
  check: { text: '#9a5b00', background: '#fff4e0', label: 'Please check' },
  done: { text: '#15803d', background: '#e8f6ec', label: 'Looks right' },
};
