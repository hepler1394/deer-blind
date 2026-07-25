// charts.ts — hand-rolled SVG, single hue, thin marks
import { fmtTok, fmtNum } from './utils';
/* =========================================================================
   charts — hand-rolled SVG, single hue, thin marks
   ========================================================================= */
function sparkSVG(points, w=96, h=26){
  if (!points || points.length < 2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const px = i => 2 + i * (w-8) / (points.length-1);
  const py = v => h-3 - (v-min) * (h-8) / Math.max(1, max-min);
  const path = points.map((v,i)=>`${i?'L':'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('');
  const lx = px(points.length-1), ly = py(points[points.length-1]);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${path}" fill="none" stroke="var(--series-dim)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="4.5" fill="var(--surface-1)"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="var(--accent)"/>
  </svg>`;
}
function tokChartSVG(series, w, h){
  const P = { t:14, r:10, b:22, l:40 };
  const iw = w-P.l-P.r, ih = h-P.t-P.b;
  const pts = series.length ? series : [0,0];
  const max = Math.max(...pts, 1000);
  const step = niceStep(max);
  const top = Math.ceil(max/step)*step;
  const px = i => P.l + i * iw / Math.max(1, pts.length-1);
  const py = v => P.t + ih - v * ih / top;
  let grid = '', ticks = '';
  for (let v=0; v<=top; v+=step){
    grid  += `<line x1="${P.l}" y1="${py(v)}" x2="${w-P.r}" y2="${py(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    ticks += `<text x="${P.l-8}" y="${py(v)+3.5}" text-anchor="end" font-size="10" fill="var(--ink-3)" font-family="var(--f-mono)" style="font-variant-numeric:tabular-nums">${fmtTok(v)}</text>`;
  }
  const line = pts.map((v,i)=>`${i?'L':'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('');
  const area = `${line} L${px(pts.length-1)},${py(0)} L${px(0)},${py(0)} Z`;
  const lx=px(pts.length-1), ly=py(pts[pts.length-1]);
  return { svg: `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block" role="img" aria-label="Token burn per interval">
    ${grid}${ticks}
    <path d="${area}" fill="var(--series)" opacity="0.1"/>
    <path d="${line}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="5.5" fill="var(--surface-1)"/><circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--series)"/>
    <line id="tc-cross" x1="0" y1="${P.t}" x2="0" y2="${P.t+ih}" stroke="var(--border-strong)" stroke-width="1" style="display:none"/>
    <circle id="tc-dot" r="4.5" fill="var(--surface-1)" style="display:none"/>
    <circle id="tc-dot2" r="3" fill="var(--series)" style="display:none"/>
    <rect id="tc-hit" x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent"/>
  </svg>`, px, py, pts, P, iw };
}
function niceStep(max){
  const raw = max/3, pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1,2,5,10]) if (m*pow >= raw) return m*pow;
  return 10*pow;
}
function wireTokChart(wrap, chart){
  const svg = wrap.querySelector('svg'); if (!svg) return;
  const tip = wrap.querySelector('.chart-tip');
  const hit = svg.querySelector('#tc-hit'), cross = svg.querySelector('#tc-cross');
  const d1 = svg.querySelector('#tc-dot'), d2 = svg.querySelector('#tc-dot2');
  const show = e => {
    const r = svg.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
    const i = Math.max(0, Math.min(chart.pts.length-1, Math.round((sx - chart.P.l) / (chart.iw / Math.max(1,chart.pts.length-1)))));
    const x = chart.px(i), y = chart.py(chart.pts[i]);
    cross.style.display=''; cross.setAttribute('x1',x); cross.setAttribute('x2',x);
    d1.style.display=''; d2.style.display='';
    d1.setAttribute('cx',x); d1.setAttribute('cy',y); d2.setAttribute('cx',x); d2.setAttribute('cy',y);
    tip.style.display='block';
    tip.innerHTML = `<span class="ct-t">interval ${i+1} of ${chart.pts.length}</span><span class="ct-v"><i></i>${fmtNum(chart.pts[i]|0)} tok</span>`;
    const wr = wrap.getBoundingClientRect();
    let tx = e.clientX - wr.left + 14; if (tx + tip.offsetWidth > wr.width - 8) tx = e.clientX - wr.left - tip.offsetWidth - 14;
    tip.style.left = tx+'px'; tip.style.top = Math.max(4, e.clientY - wr.top - 40)+'px';
  };
  const hide = () => { tip.style.display='none'; cross.style.display='none'; d1.style.display='none'; d2.style.display='none'; };
  hit.addEventListener('pointermove', show); hit.addEventListener('pointerleave', hide);
}


export { sparkSVG, tokChartSVG, niceStep, wireTokChart };
