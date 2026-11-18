import { getCards, getDeck, saveCard } from '../db';
import { grade, isDue } from '../srs';
import type { Card, Dir, ViewResult } from '../types';
import { backLink, canSpeak, h, refresh, speak } from '../ui';
import { plural, shuffle } from '../util';

export async function renderStudy(deckId: string, mode: 'due' | 'all', dir: Dir): Promise<ViewResult> {
  const deck = await getDeck(deckId);
  const wrap = h('div', { class: 'view study' });

  if (!deck) {
    wrap.append(backLink('#/', 'Mes listes'), h('p', null, "Cette liste n'existe pas."));
    return { el: wrap };
  }

  const all = await getCards(deckId);
  const now = Date.now();
  const queue: Card[] = shuffle(mode === 'due' ? all.filter((c) => isDue(c, now)) : all);

  const back = backLink(`#/deck/${deckId}`, 'Quitter');

  if (queue.length === 0) {
    wrap.append(
      back,
      h(
        'div',
        { class: 'empty' },
        h('h2', null, mode === 'due' ? 'Rien à réviser 🎉' : 'Cette liste est vide'),
        h('p', { class: 'muted' }, mode === 'due' ? 'Toutes les cartes sont à jour. Reviens plus tard !' : 'Ajoute des cartes pour commencer.'),
        h('a', { class: 'btn primary', href: `#/deck/${deckId}` }, 'Retour à la liste'),
      ),
    );
    return { el: wrap };
  }

  const total = queue.length;
  const reversed = new Map<string, boolean>();
  for (const card of queue) {
    reversed.set(card.id, dir === 'bf' ? true : dir === 'mix' ? Math.random() < 0.5 : false);
  }
  /** id → réponse au premier passage (seule celle-ci met à jour la répétition espacée) */
  const firstTry = new Map<string, boolean>();
  let flipped = false;
  let busy = false;

  const counter = h('span', { class: 'muted small' });
  const fill = h('div', { class: 'bar-fill' });
  const stage = h('div', { class: 'stage' });
  wrap.append(h('div', { class: 'row space' }, back, counter), h('div', { class: 'bar' }, fill), stage);

  function remaining(): number {
    return new Set(queue.map((c) => c.id)).size;
  }

  function updateProgress(): void {
    const done = total - remaining();
    fill.style.width = `${(done / total) * 100}%`;
    counter.textContent = `${done} / ${total}`;
  }

  function face(text: string, lang: string, cls: string, label: string): HTMLElement {
    return h(
      'div',
      { class: `face ${cls}` },
      h('span', { class: 'face-label' }, label),
      h('p', { class: 'face-text' }, text),
      canSpeak(lang) &&
        h(
          'button',
          {
            class: 'icon-btn speak',
            type: 'button',
            'aria-label': 'Écouter',
            title: 'Écouter',
            onclick: (e: Event) => {
              e.stopPropagation();
              speak(text, lang);
            },
          },
          '🔊',
        ),
    );
  }

  function show(): void {
    updateProgress();
    if (queue.length === 0) {
      finish();
      return;
    }
    flipped = false;
    busy = false;
    const card = queue[0];
    const rev = reversed.get(card.id) === true;
    const prompt = rev ? card.back : card.front;
    const answer = rev ? card.front : card.back;
    const promptLang = rev ? deck!.backLang : deck!.frontLang;
    const answerLang = rev ? deck!.frontLang : deck!.backLang;

    const actions = h('div', { class: 'actions' });
    const flipEl = h(
      'div',
      {
        class: 'flip',
        role: 'button',
        tabindex: 0,
        'aria-label': 'Retourner la carte',
        onclick: () => flip(),
        onkeydown: (e: Event) => {
          const key = (e as KeyboardEvent).key;
          if (key === 'Enter') {
            e.preventDefault();
            flip();
          }
        },
      },
      h(
        'div',
        { class: 'flip-inner' },
        face(prompt, promptLang, 'front', rev ? 'Définition' : 'Terme'),
        face(answer, answerLang, 'back', rev ? 'Terme' : 'Définition'),
      ),
    );

    const hint = h('button', { class: 'btn primary wide', type: 'button', onclick: () => flip() }, 'Retourner');
    actions.append(hint);

    function flip(): void {
      flipped = !flipped;
      flipEl.classList.toggle('flipped', flipped);
      if (flipped) {
        actions.replaceChildren(
          h('button', { class: 'btn bad', type: 'button', onclick: () => void answerCard(false) }, '✗ À revoir'),
          h('button', { class: 'btn good', type: 'button', onclick: () => void answerCard(true) }, '✓ Je savais'),
        );
        if (answerLang) speak(answer, answerLang);
      }
    }
    (flipEl as HTMLElement & { _flip?: () => void })._flip = flip;

    stage.replaceChildren(flipEl, actions, h('p', { class: 'muted small center' }, 'Espace : retourner · ← à revoir · → je savais'));
  }

  async function answerCard(known: boolean): Promise<void> {
    if (busy || queue.length === 0) return;
    busy = true;
    const card = queue.shift()!;
    if (!firstTry.has(card.id)) {
      firstTry.set(card.id, known);
      await saveCard(grade(card, known));
    }
    if (!known) queue.push(card);
    show();
  }

  function finish(): void {
    const right = [...firstTry.values()].filter(Boolean).length;
    const pct = Math.round((right / total) * 100);
    stage.replaceChildren(
      h(
        'div',
        { class: 'summary' },
        h('h2', null, 'Session terminée 🎉'),
        h('p', { class: 'big' }, `${pct} %`),
        h('p', { class: 'muted' }, `${right} sur ${plural(total, 'carte', 'cartes')} sues du premier coup.`),
        h(
          'div',
          { class: 'row center' },
          h('button', { class: 'btn', type: 'button', onclick: () => refresh() }, 'Recommencer'),
          h('a', { class: 'btn primary', href: `#/deck/${deckId}` }, 'Retour à la liste'),
        ),
      ),
    );
  }

  function onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'A')) return;
    if (queue.length === 0) return;
    if (e.key === ' ') {
      e.preventDefault();
      const flipEl = stage.querySelector<HTMLElement & { _flip?: () => void }>('.flip');
      if (!flipped) flipEl?._flip?.();
    } else if (flipped && e.key === 'ArrowLeft') {
      void answerCard(false);
    } else if (flipped && e.key === 'ArrowRight') {
      void answerCard(true);
    }
  }
  document.addEventListener('keydown', onKey);

  show();
  return {
    el: wrap,
    cleanup: () => {
      document.removeEventListener('keydown', onKey);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
  };
}
