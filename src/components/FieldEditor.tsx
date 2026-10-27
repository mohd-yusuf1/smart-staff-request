import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { isTimeOfDay } from '../domain/dates';
import type { IsoDate, LineItem } from '../domain/types';
import { setCount, setDates, setLocation, setRole, setSubcategory, setTimes } from '../parse/edit';
import {
  dateChoices,
  locationChoices,
  roleChoices,
  subcategoryChoices,
  timeChoices,
  type Choice,
} from '../parse/questions';
import type { RowKey } from '../parse/review';
import { Button } from './Button';
import { Chip } from './Chip';
import { COLORS, FONT, RADIUS, SPACING } from './theme';

// Counts above this are rare for one booking; the validator still accepts up to 20.
const COUNT_CHOICES = Array.from({ length: 10 }, (_, i) => i + 1);

interface Props {
  item: LineItem;
  rowKey: RowKey;
  today: IsoDate;
  onChange: (item: LineItem) => void;
}

function ChipGroup<T>({ choices, isSelected, onPick }: {
  choices: Choice<T>[];
  isSelected: (value: T) => boolean;
  onPick: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {choices.map((choice) => (
        <Chip key={choice.label} label={choice.label} selected={isSelected(choice.value)} onPress={() => onPick(choice.value)} />
      ))}
    </View>
  );
}

function TimeEditor({ item, onChange }: Pick<Props, 'item' | 'onChange'>) {
  const [start, setStart] = useState(item.startTime.value ?? '');
  const [end, setEnd] = useState(item.endTime.value ?? '');
  const [error, setError] = useState<string | null>(null);

  const applyCustom = () => {
    if (!isTimeOfDay(start) || !isTimeOfDay(end)) {
      setError('Use 24-hour times like 09:30 or 18:00.');
      return;
    }
    setError(null);
    onChange(setTimes(item, start, end));
  };

  return (
    <View style={styles.group}>
      <ChipGroup
        choices={timeChoices()}
        isSelected={(w) => w.start === item.startTime.value && w.end === item.endTime.value}
        onPick={(w) => onChange(setTimes(item, w.start, w.end))}
      />
      <Text style={styles.muted}>Or type your own (24-hour):</Text>
      <View style={styles.customTime}>
        <TextInput style={styles.timeInput} value={start} onChangeText={setStart} placeholder="18:00" maxLength={5} />
        <Text style={styles.muted}>to</Text>
        <TextInput style={styles.timeInput} value={end} onChangeText={setEnd} placeholder="23:00" maxLength={5} />
        <Button compact label="Set" onPress={applyCustom} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function LocationEditor({ item, onChange }: Pick<Props, 'item' | 'onChange'>) {
  const [query, setQuery] = useState('');
  const choices = locationChoices(query);
  return (
    <View style={styles.group}>
      <View style={styles.search}>
        <Search size={18} color={COLORS.muted} />
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search area, e.g. Saket or CP" />
      </View>
      <ChipGroup choices={choices} isSelected={(id) => id === item.location.value} onPick={(id) => onChange(setLocation(item, id))} />
      {choices.length === 0 && <Text style={styles.muted}>{"We don't cover that area yet."}</Text>}
    </View>
  );
}

/** The one-tap answers for one row. Picking a value writes it straight into the booking. */
export function FieldEditor({ item, rowKey, today, onChange }: Props) {
  switch (rowKey) {
    case 'role':
      return <ChipGroup choices={roleChoices()} isSelected={(r) => r === item.role.value} onPick={(r) => onChange(setRole(item, r))} />;
    case 'subcategory': {
      const choices = subcategoryChoices(item.role.value);
      if (choices.length === 0) return <Text style={styles.muted}>Pick the kind of staff first.</Text>;
      return (
        <ChipGroup
          choices={choices}
          isSelected={(s) => s === item.subcategory.value && item.subcategory.status === 'ok'}
          onPick={(s) => onChange(setSubcategory(item, s))}
        />
      );
    }
    case 'count':
      return (
        <ChipGroup
          choices={COUNT_CHOICES.map((n) => ({ label: String(n), value: n }))}
          isSelected={(n) => n === item.count.value}
          onPick={(n) => onChange(setCount(item, n))}
        />
      );
    case 'dates':
      return (
        <ChipGroup
          choices={dateChoices(item, today)}
          isSelected={(dates) => dates.join(',') === item.dates.value?.join(',')}
          onPick={(dates) => onChange(setDates(item, dates))}
        />
      );
    case 'time':
      return <TimeEditor item={item} onChange={onChange} />;
    case 'location':
      return <LocationEditor item={item} onChange={onChange} />;
  }
}

const styles = StyleSheet.create({
  group: { gap: SPACING.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  customTime: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  timeInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.s,
    width: 76,
    textAlign: 'center',
    fontSize: FONT.body,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.m,
  },
  searchInput: { flex: 1, paddingVertical: SPACING.s, fontSize: FONT.body },
  muted: { color: COLORS.muted, fontSize: FONT.body },
  error: { color: COLORS.danger },
});
