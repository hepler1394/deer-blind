# start-blind.ps1 - one click: Ollama + DeerFlow gateway + the console, live.
$ErrorActionPreference = 'SilentlyContinue'
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$deerflow = 'D:\Dev\GitHub\deer-flow'
$uv       = 'C:\Users\Cory\.local\bin\uv.exe'
if (-not (Test-Path $uv)) { $uv = 'uv' }

function Test-Port([int]$p){
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $p); $true } catch { $false } finally { $c.Close() }
}
function Wait-Port([int]$p, [int]$seconds, [string]$label){
  for ($i = 0; $i -lt $seconds; $i++){
    if (Test-Port $p) { Write-Host "  $label is up." -ForegroundColor Green; return $true }
    Start-Sleep 1
  }
  Write-Host "  $label did not come up in $seconds s - check its window." -ForegroundColor Yellow
  $false
}

Write-Host ''
Write-Host '  DEER BLIND - starting the stack' -ForegroundColor DarkYellow
Write-Host ''

# 1. Ollama - the models
if (Test-Port 11434) { Write-Host '  Ollama is already up.' -ForegroundColor Green }
else {
  Write-Host '  Starting Ollama...'
  Start-Process ollama -ArgumentList 'serve' -WindowStyle Minimized
  [void](Wait-Port 11434 20 'Ollama')
}

# 2. The DeerFlow gateway
if (Test-Port 8001) { Write-Host '  Gateway is already up.' -ForegroundColor Green }
else {
  Write-Host '  Starting the DeerFlow gateway (its log stays in its own window)...'
  $cmd = "cd '$deerflow\backend'; " +
         "`$env:DEER_FLOW_AUTH_DISABLED='1'; " +
         "`$env:GATEWAY_CORS_ORIGINS='http://localhost:4173'; " +
         "`$env:PYTHONPATH='.'; " +
         "& '$uv' run uvicorn app.gateway.app:app --host 127.0.0.1 --port 8001"
  Start-Process powershell -ArgumentList '-NoProfile','-NoExit','-Command', $cmd
  [void](Wait-Port 8001 90 'Gateway')
}

# 3. The console itself
if (Test-Port 4173) { Write-Host '  Console server is already up.' -ForegroundColor Green }
else {
  Write-Host '  Serving the console on http://localhost:4173 ...'
  $py = (Get-Command py -ErrorAction SilentlyContinue).Source
  if ($py) { Start-Process py -ArgumentList '-m','http.server','4173' -WorkingDirectory $root -WindowStyle Minimized }
  else     { Start-Process python -ArgumentList '-m','http.server','4173' -WorkingDirectory $root -WindowStyle Minimized }
  [void](Wait-Port 4173 15 'Console server')
}

# 4. Open it, live
Start-Process 'http://localhost:4173/deer-blind.html#gw=http://localhost:8001&mode=live'
Write-Host ''
Write-Host '  The blind is open. Good hunting.' -ForegroundColor DarkYellow
Start-Sleep 3
