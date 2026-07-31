// state.ts — the one store, with the shapes written down.
/* ---------- domain types ---------- */
type FeedMode = 'mock' | 'live';
type ViewName = 'ops' | 'tele' | 'arts' | 'station';
type Status = 'run' | 'ok' | 'warn' | 'crit' | 'idle' | 'queue';
type ArtifactType = 'md' | 'html' | 'json' | 'img' | 'video';
type EventKind = 'sys' | 'info' | 'tool' | 'warn' | 'err';

interface Message {
  who: 'you' | 'atlas';
  ts: number;
  body: string;
  think?: string;          // stripped <think> reasoning, shown collapsed
  dur?: number;            // ms the turn took (agent messages)
  err?: boolean;
}

interface Upload {
  name: string;
  size: number;
  url: string;             // absolute gateway artifact URL
}

interface Thread {
  id: string;
  title: string;
  createdAt: number;
  status: Status;
  messages: Message[];
  runIds: string[];
  remoteId?: string;       // gateway thread_id when live
  live?: boolean;
  demo?: boolean;
  uploads?: Upload[];      // the field bag
  _upsPulled?: boolean;
  _runsLoaded?: boolean;
}

interface AgentRow {
  id: string;
  name: string;
  kind: string;            // lead | web | sandbox | report | node | …
  task: string;
  status: Status;
  tokens: number;
  ctxUsed: number;         // 0..1 of context window
  depth: number;           // 0 = lead, 1+ = sub-agent
}

interface FeedEvent {
  ts: number;
  agent: string;
  kind: EventKind;
  msg: string;
}

interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  body: string;            // text content, or a placeholder note for media
  threadId: string;
  bytes: number;
  ts: number;
  gwPath?: string;         // path on the gateway, when pulled from one
  gwUrl?: string;          // canonical absolute URL on the gateway
}

interface Run {
  id: string;
  threadId: string;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  agents: AgentRow[];
  events: FeedEvent[];
  artifacts: Artifact[];
  tokens: number;
  toolCalls: number;
  tokSeries: number[];
  live?: boolean;
  remoteRunId?: string | null;
  thread?: Thread;
  /* stream-time scratch — underscore = not rendered directly */
  _nodes?: Record<string, AgentRow>;
  _presented?: string[];
  _artsPulled?: boolean;
  _presPulled?: boolean;
  _lastN?: number;
  _acc?: number;
  _t0?: number;
  timer?: ReturnType<typeof setInterval>;
}

interface ModelInfo {
  name: string;
  display_name?: string;
  provider?: string;
  thinking?: boolean;
  ctx?: number;
}

interface SkillInfo {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  builtin: boolean;
}

interface MemoryView {
  profile: string[][];   /* [key, value] rows */
  projects: string[][];  /* [key, value] rows */
  stats: { entries?: number; lastReload?: number | null; store?: string };
}

interface AppState {
  mode: FeedMode;
  gatewayUrl: string;
  liveOk: boolean;
  view: ViewName;
  threads: Thread[];
  runs: Record<string, Run>;
  activeThreadId: string | null;
  watchRunId: string | null;   // what Telemetry is pointed at
  feedFilter: string;          // 'all' | EventKind | agent name
  feedQuery: string;
  selArtifact: string | null;
  artQuery: string;
  artView: 'preview' | 'source';
  threadQuery: string;
  installingSkill: string | null; // filename while a .skill archive is being scanned
  pendingFiles: File[];
  totalTokens: number;
  models: ModelInfo[];
  skills: SkillInfo[];
  memory: MemoryView | null;
  mcp: unknown;                // gateway MCP config JSON, edited as text
  composerModel: string | null;
  composerSkills: Set<string>;
  timers: Set<ReturnType<typeof setInterval>>;
}

/* ---------- state ---------- */
const S: AppState = {
  mode: 'mock',
  gatewayUrl: 'http://localhost:2026',
  liveOk: false,
  view: 'ops',
  threads: [],
  runs: {},
  activeThreadId: null,
  watchRunId: null,
  feedFilter: 'all',
  feedQuery: '',
  selArtifact: null,
  artQuery: '',
  artView: 'preview',
  threadQuery: '',
  installingSkill: null,
  pendingFiles: [],
  totalTokens: 0,
  models: [], skills: [], memory: null, mcp: null,
  composerModel: null, composerSkills: new Set(['deep-research']),
  timers: new Set(),
};

export { S };
export type { AppState, Thread, Message, Upload, Run, AgentRow, FeedEvent, Artifact, ArtifactType, ModelInfo, SkillInfo, MemoryView, Status, EventKind };
