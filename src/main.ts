import { registerSW } from 'virtual:pwa-register';
import './style.css';
import type { Dir, ViewResult } from './types';
import { h, toast } from './ui';
import { renderDeck } from './views/deck';
import { renderHome } from './views/home';
import { renderStudy } from './views/study';

// ---------- Service worker (mode hors ligne) ----------
registerSW({
  immediate: true,
  onOfflineReady() {
    toast("Prête à fonctionner hors ligne ✓");
  },
});

// Demande à ne pas purger les données (IndexedDB) en cas de manque d'espace.
void navigator.storage?.persist?.();

// ---------- Coque de l'application ----------
const app = document.getElementById('app')!;

const netBadge = h('span', { class: 'net', role: 'status' });
function updateNet(): void {
  const online = navigator.onLine;
  netBadge.textContent = online ? '' : 'Hors ligne';
  netBadge.hidden = online;
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

const view = h('main', { class: 'container', id: 'view' });
app.replaceChildren(
  h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('img', { src: '/icon.svg', alt: '', width: 28, height: 28 }), 'Flashcards'), netBadge),
  view,
);

// ---------- Routeur (hash) ----------
let cleanup: (() => void) | undefined;
let token = 0;

function notFound(): ViewResult {
  return { el: h('div', { class: 'view' }, h('p', null, 'Page introuvable.'), h('a', { class: 'btn', href: '#/' }, "Retour à l'accueil")) };
}

async function resolve(): Promise<ViewResult> {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const [name, id] = path.split('/').filter(Boolean);

  if (!name) return renderHome();
  if (name === 'deck' && id) return renderDeck(id);
  if (name === 'study' && id) {
    const dirParam = params.get('dir');
    const dir: Dir = dirParam === 'bf' || dirParam === 'mix' ? dirParam : 'fb';
    return renderStudy(id, params.get('mode') === 'all' ? 'all' : 'due', dir);
  }
  return notFound();
}

async function render(): Promise<void> {
  const mine = ++token;
  let result: ViewResult;
  try {
    result = await resolve();
  } catch (err) {
    console.error(err);
    result = { el: h('div', { class: 'view' }, h('p', null, "Une erreur est survenue."), h('a', { class: 'btn', href: '#/' }, 'Accueil')) };
  }
  if (mine !== token) {
    result.cleanup?.(); // une navigation plus récente a pris le relais
    return;
  }
  cleanup?.();
  cleanup = result.cleanup;
  view.replaceChildren(result.el);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void render());
window.addEventListener('app:refresh', () => void render());
void render();
