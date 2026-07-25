// mockdata.ts — demo catalog + artifact bodies
/* ---------- mock catalog ---------- */
const MOCK_MODELS = [
  { name:'deepseek-chat',      display_name:'DeepSeek V3',        provider:'deepseek',  ctx:128000 },
  { name:'kimi-k2',            display_name:'Kimi K2',            provider:'moonshot',  ctx:256000 },
  { name:'gpt-5.2',            display_name:'GPT-5.2',            provider:'openai',    ctx:400000 },
  { name:'qwen3-32b-local',    display_name:'Qwen3 32B (ollama)', provider:'ollama',    ctx:32768 },
];
const MOCK_SKILLS = [
  { id:'deep-research', name:'Deep research', desc:'Multi-pass web recon with cited sources and a synthesis stage.', enabled:true,  builtin:true },
  { id:'report-writer', name:'Report writer', desc:'Long-form markdown reports with charts pulled from analysis runs.', enabled:true,  builtin:true },
  { id:'slide-deck',    name:'Slide deck',    desc:'Outline first, then a styled deck exported through the sandbox.', enabled:true,  builtin:true },
  { id:'web-build',     name:'Web build',     desc:'Scaffold and serve small sites inside the sandbox with live preview.', enabled:false, builtin:true },
  { id:'podcast-mini',  name:'Podcast mini',  desc:'Transcribe, chapter and summarize audio dropped into a thread.', enabled:false, builtin:false },
];
const MOCK_MEMORY = {
  profile: [
    ['Prefers', 'terse summaries first, detail on request'],
    ['Timezone', 'America/Chicago'],
    ['Default report format', 'markdown with source table'],
    ['Recurring topic', 'retail media / ad-tech market scans'],
  ],
  projects: [
    ['retail-media-scan', 'network CPM benchmarks live in artifacts/sources.json'],
    ['snack-brand-site', 'brand palette locked: pine, blaze orange, cream'],
  ],
  stats: { entries: 23, lastReload: Date.now() - 1000*60*47, store: 'sqlite (local)' },
};
const MOCK_MCP = {
  servers: {
    'tavily-search': { transport:'stdio', command:'npx tavily-mcp', enabled:true },
    'github':        { transport:'stdio', command:'npx @modelcontextprotocol/server-github', enabled:true },
    'filesystem':    { transport:'stdio', command:'mcp-server-fs --root ~/deer-work', enabled:false },
  },
};

/* ---------- mock artifact bodies ---------- */
const ART_REPORT = `# US retail media networks — field scan, July 2026

Six networks now clear $1B in annual ad revenue. The growth story is
splitting in two: marketplaces with strong first-party checkout data keep
compounding, while grocery-anchored networks are stalling on measurement
disputes and thin on-site inventory.

## Where the spend is going

| Network | 2025 est. revenue | YoY | Signal |
| --- | --- | --- | --- |
| Amazon Ads | $56.2B | +18% | still absorbs ~3/4 of category spend |
| Walmart Connect | $4.4B | +26% | Vizio close adds CTV inventory |
| Instacart | $1.1B | +9% | growth cooling as basket sizes flatten |
| Target Roundel | $0.9B | +11% | leaning on in-store screens |
| Kroger Precision | $0.6B | +7% | measurement dispute with two majors |
| Chewy Ads | $0.4B | +31% | fastest riser off a small base |

## Three things worth watching

1. **Off-site is the battleground.** Every network above now resells its
   audience graph into open-web DSPs; take-rates there are half of on-site.
2. **In-store retail media is finally real** — Target and Kroger both report
   screen networks at scale, but neither shares verified impression counts.
3. **Measurement consolidation.** Three of the six now accept the same
   third-party verification stack, up from zero in 2024.

> Working note from analyst run: CPM deltas in \`sources.json\` are
> computed from public rate cards, not negotiated rates — treat as ceiling.

## Method

Two scout passes (12 sources, 9 kept), one sandbox analysis pass over the
collected tables, one synthesis pass. Full trail in the run telemetry.
`;
const ART_CHART_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Spend by network</title>
<style>body{font:13px/1.5 system-ui;margin:24px;background:#fff;color:#111}
h1{font-size:15px;margin:0 0 4px}p{color:#666;margin:0 0 16px;font-size:12px}
.bar{display:flex;align-items:center;gap:10px;margin:7px 0}
.bar b{width:130px;font-weight:500;font-size:12px;text-align:right}
.bar i{display:block;height:16px;background:#2F5D3A;border-radius:0 3px 3px 0}
.bar span{font-size:11px;color:#555}</style></head><body>
<h1>US retail media — est. 2025 ad revenue</h1><p>Amazon excluded for scale (est. $56.2B)</p>
<div class="bar"><b>Walmart Connect</b><i style="width:352px"></i><span>$4.4B</span></div>
<div class="bar"><b>Instacart</b><i style="width:88px"></i><span>$1.1B</span></div>
<div class="bar"><b>Target Roundel</b><i style="width:72px"></i><span>$0.9B</span></div>
<div class="bar"><b>Kroger Precision</b><i style="width:48px"></i><span>$0.6B</span></div>
<div class="bar"><b>Chewy Ads</b><i style="width:32px"></i><span>$0.4B</span></div>
</body></html>`;
const ART_SOURCES = JSON.stringify({
  collected: 12, kept: 9, dropped: ["duplicate coverage x2", "paywalled, no cache"],
  sources: [
    { id: 1, title: "eMarketer retail media forecast update", date: "2026-06-11", used_for: "revenue table" },
    { id: 2, title: "Walmart Q1 FY27 earnings call transcript", date: "2026-05-15", used_for: "Connect growth, Vizio" },
    { id: 3, title: "Instacart shareholder letter Q1 2026", date: "2026-05-06", used_for: "growth cooling" },
    { id: 4, title: "Kroger Precision / verification dispute coverage", date: "2026-04-22", used_for: "measurement section" },
    { id: 5, title: "Target Roundel in-store screens press release", date: "2026-03-18", used_for: "in-store push" },
    { id: 6, title: "Chewy Ads launch retrospective", date: "2026-02-09", used_for: "riser note" },
    { id: 7, title: "IAB retail media measurement framework v2", date: "2026-01-27", used_for: "consolidation point" },
    { id: 8, title: "Public rate cards (6 networks)", date: "2026-06-30", used_for: "CPM deltas" },
    { id: 9, title: "OpenRTB off-site reseller integration notes", date: "2026-05-29", used_for: "off-site take-rates" }
  ]
}, null, 2);
const ART_SLIDES = `# Retail media scan — deck outline

1. Cold open: six networks past $1B — but two speeds
2. The table (revenue + YoY, one slide, no clutter)
3. Off-site take-rate squeeze (diagram)
4. In-store screens: real inventory, unverified counts
5. Measurement: 3 of 6 on one stack — what changes
6. Watchlist + method note
`;


export { MOCK_MODELS, MOCK_SKILLS, MOCK_MEMORY, MOCK_MCP, ART_REPORT, ART_CHART_HTML, ART_SOURCES, ART_SLIDES };
