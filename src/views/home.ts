import { exportAll, getAllCards, getDecks, importAll, saveCards, saveDeck } from '../db';
import { newCard } from '../srs';
import type { Deck, ViewResult } from '../types';
import { downloadJSON, h, refresh, toast } from '../ui';
import { plural, uid } from '../util';

function makeDeck(name: string, frontLang = '', backLang = ''): Deck {
  const now = Date.now();
  return { id: uid(), name, frontLang, backLang, createdAt: now, updatedAt: now };
}

async function createExample(): Promise<void> {
  const deck = makeDeck('Exemple – Anglais de base', 'en-GB', 'fr-FR');
  await saveDeck(deck);
  const pairs: Array<[string, string]> = [
    ['Hello', 'Bonjour'],
    ['Thank you', 'Merci'],
    ['Goodbye', 'Au revoir'],
    ['Please', "S'il vous plaît"],
    ['Water', 'Eau'],
    ['Book', 'Livre'],
  ];
  await saveCards(pairs.map(([front, back]) => newCard(deck.id, front, back)));
  location.hash = `#/deck/${deck.id}`;
}

export async function renderHome(): Promise<ViewResult> {
  const [decks, cards] = await Promise.all([getDecks(), getAllCards()]);
  const now = Date.now();

  const stats = new Map<string, { total: number; due: number }>();
  for (const card of cards) {
    const s = stats.get(card.deckId) ?? { total: 0, due: 0 };
    s.total++;
    if (card.due <= now) s.due++;
    stats.set(card.deckId, s);
  }

  // --- Création d'une liste ---
  const nameInput = h('input', {
    type: 'text',
    placeholder: 'Nom de la nouvelle liste (ex. Vocabulaire espagnol)',
    maxLength: 80,
    required: true,
    autocomplete: 'off',
    'aria-label': 'Nom de la nouvelle liste',
  });
  const createForm = h(
    'form',
    {
      class: 'row',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        const deck = makeDeck(name);
        await saveDeck(deck);
        location.hash = `#/deck/${deck.id}`;
      },
    },
    nameInput,
    h('button', { class: 'btn primary', type: 'submit' }, 'Créer'),
  );

  // --- Liste des decks ---
  let listEl: HTMLElement;
  if (decks.length === 0) {
    listEl = h(
      'div',
      { class: 'empty' },
      h('p', null, "Aucune liste pour l'instant."),
      h('p', { class: 'muted' }, 'Crée ta première liste ci-dessus, ou essaie avec un exemple.'),
      h('button', { class: 'btn', type: 'button', onclick: () => void createExample() }, "Ajouter une liste d'exemple"),
    );
  } else {
    listEl = h(
      'ul',
      { class: 'deck-list' },
      ...decks.map((deck) => {
        const s = stats.get(deck.id) ?? { total: 0, due: 0 };
        return h(
          'li',
          { class: 'deck-item' },
          h(
            'a',
            { class: 'deck-link', href: `#/deck/${deck.id}` },
            h('span', { class: 'deck-name' }, deck.name),
            h(
              'span',
              { class: 'muted small' },
              `${plural(s.total, 'carte', 'cartes')} · ${s.due > 0 ? `${s.due} à réviser` : 'à jour ✓'}`,
            ),
          ),
          s.due > 0 &&
            h('a', { class: 'btn primary small-btn', href: `#/study/${deck.id}?mode=due` }, 'Réviser'),
        );
      }),
    );
  }

  // --- Sauvegarde ---
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const result = await importAll(JSON.parse(await file.text()));
        toast(`Importé : ${plural(result.decks, 'liste', 'listes')}, ${plural(result.cards, 'carte', 'cartes')}`);
        refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Échec de l'import");
      } finally {
        fileInput.value = '';
      }
    },
  });

  const backup = h(
    'details',
    { class: 'panel' },
    h('summary', null, 'Sauvegarde et restauration'),
    h(
      'p',
      { class: 'muted small' },
      "Tes données sont stockées uniquement sur cet appareil. Exporte-les régulièrement pour les sauvegarder ou les transférer.",
    ),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: async () => {
            const date = new Date().toISOString().slice(0, 10);
            downloadJSON(`flashcards-sauvegarde-${date}.json`, await exportAll());
          },
        },
        'Exporter (.json)',
      ),
      h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Importer…'),
      fileInput,
    ),
  );

  const totalDue = [...stats.values()].reduce((n, s) => n + s.due, 0);

  const el = h(
    'div',
    { class: 'view' },
    h('h1', null, 'Mes listes'),
    decks.length > 0 &&
      h(
        'p',
        { class: 'muted' },
        totalDue > 0 ? `${plural(totalDue, 'carte', 'cartes')} à réviser aujourd'hui.` : "Rien à réviser pour l'instant 🎉",
      ),
    createForm,
    listEl,
    backup,
  );
  return { el };
}
