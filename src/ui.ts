type Child = Node | string | null | undefined | false;

/** Mini helper de création de DOM (pas d'innerHTML : le contenu utilisateur reste du texte). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  let deferredValue: unknown;
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key === 'class') {
        el.className = String(value);
      } else if (key === 'value') {
        deferredValue = value; // appliqué après les enfants (utile pour <select>)
      } else if (key in el) {
        (el as unknown as Record<string, unknown>)[key] = value;
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  for (const child of children) {
    if (child != null && child !== false) el.append(child);
  }
  if (deferredValue !== undefined) {
    (el as unknown as { value: string }).value = String(deferredValue);
  }
  return el;
}

let toastTimer: number | undefined;

export function toast(message: string): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const LANGS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Aucune (pas de lecture audio)'],
  ['fr-FR', 'Français'],
  ['en-GB', 'Anglais (UK)'],
  ['en-US', 'Anglais (US)'],
  ['es-ES', 'Espagnol'],
  ['de-DE', 'Allemand'],
  ['it-IT', 'Italien'],
  ['nl-NL', 'Néerlandais'],
  ['pt-PT', 'Portugais'],
  ['ru-RU', 'Russe'],
  ['ja-JP', 'Japonais'],
  ['zh-CN', 'Chinois'],
  ['ko-KR', 'Coréen'],
  ['ar-SA', 'Arabe'],
];

export function canSpeak(lang: string): boolean {
  return Boolean(lang) && 'speechSynthesis' in window;
}

/** Lecture audio via la synthèse vocale de l'appareil (fonctionne hors ligne si une voix est installée). */
export function speak(text: string, lang: string): void {
  if (!canSpeak(lang)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function langSelect(value: string, label: string): HTMLSelectElement {
  return h(
    'select',
    { value, 'aria-label': label },
    ...LANGS.map(([code, name]) => h('option', { value: code }, name)),
  );
}

export function backLink(href: string, label: string): HTMLAnchorElement {
  return h('a', { class: 'back', href }, `← ${label}`);
}

export function refresh(): void {
  window.dispatchEvent(new Event('app:refresh'));
}
