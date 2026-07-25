// engine.ts — mock run scripting, run helpers, field report
import { S } from './state';
import { mulberry, fmtTok, fmtNum, fmtBytes, fmtDur, fmtT } from './utils';
import { renderIfActive, renderAll, renderStrip, toast } from './hub';
import { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP, ART_REPORT, ART_CHART_HTML, ART_SOURCES, ART_SLIDES } from './mockdata';
import { Live } from './adapter';
/* ---------- mock run scripting ---------- */
let _id = 100;
const nid = p => `${p}_${(_id++).toString(36)}`;

function seedMockWorld(){
  const now = Date.now();
  /* finished demo thread with a full run trail */
  const t1: any = { id: nid('th'), title: 'Map the US retail media networks — who is growing, who is stalling',
    createdAt: now - 1000*60*38, status: 'ok', messages: [], runIds: [] };
  const r1 = mkRun(t1.id, now - 1000*60*38);
  r1.status='ok'; r1.endedAt = now - 1000*60*31;
  r1.agents = [
    mkAgent('atlas','lead','synthesize the scan; delegate recon and analysis', 'ok', 41200, .43, 0),
    mkAgent('scout-1','web','network revenue + growth: earnings, forecasts','ok', 28400, .31, 1),
    mkAgent('scout-2','web','measurement disputes, in-store, off-site moves','ok', 24100, .27, 1),
    mkAgent('analyst','sandbox','normalize tables, compute CPM deltas','ok', 15800, .22, 1),
    mkAgent('scribe','report','draft field scan + deck outline','ok', 19600, .35, 1),
  ];
  r1.tokens = 129100; r1.toolCalls = 23;
  r1.tokSeries = [3.1,7.8,12.4,16.0,14.2,18.9,22.6,17.3,11.0,8.4,5.2,2.3].map(v=>v*1000);
  const T0 = r1.startedAt;
  r1.events = [
    ev(T0+1200,'atlas','sys','run accepted — decomposing brief into 4 work items'),
    ev(T0+4200,'atlas','tool','spawn(scout-1, scout-2) — parallel recon'),
    ev(T0+6900,'scout-1','tool','search("retail media network revenue 2025 2026 forecast")'),
    ev(T0+7300,'scout-2','tool','search("kroger precision measurement dispute verification")'),
    ev(T0+21000,'scout-1','info','9 of 12 sources kept — 2 duplicates, 1 paywalled'),
    ev(T0+24500,'scout-2','warn','rate-limited on one publisher — backing off 20s, queue intact'),
    ev(T0+61000,'scout-2','info','recovered; measurement + in-store notes complete'),
    ev(T0+63000,'atlas','tool','spawn(analyst) — tables ready for normalization'),
    ev(T0+64800,'analyst','tool','bash: python normalize.py --in sources.json'),
    ev(T0+92000,'analyst','info','CPM deltas computed from public rate cards (ceiling values)'),
    ev(T0+95000,'atlas','tool','spawn(scribe) — synthesis inputs assembled'),
    ev(T0+96500,'scribe','tool','write_file(artifacts/retail-media-scan.md)'),
    ev(T0+128000,'scribe','tool','write_file(artifacts/spend-by-network.html)'),
    ev(T0+131000,'scribe','tool','write_file(artifacts/deck-outline.md)'),
    ev(T0+134000,'atlas','info','synthesis pass over 4 agent reports — 129.1k tokens total'),
    ev(T0+139000,'atlas','sys','run complete — 4 artifacts, 23 tool calls, 0 failures'),
  ];
  r1.artifacts = [
    art('retail-media-scan.md','md',ART_REPORT, t1.id),
    art('spend-by-network.html','html',ART_CHART_HTML, t1.id),
    art('sources.json','json',ART_SOURCES, t1.id),
    art('deck-outline.md','md',ART_SLIDES, t1.id),
  ];
  t1.messages = [
    { who:'you', ts:T0-2000, body:'Map the US retail media networks. Who is actually growing, who is stalling, and what should we watch next quarter? Table plus a short deck outline.' },
    { who:'atlas', ts:T0+139000, body:
`Scan complete — two speeds in the market.

**Growing:** Walmart Connect (+26%, CTV via Vizio) and Chewy (+31% off a small base). **Stalling:** Instacart (+9%, baskets flat) and Kroger (+7%, stuck in a measurement dispute with two major CPGs).

Four artifacts in the tray: the field scan, a spend chart, the source trail, and a 6-slide outline. The CPM deltas are rate-card ceilings, not negotiated — flagged in the report.` },
  ];
  t1.runIds = [r1.id];

  /* failed run thread — the error path, honestly */
  const t2: any = { id: nid('th'), title: 'Transcribe + chapter podcast ep. 214', createdAt: now - 1000*60*12, status:'crit', messages: [], runIds: [] };
  const r2 = mkRun(t2.id, now - 1000*60*12);
  r2.status='crit'; r2.endedAt = now - 1000*60*10;
  r2.agents = [
    mkAgent('atlas','lead','delegate transcription','crit', 2100, .04, 0),
    mkAgent('fetcher','sandbox','pull episode audio from feed URL','crit', 1400, .03, 1),
  ];
  r2.tokens = 3500; r2.toolCalls = 4;
  r2.tokSeries = [1.1,1.6,0.8,0,0,0,0,0,0,0,0,0].map(v=>v*1000);
  const U0 = r2.startedAt;
  r2.events = [
    ev(U0+900,'atlas','sys','run accepted — single work item, spawning fetcher'),
    ev(U0+2400,'fetcher','tool','bash: curl -L feeds.example.com/ep214.mp3'),
    ev(U0+9800,'fetcher','err','HTTP 403 — feed requires authenticated session'),
    ev(U0+11000,'fetcher','tool','retry with resolved CDN URL'),
    ev(U0+19000,'fetcher','err','HTTP 403 again — giving up after 2 attempts'),
    ev(U0+21000,'atlas','err','run failed: audio unreachable. Suggest: drop the file into the thread and re-dispatch.'),
  ];
  r2.artifacts = [];
  t2.messages = [
    { who:'you', ts:U0-1500, body:'Transcribe and chapter podcast episode 214 from our feed.' },
    { who:'atlas', ts:U0+21000, body:'Stopped — the feed returned **403 Forbidden** twice, so the audio never reached the sandbox. Fastest fix: drag the mp3 into this thread and re-dispatch; the podcast-mini skill will take it from there.', err:true },
  ];
  t2.runIds = [r2.id];

  t1.demo = true; t2.demo = true;
  S.threads = [t2, t1]; // newest first
  S.runs[r1.id]=r1; S.runs[r2.id]=r2;
  S.activeThreadId = t1.id;
  S.watchRunId = r1.id;
  S.totalTokens = r1.tokens + r2.tokens;
  S.models = MOCK_MODELS; S.composerModel = MOCK_MODELS[0].name;
  S.skills = JSON.parse(JSON.stringify(MOCK_SKILLS));
  S.memory = MOCK_MEMORY; S.mcp = JSON.parse(JSON.stringify(MOCK_MCP));
}
function mkRun(threadId, startedAt): any {
  const r = { id: nid('run'), threadId, status:'run', startedAt, endedAt:null,
    agents: [], events: [], artifacts: [], tokens: 0, toolCalls: 0, tokSeries: [] };
  return r;
}
function mkAgent(name, kind, task, st, tok, ctx, depth): any {
  return { id: nid('ag'), name, kind, task, status: st, tokens: tok, ctxUsed: ctx, depth };
}
const ev = (ts, agent, kind, msg) => ({ ts, agent, kind, msg });
const art = (name, type, body, threadId): any => ({ id: nid('art'), name, type, body, threadId, bytes: new Blob([body]).size, ts: Date.now() });

