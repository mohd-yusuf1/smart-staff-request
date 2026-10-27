import { StyleSheet, Text } from 'react-native';

import { COLORS } from './theme';

interface Range {
  start: number;
  end: number;
}

// Every place an evidence phrase occurs, merged so overlaps highlight once.
function evidenceRanges(text: string, evidence: string[]): Range[] {
  const lower = text.toLowerCase();
  const ranges: Range[] = [];
  for (const phrase of evidence) {
    const needle = phrase.trim().toLowerCase();
    if (!needle) continue;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      ranges.push({ start: at, end: at + needle.length });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** The owner's own words, with the parts the parse came from highlighted. */
export function SourceText({ text, evidence }: { text: string; evidence: string[] }) {
  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  for (const { start, end } of evidenceRanges(text, evidence)) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), highlighted: false });
    parts.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });

  return (
    <Text style={styles.text}>
      {parts.map((part, i) => (
        <Text key={i} style={part.highlighted ? styles.highlighted : undefined}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: COLORS.text },
  highlighted: { backgroundColor: COLORS.highlight },
});
