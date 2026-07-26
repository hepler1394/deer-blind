// apply-ts.mjs — apply exact-string hunks {f,o,n} from a patch json to src files
import fs from 'fs';
const H = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let ok = 0; const miss = [];
for (let i = 0; i < H.length; i++){
  const { f, o, n } = H[i];
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes(o)) { fs.writeFileSync(f, s.split(o).join(n)); ok++; }
  else miss.push(i + ':' + f);
}
console.log('applied', ok, 'missing', JSON.stringify(miss));
