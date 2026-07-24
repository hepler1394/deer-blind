// build deer-blind.html from src + @fontsource woff2 (run: node build-blind.mjs)
import fs from 'fs';
const b64 = p => fs.readFileSync(p).toString('base64');
const F = {
  __F_CHAKRA600__: 'node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-600-normal.woff2',
  __F_SANS400__:   'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
  __F_SANS500__:   'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2',
  __F_SANS600__:   'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
  __F_MONO400__:   'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
  __F_MONO600__:   'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2',
};
let src = fs.readFileSync('deer-blind.src.html','utf8');
for (const [k,p] of Object.entries(F)) src = src.replaceAll(k, b64(p));
fs.writeFileSync('deer-blind.html', src);
console.log('built deer-blind.html', src.length, 'bytes');
