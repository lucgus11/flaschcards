import type { Card } from './types';
import { startOfDay, uid } from './util';

const DAY = 86_400_000;

/** Intervalles (en jours) par boîte de Leitner. Boîte 0 = à revoir immédiatement. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];

export function newCard(deckId: string, front: string, back: string): Card {
  return {
    id: uid(),
    deckId,
    front,
    back,
    createdAt: Date.now(),
    box: 0,
    due: 0,
    reps: 0,
    lapses: 0,
  };
}

export function isDue(card: Card, now = Date.now()): boolean {
  return card.due <= now;
}

/** Applique une réponse (sue / à revoir) et planifie la prochaine révision. */
export function grade(card: Card, known: boolean, now = Date.now()): Card {
  const box = known ? Math.min(card.box + 1, INTERVALS.length - 1) : 0;
  const due = box === 0 ? now : startOfDay(now) + INTERVALS[box] * DAY;
  return {
    ...card,
    box,
    due,
    reps: card.reps + 1,
    lapses: card.lapses + (known ? 0 : 1),
  };
}
