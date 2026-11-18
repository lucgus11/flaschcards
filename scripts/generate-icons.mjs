// Génère les icônes PNG de la PWA à partir de public/icon.svg.
// Usage : npm run icons
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = await readFile(new URL('../public/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

// Icônes « any » : coins arrondis transparents
await sharp(source).resize(192, 192).png().toFile(out('pwa-192x192.png'));
await sharp(source).resize(512, 512).png().toFile(out('pwa-512x512.png'));

// Version pleine page (sans coins arrondis) : base du maskable et de l'icône iOS
const fullBleed = (scale) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#4f46e5"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="116" y="150" width="280" height="212" rx="32" fill="#fff"/>
    <rect x="156" y="226" width="200" height="22" rx="11" fill="#4f46e5"/>
    <rect x="156" y="270" width="140" height="22" rx="11" fill="#a5b4fc"/>
  </g>
</svg>`);

// Maskable : contenu dans la « safe zone » (80 % centraux)
await sharp(fullBleed(0.75)).resize(512, 512).png().toFile(out('maskable-512x512.png'));
await sharp(fullBleed(1)).resize(180, 180).png().toFile(out('apple-touch-icon.png'));

console.log('Icônes générées dans public/');
