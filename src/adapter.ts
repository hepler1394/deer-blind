// adapter.ts — Live: verified against the deer-flow backend source
import { S } from './state';
import { $, fmtNum, stripThink } from './utils';
import { nid, mkRun, mkAgent, art, pushEvent } from './engine';
import { renderAll, renderIfActive, renderStrip, renderNavCounts, renderChat, renderOps, renderTop, toast, note, pushToastOnce } from './hub';
/* =========================================================================
   live adapter — verified against deer-flow backend source (gateway routers)
   native surface: /api/threads, /api/models, /api/skills, /api/memory, /api/mcp
   ========================================================================= */
const Live = {
  base(){ return S.gatewayUrl.replace(/\/$/,''); },
  csrf(){ const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; },
  headers(json=true){
    const h = json ? {'Content-Type':'application/json'} : {};
    const c = this.csrf(); if (c) h['X-CSRF-Token'] = c;
    return h;
  },
  async req(path, opts: any = {}){
    const r = await fetch(this.base() + path, {
      credentials:'include', headers:this.headers(!(opts.body instanceof FormData)), ...opts });
    if (r.status===401) throw new Error('401 — gateway auth is on. Sign in to the DeerFlow UI in this browser (cookie is shared across localhost ports), or run the gateway with DEER_FLOW_AUTH_DISABLED=1 for local dev.');
    if (!r.ok){ let d=''; try{ d=(await r.json()).detail||''; }catch(_){}
      throw new Error(`${r.status} ${r.statusText} on ${path}${d?' — '+d:''}`); }
    const ct = r.headers.get('content-type')||'';
    return ct.includes('json') ? r.json() : r.text();
  },
  async test(){
    const t0 = performance.now();
    let service = 'gateway';
    /* /health lives at the gateway root; behind the :2026 nginx it may not be
       proxied — so it's advisory only. /api/models is the real reachability test. */
    try { const h = await this.req('/health'); service = h.service||service; } catch(_){}
    const m = await this.req('/api/models');
    return { ms: Math.round(performance.now()-t0), models: m.models||[], service };
  },
  async hydrate(){
    try { const m = await this.req('/api/models');
      S.models = (m.models||[]).map(x=>({name:x.name, display_name:x.display_name||x.name, provider:x.description||'', thinking:!!x.supports_thinking}));
      if (S.models.length && !S.models.find(x=>x.name===S.composerModel)) S.composerModel=S.models[0].name;
    } catch(e){ note('models', e); }
    try { const sk = await this.req('/api/skills');
      const list = sk.skills||[];
      if (list.length) S.skills = list.map(x=>({id:x.name, name:x.name, desc:x.description||'', enabled:x.enabled!==false, builtin:x.category!=='custom'}));
    } catch(e){ note('skills', e); }
    try { const mem = await this.req('/api/memory');
      const prof = [];
      const u = mem.user||{};
      for (const [k,v] of Object.entries(u)){
        if (v==null || typeof v==='object' && !Array.isArray(v)) continue;
        prof.push([k, Array.isArray(v)?v.join(', '):String(v)]);
      }
      (mem.facts||[]).slice(0,8).forEach(f=>prof.push(['fact', f.content||f.text||JSON.stringify(f)]));
      S.memory = { profile: prof.slice(0,14),
        projects: Object.entries(mem.history||{}).map(([k,v])=>[k, typeof v==='string'?v:JSON.stringify(v).slice(0,120)]),
        stats: { entries: (mem.facts||[]).length, lastReload: mem.lastUpdated ? +new Date(mem.lastUpdated) : null, store: 'gateway rev '+(mem.revision??'—') } };
    } catch(e){ note('memory', e); }
    try { S.mcp = await this.req('/api/mcp/config'); } catch(e){ note('mcp', e); }
    await this.hydrateThreads();
    renderAll();
  },
  async hydrateThreads(){
    /* pull the gateway's existing threads into Operations */
    try {
      const list = await this.req('/api/threads/search', {method:'POST', body: JSON.stringify({limit: 25})});
      for (const rt of (Array.isArray(list)?list:[])){
        if (S.threads.find(t=>t.remoteId===rt.thread_id)) continue;
        const meta = rt.metadata||{};
        S.threads.push({ id: nid('th'), remoteId: rt.thread_id, live:true,
          title: meta.display_name || meta.title || ('gateway thread '+String(rt.thread_id).slice(0,8)),
          createdAt: rt.created_at ? +new Date(rt.created_at) : Date.now(),
          status: /busy|running|interrupt/i.test(String(rt.status||'')) ? 'run' : /error|fail/i.test(String(rt.status||'')) ? 'crit' : 'ok',
          messages: [], runIds: [] });
      }
      for (const t of S.threads){ if (t.live && t.status==='run') this.loadRuns(t); }
    } catch(e){ note('threads-search', e); }
  },
  async loadThread(t){
    /* lazy-load a gateway thread's message history on first open */
    this.loadRuns(t);
    try {
      const msgs = await this.req(`/api/threads/${t.remoteId}/messages?limit=60`);
      const out = [];
      for (const m of (Array.isArray(msgs)?msgs:[])){
        const et = String(m.event_type||m.type||'');
        const isHuman = /human|user/i.test(et);
        const isAI = !isHuman && /ai/i.test(et);
        if (!isHuman && !isAI) continue;
        let body = m.content;
        if (body && typeof body==='object' && !Array.isArray(body) && 'content' in body) body = body.content;
        if (Array.isArray(body)) body = body.map(p=>p?.text||'').join('');
        if (typeof body !== 'string') body = JSON.stringify(body).slice(0,400);
        const ts = m.created_at ? +new Date(m.created_at) : Date.now();
        if (isHuman) out.push({who:'you', ts, body});
        else { const f = stripThink(body);
          const durS = m.additional_kwargs && m.additional_kwargs.turn_duration;
          out.push({who:'atlas', ts, dur: durS ? durS*1000 : undefined, body: f.text || body, think: f.think || undefined}); }
      }
      if (out.length){
        t.messages = out;
        if (/^gateway thread /.test(t.title)){
          const firstHuman = out.find(m=>m.who==='you');
          if (firstHuman && firstHuman.body){
            const nt = String(firstHuman.body).trim().replace(/\s+/g,' ');
            t.title = nt.length<64 ? nt : nt.slice(0,61).replace(/\s+\S*$/,'')+'…';
            renderOps();
          }
        }
        renderChat();
      }
      else pushToastOnce('History','no displayable messages on that gateway thread');
    } catch(e){ note('thread-messages', e); toast('History','could not load thread history — '+e.message, true); }
  },
  async consumeSSE(res, run){
    /* shared SSE reader — used by fresh dispatches and mid-flight re-attach */
    const lead = run.agents[0];
    const nodes = run._nodes = run._nodes || {};
    const touchNode = (name)=>{
      if (!name || name==='__start__' || name==='__end__') return null;
      if (!nodes[name]){
        nodes[name] = mkAgent(name,'node','graph node','run',0,0,1);
        run.agents.push(nodes[name]);
      }
      return nodes[name];
    };
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf='', evName='', acc='';
    const bump = n => { run.tokens += n; S.totalTokens += n; run._acc=(run._acc||0)+n;
      if (!run._t0 || Date.now()-run._t0 > 4000){ run.tokSeries.push(run._acc); run._acc=0; run._t0=Date.now();
        if (run.tokSeries.length>24) run.tokSeries.shift(); } };
    while (true){
      const {done, value} = await reader.read(); if (done) break;
      buf += dec.decode(value, {stream:true});
      const frames = buf.split('\n\n'); buf = frames.pop();
      for (const frame of frames){
        evName = '';
        let data = '';
        for (const line of frame.split('\n')){
          if (line.startsWith('event:')) evName = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
          /* lines starting with ':' are heartbeats — ignored */
        }
        if (!evName || !data) continue;
        if (evName==='end'){ buf=''; break; }
        let d; try { d = JSON.parse(data); } catch(_){ continue; }
        if (evName==='messages'){
          const [chunk, meta] = Array.isArray(d) ? d : [d, {}];
          const nodeName = meta?.langgraph_node || meta?.checkpoint_ns?.split(':')[0] || null;
          const agentRow = touchNode(nodeName) || lead;
          const t = chunk?.type || chunk?.role || '';
          if (/human|user|system/i.test(t)) continue; /* input echo — not agent output */
          let text = '';
          const c = chunk?.content;
          if (typeof c==='string') text = c;
          else if (Array.isArray(c)) text = c.map(p=>p?.text||'').join('');
          if (/tool/i.test(t)){
            /* tool output is telemetry, not reply text — never accumulate it */
            pushEvent(run, agentRow.name, 'tool', (chunk.name?chunk.name+': ':'')+String(text).slice(0,160));
            continue;
          } else if (chunk?.tool_calls?.length || chunk?.tool_call_chunks?.length){
            const tc = (chunk.tool_calls||chunk.tool_call_chunks||[])[0]||{};
            if (tc.name) pushEvent(run, agentRow.name, 'tool', 'call '+tc.name+'(…)');
            for (const call of (chunk.tool_calls||[])){
              if (call.name==='present_files' && call.args && Array.isArray(call.args.filepaths))
                (run._presented = run._presented || []).push(...call.args.filepaths);
            }
          }
          if (text){
            acc += text; bump(Math.ceil(text.length/4));
            agentRow.tokens += Math.ceil(text.length/4);
          }
        } else if (evName==='values' && d && typeof d==='object'){
          const n = (d.messages||[]).length;
          if (n && n!==run._lastN){ run._lastN=n; pushEvent(run,'gateway','info','state: '+n+' messages in thread'); }
        } else if (evName==='metadata' && d && d.run_id){
          if (!run.remoteRunId){ run.remoteRunId = d.run_id; pushEvent(run,'blind','sys','run '+d.run_id+' streaming (SSE)'); }
        } else if (evName==='error'){
          pushEvent(run,'gateway','err', (typeof d==='string'?d:JSON.stringify(d)).slice(0,220));
        }
      }
      renderIfActive('tele'); renderStrip();
    }
    return acc;
  },
  async loadRuns(t){
    /* backfill a gateway thread's runs into Telemetry; re-attach if one is live */
    if (t._runsLoaded) return; t._runsLoaded = true;
    try {
      const runs = await this.req(`/api/threads/${t.remoteId}/runs`);
      for (const rr of (Array.isArray(runs)?runs:[]).slice(-6)){
        const rid = rr.run_id || rr.id; if (!rid) continue;
        if (t.runIds.some(x=>S.runs[x] && S.runs[x].remoteRunId===rid)) continue;
        const run = mkRun(t.id, rr.created_at ? +new Date(rr.created_at) : Date.now());
        run.live = true; run.remoteRunId = rid; run.thread = t;
        const st = String(rr.status||'');
        run.status = /run|pend|stream/i.test(st) ? 'run' : /err|fail|cancel/i.test(st) ? 'crit' : 'ok';
        run.endedAt = run.status==='run' ? null : (rr.updated_at ? +new Date(rr.updated_at) : run.startedAt);
        run.agents = [mkAgent('gateway','lead','gateway run '+String(rid).slice(0,8), run.status, 0, 0, 0)];
        S.runs[run.id] = run; t.runIds.push(run.id);
        if (run.status==='run') this.attach(t, run);
        else { this.loadRunEvents(t, run).then(()=>this.pullPresented(t, run)); this.pullArtifacts(t, run); }
      }
      try { const tu = await this.req(`/api/threads/${t.remoteId}/token-usage`);
        const last = S.runs[t.runIds[t.runIds.length-1]];
        if (last && tu.total_tokens) last.tokens = tu.total_tokens;
      } catch(_){}
      /* reconcile stale thread status once runs are known */
      if (t.status==='run' && !t.runIds.some(x=>S.runs[x] && S.runs[x].status==='run')){
        const lastR = S.runs[t.runIds[t.runIds.length-1]];
        if (lastR) t.status = lastR.status;
      }
    } catch(e){ note('runs-list', e); }
    renderNavCounts(); renderIfActive('tele');
  },
  async loadRunEvents(t, run){
    /* pull the persisted event stream for a completed run into the field feed */
    try {
      const evs = await this.req(`/api/threads/${t.remoteId}/runs/${run.remoteRunId}/events?limit=300`);
      for (const e of (Array.isArray(evs)?evs:[])){
        const et = String(e.event_type||'');
        const kind = /error|fail/i.test(et) ? 'err' : /tool/i.test(et) ? 'tool' : /ai\.response/i.test(et) ? 'info' : 'sys';
        let msg = et;
        const c = e.content;
        if (typeof c==='string' && c && !/^<object/.test(c)) msg = et+': '+stripThink(c).text.slice(0,140);
        else if (c && typeof c==='object' && typeof c.content==='string') msg = et+': '+stripThink(c.content).text.slice(0,140);
        else if (e.name) msg = et+': '+e.name;
        const tcs = (c && typeof c==='object' && Array.isArray(c.tool_calls)) ? c.tool_calls : [];
        for (const call of tcs){
          if (call.name==='present_files' && call.args && Array.isArray(call.args.filepaths))
            (run._presented = run._presented || []).push(...call.args.filepaths);
        }
        run.events.push({ ts: e.created_at ? +new Date(e.created_at) : run.startedAt,
          agent: e.task_id ? String(e.task_id).slice(0,8) : 'gateway', kind, msg });
      }
      run.toolCalls = run.events.filter(x=>x.kind==='tool').length;
      renderIfActive('tele');
    } catch(e){ note('run-events', e); }
  },
  async pullArtifacts(t, run){
    /* fetch a run's workspace files into the artifact tray */
    if (!run.remoteRunId || run._artsPulled) return; run._artsPulled = true;
    try {
      const wc = await this.req(`/api/threads/${t.remoteId}/runs/${run.remoteRunId}/workspace-changes?include_diff=false`);
      const files = wc.files||wc.changes||[];
      for (const f of files.slice(0,30)){
        const p = f.path||f.file||String(f);
        pushEvent(run,'gateway','info','workspace: '+p);
        const name = p.split('/').pop();
        const ext = (name.split('.').pop()||'').toLowerCase();
        const type = ext==='md'?'md':ext==='html'?'html':'json';
        let body = `(file lives on the gateway)\n\nGET ${this.base()}/api/threads/${t.remoteId}/artifacts/${p}`;
        try { if (['md','txt','json','html','csv'].includes(ext)){
          const raw = await this.req(`/api/threads/${t.remoteId}/artifacts/${encodeURI(p)}`);
          body = typeof raw==='string' ? raw : JSON.stringify(raw,null,2); } } catch(_){}
        run.artifacts.push({...art(name, type, body, t.id), gwPath: p});
      }
      if (files.length){ toast('Artifacts', files.length+' file'+(files.length===1?'':'s')+' pulled from the gateway'); renderNavCounts(); renderIfActive('arts'); }
    } catch(e){ note('workspace-changes', e); }
  },
  async pullPresented(t, run){
    /* artifacts announced via the present_files tool — the only artifact channel
       on LocalSandboxProvider, where workspace snapshots report available:false */
    const paths = [...new Set<string>(run._presented || [])];
    if (!paths.length || run._presPulled) return; run._presPulled = true;
    let pulled = 0;
    for (const p of paths.slice(0, 30)){
      const name = p.split('/').pop();
      const ext = (name.split('.').pop()||'').toLowerCase();
      const type = ext==='md'?'md':ext==='html'?'html':'json';
      try {
        const raw = await this.req(`/api/threads/${t.remoteId}/artifacts${encodeURI(p)}`);
        const body = typeof raw==='string' ? raw : JSON.stringify(raw, null, 2);
        run.artifacts.push({...art(name, type, body, t.id), gwPath: p});
        pushEvent(run, 'gateway', 'info', 'presented: '+p); pulled++;
      } catch(_){
        pushEvent(run, 'gateway', 'warn', 'agent presented a file the gateway cannot find: '+p);
      }
    }
    if (pulled){ toast('Artifacts', pulled+' presented file'+(pulled===1?'':'s')+' pulled'); }
    renderNavCounts(); renderIfActive('arts'); renderIfActive('tele');
  },
  async attach(t, run){
    /* resume watching an in-flight gateway run (survives tab reloads) */
    pushEvent(run,'blind','sys','re-attaching to in-flight run '+String(run.remoteRunId).slice(0,8));
    S.watchRunId = run.id; renderIfActive('tele');
    try {
      const res = await fetch(this.base()+`/api/threads/${t.remoteId}/runs/${run.remoteRunId}/stream`,
        { method:'GET', credentials:'include', headers:this.headers(false) });
      if (!res.ok || !res.body) throw new Error(res.status+' '+res.statusText+' on run stream');
      const acc = await this.consumeSSE(res, run);
      run.status='ok'; run.endedAt=Date.now();
      if (t.status==='run') t.status='ok';
      run.agents.forEach(a=>{ if (a.status==='run') a.status='ok'; });
      const fin = stripThink(acc);
      if (fin.text) t.messages.push({who:'atlas', ts:Date.now(), dur:(run.endedAt||Date.now())-run.startedAt, body:fin.text, think:fin.think||undefined});
      pushEvent(run,'blind','sys','stream closed');
    } catch(e){
      run.status='warn';
      pushEvent(run,'gateway','err','re-attach failed: '+e.message);
    }
    renderAll();
  },
  async putSkill(s){
    try { await this.req('/api/skills/'+encodeURIComponent(s.id), {method:'PUT', body: JSON.stringify({enabled:s.enabled})}); }
    catch(e){ toast('Skills','gateway rejected the update — '+e.message, true); this.hydrate(); }
  },
  async installSkill(file){
    /* real flow per source: upload the .skill into a thread, then
       POST /api/skills/install {thread_id, path}. The gateway LLM-scans the
       archive before accepting it — minutes on a local model — so the whole
       time is spent behind S.installingSkill and a visible pending state,
       instead of the old silent nothing. */
    if (S.installingSkill){ toast('Skill rack','an install is already in flight — one at a time', true); return; }
    S.installingSkill = file.name; renderIfActive('station');
    try {
      const th = await this.req('/api/threads', {method:'POST', body: JSON.stringify({metadata:{purpose:'deer-blind skill install'}})});
      const tid = th.thread_id;
      const fd = new FormData(); fd.append('files', file);
      const up = await this.req(`/api/threads/${tid}/uploads`, {method:'POST', body: fd});
      const f0 = (up.files||up.uploaded||[])[0] || {};
      /* the install endpoint resolves this through resolve_thread_virtual_path(),
         which requires the /mnt/user-data/... sandbox path — NOT f0.path, which is
         the real host filesystem path and gets rejected with 400 "must start with
         /mnt/user-data" every time. virtual_path is the one that actually works. */
      const vpath = f0.virtual_path || f0.path || ('/mnt/user-data/uploads/'+file.name);
      await this.req('/api/skills/install', {method:'POST', body: JSON.stringify({thread_id: tid, path: vpath})});
      toast('Skill rack', file.name+' installed on gateway'); this.hydrate();
    } catch(e){ toast('Install failed', e.message, true); }
    finally { S.installingSkill = null; renderIfActive('station'); }
  },
  async putMcp(cfg){ try { await this.req('/api/mcp/config',{method:'PUT',body:JSON.stringify(cfg)}); }
    catch(e){ toast('MCP','push failed — '+e.message, true); } },
  async memoryReload(){ try { await this.req('/api/memory/reload',{method:'POST'});
      toast('Memory','gateway reloaded'); this.hydrate(); }
    catch(e){ toast('Memory','reload failed — '+e.message, true); } },
  async cancel(thread, run){
    try { await this.req(`/api/threads/${thread.remoteId}/runs/${run.remoteRunId}/cancel`, {method:'POST'});
      pushEvent(run,'blind','sys','cancel requested on gateway'); }
    catch(e){ toast('Cancel', e.message, true); }
  },
  async uploadToThread(thread, files){
    if (!thread.remoteId){
      const th = await this.req('/api/threads', {method:'POST', body: JSON.stringify({})});
      thread.remoteId = th.thread_id;
    }
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const up = await this.req(`/api/threads/${thread.remoteId}/uploads`, {method:'POST', body: fd});
    return up.files||up.uploaded||[];
  },

  /* dispatch through the native gateway run API (SSE) */
  async dispatch(thread, brief){
    const run = mkRun(thread.id, Date.now());
    S.runs[run.id]=run; thread.runIds.push(run.id); thread.status='run'; S.watchRunId=run.id;
    const lead = mkAgent('gateway','lead','remote run on '+this.base().replace(/^https?:\/\//,''),'run',0,0,0);
    run.agents=[lead];
    run.live = true; run.thread = thread;
    pushEvent(run,'blind','sys','opening thread on gateway');
    renderAll();
    try {
      if (!thread.remoteId){
        const th = await this.req('/api/threads', {method:'POST', body:JSON.stringify({})});
        thread.remoteId = th.thread_id;
        pushEvent(run,'blind','sys','thread '+thread.remoteId+' created');
      }
      const res = await fetch(this.base()+`/api/threads/${thread.remoteId}/runs/stream`, {
        method:'POST', credentials:'include', headers:this.headers(),
        body: JSON.stringify({
          input:{ messages:[{role:'user', content:brief}] },
          /* 'messages-tuple' is the 2026-07 gateway's name for token streaming -
             plain 'messages' now 422s at validation. The SSE events it emits are
             still named 'messages', so consumeSSE stays as-is. */
          stream_mode:['values','messages-tuple'],
          stream_subgraphs:true,
          context:{ model_name: S.composerModel },
        }) });
      if (res.status===401) throw new Error('401 — gateway auth is on. Sign in to the DeerFlow UI in this browser, or set DEER_FLOW_AUTH_DISABLED=1 for local dev.');
      if (!res.ok || !res.body) throw new Error(res.status+' '+res.statusText+' on runs/stream');
      const loc = res.headers.get('Content-Location')||'';
      run.remoteRunId = (loc.match(/\/runs\/([^/]+)$/)||[])[1] || null;
      if (run.remoteRunId) pushEvent(run,'blind','sys','run '+run.remoteRunId+' streaming (SSE)');
      const acc = await this.consumeSSE(res, run);
      run.status='ok'; run.endedAt=Date.now(); thread.status='ok';
      run.agents.forEach(a=>{ if (a.status==='run') a.status='ok'; });
      pushEvent(run,'blind','sys','stream closed');
      /* post-run truth from the gateway: real token usage + produced files */
      try { const tu = await this.req(`/api/threads/${thread.remoteId}/token-usage`);
        if (tu.total_tokens){ S.totalTokens += tu.total_tokens - run.tokens; run.tokens = tu.total_tokens;
          pushEvent(run,'gateway','info',`token usage (gateway): ${fmtNum(tu.total_tokens)} total · ${fmtNum(tu.total_input_tokens)} in / ${fmtNum(tu.total_output_tokens)} out · ${tu.total_runs} runs`); }
      } catch(e){ note('token-usage', e); }
      await this.pullArtifacts(thread, run);
      await this.pullPresented(thread, run);
      const fin = stripThink(acc);
      thread.messages.push({who:'atlas', ts:Date.now(), dur: (run.endedAt||Date.now())-run.startedAt, think: fin.think || undefined, body: fin.text || 'Run finished — the stream carried no assistant text this console recognized. The raw event log is on the gateway: GET /api/threads/'+thread.remoteId+'/runs/'+(run.remoteRunId||'…')+'/events.'});
    } catch(e){
      run.status='crit'; run.endedAt=Date.now(); thread.status='crit';
      run.agents.forEach(a=>{ if (a.status==='run') a.status='crit'; });
      pushEvent(run,'gateway','err', e.message);
      if (/failed to fetch|networkerror|load failed/i.test(e.message))
        pushEvent(run,'blind','sys','if the browser console mentions CORS, restart the gateway with GATEWAY_CORS_ORIGINS='+location.origin+' — see Station → Connection');
      thread.messages.push({who:'atlas', ts:Date.now(), err:true, body:'The gateway run failed: **'+e.message+'**. Details in Telemetry.'});
      toast('Gateway run failed', e.message, true);
    }
    renderAll();
  },
};


async function testConnection(){
  const btn=$('#btn-test-conn'), out=$('#conn-result'), lat=$('#conn-latency');
  btn.disabled=true; btn.textContent='Testing…'; out.hidden=true; lat.textContent='';
  S.gatewayUrl = $('#conn-url').value.trim().replace(/\/$/,'') || 'http://localhost:2026';
  try {
    const {ms, models, service} = await Live.test();
    const n = models.length;
    S.liveOk = true; lat.textContent = ms+' ms';
    out.hidden=false; out.className='conn-result ok';
    out.textContent = `OK — ${service} answered in ${ms} ms — ${n} model${n===1?'':'s'} on the roster${n?': '+models.map(m=>m.name).join(', '):''}`;
    if (S.mode==='live'){ await Live.hydrate(); toast('Live','connected to '+S.gatewayUrl); }
  } catch(e){
    S.liveOk = false;
    out.hidden=false; out.className='conn-result err';
    out.textContent = `ERR — ${e.message||e}\n\nlikely: gateway not running · wrong port · CORS not allow-listed (see note below)`;
  }
  btn.disabled=false; btn.textContent='Test connection';
  renderTop(); renderStrip();
}

async function checkRelease(){
  const btn=$('#btn-check-release'), out=$('#release-result'), noteEl=$('#release-note');
  btn.disabled=true; noteEl.textContent='asking github…'; out.hidden=true;
  try {
    const r = await fetch('https://api.github.com/repos/bytedance/deer-flow/releases/latest',
      {headers:{'Accept':'application/vnd.github+json'}});
    if (!r.ok) throw new Error('GitHub answered '+r.status+(r.status===403?' (rate limit — 60/hr unauthenticated)':''));
    const d = await r.json();
    out.hidden=false; out.className='conn-result ok';
    out.textContent = `latest: ${d.tag_name||d.name} · published ${new Date(d.published_at).toLocaleDateString()}\n${(d.body||'').split('\n').slice(0,3).join('\n').slice(0,240)}`;
    noteEl.textContent='';
  } catch(e){
    out.hidden=false; out.className='conn-result err';
    out.textContent = 'ERR — '+e.message+' — offline is fine, this is the only outbound call in the file.';
    noteEl.textContent='';
  }
  btn.disabled=false;
}


export { Live, testConnection, checkRelease };
