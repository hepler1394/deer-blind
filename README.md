# Deer Blind

A field console for [DeerFlow 2.0](https://github.com/bytedance/deer-flow) — brief the lead agent, watch the herd work in live telemetry, read every artifact a run drops, and tune the station, all from one dark, quiet screen. Hand-built: no framework, no component library, hand-rolled SVG charts, real fonts inlined at build time.

## Just want to open it?

`deer-blind.html` is the whole console in one file — it is the committed build output. Double-click it for mock mode (a scripted demo world), or go live with one click:

```
start-deer-blind.cmd
```

That starts the whole stack: Ollama (if it isn't already running), the DeerFlow gateway in its own log window, and a local server for this folder on http://localhost:4173 — then it opens the console live. Mode, gateway URL, and model all live in the URL hash (`#gw=http://localhost:8001&mode=live`) — nothing is stored in the browser.

## The real project

The console is a Vite + TypeScript project; the single file above is its build output, kept committed so the double-click path never dies.

```
npm install
npm run dev      # dev server on http://localhost:5173, hot reload
npm run build    # builds dist/index.html and copies it to ./deer-blind.html
npm run check    # tsc --noEmit
```

### Map

```
index.html            markup shell — topbar, nav rail, views, composer
src/main.ts           boot + wiring
src/state.ts          the one store (S)
src/render.ts         every view renderer + dispatch
src/engine.ts         mock run scripting, run helpers, field-report export
src/adapter.ts        Live — the DeerFlow gateway client (SSE, attach, watchdog)
src/charts.ts         hand-rolled SVG charts, single hue, thin marks
src/mockdata.ts       demo catalog + artifact bodies
src/utils.ts          formatting, markdown, reasoning-stripper
src/hub.ts            late-bound render entry points + toasts (breaks import cycles)
src/styles/app.css    the whole design system
src/styles/fonts.css  @fontsource imports, inlined as base64 by the build
```

### Live mode

The adapter speaks the gateway's native surface, verified against the deer-flow backend source: `POST /api/threads`, `POST /api/threads/{id}/runs/stream` (SSE), cancel / reattach / events / workspace-changes, plus `/api/models`, `/api/skills`, `/api/memory`, and `/api/mcp/config`. Details that cost real debugging: the run id arrives in the SSE `metadata` event (the `Content-Location` header is invisible cross-origin), a busy thread reports status `running` (the docs say `busy`), and qwen-style `<think>` blocks are folded into a REASONING disclosure instead of leaking into the reply.

The launcher starts the gateway for you. To run it by hand (Windows, no Docker — local sandbox + Ollama):

```powershell
cd D:\Dev\GitHub\deer-flow\backend
$env:DEER_FLOW_AUTH_DISABLED='1'          # localhost dev only — never expose 8001
$env:GATEWAY_CORS_ORIGINS='http://localhost:4173'
$env:PYTHONPATH='.'
uv run uvicorn app.gateway.app:app --host 127.0.0.1 --port 8001
```

`DEER_FLOW_AUTH_DISABLED` switches the gateway's auth off, so keep it bound to 127.0.0.1, and leave `sandbox.allow_host_bash` off in `config.yaml` so agent runs cannot execute arbitrary shell on the host.
