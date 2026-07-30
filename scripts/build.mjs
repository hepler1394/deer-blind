// build.mjs — one process, no shell chaining.
//
// The old build script was `vite build && node -e "…copyFileSync…"`, which
// could die between the two halves without printing a word under some
// non-interactive Windows shells — leaving a stale deer-blind.html that
// still "built fine". This drives Vite through its JS API instead, then
// copies and *verifies* the output, loudly.
//
// Usage: node scripts/build.mjs [dest]   (dest defaults to ./deer-blind.html)
import { build } from 'vite';
import { copyFileSync, statSync } from 'node:fs';

const dest = process.argv[2] || 'deer-blind.html';

await build(); // picks up vite.config.ts from the project root

const src = 'dist/index.html';
const size = statSync(src).size;
if (size < 100_000) {
  throw new Error(`[build] ${src} is suspiciously small (${size} B) — the bundle is likely broken, refusing to copy`);
}
copyFileSync(src, dest);
console.log(`[build] ${src} -> ${dest} (${size.toLocaleString()} B)`);
