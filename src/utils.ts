// utils.ts — helpers, formatting, markdown, reasoning-stripper
/* ---------- tiny utils ---------- */
const $  = (s: string, r: any = document): any => r.querySelector(s);
const $$ = (s: string, r: any = document): any[] => [...r.querySelectorAll(s)];
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

/* media sniffing - one shared answer to "can the console show this inline?" */
const IMG_EXTS = ['png','jpg','jpeg','gif','webp','svg','bmp'];
const VID_EXTS = ['mp4','webm','mov','m4v','mkv','avi'];
const mediaKind = (name): 'img'|'video'|null => {
  const e = (String(name).split('.').pop()||'').toLowerCase();
  return IMG_EXTS.includes(e) ? 'img' : VID_EXTS.includes(e) ? 'video' : null;
};

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

/* zip, the store-only edition — enough to hand the artifact tray over as one
   file without pulling in a dependency. No compression: these are small text
   artifacts, and "opens everywhere" beats saving a few KB. */
let _crcT: Uint32Array | null = null;
function crc32(b: Uint8Array){
  if (!_crcT){ _crcT = new Uint32Array(256);
    for (let n=0;n<256;n++){ let c=n; for (let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; _crcT[n]=c>>>0; } }
  let c = 0xFFFFFFFF;
  for (let i=0;i<b.length;i++) c = _crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files: {name: string, data: string | Uint8Array}[]): Blob {
  const enc = new TextEncoder();
  /* any[]: TS 7's Uint8Array<ArrayBufferLike> vs BlobPart split fights plain
     TextEncoder output; the runtime shapes here are trivially Blob-safe */
  const parts: any[] = [], cen: any[] = [];
  let off = 0;
  const d = new Date();
  const dosT = (d.getHours()<<11) | (d.getMinutes()<<5) | (d.getSeconds()>>1);
  const dosD = (((d.getFullYear()-1980)&0x7F)<<9) | ((d.getMonth()+1)<<5) | d.getDate();
  for (const f of files){
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,dosT,true); lh.setUint16(12,dosD,true); lh.setUint32(14,crc,true);
    lh.setUint32(18,data.length,true); lh.setUint32(22,data.length,true);
    lh.setUint16(26,name.length,true); lh.setUint16(28,0,true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
    ch.setUint16(12,dosT,true); ch.setUint16(14,dosD,true); ch.setUint32(16,crc,true);
    ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true);
    ch.setUint16(28,name.length,true); ch.setUint16(30,0,true); ch.setUint16(32,0,true);
    ch.setUint16(34,0,true); ch.setUint16(36,0,true); ch.setUint32(38,0,true); ch.setUint32(42,off,true);
    cen.push(ch.buffer, name);
    off += 30 + name.length + data.length;
  }
  let cenSize = 0; for (const c of cen) cenSize += (c as any).byteLength;
  const eo = new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true); eo.setUint16(4,0,true); eo.setUint16(6,0,true);
  eo.setUint16(8,files.length,true); eo.setUint16(10,files.length,true);
  eo.setUint32(12,cenSize,true); eo.setUint32(16,off,true); eo.setUint16(20,0,true);
  return new Blob([...parts, ...cen, eo.buffer], {type:'application/zip'});
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


export { $, $$, esc, fmtTok, fmtNum, fmtBytes, fmtClock, fmtT, fmtAgo, fmtDur, mulberry, debounce, md, stripThink, crc32, makeZip, mediaKind };
