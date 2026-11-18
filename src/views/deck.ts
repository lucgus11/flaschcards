import { deleteCard, deleteDeck, getCards, getDeck, saveCard, saveCards, saveDeck } from '../db';
import { isDue, newCard } from '../srs';
import type { Card, Dir, ViewResult } from '../types';
import { backLink, h, langSelect, toast } from '../ui';
import { parseBulk, plural } from '../util';

const DIR_KEY = 'fc.dir';

function loadDir(): Dir {
  try {
    const v = localStorage.getItem(DIR_KEY);
    if (v === 'fb' || v === 'bf' || v === 'mix') return v;
  } catch {
    /* stockage indisponible */
  }
  return 'fb';
}

function saveDir(dir: Dir): void {
  try {
    localStorage.setItem(DIR_KEY, dir);
  } catch {
    /* ignore */
  }
}

export async function renderDeck(id: string): Promise<ViewResult> {
  const deck = await getDeck(id);
  if (!deck) {
    return {
      el: h(
        'div',
        { class: 'view' },
        backLink('#/', 'Mes listes'),
        h('p', null, "Cette liste n'existe pas (ou a été supprimée)."),
      ),
    };
  }

  let cards: Card[] = (await getCards(id)).sort((a, b) => a.createdAt - b.createdAt);

  const title = h('h1', null, deck.name);
  const statsEl = h('p', { class: 'muted' });
  const listEl = h('div', { class: 'card-list' });
  const filterInput = h('input', {
    type: 'search',
    placeholder: 'Rechercher dans la liste…',
    'aria-label': 'Rechercher une carte',
    oninput: () => applyFilter(),
  });

  // --- Lancement de la révision ---
  const dirSelect = h(
    'select',
    {
      value: loadDir(),
      'aria-label': 'Sens de révision',
      onchange: () => saveDir(dirSelect.value as Dir),
    },
    h('option', { value: 'fb' }, 'Terme → définition'),
    h('option', { value: 'bf' }, 'Définition → terme'),
    h('option', { value: 'mix' }, 'Mélangé'),
  );
  const dueBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => go('due') });
  const allBtn = h('button', { class: 'btn', type: 'button', onclick: () => go('all') }, 'Tout réviser');
  function go(mode: 'due' | 'all'): void {
    location.hash = `#/study/${id}?mode=${mode}&dir=${dirSelect.value}`;
  }

  // --- Ajout d'une carte ---
  const frontInput = h('input', {
    type: 'text',
    placeholder: 'Terme',
    required: true,
    autocomplete: 'off',
    autocapitalize: 'off',
    'aria-label': 'Terme (face avant)',
  });
  const backInput = h('input', {
    type: 'text',
    placeholder: 'Définition / traduction',
    required: true,
    autocomplete: 'off',
    autocapitalize: 'off',
    'aria-label': 'Définition (face arrière)',
  });
  const addForm = h(
    'form',
    {
      class: 'add-form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const front = frontInput.value.trim();
        const back = backInput.value.trim();
        if (!front || !back) return;
        const card = newCard(id, front, back);
        await saveCard(card, id);
        cards.push(card);
        frontInput.value = '';
        backInput.value = '';
        update();
        frontInput.focus();
      },
    },
    frontInput,
    backInput,
    h('button', { class: 'btn primary', type: 'submit' }, 'Ajouter'),
  );

  // --- Import en masse ---
  const bulkText = h('textarea', {
    rows: 6,
    placeholder: 'chat ; cat\nchien ; dog\nmaison ; house',
    'aria-label': 'Cartes à importer',
    oninput: () => {
      const { cards: parsed, skipped } = parseBulk(bulkText.value);
      bulkInfo.textContent =
        bulkText.value.trim() === ''
          ? ''
          : `${plural(parsed.length, 'carte détectée', 'cartes détectées')}${skipped ? ` · ${plural(skipped, 'ligne ignorée', 'lignes ignorées')}` : ''}`;
    },
  });
  const bulkInfo = h('span', { class: 'muted small' });
  const bulkForm = h(
    'form',
    {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const { cards: parsed } = parseBulk(bulkText.value);
        if (parsed.length === 0) {
          toast('Aucune carte détectée');
          return;
        }
        const created = parsed.map((p) => newCard(id, p.front, p.back));
        await saveCards(created, id);
        cards.push(...created);
        bulkText.value = '';
        bulkInfo.textContent = '';
        update();
        toast(`${plural(created.length, 'carte ajoutée', 'cartes ajoutées')}`);
      },
    },
    h(
      'p',
      { class: 'muted small' },
      'Une carte par ligne : terme et définition séparés par « ; », une tabulation (copier-coller depuis Quizlet ou un tableur), « = » ou « - ».',
    ),
    bulkText,
    h('div', { class: 'row space' }, bulkInfo, h('button', { class: 'btn', type: 'submit' }, 'Importer')),
  );

  // --- Paramètres ---
  const nameInput = h('input', { type: 'text', value: deck.name, maxLength: 80, required: true, 'aria-label': 'Nom de la liste' });
  const frontLang = langSelect(deck.frontLang, 'Langue du terme');
  const backLang = langSelect(deck.backLang, 'Langue de la définition');
  const settings = h(
    'details',
    { class: 'panel' },
    h('summary', null, 'Paramètres de la liste'),
    h(
      'form',
      {
        class: 'stack',
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const name = nameInput.value.trim();
          if (!name) return;
          deck.name = name;
          deck.frontLang = frontLang.value;
          deck.backLang = backLang.value;
          deck.updatedAt = Date.now();
          await saveDeck(deck);
          title.textContent = name;
          toast('Paramètres enregistrés');
        },
      },
      h('label', null, 'Nom', nameInput),
      h('label', null, 'Langue du terme (lecture audio)', frontLang),
      h('label', null, 'Langue de la définition (lecture audio)', backLang),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Enregistrer')),
    ),
    h(
      'button',
      {
        class: 'btn danger',
        type: 'button',
        onclick: async () => {
          if (!confirm(`Supprimer la liste « ${deck.name} » et ses ${cards.length} cartes ? Cette action est définitive.`)) return;
          await deleteDeck(id);
          toast('Liste supprimée');
          location.hash = '#/';
        },
      },
      'Supprimer la liste',
    ),
  );

  // --- Lignes de cartes ---
  const rows = new Map<string, HTMLElement>();

  function buildRow(card: Card): HTMLElement {
    const row = h('div', { class: 'card-row' });
    const showView = (): void => {
      row.replaceChildren(
        h('div', { class: 'texts' }, h('strong', null, card.front), h('span', { class: 'muted' }, card.back)),
        h(
          'div',
          { class: 'row-actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Modifier', title: 'Modifier', onclick: showEdit }, '✏️'),
          h(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              'aria-label': 'Supprimer',
              title: 'Supprimer',
              onclick: async () => {
                await deleteCard(card.id);
                cards = cards.filter((c) => c.id !== card.id);
                update();
              },
            },
            '🗑️',
          ),
        ),
      );
    };
    const showEdit = (): void => {
      const f = h('input', { type: 'text', value: card.front, required: true, 'aria-label': 'Terme' });
      const b = h('input', { type: 'text', value: card.back, required: true, 'aria-label': 'Définition' });
      row.replaceChildren(
        h(
          'form',
          {
            class: 'edit-form',
            onsubmit: async (e: Event) => {
              e.preventDefault();
              const front = f.value.trim();
              const back = b.value.trim();
              if (!front || !back) return;
              card.front = front;
              card.back = back;
              await saveCard(card, id);
              showView();
              applyFilter();
            },
          },
          f,
          b,
          h('button', { class: 'btn primary small-btn', type: 'submit' }, 'OK'),
          h('button', { class: 'btn small-btn', type: 'button', onclick: showView }, 'Annuler'),
        ),
      );
      f.focus();
    };
    showView();
    return row;
  }

  function applyFilter(): void {
    const q = filterInput.value.trim().toLowerCase();
    for (const card of cards) {
      const row = rows.get(card.id);
      if (row) row.hidden = q !== '' && !`${card.front} ${card.back}`.toLowerCase().includes(q);
    }
  }

  function update(): void {
    const now = Date.now();
    const due = cards.filter((c) => isDue(c, now)).length;
    statsEl.textContent = `${plural(cards.length, 'carte', 'cartes')} · ${due} à réviser`;
    dueBtn.textContent = due > 0 ? `Réviser (${due})` : 'Rien à réviser';
    dueBtn.disabled = due === 0;
    allBtn.disabled = cards.length === 0;

    rows.clear();
    const els = cards.map((card) => {
      const row = buildRow(card);
      rows.set(card.id, row);
      return row;
    });
    listEl.replaceChildren(
      ...(els.length > 0 ? els : [h('p', { class: 'muted empty' }, 'Aucune carte. Ajoute-en une ci-dessus.')]),
    );
    filterInput.hidden = cards.length < 8;
    applyFilter();
  }

  update();

  const el = h(
    'div',
    { class: 'view' },
    backLink('#/', 'Mes listes'),
    title,
    statsEl,
    h('div', { class: 'study-launch' }, dirSelect, h('div', { class: 'row' }, dueBtn, allBtn)),
    h('h2', null, 'Ajouter une carte'),
    addForm,
    h('details', { class: 'panel' }, h('summary', null, 'Importer en masse'), bulkForm),
    h('h2', null, 'Cartes'),
    filterInput,
    listEl,
    settings,
  );
  return { el };
}
