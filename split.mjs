// split.mjs — deterministic module extraction from deer-blind.src.html
// Reads ./deer-blind.src.html (the verified single source of truth) and
// generates the src/ module tree + index.html. Code is relocated, not rewritten;
// the only edits are removing three functions that move into hub.ts verbatim.
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('deer-blind.src.html'), 'utf8');

function between(startAnchor, endAnchor, { includeStart = false, includeEnd = false } = {}) {
  const si = SRC.indexOf(startAnchor);
  if (si < 0) throw new Error('start anchor not found: ' + startAnchor.slice(0, 60));
  const from = includeStart ? si : si + startAnchor.length;
  const ei = SRC.indexOf(endAnchor, from);
  if (ei < 0) throw new Error('end anchor not found: ' + endAnchor.slice(0, 60));
  const to = includeEnd ? ei + endAnchor.length : ei;
  return SRC.slice(from, to);
}
function cut(code, exactBlock, label) {
  if (!code.includes(exactBlock)) throw new Error('cut block not found: ' + label);
  return code.replace(exactBlock, '');
}
const w = (rel, content) => {
  const p = path.resolve(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log('wrote', rel.padEnd(24), String(content.length).padStart(7), 'bytes');
};

/* ---------- styles ---------- */
const css1 = between('/* ---------- tokens ---------- */', '</style>', { includeStart: true });
const css2 = between('<style id="css-views">', '</style>').replace(/^\n?/, '');
w('src/styles/app.css', css1 + '\n' + css2);
w('src/styles/fonts.css', `/* real font pipeline — vite inlines these as base64 in the singlefile build */
@import '@fontsource/chakra-petch/latin-600.css';
@import '@fontsource/ibm-plex-sans/latin-400.css';
@import '@fontsource/ibm-plex-sans/latin-500.css';
@import '@fontsource/ibm-plex-sans/latin-600.css';
@import '@fontsource/ibm-plex-mono/latin-400.css';
@import '@fontsource/ibm-plex-mono/latin-600.css';
`);

/* ---------- index.html ---------- */
const bodyMarkup = between('<body>\n', '\n<script>')
  .replace('BLIND v0.8', 'BLIND v0.9'); // the conversion release
const favicon = between('<link rel="icon"', '>\n<style>', { includeStart: true });
w('index.html', `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deer Blind — a field console for DeerFlow 2.0</title>
${favicon}>
</head>
<body>
${bodyMarkup}
<script type="module" src="/src/main.ts"></script>
</body>
</html>
`);

/* ---------- JS slices ---------- */
const slice = (a, b) => between(a, b, { includeStart: true, includeEnd: false });
const B = {
  utils:    slice(`/* ---------- tiny utils ---------- */`, `/* ---------- state ---------- */`),
  state:    slice(`/* ---------- state ---------- */`, `/* ---------- mock catalog ---------- */`),
  mockdata: slice(`/* ---------- mock catalog ---------- */`, `/* ---------- mock run scripting ---------- */`),
  engine:   slice(`/* ---------- mock run scripting ---------- */`, `/* =========================================================================\n   charts`),
  charts:   slice(`/* =========================================================================\n   charts`, `/* =========================================================================\n   renderers`),
  render:   slice(`/* =========================================================================\n   renderers`, `/* =========================================================================\n   live adapter`),
  adapter:  slice(`/* =========================================================================\n   live adapter`, `/* =========================================================================\n   toasts, clock, boot`),
  boot:     slice(`/* =========================================================================\n   toasts, clock, boot`, `boot();\n</script>`),
};

/* three tiny functions move verbatim into hub.ts to break import cycles */
const TOAST_FN = `function toast(k, msg, isErr){
  const t = document.createElement('div');
  t.className = 'toast'+(isErr?' crit':'');
  t.innerHTML = \`<span class="t-k">\${esc(k).toUpperCase()}</span>\${esc(msg)}\`;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(), 350); }, 4200);
}
`;
const NOTE_FN = `function note(what, e){ console.warn('[blind] '+what+':', e.message); }
const _onceToasts = new Set();
function pushToastOnce(k, msg){ if (_onceToasts.has(k)) return; _onceToasts.add(k); toast(k, msg); }
`;
B.boot = cut(B.boot, TOAST_FN, 'toast in boot');
B.adapter = cut(B.adapter, NOTE_FN, 'note/pushToastOnce in adapter');
B.engine = B.engine.replace('_exported from Deer Blind v0.6_', '_exported from Deer Blind_');

const H = {
  utils: `// utils.ts — helpers, formatting, markdown, reasoning-stripper\n`,
  state: `// state.ts — the one store\n`,
  mockdata: `// mockdata.ts — demo catalog + artifact bodies\n`,
  engine: `// engine.ts — mock run scripting, run helpers, field report\nimport { S } from './state';\nimport { mulberry, fmtTok, fmtNum, fmtBytes, fmtDur, fmtT } from './utils';\nimport { renderIfActive, renderAll, renderStrip, toast } from './hub';\nimport { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP, ART_REPORT, ART_CHART_HTML, ART_SOURCES, ART_SLIDES } from './mockdata';\nimport { Live } from './adapter';\n`,
  charts: `// charts.ts — hand-rolled SVG, single hue, thin marks\nimport { fmtTok, fmtNum } from './utils';\n`,
  render: `// render.ts — every view renderer + dispatch\nimport { S } from './state';\nimport { $, $$, esc, fmtTok, fmtNum, fmtBytes, fmtT, fmtAgo, fmtDur, md, stripThink } from './utils';\nimport { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP } from './mockdata';\nimport { nid, pushEvent, startMockRun, stopRun, fieldReport } from './engine';\nimport { sparkSVG, tokChartSVG, wireTokChart } from './charts';\nimport { Live } from './adapter';\nimport { toast } from './hub';\n`,
  adapter: `// adapter.ts — Live: verified against the deer-flow backend source\nimport { S } from './state';\nimport { $, fmtNum, stripThink } from './utils';\nimport { nid, mkRun, mkAgent, art, pushEvent } from './engine';\nimport { renderAll, renderIfActive, renderStrip, renderNavCounts, renderChat, renderOps, renderTop, toast, note, pushToastOnce } from './hub';\n`,
  boot: `// main.ts — boot + wiring\nimport './styles/fonts.css';\nimport './styles/app.css';\nimport { S } from './state';\nimport { $, $$, esc, fmtClock, fmtDur } from './utils';\nimport { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP } from './mockdata';\nimport { seedMockWorld } from './engine';\nimport { Live } from './adapter';\nimport { wireHub, toast } from './hub';\nimport { setView, dispatch, renderOps, renderPending, renderAll, renderTop, renderStrip, renderIfActive, renderNavCounts, renderChat } from './render';\n`,
};
const X = {
  utils: `\nexport { $, $$, esc, fmtTok, fmtNum, fmtBytes, fmtClock, fmtT, fmtAgo, fmtDur, mulberry, debounce, md, stripThink };\n`,
  state: `\nexport { S };\n`,
  mockdata: `\nexport { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP, ART_REPORT, ART_CHART_HTML, ART_SOURCES, ART_SLIDES };\n`,
  engine: `\nexport { nid, seedMockWorld, mkRun, mkAgent, ev, art, startMockRun, stopRun, pushEvent, fieldReport };\n`,
  charts: `\nexport { sparkSVG, tokChartSVG, niceStep, wireTokChart };\n`,
  render: `\nexport { setView, renderIfActive, renderView, renderAll, statusChip, renderNavCounts, renderTop, renderStrip, renderOps, renderChat, renderComposer, deleteThread, renderPending, dispatch, renderTele, renderFeedLines, allArtifacts, renderArts, fileIcon, antlerSVG, renderStation };\n`,
  adapter: `\nexport { Live, testConnection, checkRelease };\n`,
};

/* testConnection/checkRelease live in the boot slice; move them to adapter so
   render/station wiring in main can import them from one place */
const TESTCONN = between('async function testConnection(){', '\nfunction boot(){');
B.adapter += '\nasync function testConnection(){' + TESTCONN + '\n';
B.boot = B.boot.replace('async function testConnection(){' + TESTCONN + '\n', '');

w('src/utils.ts', H.utils + B.utils + X.utils);
w('src/state.ts', H.state + B.state + X.state);
w('src/mockdata.ts', H.mockdata + B.mockdata + X.mockdata);
w('src/engine.ts', H.engine + B.engine + X.engine);
w('src/charts.ts', H.charts + B.charts + X.charts);
w('src/render.ts', H.render + B.render + X.render);
w('src/adapter.ts', H.adapter + B.adapter + X.adapter);
w('src/main.ts', H.boot + `import { testConnection, checkRelease } from './adapter';\n` + B.boot + `
wireHub({ renderAll, renderIfActive, renderStrip, renderNavCounts, renderChat, renderOps, renderTop });
boot();
`);
w('src/hub.ts', `// hub.ts — late-bound UI entry points + shared toast (breaks import cycles)
import { $, esc } from './utils';
type Fn = (...a: any[]) => any;
export let renderAll: Fn = () => {};
export let renderIfActive: Fn = () => {};
export let renderStrip: Fn = () => {};
export let renderNavCounts: Fn = () => {};
export let renderChat: Fn = () => {};
export let renderOps: Fn = () => {};
export let renderTop: Fn = () => {};
export function wireHub(f: Record<string, Fn>){
  renderAll = f.renderAll; renderIfActive = f.renderIfActive; renderStrip = f.renderStrip;
  renderNavCounts = f.renderNavCounts; renderChat = f.renderChat; renderOps = f.renderOps; renderTop = f.renderTop;
}
${TOAST_FN}${NOTE_FN}export { toast, note, pushToastOnce };
`);
console.log('split complete');
