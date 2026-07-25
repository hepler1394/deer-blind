// render.ts — every view renderer + dispatch
import { S } from './state';
import { $, $$, esc, fmtTok, fmtNum, fmtBytes, fmtT, fmtAgo, fmtDur, md, stripThink } from './utils';
import { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP } from './mockdata';
import { nid, pushEvent, startMockRun, stopRun, fieldReport } from './engine';
import { sparkSVG, tokChartSVG, wireTokChart } from './charts';
import { Live } from './adapter';
import { toast } from './hub';
/* =========================================================================
   renderers
   ========================================================================= */
function setView(v){
  S.view = v;
  $$('.view').forEach(x=>x.classList.remove('active'));
  $('#view-'+v).classList.add('active');
  $$('.rail-item').forEach(b=>{ if (b.dataset.nav===v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  renderView(v);
}
function renderIfActive(v){ if (S.view===v) renderView(v); }
function renderView(v){
  if (v==='ops') renderOps();
  else if (v==='tele') renderTele();
  else if (v==='arts') renderArts();
  else if (v==='station') renderStation();
}
function renderAll(){ renderNavCounts(); renderTop(); renderStrip(); renderView(S.view); }

function statusChip(st, label?){
  const map = { run:['run','RUNNING'], ok:['ok','OK'], warn:['warn','DEGRADED'], crit:['crit','FAILED'], idle:['idle','IDLE'], queue:['queue','QUEUED'] };
  const [cls, text] = map[st] || map.idle;
  return `<span class="status ${cls}"><span class="sdot"></span>${label||text}</span>`;
}
function renderNavCounts(){
  $('#nav-count-ops').textContent = S.threads.length || '';
  const running = Object.values<any>(S.runs).filter(r=>r.status==='run').length;
  $('#nav-count-tele').textContent = running ? running+' live' : '';
  const arts = Object.values<any>(S.runs).flatMap(r=>r.artifacts||[]).length;
  $('#nav-count-arts').textContent = arts || '';
}
function renderTop(){
  const pill = $('#mode-pill'), lbl = $('#mode-pill-label'), url = $('#top-url');
  pill.className = 'mode-pill';
  if (S.mode==='mock'){ pill.classList.add('mock'); lbl.textContent='MOCK'; url.textContent='mock feed — no gateway attached'; }
  else if (S.liveOk){ pill.classList.add('live'); lbl.textContent='LIVE'; url.textContent=S.gatewayUrl.replace(/^https?:\/\//,''); }
  else { pill.classList.add('err'); lbl.textContent='LIVE · UNREACHABLE'; url.textContent=S.gatewayUrl.replace(/^https?:\/\//,''); }
  $('#rail-url').textContent = S.gatewayUrl.replace(/^https?:\/\//,'');
}
function renderStrip(){
  $('#strip-mode').textContent = 'feed: ' + (S.mode==='mock' ? 'mock' : (S.liveOk?'live':'live (unreachable)'));
  const run = S.runs[S.watchRunId];
  $('#strip-run').textContent = run && run.status==='run'
    ? `run ${run.id} · ${run.agents.filter(a=>a.status==='run').length} agents working`
    : 'no active run';
  const liveTot = Object.values<any>(S.runs).filter(r=>r.live).reduce((a,r)=>a+(r.tokens|0),0);
  $('#strip-tokens').textContent = 'burn ' + fmtTok(S.mode==='live' ? liveTot : S.totalTokens) + ' tok';
  const notes = ['quiet in the field','wind from the northwest','glass steady','herd accounted for'];
  const running = run && run.status==='run';
  $('#strip-note').textContent = running ? 'eyes on the herd' : notes[Math.floor(Date.now()/30000)%notes.length];
}

/* ----- operations ----- */
function renderOps(){
  const list = $('#thread-list');
  if (!S.threads.length){
    list.innerHTML = `<div class="empty" style="padding:var(--s6) var(--s3)">
      ${antlerSVG(34)}<div class="e-title">No operations yet</div>
      <div class="e-sub">Brief the agent below — research, a build, a report. Runs and their telemetry gather here.</div></div>`;
  } else {
    const ordered = (S.mode==='live' && S.liveOk)
      ? [...S.threads].sort((a,b)=>((a.demo?1:0)-(b.demo?1:0)) || (b.createdAt-a.createdAt))
      : S.threads;
    list.innerHTML = ordered.map(t=>{
      const latest = S.runs[t.runIds[t.runIds.length-1]];
      return `<button class="thread-card ${t.id===S.activeThreadId?'sel':''}" data-th="${t.id}">
        <span class="tc-title">${esc(t.title)}</span>
        <span class="tc-meta">${statusChip(t.status)}${t.demo?'<span class="tag" style="font-size:9px;padding:1px 5px;letter-spacing:.08em">DEMO</span>':''}<span>${fmtAgo(t.createdAt)}</span>${latest?`<span>${fmtTok(latest.tokens)} tok</span>`:''}</span>
      </button>`;
    }).join('');
    $$('.thread-card', list).forEach(b=>b.addEventListener('click',()=>{
      S.activeThreadId = b.dataset.th;
      const t = S.threads.find(x=>x.id===S.activeThreadId);
      if (t && t.runIds.length) S.watchRunId = t.runIds[t.runIds.length-1];
      if (S.mode==='live' && S.liveOk && t && t.remoteId && !t.messages.length) Live.loadThread(t);
      renderOps();
    }));
  }
  renderChat();
  renderComposer();
}
function renderChat(){
  const head = $('#chat-head'), scroll = $('#chat-scroll');
  const t = S.threads.find(x=>x.id===S.activeThreadId);
  const narrowNew = `<button class="btn sm narrow-new" id="btn-new-narrow">New</button>`;
  if (!t){
    head.innerHTML = `<div class="ch-title" style="color:var(--ink-3)">New operation</div>${narrowNew}`;
    const nn0 = $('#btn-new-narrow'); if (nn0) nn0.addEventListener('click',()=>{ S.activeThreadId=null; renderOps(); $('#composer-input').focus(); });
    scroll.innerHTML = `<div class="empty">${antlerSVG(44)}
      <div class="e-title">The blind is set</div>
      <div class="e-sub">Nothing dispatched in this thread. Type a brief below — the lead agent decomposes it, the herd fans out, and you watch it all from Telemetry.</div></div>`;
    return;
  }
  const run = S.runs[t.runIds[t.runIds.length-1]];
  head.innerHTML = `<div class="ch-title">${esc(t.title)}</div>
    ${narrowNew}
    ${run ? `<button class="btn sm" id="btn-watch">Watch in Telemetry</button>` : ''}
    <button class="iconbtn" id="btn-del-thread" title="Delete operation" aria-label="Delete operation">
      <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M2.5 4h10M6 4V2.5h3V4M4 4l.7 9h5.6L11 4M6.2 6.5v4M8.8 6.5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
    </button>
    ${statusChip(t.status)}`;
  const watch = $('#btn-watch'); if (watch) watch.addEventListener('click',()=>{ S.watchRunId = run.id; setView('tele'); });
  $('#btn-del-thread').addEventListener('click',()=>deleteThread(t));
  const nn = $('#btn-new-narrow'); if (nn) nn.addEventListener('click',()=>{ S.activeThreadId=null; renderOps(); $('#composer-input').focus(); });
  scroll.innerHTML = t.messages.map((m,i)=>{
    if (m.who==='you') return `<div class="msg user"><div class="m-who">YOU · ${fmtT(m.ts)}${S.mode==='live'&&S.liveOk?` <button class="iconbtn msg-reask" data-mi="${i}" title="Re-ask on a fresh thread with the selected model" aria-label="Re-ask" style="width:20px;height:20px"><svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M2.5 7.5a5 5 0 1 1 1.5 3.6M2.5 11.5v-3h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}</div><div class="m-body">${esc(m.body)}</div></div>`;
    const thinkBlock = m.think ? `<details style="margin-top:7px"><summary style="cursor:pointer;font:600 10px var(--f-mono);letter-spacing:.1em;color:var(--ink-3)">REASONING</summary><div style="font-size:12px;color:var(--ink-3);line-height:1.55;padding:6px 0 0;border-left:2px solid var(--border-strong);padding-left:10px;margin-top:6px">${esc(m.think).replace(/\n/g,'<br>')}</div></details>` : '';
    return `<div class="msg agent"><div class="m-who"><span style="color:${m.err?'var(--crit)':'var(--series)'}">ATLAS</span> · lead · ${fmtT(m.ts)}${m.dur?` · ${fmtDur(m.dur)}`:''} <button class="iconbtn msg-copy" data-mi="${i}" title="Copy message" aria-label="Copy message" style="width:20px;height:20px"><svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 5V3.5A1.5 1.5 0 0 0 8.5 2h-5A1.5 1.5 0 0 0 2 3.5v5A1.5 1.5 0 0 0 3.5 10H5" stroke="currentColor" stroke-width="1.4"/></svg></button></div><div class="m-body">${md(m.body)}${thinkBlock}</div></div>`;
  }).join('')
  + (t.status==='run' ? `<div class="msg agent"><div class="m-who"><span style="color:var(--series)">ATLAS</span> · lead · working</div><div class="m-body"><span style="color:var(--ink-3)">run in flight — watch the herd in Telemetry</span> <span class="cursor-blink"></span></div></div>` : '');
  $$('.msg-copy', scroll).forEach(b=>b.addEventListener('click',()=>{
    const m = t.messages[+b.dataset.mi]; if (!m) return;
    navigator.clipboard.writeText(m.body).then(()=>toast('Copied','message on the clipboard'))
      .catch(()=>toast('Copy failed','clipboard is blocked in this context', true));
  }));
  $$('.msg-reask', scroll).forEach(b=>b.addEventListener('click',()=>{
    const m = t.messages[+b.dataset.mi]; if (!m) return;
    S.activeThreadId = null;
    $('#composer-input').value = m.body;
    toast('Re-ask','same brief, fresh thread, '+(S.composerModel||'selected model'));
    dispatch();
  }));
  scroll.scrollTop = scroll.scrollHeight;
}
function renderComposer(){
  const sel = $('#composer-model');
  sel.innerHTML = S.models.map(m=>`<option value="${esc(m.name)}" ${m.name===S.composerModel?'selected':''}>${esc(m.display_name||m.name)}</option>`).join('')
    || '<option>no models — check Station</option>';
  const chips = $('#composer-skills');
  chips.innerHTML = S.skills.filter(s=>s.enabled).slice(0,3).map(s=>
    `<button class="skill-chip" data-skill="${s.id}" aria-pressed="${S.composerSkills.has(s.id)}">${esc(s.name)}</button>`).join('');
  $$('.skill-chip', chips).forEach(c=>c.addEventListener('click',()=>{
    const id=c.dataset.skill;
    S.composerSkills.has(id) ? S.composerSkills.delete(id) : S.composerSkills.add(id);
    c.setAttribute('aria-pressed', S.composerSkills.has(id));
  }));
}
function deleteThread(t){
  if (S.mode==='live' && S.liveOk && t.remoteId)
    Live.req('/api/threads/'+t.remoteId, {method:'DELETE'}).catch(e=>toast('Delete', 'gateway: '+e.message, true));
  t.runIds.forEach(rid=>{ delete S.runs[rid]; });
  S.threads = S.threads.filter(x=>x.id!==t.id);
  if (S.activeThreadId===t.id) S.activeThreadId = S.threads[0]?.id || null;
  if (!S.runs[S.watchRunId]) S.watchRunId = S.threads[0]?.runIds?.slice(-1)[0] || null;
  toast('Deleted', t.title.slice(0,48));
  renderAll();
}
function renderPending(){
  const box = $('#pending-files'); if (!box) return;
  if (!S.pendingFiles?.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='flex';
  box.innerHTML = S.pendingFiles.map((f,i)=>
    `<span class="tag" style="gap:7px">${esc(f.name)} <span style="color:var(--ink-3)">${fmtBytes(f.size)}</span>
     <button class="iconbtn" data-unfile="${i}" style="width:16px;height:16px" aria-label="Remove ${esc(f.name)}">×</button></span>`).join('');
  $$('[data-unfile]', box).forEach(b=>b.addEventListener('click',()=>{ S.pendingFiles.splice(+b.dataset.unfile,1); renderPending(); }));
}
function dispatch(){
  const ta = $('#composer-input');
  const brief = ta.value.trim();
  if (!brief) { ta.focus(); return; }
  const btn = $('#btn-dispatch'); btn.disabled = true; setTimeout(()=>btn.disabled=false, 1200);
  let t = S.threads.find(x=>x.id===S.activeThreadId);
  const title = brief.length<64 ? brief : brief.slice(0,61).replace(/\s+\S*$/,'')+'…';
  if (!t || t.status==='run'){ t = { id:nid('th'), title, createdAt:Date.now(), status:'run', messages:[], runIds:[] };
    S.threads.unshift(t); S.activeThreadId = t.id; }
  else if (!t.messages.length) t.title = title;
  t.messages.push({ who:'you', ts:Date.now(), body:brief });
  ta.value='';
  const files = S.pendingFiles?.splice(0) || [];
  renderPending();
  if (S.mode==='live' && S.liveOk){
    (async ()=>{
      if (files.length){
        try { const up = await Live.uploadToThread(t, files);
          toast('Uploaded', files.length+' file'+(files.length===1?'':'s')+' on the thread'); }
        catch(e){ toast('Upload failed', e.message, true); }
      }
      Live.dispatch(t, brief);
    })();
  } else {
    if (S.mode==='live') toast('Gateway unreachable','Dispatching to the mock herd instead — fix the connection under Station.', true);
    const run = startMockRun(t, brief);
    files.forEach(f=>pushEvent(run,'blind','info','file received: '+f.name+' ('+fmtBytes(f.size)+') — mock keeps it in mind'));
  }
  renderAll();
  toast('Dispatched', 'The herd is moving — watch it in Telemetry.');
}

/* ----- telemetry ----- */
function renderTele(){
  const main = $('#tele-main'), side = $('#tele-side');
  const run = S.runs[S.watchRunId];
  /* don't clobber the grep box while the user is typing in it */
  if (document.activeElement && document.activeElement.id==='feed-q'){
    const fsEl = $('#feed-scroll');
    if (fsEl && run) fsEl.innerHTML = renderFeedLines(run);
    return;
  }
  if (!run){
    main.innerHTML = `<div class="empty" style="height:100%">${antlerSVG(44)}
      <div class="e-title">Telemetry idle</div>
      <div class="e-sub">No run on the wire. Dispatch a brief from Operations and the herd shows up here — agent tree, live feed, token burn.</div></div>`;
    side.innerHTML='';
    return;
  }
  const t = S.threads.find(x=>x.id===run.threadId);
  const dur = (run.endedAt||Date.now()) - run.startedAt;
  const allRuns = Object.values<any>(S.runs)
    .filter(r=>r.id!==run.id)
    .sort((a,b)=>b.startedAt-a.startedAt)
    .slice(0,20)
    .map(r=>{ const th=S.threads.find(x=>x.id===r.threadId);
      return { id:r.id, label:(th?th.title.slice(0,26):'?')+' · '+String(r.remoteRunId||r.id).slice(0,8)+' · '+r.status }; });
  main.innerHTML = `
    <div class="run-head">
      <div class="rh-body">
        <h2>${esc(t?t.title:'(untitled run)')}</h2>
        <div class="rh-meta">
          ${statusChip(run.status, run.status==='idle'&&run.endedAt?'STOPPED':undefined)}
          <span>${esc(run.remoteRunId||run.id)}</span><span>·</span>
          <span id="rh-elapsed">${fmtDur(dur)} ${run.status==='run'?'elapsed':'total'}</span><span>·</span>
          <span>${run.agents.length} agents</span>
          ${run.status==='run' ? `<span>·</span><button class="btn sm danger" id="btn-stop-run">Stop run</button>` : ''}
          <span>·</span><button class="btn sm" id="btn-field-report">Field report</button>
          ${allRuns.length?`<span>·</span><select class="input" id="tele-pick" style="width:auto;padding:2px 24px 2px 8px;font-size:11px;font-family:var(--f-mono);background-color:transparent">
            <option value="">other runs…</option>
            ${allRuns.map(o=>`<option value="${o.id}">${esc(o.label)}</option>`).join('')}
          </select>`:''}
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>The herd</h3><span class="ph-note">click an agent to filter the feed</span></div>
      <div class="agent-tree">${run.agents.map(a=>`
        <div class="agent-row ${S.feedFilter===a.name?'sel':''}" data-agent="${a.name}" role="button" tabindex="0">
          <span class="a-depth">${a.depth
            ? '<svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true"><path d="M1.5 0v6.5h7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
            : '<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><rect x="4.5" y="0.4" width="5.8" height="5.8" transform="rotate(45 4.5 0.4)" fill="currentColor"/></svg>'}</span>
          <span class="a-badge">${a.kind.toUpperCase()}</span>
          <span class="a-name">${esc(a.name)}</span>
          <span class="a-task">${esc(a.task)}</span>
          <span class="a-tok">${fmtTok(a.tokens)}</span>
          ${statusChip(a.status)}
        </div>`).join('')}</div>
    </div>
    <div class="panel feed">
      <div class="panel-h"><h3>Field feed</h3>
        <div class="feed-filters" style="margin-left:auto">
          ${['all','tool','info','warn','err'].map(k=>`<button class="f-chip" data-f="${k}" aria-pressed="${S.feedFilter===k}">${k}</button>`).join('')}
          <input class="input" id="feed-q" placeholder="grep the wire…" value="${esc(S.feedQuery)}" aria-label="Filter feed text"
            style="width:130px;padding:3px 8px;font:400 11px var(--f-mono)">
        </div>
      </div>
      <div class="feed-scroll" id="feed-scroll">${renderFeedLines(run)}</div>
    </div>`;
  const pick = $('#tele-pick'); if (pick) pick.addEventListener('change',()=>{ if (pick.value){ S.watchRunId=pick.value; S.feedFilter='all'; renderTele(); }});
  const stopBtn = $('#btn-stop-run'); if (stopBtn) stopBtn.addEventListener('click',()=>stopRun(run));
  $$('.agent-row', main).forEach(r=>{
    const go = ()=>{ S.feedFilter = S.feedFilter===r.dataset.agent ? 'all' : r.dataset.agent; renderTele(); };
    r.addEventListener('click', go);
    r.addEventListener('keydown', e=>{ if (e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); }});
  });
  $$('.f-chip', main).forEach(c=>c.addEventListener('click',()=>{ S.feedFilter=c.dataset.f; renderTele(); }));
  const fq = $('#feed-q'); if (fq) fq.addEventListener('input', ()=>{ S.feedQuery = fq.value; const fsEl=$('#feed-scroll'); if (fsEl) fsEl.innerHTML = renderFeedLines(run); });
  const rep = $('#btn-field-report'); if (rep) rep.addEventListener('click', ()=>fieldReport(run));
  const fs = $('#feed-scroll'); fs.scrollTop = fs.scrollHeight;

  /* side instruments */
  const spark = run.tokSeries.slice(-12);
  const ctxAgents = run.agents.filter(a=>a.depth>0);
  side.innerHTML = `
    <div class="tiles">
      <div class="tile wide"><span class="t-label">Token burn</span>
        <span class="t-value">${fmtTok(run.tokens)}</span>
        <span class="t-delta">${run.status==='run'?'accruing':'final'} · all agents</span>
        <span class="t-spark">${sparkSVG(spark, 240, 30)}</span></div>
      <div class="tile"><span class="t-label">Tool calls</span><span class="t-value">${run.toolCalls}</span></div>
      <div class="tile"><span class="t-label">Artifacts</span><span class="t-value">${(run.artifacts||[]).length}</span></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Burn rate</h3><span class="ph-note">tok / interval</span></div>
      <div class="chart-wrap" id="tok-chart">${''}<div class="chart-tip"></div></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Context load</h3><span class="ph-note">per sub-agent</span></div>
      <div style="padding:var(--s2) var(--s4) var(--s3)">
        ${ctxAgents.length ? ctxAgents.map(a=>{
          const pct = Math.round(a.ctxUsed*100);
          const cls = pct>85?'crit':pct>65?'warn':'';
          return `<div class="meter-row"><div class="m-top"><span>${esc(a.name)}</span><span class="m-val">${pct}% of window</span></div>
            <div class="meter ${cls}"><i style="width:${pct}%"></i></div></div>`;
        }).join('') : `<div style="padding:var(--s3) 0;color:var(--ink-3);font-size:12px">no sub-agents spawned yet</div>`}
      </div>
    </div>`;
  const cw = $('#tok-chart');
  const chart = tokChartSVG(run.tokSeries.length?run.tokSeries:[0,0], 300, 150);
  cw.insertAdjacentHTML('afterbegin', chart.svg);
  wireTokChart(cw, chart);
}
function renderFeedLines(run){
  const q = S.feedQuery.trim().toLowerCase();
  const evs = run.events.filter(e=>{
    if (q && !((e.agent+' '+e.msg).toLowerCase().includes(q))) return false;
    if (S.feedFilter==='all') return true;
    if (['tool','info','warn','err'].includes(S.feedFilter)) return e.kind===S.feedFilter || (S.feedFilter==='info'&&e.kind==='sys');
    return e.agent===S.feedFilter;
  });
  if (!evs.length) return `<div style="color:var(--ink-3);padding:6px 0">nothing on this channel yet — the wire is quiet</div>`;
  return evs.map(e=>`<div class="fl k-${e.kind}"><span class="fl-t">${fmtT(e.ts)}</span><span class="fl-a">${esc(e.agent)}</span><span class="fl-m">${esc(e.msg)}</span></div>`).join('');
}

/* ----- artifacts ----- */
function allArtifacts(){
  const out=[];
  for (const t of S.threads){
    const arts = t.runIds.flatMap(rid=>S.runs[rid]?.artifacts||[]);
    if (arts.length) out.push({thread:t, arts});
  }
  return out;
}
function renderArts(){
  const listEl = $('#arts-list'), viewEl = $('#arts-view');
  const groups = allArtifacts();
  if (!groups.length){
    listEl.innerHTML='';
    viewEl.innerHTML = `<div class="empty" style="height:100%">${antlerSVG(44)}
      <div class="e-title">The tray is empty</div>
      <div class="e-sub">Artifacts land here as runs write them — reports, charts, source trails, whole little sites. Dispatch something and check back.</div></div>`;
    return;
  }
  const flat = groups.flatMap(g=>g.arts);
  if (!S.selArtifact || !flat.find(a=>a.id===S.selArtifact)) S.selArtifact = flat[0].id;
  listEl.innerHTML = groups.map(g=>`
    <div class="arts-group">
      <div class="ag-h"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.thread.title)}</span><span class="ag-n">${g.arts.length}</span></div>
      ${g.arts.map(a=>`
        <button class="art-row ${a.id===S.selArtifact?'sel':''}" data-art="${a.id}">
          ${fileIcon(a.type)}<span class="ar-name">${esc(a.name)}</span><span class="ar-size">${fmtBytes(a.bytes)}</span>
        </button>`).join('')}
    </div>`).join('');
  $$('.art-row', listEl).forEach(b=>b.addEventListener('click',()=>{ S.selArtifact=b.dataset.art; renderArts(); }));

  const a = flat.find(x=>x.id===S.selArtifact);
  const dl = `<button class="btn sm" id="btn-dl-art">Download</button>`;
  const liveLink = S.mode==='live' && S.liveOk
    ? `<a class="btn sm" style="text-decoration:none" href="${S.gatewayUrl}/api/threads/${a.threadId}/artifacts/${encodeURIComponent(a.name)}" target="_blank" rel="noopener">Open on gateway</a>` : '';
  let bodyHtml;
  if (a.type==='md') bodyHtml = `<div class="arts-body pad"><div class="md-doc">${md(a.body)}</div></div>`;
  else if (a.type==='html') bodyHtml = `<div class="arts-body"><iframe sandbox="" title="${esc(a.name)} preview" srcdoc="${esc(a.body)}"></iframe></div>`;
  else bodyHtml = `<div class="arts-body"><div class="code-doc">${esc(a.body)}</div></div>`;
  viewEl.innerHTML = `
    <div class="arts-view-h">${fileIcon(a.type)}<span class="av-name">${esc(a.name)}</span>
      <span class="tag">${a.type.toUpperCase()}</span>${liveLink}${dl}</div>${bodyHtml}`;
  $('#btn-dl-art').addEventListener('click',()=>{
    const blob = new Blob([a.body], {type: a.type==='html'?'text/html':a.type==='json'?'application/json':'text/markdown'});
    const u = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href=u; link.download=a.name; link.click(); setTimeout(()=>URL.revokeObjectURL(u), 5000);
  });
}
function fileIcon(type){
  const c = type==='html' ? 'M2 4l3 3.5L2 11M7 11h5' : type==='json' ? 'M5 2C3.5 2 4.5 7.5 3 7.5 4.5 7.5 3.5 13 5 13M10 2c1.5 0 .5 5.5 2 5.5-1.5 0-.5 5.5-2 5.5' : 'M3 3h9M3 6h9M3 9h6';
  return `<svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="${c}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function antlerSVG(size){
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path d="M8.2 21.5c.3-4.4-.6-7.4-2.9-9.9M5.3 11.6c-1.6-1.7-2.2-3.5-2-6.1M5.3 11.6c-2 .1-3.3-.4-4.3-1.6M6.1 8.4C5 7.2 4.6 5.9 4.7 4M8.2 14.7c-1.8-.3-3-1-3.9-2.2M17.8 21.5c-.3-4.4.6-7.4 2.9-9.9M20.7 11.6c1.6-1.7 2.2-3.5 2-6.1M20.7 11.6c2 .1 3.3-.4 4.3-1.6M19.9 8.4c1.1-1.2 1.5-2.5 1.4-4.4M17.8 14.7c1.8-.3 3-1 3.9-2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="13" cy="21.5" r="2.1" fill="currentColor"/></svg>`;
}

/* =========================================================================
   station
   ========================================================================= */
function renderStation(){
  renderModelsTab(); renderSkillsTab(); renderMemoryTab(); renderMcpTab();
}
function srcNote(){
  return S.mode==='live' && S.liveOk
    ? `<span class="tag" style="color:var(--series);border-color:rgba(111,176,94,.4)">FROM GATEWAY</span>`
    : `<span class="tag">MOCK DATA</span>`;
}
function renderModelsTab(){
  $('#tab-models').innerHTML = `
    <div class="panel">
      <div class="panel-h"><h3>Model roster</h3><span class="ph-note" style="display:flex;gap:8px;align-items:center">GET /api/models ${srcNote()}</span></div>
      ${S.models.map(m=>`
        <div class="listrow">
          <div class="lr-body">
            <div class="lr-t">${esc(m.display_name||m.name)}
              ${m.name===S.composerModel?'<span class="tag" style="color:var(--series);border-color:rgba(111,176,94,.4)">DEFAULT</span>':''}</div>
            <div class="lr-d">provider: ${esc(m.provider||'—')}${m.ctx?` · context ${fmtTok(m.ctx)}`:''}</div>
          </div>
          <span class="lr-mono">${esc(m.name)}</span>
          <button class="btn sm" data-setmodel="${esc(m.name)}" ${m.name===S.composerModel?'disabled':''}>Set default</button>
        </div>`).join('') || `<div class="empty"><div class="e-title">No models reported</div><div class="e-sub">The gateway returned an empty roster — check config.yaml on the DeerFlow side.</div></div>`}
    </div>
    <p style="font-size:11.5px;color:var(--ink-3);margin-top:var(--s3);line-height:1.6">
      DeerFlow is model-agnostic: anything OpenAI-compatible plus local models through Ollama.
      The roster above is what the gateway's <code style="background:var(--surface-3);padding:1px 5px;border-radius:4px">config.yaml</code> declares.</p>`;
  $$('[data-setmodel]').forEach(b=>b.addEventListener('click',()=>{
    S.composerModel=b.dataset.setmodel; renderModelsTab(); renderComposer();
    toast('Default model', b.dataset.setmodel+' will take the next dispatch');
  }));
}
function renderSkillsTab(){
  $('#tab-skills').innerHTML = `
    <div class="panel">
      <div class="panel-h"><h3>Skill rack</h3><span class="ph-note" style="display:flex;gap:8px;align-items:center">GET · PUT /api/skills ${srcNote()}</span></div>
      ${S.skills.map(s=>`
        <div class="listrow">
          <div class="lr-body">
            <div class="lr-t">${esc(s.name)} ${s.builtin?'<span class="tag">BUILT-IN</span>':'<span class="tag" style="color:var(--warn);border-color:rgba(250,178,25,.35)">USER</span>'}</div>
            <div class="lr-d">${esc(s.desc)}</div>
          </div>
          <label class="switch" title="${s.enabled?'Enabled':'Disabled'}">
            <input type="checkbox" data-skill-toggle="${s.id}" ${s.enabled?'checked':''} aria-label="Toggle ${esc(s.name)}"><i></i>
          </label>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:var(--s4)">
      <button class="btn" id="btn-install-skill">Install from .skill archive</button>
      <span style="font-size:11.5px;color:var(--ink-3)">POST /api/skills/install — zip of SKILL.md + resources</span>
    </div>`;
  $$('[data-skill-toggle]').forEach(sw=>sw.addEventListener('change',()=>{
    const s = S.skills.find(x=>x.id===sw.dataset.skillToggle); if (!s) return;
    s.enabled = sw.checked; renderComposer();
    if (S.mode==='live' && S.liveOk) Live.putSkill(s);
    toast('Skill rack', `${s.name} ${s.enabled?'enabled':'disabled'}${S.mode==='mock'?' (mock)':''}`);
  }));
  $('#btn-install-skill').addEventListener('click',()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.skill,.zip';
    inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
      if (S.mode==='live'&&S.liveOk) Live.installSkill(f);
      else { S.skills.push({id:'user-'+Date.now().toString(36), name:f.name.replace(/\.(skill|zip)$/,''), desc:'Installed from archive (mock — flip Live to really install).', enabled:true, builtin:false}); renderSkillsTab(); toast('Skill rack', f.name+' staged (mock)'); } };
    inp.click();
  });
}
function renderMemoryTab(){
  const m = S.memory || {profile:[],projects:[],stats:{}};
  $('#tab-memory').innerHTML = `
    <div class="tiles" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--s4)">
      <div class="tile"><span class="t-label">Entries</span><span class="t-value">${m.stats.entries??'—'}</span></div>
      <div class="tile"><span class="t-label">Store</span><span class="t-value" style="font-size:15px;padding-top:6px">${esc(m.stats.store||'—')}</span></div>
      <div class="tile"><span class="t-label">Last reload</span><span class="t-value" style="font-size:15px;padding-top:6px">${m.stats.lastReload?fmtAgo(m.stats.lastReload):'—'}</span></div>
    </div>
    <div class="panel" style="margin-bottom:var(--s4)">
      <div class="panel-h"><h3>What it holds on you</h3><span class="ph-note" style="display:flex;gap:8px;align-items:center">GET /api/memory/status ${srcNote()}</span></div>
      ${m.profile.map(([k,v])=>`<div class="listrow"><div class="lr-body"><div class="lr-t">${esc(k)}</div><div class="lr-d">${esc(v)}</div></div></div>`).join('')}
    </div>
    <div class="panel" style="margin-bottom:var(--s4)">
      <div class="panel-h"><h3>Project threads</h3></div>
      ${m.projects.map(([k,v])=>`<div class="listrow"><div class="lr-body"><div class="lr-t" style="font-family:var(--f-mono);font-size:12.5px">${esc(k)}</div><div class="lr-d">${esc(v)}</div></div></div>`).join('')}
    </div>
    <button class="btn" id="btn-mem-reload">Force reload</button>
    <span style="font-size:11.5px;color:var(--ink-3);margin-left:10px">POST /api/memory/reload</span>`;
  $('#btn-mem-reload').addEventListener('click', async ()=>{
    if (S.mode==='live'&&S.liveOk){ await Live.memoryReload(); }
    else { S.memory.stats.lastReload=Date.now(); renderMemoryTab(); toast('Memory','reloaded (mock)'); }
  });
}
function renderMcpTab(){
  $('#tab-mcp').innerHTML = `
    <div class="frow" style="border-top:none">
      <div class="fr-l"><label for="mcp-json">Server config</label>
        <div class="fr-d">The gateway's MCP wiring — tool servers agents can reach. Edit and push.</div></div>
      <div class="fr-c">
        <textarea class="input json-edit" id="mcp-json" spellcheck="false" aria-label="MCP config JSON">${esc(JSON.stringify(S.mcp, null, 2))}</textarea>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn" id="btn-mcp-save">Push config</button>
          <span style="font-size:11.5px;color:var(--ink-3)">GET · PUT /api/mcp/config</span>
          <span id="mcp-err" style="font-size:11.5px;color:var(--crit)"></span>
        </div>
      </div>
    </div>`;
  $('#btn-mcp-save').addEventListener('click', async ()=>{
    const errEl=$('#mcp-err');
    try {
      const parsed = JSON.parse($('#mcp-json').value); errEl.textContent='';
      S.mcp = parsed;
      if (S.mode==='live'&&S.liveOk) await Live.putMcp(parsed);
      toast('MCP config','pushed'+(S.mode==='mock'?' (mock)':''));
    } catch(e){ errEl.textContent='not valid JSON — nothing pushed'; }
  });
}


export { setView, renderIfActive, renderView, renderAll, statusChip, renderNavCounts, renderTop, renderStrip, renderOps, renderChat, renderComposer, deleteThread, renderPending, dispatch, renderTele, renderFeedLines, allArtifacts, renderArts, fileIcon, antlerSVG, renderStation };
