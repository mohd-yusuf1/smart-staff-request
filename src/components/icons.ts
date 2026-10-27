import {
  CalendarDays,
  ChefHat,
  Clock,
  ConciergeBell,
  CookingPot,
  Hash,
  MapPin,
  Sparkles,
  SprayCan,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import type { Role } from '../domain/taxonomy';
import type { RowKey } from '../parse/review';

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  chef: ChefHat,
  helper: CookingPot,
  cleaner: SprayCan,
  waiter: ConciergeBell,
};

export const ROW_ICONS: Record<RowKey, LucideIcon> = {
  role: Users,
  subcategory: Sparkles,
  count: Hash,
  dates: CalendarDays,
  time: Clock,
  location: MapPin,
};

/** Shown where the staff type isn't known yet. */
export const UNKNOWN_ROLE_ICON: LucideIcon = Users;
