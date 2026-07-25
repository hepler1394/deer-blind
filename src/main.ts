// main.ts — boot + wiring
import './styles/fonts.css';
import './styles/app.css';
import { S } from './state';
import { $, $$, esc, fmtClock, fmtDur } from './utils';
import { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP } from './mockdata';
import { seedMockWorld } from './engine';
import { Live } from './adapter';
import { wireHub, toast } from './hub';
import { setView, dispatch, renderOps, renderPending, renderAll, renderTop, renderStrip, renderIfActive, renderNavCounts, renderChat } from './render';
import { testConnection, checkRelease } from './adapter';
/* =========================================================================
   toasts, clock, boot
   ========================================================================= */

function boot(){
  seedMockWorld();

  /* nav */
  $$('.rail-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.nav)));
  $('#mode-pill').addEventListener('click',()=>{ setView('station'); });

  /* station tabs */
  $$('.tab').forEach(tb=>tb.addEventListener('click',()=>{
    $$('.tab').forEach(x=>x.setAttribute('aria-selected', x===tb ? 'true':'false'));
    $$('.tabpanel').forEach(p=>p.classList.remove('active'));
    $('#tab-'+tb.dataset.tab).classList.add('active');
  }));
  $('.tabs').addEventListener('keydown', (e: any)=>{
    if (e.key!=='ArrowRight' && e.key!=='ArrowLeft') return;
    const tabs=$$('.tab'); const i=tabs.findIndex(t=>t.getAttribute('aria-selected')==='true');
    const n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]; n.click(); n.focus();
  });

  /* composer */
  $('#btn-dispatch').addEventListener('click', dispatch);
  $('#composer-input').addEventListener('keydown', e=>{
    if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); dispatch(); }});
  $('#composer-model').addEventListener('change', e=>{ S.composerModel=e.target.value; });
  $('#btn-new-thread').addEventListener('click',()=>{ S.activeThreadId=null; renderOps(); $('#composer-input').focus(); });
  $('#btn-attach').addEventListener('click',()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.multiple=true;
    inp.onchange=()=>{ S.pendingFiles=(S.pendingFiles||[]).concat([...inp.files]); renderPending(); };
    inp.click();
  });

  /* station bindings */
  $('#btn-test-conn').addEventListener('click', testConnection);
  $('#conn-mode').addEventListener('change', async e=>{
    S.mode = e.target.value;
    if (S.mode==='live'){ toast('Live mode','point me at a gateway and hit Test connection'); await testConnection(); }
    else { S.liveOk=false; S.models=MOCK_MODELS; S.skills=JSON.parse(JSON.stringify(MOCK_SKILLS)); S.memory=MOCK_MEMORY; S.mcp=JSON.parse(JSON.stringify(MOCK_MCP)); toast('Mock mode','back to the simulated herd'); }
    renderAll();
  });
  $('#conn-url').addEventListener('change', e=>{ S.gatewayUrl=e.target.value.trim().replace(/\/$/,'')||'http://localhost:2026'; renderTop(); });
  $('#btn-check-release').addEventListener('click', checkRelease);

  /* keyboard */
  document.addEventListener('keydown', e=>{
    const inField = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.key==='/' && !inField){
      e.preventDefault(); setView('ops'); $('#composer-input').focus();
    } else if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey){
      const views = {'1':'ops','2':'tele','3':'arts','4':'station'};
      if (views[e.key]) setView(views[e.key]);
    }
  });

  /* settings via URL hash — no storage APIs, survives reload when served */
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('gw')){ S.gatewayUrl = h.get('gw').replace(/\/$/,''); $('#conn-url').value = S.gatewayUrl; }
    if (h.get('mode')==='live'){ S.mode='live'; $('#conn-mode').value='live'; setTimeout(()=>testConnection(), 300); }
  } catch(_){}
  const syncHash = ()=>{ try {
    const h = new URLSearchParams();
    if (S.gatewayUrl !== 'http://localhost:2026') h.set('gw', S.gatewayUrl);
    if (S.mode === 'live') h.set('mode','live');
    const s = h.toString();
    history.replaceState(null,'', s ? '#'+s : location.pathname + location.search);
  } catch(_){} };
  $('#conn-url').addEventListener('change', syncHash);
  $('#conn-mode').addEventListener('change', syncHash);

  /* clock + strip + live elapsed */
  setInterval(()=>{
    $('#top-clock').textContent = fmtClock(new Date());
    const run = S.runs[S.watchRunId];
    if (S.view==='tele' && run && run.status==='run'){
      const el = $('#rh-elapsed');
      if (el) el.textContent = fmtDur(Date.now()-run.startedAt)+' elapsed';
    }
  }, 1000);
  $('#top-clock').textContent = fmtClock(new Date());

  /* gateway watchdog — notices outages and heals when the wire returns */
  setInterval(async ()=>{
    if (S.mode!=='live') return;
    let up = false;
    try {
      const r = await fetch(Live.base()+'/api/models', {credentials:'include', headers:Live.headers(false)});
      up = r.ok;
    } catch(_){ up = false; }
    if (S.liveOk && !up){
      S.liveOk = false; renderTop(); renderStrip();
      toast('Gateway lost','the wire went quiet — watching for its return', true);
    } else if (!S.liveOk && up){
      S.liveOk = true;
      S.threads.forEach(t=>{ if (t.live) t._runsLoaded = false; });
      toast('Gateway back','wire restored — re-hydrating');
      Live.hydrate();
    }
  }, 30000);

  renderAll();
}

wireHub({ renderAll, renderIfActive, renderStrip, renderNavCounts, renderChat, renderOps, renderTop });
boot();
