$Root = Split-Path -Parent $PSScriptRoot
$PidFiles = @(
  (Join-Path $Root ".runtime\relay.pid"),
  (Join-Path $Root ".relay.pid")
)
$Stopped = $false
foreach ($PidFile in $PidFiles) {
  if (-not (Test-Path $PidFile)) { continue }
  $RelayPid = Get-Content $PidFile -ErrorAction SilentlyContinue
  if ($RelayPid) {
    Stop-Process -Id ([int]$RelayPid) -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped Pi Cafe Space relay PID $RelayPid"
    $Stopped = $true
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
if (-not $Stopped) { Write-Host "No Pi Cafe Space relay PID file was found" }
