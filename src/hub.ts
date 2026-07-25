// hub.ts — late-bound UI entry points + shared toast (breaks import cycles)
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
function toast(k, msg, isErr?){
  const t = document.createElement('div');
  t.className = 'toast'+(isErr?' crit':'');
  t.innerHTML = `<span class="t-k">${esc(k).toUpperCase()}</span>${esc(msg)}`;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(), 350); }, 4200);
}
function note(what, e){ console.warn('[blind] '+what+':', e.message); }
const _onceToasts = new Set();
function pushToastOnce(k, msg){ if (_onceToasts.has(k)) return; _onceToasts.add(k); toast(k, msg); }
export { toast, note, pushToastOnce };