/* ---------- live mock run (the show) ---------- */
function startMockRun(thread, brief){
  const run = mkRun(thread.id, Date.now());
  S.runs[run.id] = run; thread.runIds.push(run.id); thread.status = 'run';
  S.watchRunId = run.id;
  const rand = mulberry(brief.length * 7 + thread.runIds.length * 13);
  const lower = brief.toLowerCase();
  const wantsCode = /\b(build|site|app|scaffold|component|api)\b/.test(lower);
  const wantsDeck = /\b(deck|slides?|presentation)\b/.test(lower);
  const shortBrief = brief.length < 60 ? brief : brief.slice(0, 57).replace(/\s+\S*$/,'') + '…';

  const agents = [ mkAgent('atlas','lead','decompose brief, synthesize result','queue',0,0,0) ];
  agents.push(mkAgent('scout-1','web','primary recon on the brief','queue',0,0,1));
  agents.push(mkAgent('scout-2','web','counter-pass: gaps, disputes, recency','queue',0,0,1));
  agents.push(wantsCode
    ? mkAgent('builder','sandbox','scaffold + run in sandbox','queue',0,0,1)
    : mkAgent('analyst','sandbox','structure findings, run the numbers','queue',0,0,1));
  agents.push(wantsDeck
    ? mkAgent('scribe','report','draft report + deck outline','queue',0,0,1)
    : mkAgent('scribe','report','draft the write-up','queue',0,0,1));
  run.agents = agents;
  const A = Object.fromEntries(agents.map(a=>[a.name,a]));

  const script = [];
  const say = (t, agent, kind, msg) => script.push({t, fn(){ pushEvent(run, agent, kind, msg); }});
  const setSt = (t, name, st) => script.push({t, fn(){ A[name].status = st; }});

  say(600,'atlas','sys',`run accepted — brief: "${shortBrief}"`);
  setSt(600,'atlas','run');
  say(2100,'atlas','info','decomposed into 3 work items; fanning out 2 scouts');
  setSt(2600,'scout-1','run'); setSt(2600,'scout-2','run');
  say(2700,'atlas','tool','spawn(scout-1, scout-2)');
  const q1 = brief.split(/\s+/).slice(0,5).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g,'');
  say(3600,'scout-1','tool',`search("${q1}")`);
  say(4300,'scout-2','tool',`search("${q1} criticism OR dispute OR 2026")`);
  say(9000,'scout-1','info','12 candidate sources, scoring for authority + recency');
  say(11500,'scout-2','warn','one source rate-limited — backing off, queue intact');
  say(15500,'scout-1','info','kept 8 of 12; extracting claims');
  say(18000,'scout-2','info','counter-pass done: 2 disputes worth flagging');
  setSt(19000,'scout-1','ok'); setSt(19500,'scout-2','ok');
  const third = agents[3].name;
  setSt(20000,third,'run');
  say(20200,'atlas','tool',`spawn(${third})`);
  say(21500,third,'tool', wantsCode ? 'bash: pnpm create vite@latest scratch --template vanilla' : 'bash: python structure.py --in claims.json');
  say(26500,third,'info', wantsCode ? 'scaffold running on sandbox :5173 — smoke test passed' : 'claims normalized; 3 tables built');
  setSt(28000,third,'ok');
  setSt(28600,'scribe','run');
  say(28800,'atlas','tool','spawn(scribe)');
  say(30000,'scribe','tool','write_file(artifacts/field-notes.md)');
  say(34000,'scribe','tool', wantsDeck ? 'write_file(artifacts/deck-outline.md)' : 'write_file(artifacts/summary.md)');
  say(36500,'scribe','info','draft complete; handing back to atlas');
  setSt(37000,'scribe','ok');
  say(38000,'atlas','info','synthesis pass over agent reports');
  say(41500,'atlas','sys','run complete — artifacts in the tray');
  setSt(41500,'atlas','ok');

  script.push({ t: 30500, fn(){
    const a1 = art('field-notes.md','md',
`# Field notes — ${shortBrief}

Drafted by the mock herd to show the full loop: recon fan-out, a sandbox
pass, and this write-up landing in the artifact tray.

- scout-1 kept 8 of 12 sources after scoring
- scout-2 flagged 2 disputes on the counter-pass
- ${third} ${wantsCode ? 'scaffolded and smoke-tested a sandbox build' : 'normalized claims into 3 tables'}

Point the Station at a live gateway and this same console renders the
real thing — same tray, same telemetry, actual work.
`, thread.id);
    run.artifacts.push(a1); renderIfActive('arts'); toast('Artifact','field-notes.md landed in the tray');
  }});
  script.push({ t: 34600, fn(){
    const a2 = art(wantsDeck?'deck-outline.md':'summary.md','md',
      wantsDeck ? `# Deck outline\n\n1. The one-line answer\n2. What the scouts found (8 kept sources)\n3. The two disputes worth acknowledging\n4. Numbers from the sandbox pass\n5. Recommendation + next watch\n`
                : `# Summary\n\nOne page, straight answer first, caveats where they belong. The mock run
keeps it short on purpose — the live gateway writes the real one.\n`, thread.id);
    run.artifacts.push(a2); renderIfActive('arts');
  }});

  /* token + series ticker */
  let tick = 0;
  const phase = ts => ts<3000?0.15 : ts<19000?1.0 : ts<28000?0.7 : ts<37000?0.85 : ts<41500?0.5 : 0;
  const tokTimer = setInterval(()=>{
    if (run.status !== 'run'){ clearInterval(tokTimer); S.timers.delete(tokTimer); return; }
    tick += 1;
    const el = Date.now() - run.startedAt;
    const rate = phase(el) * (900 + rand()*700);
    run.tokens += rate|0; S.totalTokens += rate|0;
    const active = run.agents.filter(a=>a.status==='run');
    for (const a of active){ a.tokens += (rate/Math.max(1,active.length))|0; a.ctxUsed = Math.min(.96, a.ctxUsed + rate/(Math.max(1,active.length)*180000)); }
    if (tick % 4 === 0){ run.tokSeries.push(run._acc||0); run._acc = 0; if (run.tokSeries.length>24) run.tokSeries.shift(); }
    run._acc = (run._acc||0) + rate;
    renderStrip(); renderIfActive('tele');
  }, 1000);
  S.timers.add(tokTimer);

  /* play the script */
  for (const step of script){
    const t = setTimeout(()=>{ if (run.status!=='run') return; step.fn(); renderIfActive('tele'); S.timers.delete(t); }, step.t);
    S.timers.add(t);
  }
  /* finale */
  const done = setTimeout(()=>{
    if (run.status!=='run') return;
    run.status='ok'; run.endedAt=Date.now(); thread.status='ok';
    run.toolCalls = 9 + (rand()*4|0);
    const reply =
`Done. Two scouts fanned out, ${third} handled the ${wantsCode?'build':'numbers'}, and the write-up is in the tray${wantsDeck?' with a deck outline':''}.

This was the **mock herd** — a scripted run so you can feel the console. Flip the Station to Live and the same brief goes to your DeerFlow gateway for the real thing.`;
    thread.messages.push({ who:'atlas', ts:Date.now(), body: reply });
    toast('Run complete', fmtTok(run.tokens)+' tokens · artifacts in the tray');
    renderAll(); S.timers.delete(done);
  }, 42500);
  S.timers.add(done);

  pushEvent(run, 'blind', 'sys', 'telemetry attached to run ' + run.id);
  return run;
}
function stopRun(run){
  const thread = S.threads.find(t=>t.id===run.threadId);
  if (run.live && thread) Live.cancel(thread, run);
  run.status='idle'; run.endedAt=Date.now();
  if (thread && thread.status==='run') thread.status='idle';
  run.agents.forEach(a=>{ if (a.status==='run'||a.status==='queue') a.status='idle'; });
  pushEvent(run,'blind','sys','run stopped from the blind');
  toast('Stopped','the herd is standing down');
  renderAll();
}
function fieldReport(run){
  /* export a run's telemetry as a markdown field report */
  const t = S.threads.find(x=>x.id===run.threadId);
  const dur = (run.endedAt||Date.now()) - run.startedAt;
  const lines = [];
  lines.push('# Field report — '+(t?t.title:'(untitled run)'));
  lines.push('');
  lines.push('run `'+(run.remoteRunId||run.id)+'` · status **'+run.status.toUpperCase()+'** · '+fmtDur(dur)+' · '+fmtNum(run.tokens|0)+' tokens · '+run.toolCalls+' tool calls · '+(run.artifacts||[]).length+' artifacts');
  lines.push('');
  lines.push('## The herd');
  lines.push('');
  lines.push('| agent | kind | status | tokens | task |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const a of run.agents) lines.push('| '+a.name+' | '+a.kind+' | '+a.status+' | '+fmtNum(a.tokens|0)+' | '+String(a.task).replace(/\|/g,'/')+' |');
  lines.push('');
  lines.push('## Field feed');
  lines.push('');
  lines.push('```');
  for (const e of run.events) lines.push(fmtT(e.ts)+'  '+String(e.agent).padEnd(10)+' ['+e.kind+'] '+e.msg);
  lines.push('```');
  if ((run.artifacts||[]).length){
    lines.push('');
    lines.push('## Artifacts');
    lines.push('');
    for (const a of run.artifacts) lines.push('- `'+a.name+'` ('+fmtBytes(a.bytes)+')');
  }
  lines.push('');
  lines.push('_exported from Deer Blind_');
  const blob = new Blob([lines.join('\n')], {type:'text/markdown'});
  const u = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = u; link.download = 'field-report-'+String(run.remoteRunId||run.id).slice(0,8)+'.md';
  link.click(); setTimeout(()=>URL.revokeObjectURL(u), 5000);
  toast('Field report','telemetry exported as markdown');
}
function pushEvent(run, agent, kind, msg){
  run.events.push(ev(Date.now(), agent, kind, msg));
  if (kind==='tool') run.toolCalls++;
}


export { nid, seedMockWorld, mkRun, mkAgent, ev, art, startMockRun, stopRun, pushEvent, fieldReport };
