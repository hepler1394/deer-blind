// state.ts — the one store
/* ---------- state ---------- */
const S: any = {
  mode: 'mock',                 // 'mock' | 'live'
  gatewayUrl: 'http://localhost:2026',
  liveOk: false,
  view: 'ops',
  threads: [],                  // {id,title,createdAt,status,messages:[],runIds:[]}
  runs: {},                     // runId -> {threadId,status,startedAt,endedAt,agents:[],events:[],tokens,toolCalls,tokSeries:[]}
  activeThreadId: null,
  watchRunId: null,             // what Telemetry is pointed at
  feedFilter: 'all',
  feedQuery: '',
  selArtifact: null,
  artQuery: '',
  artView: 'preview',           // html artifacts: 'preview' | 'source'
  threadQuery: '',
  installingSkill: null,        // filename while a .skill archive is being scanned/installed
  pendingFiles: [],
  totalTokens: 0,
  models: [], skills: [], memory: null, mcp: null,
  composerModel: null, composerSkills: new Set(['deep-research']),
  timers: new Set(),
};


export { S };
