// tools/gate-hash.mjs — deterministic hash of the generated module tree.
// Run after split.mjs; the printed hash must match the value in the migration notes.
import crypto from 'crypto';
import fs from 'fs';
const files = ['src/adapter.ts','src/charts.ts','src/engine.ts','src/hub.ts','src/main.ts',
  'src/mockdata.ts','src/render.ts','src/state.ts','src/utils.ts',
  'src/styles/app.css','src/styles/fonts.css','index.html'];
const h = crypto.createHash('md5');
for (const f of files){ h.update(f); h.update(fs.readFileSync(f)); }
console.log('GATE-HASH', h.digest('hex'));
