# start-blind.ps1 - one click: Ollama + DeerFlow gateway + the console, live.
# Everything runs hidden in the background; the gateway logs to deer-flow-gateway.log.
# stop-deer-blind.cmd shuts it all down again (Ollama is left alone).
param([switch]$NoOpen)
$ErrorActionPreference = 'SilentlyContinue'
Remove-Item Env:VIRTUAL_ENV -ErrorAction SilentlyContinue   # scrub inherited venvs (silences a uv warning)
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$deerflow = Join-Path (Split-Path -Parent $root) 'deer-flow'   # sibling folder under D:\Dev\GitHub\Deer
$uv       = 'C:\Users\Cory\.local\bin\uv.exe'
if (-not (Test-Path $uv)) { $uv = 'uv' }

# OpenRouter key. deer-flow's config.yaml lists two OpenRouter models whose
# api_key is $OPENROUTER_API_KEY - without SOME value the gateway refuses to
# boot. Resolution order: already-set env var, deer-flow\.env, openrouter.key
# next to this script. The key never leaves this machine.
$orKey = $env:OPENROUTER_API_KEY
if (-not $orKey) {
  $envFile = Join-Path $deerflow '.env'
  if (Test-Path $envFile) {
    $line = Select-String -Path $envFile -Pattern '^\s*OPENROUTER_API_KEY\s*=' | Select-Object -First 1
    if ($line) { $orKey = ($line.Line -split '=', 2)[1].Trim().Trim('"') }
  }
}
if (-not $orKey) {
  $orFile = Join-Path $root 'openrouter.key'
  if (Test-Path $orFile) { $orKey = (Get-Content $orFile -Raw).Trim() }
}
if ($orKey) { Write-Host "  OpenRouter key: loaded ($($orKey.Length) chars)." -ForegroundColor Green }
else { $orKey = 'not-set'; Write-Host '  No OpenRouter key found - local models only.' -ForegroundColor Yellow }
$env:OPENROUTER_API_KEY = $orKey

function Test-Port([int]$p){
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $p); $true } catch { $false } finally { $c.Close() }
}
function Wait-Port([int]$p, [int]$seconds, [string]$label){
  for ($i = 0; $i -lt $seconds; $i++){
    if (Test-Port $p) { Write-Host "  $label is up." -ForegroundColor Green; return $true }
    Start-Sleep 1
  }
  Write-Host "  $label did not come up in $seconds s - see deer-flow-gateway.log." -ForegroundColor Yellow
  $false
}

Write-Host ''
Write-Host '  DEER BLIND - starting the stack (background)' -ForegroundColor DarkYellow
Write-Host ''

# 1. Ollama - the models
if (Test-Port 11434) { Write-Host '  Ollama is already up.' -ForegroundColor Green }
else {
  Write-Host '  Starting Ollama...'
  Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden
  [void](Wait-Port 11434 20 'Ollama')
}

# 2. The DeerFlow gateway (inherits the env set above)
if (Test-Port 8001) { Write-Host '  Gateway is already up.' -ForegroundColor Green }
else {
  Write-Host '  Starting the DeerFlow gateway (log: deer-flow-gateway.log)...'
  $glog = Join-Path $root 'deer-flow-gateway.log'
  $cmd = "cd '$deerflow\backend'; " +
         "`$env:DEER_FLOW_AUTH_DISABLED='1'; " +
         "`$env:GATEWAY_CORS_ORIGINS='http://localhost:4173'; " +
         "`$env:PYTHONPATH='.'; " +
         "& '$uv' run uvicorn app.gateway.app:app --host 127.0.0.1 --port 8001 *>> '$glog'"
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-Command', $cmd
  [void](Wait-Port 8001 90 'Gateway')
}

# 3. The console itself
if (Test-Port 4173) { Write-Host '  Console server is already up.' -ForegroundColor Green }
else {
  Write-Host '  Serving the console on http://localhost:4173 ...'
  $py = (Get-Command py -ErrorAction SilentlyContinue).Source
  if ($py) { Start-Process py -ArgumentList '-m','http.server','4173' -WorkingDirectory $root -WindowStyle Hidden }
  else     { Start-Process python -ArgumentList '-m','http.server','4173' -WorkingDirectory $root -WindowStyle Hidden }
  [void](Wait-Port 4173 15 'Console server')
}

# 4. Open it, live
if (-not $NoOpen) { Start-Process 'http://localhost:4173/deer-blind.html#gw=http://localhost:8001&mode=live' }
Write-Host ''
Write-Host '  The blind is open. Good hunting. (stop-deer-blind.cmd closes camp)' -ForegroundColor DarkYellow
Start-Sleep 3
