// utils.ts — helpers, formatting, markdown, reasoning-stripper
/* ---------- tiny utils ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTok = n => n >= 1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,'')+'M' : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,'')+'k' : String(n|0);
const fmtNum = n => n.toLocaleString('en-US');
const fmtBytes = n => n >= 1048576 ? (n/1048576).toFixed(1)+' MB' : n >= 1024 ? (n/1024).toFixed(1)+' KB' : n+' B';
const fmtClock = d => d.toTimeString().slice(0,8);
const fmtT = ts => new Date(ts).toTimeString().slice(0,8);
const fmtAgo = ts => { const s=(Date.now()-ts)/1e3; if(s<60) return 'just now';
  if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`; };
const fmtDur = ms => { const s=Math.floor(ms/1e3);
  return s<60 ? `${s}s` : `${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`; };
function mulberry(seed){ return function(){ let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t>>>15, t | 1); t ^= t + Math.imul(t ^ t>>>7, t | 61);
  return ((t ^ t>>>14) >>> 0) / 4294967296; }; }
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};

/* markdown, the 5%-of-commonmark-you-actually-need edition */
function md(src){
  src = String(src).replace(/\r\n/g,'\n');
  const blocks = []; // stash code fences
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_,lang,code)=>{
    blocks.push(`<pre><code>${esc(code.replace(/\n$/,''))}</code></pre>`);
    return `\x00B${blocks.length-1}\x00`; });
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g,'$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = src.split('\n'); const out = [];
  let i = 0;
  while (i < lines.length){
    const L = lines[i];
    if (/^\x00B\d+\x00$/.test(L.trim())){ out.push(L.trim()); i++; continue; }
    if (/^\s*$/.test(L)){ i++; continue; }
    let m;
    if (m = L.match(/^(#{1,3})\s+(.*)/)){ out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^---\s*$/.test(L)){ out.push('<hr>'); i++; continue; }
    if (/^\s*>\s?/.test(L)){ const b=[]; while(i<lines.length && /^\s*>\s?/.test(lines[i])){ b.push(lines[i].replace(/^\s*>\s?/,'')); i++; }
      out.push(`<blockquote>${b.map(inline).join('<br>')}</blockquote>`); continue; }
    if (/^\s*[-*]\s+/.test(L)){ const items=[]; while(i<lines.length && (/^\s*[-*]\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))){
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/,'')); else items[items.length-1] += ' '+lines[i].trim(); i++; }
      out.push(`<ul>${items.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`); continue; }
    if (/^\s*\d+\.\s+/.test(L)){ const items=[]; while(i<lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))){
        if (/^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*\d+\.\s+/,'')); else items[items.length-1] += ' '+lines[i].trim(); i++; }
      out.push(`<ol>${items.map(x=>`<li>${inline(x)}</li>`).join('')}</ol>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(L) && i+1<lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i+1])){
      const head = L.split('|').slice(1,-1).map(c=>c.trim()); i += 2; const rows=[];
      while(i<lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){ rows.push(lines[i].split('|').slice(1,-1).map(c=>c.trim())); i++; }
      out.push(`<table><thead><tr>${head.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${
        rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
    const para=[]; while(i<lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|---\s*$|\s*[-*]\s|\s*\d+\.\s|\s*>|\s*\|.*\|\s*$|\x00B)/.test(lines[i])){ para.push(lines[i]); i++; }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); else i++;
  }
  return out.join('\n').replace(/\x00B(\d+)\x00/g, (_,n)=>blocks[+n]);
}

/* qwen-style reasoning: pull <think>…</think> out of a message */
function stripThink(s){
  let think = '';
  const text = String(s)
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_,t)=>{ think += t.trim()+'\n'; return ''; })
    .replace(/^<think>[\s\S]*$/gi, m=>{ think += m.replace(/^<think>/i,'').trim(); return ''; })
    .trim();
  return { text, think: think.trim() };
}


export { $, $$, esc, fmtTok, fmtNum, fmtBytes, fmtClock, fmtT, fmtAgo, fmtDur, mulberry, debounce, md, stripThink };
