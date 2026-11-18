export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface ParsedLine {
  front: string;
  back: string;
}

/**
 * Parse un texte « un terme par ligne ».
 * Séparateurs acceptés : tabulation (export Quizlet), « ; », « = », « - », « – ».
 */
export function parseBulk(text: string): { cards: ParsedLine[]; skipped: number } {
  const cards: ParsedLine[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let idx = -1;
    let sepLen = 1;
    const tab = line.indexOf('\t');
    if (tab > 0) {
      idx = tab;
    } else {
      for (const sep of [';', ' = ', ' - ', ' – ']) {
        const i = line.indexOf(sep);
        if (i > 0) {
          idx = i;
          sepLen = sep.length;
          break;
        }
      }
    }
    if (idx <= 0) {
      skipped++;
      continue;
    }
    const front = line.slice(0, idx).trim();
    const back = line.slice(idx + sepLen).trim();
    if (front && back) cards.push({ front, back });
    else skipped++;
  }
  return { cards, skipped };
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}
