# Deer Blind

A single-file field console for [DeerFlow 2.0](https://github.com/bytedance/deer-flow) — chat/dispatch,
live agent telemetry, artifact tray, and gateway admin. Named for the hut you watch deer from:
you sit in the blind, the herd does the work.

Built by Claude for Cory, July 2026. Dark pine + blaze orange, IBM Plex + Chakra Petch,
hand-rolled charts, zero runtime dependencies. Works offline on a built-in mock feed;
flips to Live against a real gateway (verified against the deer-flow backend source and
a live gateway boot — native `/api/threads` SSE, run cancel, token usage, workspace pickup).

## Local layout (Cory's machine)

- `D:\Dev\GitHub\deer-blind` — this repo + built `deer-blind.html`
- `D:\Dev\GitHub\deer-flow` — DeerFlow 2.0, configured for local Ollama (qwen3:30b-a3b / qwen3:8b),
  LocalSandboxProvider (no Docker/WSL needed — virtualization is off in BIOS)

## Build the console

```powershell
npm install @fontsource/chakra-petch @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
node -e "const fs=require('fs');fs.writeFileSync('deer-blind.src.html',['src.part1.txt','src.part2.txt','src.part3.txt'].map(p=>fs.readFileSync(p,'utf8')).join(''))"
node build-blind.mjs
```

## Run

Start the gateway:

```powershell
cd D:\Dev\GitHub\deer-flow\backend
$env:DEER_FLOW_AUTH_DISABLED='1'          # local dev only — never expose port 8001
$env:GATEWAY_CORS_ORIGINS='http://localhost:4173'
$env:PYTHONPATH='.'
uv run uvicorn app.gateway.app:app --host 127.0.0.1 --port 8001
```

Then double-click `start-deer-blind.cmd` — it serves the console on :4173 and opens it
already pointed at the gateway (`#gw=http://localhost:8001&mode=live`).

Health check: `curl http://127.0.0.1:8001/api/models` — should list the two qwen3 models.

## Notes

- Agent host bash stays disabled (`sandbox.allow_host_bash` off) so runs can't execute
  arbitrary shell on this PC.
- The 30B model takes a beat on first token; switch the composer to Qwen3 8B for quick tests.
- Console keyboard: `1-4` switch views · `/` focuses the composer · `Enter` dispatches.
