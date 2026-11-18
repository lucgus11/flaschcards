import type { Backup, Card, Deck } from './types';

const DB_NAME = 'flashcards';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cards')) {
        const store = db.createObjectStore('cards', { keyPath: 'id' });
        store.createIndex('deckId', 'deckId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getDecks(): Promise<Deck[]> {
  const db = await open();
  const decks = await wrap<Deck[]>(db.transaction('decks').objectStore('decks').getAll());
  return decks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = await open();
  return wrap<Deck | undefined>(db.transaction('decks').objectStore('decks').get(id));
}

export async function saveDeck(deck: Deck): Promise<void> {
  const db = await open();
  const tx = db.transaction('decks', 'readwrite');
  tx.objectStore('decks').put(deck);
  await done(tx);
}

export async function deleteDeck(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(['decks', 'cards'], 'readwrite');
  tx.objectStore('decks').delete(id);
  const cards = tx.objectStore('cards');
  const keys = await wrap<IDBValidKey[]>(cards.index('deckId').getAllKeys(IDBKeyRange.only(id)));
  for (const key of keys) cards.delete(key);
  await done(tx);
}

export async function getCards(deckId: string): Promise<Card[]> {
  const db = await open();
  return wrap<Card[]>(
    db.transaction('cards').objectStore('cards').index('deckId').getAll(IDBKeyRange.only(deckId)),
  );
}

export async function getAllCards(): Promise<Card[]> {
  const db = await open();
  return wrap<Card[]>(db.transaction('cards').objectStore('cards').getAll());
}

export async function saveCards(cards: Card[], touchDeckId?: string): Promise<void> {
  if (cards.length === 0) return;
  const db = await open();
  const tx = db.transaction(['cards', 'decks'], 'readwrite');
  const store = tx.objectStore('cards');
  for (const card of cards) store.put(card);
  if (touchDeckId) {
    const decks = tx.objectStore('decks');
    const deck = await wrap<Deck | undefined>(decks.get(touchDeckId));
    if (deck) decks.put({ ...deck, updatedAt: Date.now() });
  }
  await done(tx);
}

export function saveCard(card: Card, touchDeckId?: string): Promise<void> {
  return saveCards([card], touchDeckId);
}

export async function deleteCard(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction('cards', 'readwrite');
  tx.objectStore('cards').delete(id);
  await done(tx);
}

// ---------- Sauvegarde / restauration ----------

export async function exportAll(): Promise<Backup> {
  const [decks, cards] = await Promise.all([getDecks(), getAllCards()]);
  return { app: 'flashcards-pwa', version: 1, exportedAt: new Date().toISOString(), decks, cards };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}

function num(x: unknown, fallback = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function normalizeDeck(x: unknown): Deck | null {
  if (!isObj(x) || typeof x.id !== 'string' || typeof x.name !== 'string') return null;
  const now = Date.now();
  return {
    id: x.id,
    name: x.name,
    frontLang: str(x.frontLang),
    backLang: str(x.backLang),
    createdAt: num(x.createdAt, now),
    updatedAt: num(x.updatedAt, now),
  };
}

function normalizeCard(x: unknown): Card | null {
  if (
    !isObj(x) ||
    typeof x.id !== 'string' ||
    typeof x.deckId !== 'string' ||
    typeof x.front !== 'string' ||
    typeof x.back !== 'string'
  ) {
    return null;
  }
  return {
    id: x.id,
    deckId: x.deckId,
    front: x.front,
    back: x.back,
    createdAt: num(x.createdAt, Date.now()),
    box: num(x.box),
    due: num(x.due),
    reps: num(x.reps),
    lapses: num(x.lapses),
  };
}

/** Fusionne une sauvegarde dans la base (les éléments de même id sont remplacés). */
export async function importAll(data: unknown): Promise<{ decks: number; cards: number }> {
  if (!isObj(data) || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
    throw new Error('Fichier de sauvegarde invalide.');
  }
  const decks = data.decks.map(normalizeDeck).filter((d): d is Deck => d !== null);
  const cards = data.cards.map(normalizeCard).filter((c): c is Card => c !== null);
  const db = await open();
  const tx = db.transaction(['decks', 'cards'], 'readwrite');
  for (const d of decks) tx.objectStore('decks').put(d);
  for (const c of cards) tx.objectStore('cards').put(c);
  await done(tx);
  return { decks: decks.length, cards: cards.length };
}
