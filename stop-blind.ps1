# stop-blind.ps1 - close camp: stop the gateway and the console server.
# Ollama is left alone (other things on this machine use it).
$ErrorActionPreference = 'SilentlyContinue'
Write-Host ''
Write-Host '  DEER BLIND - closing camp' -ForegroundColor DarkYellow
foreach ($port in 8001, 4173){
  $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  if (-not $owners) { Write-Host "  nothing on port $port."; continue }
  foreach ($procId in $owners){
    $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Write-Host "  stopped $name (pid $procId) on port $port." -ForegroundColor Green
  }
}
Write-Host '  Camp is closed.' -ForegroundColor DarkYellow
Start-Sleep 2
