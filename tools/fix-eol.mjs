// tools/fix-eol.mjs — force LF on the generator before it runs.
// Defends the byte-exact gate against git autocrlf smudging on checkout.
import fs from 'fs';
for (const f of ['split.mjs']){
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('\r')) { fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); console.log('normalized', f); }
  else console.log('already LF', f);
}
