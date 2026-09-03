param(
  [string]$Bind = "127.0.0.1",
  [int]$Port = 37891,
  [string]$HostToken = "local-dev-host-token",
  [string]$ClientToken = "local-dev-client-token"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root ".runtime"
$PidFile = Join-Path $Runtime "relay.pid"
$Entry = Join-Path $Root "dist\relay\index.js"
$isLoopback = $Bind -in @("127.0.0.1", "localhost", "::1")
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port must be between 1 and 65535" }
if (-not $isLoopback -and ($HostToken -eq "local-dev-host-token" -or $ClientToken -eq "local-dev-client-token" -or $HostToken.Length -lt 16 -or $ClientToken.Length -lt 16)) {
  throw "Use explicit high-entropy tokens (at least 16 characters) when binding relay outside loopback"
}

New-Item -ItemType Directory -Path $Runtime -Force | Out-Null

if (Test-Path $PidFile) {
  $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
  if ($OldPid) { Stop-Process -Id ([int]$OldPid) -Force -ErrorAction SilentlyContinue }
}

if (-not (Test-Path $Entry)) {
  Push-Location $Root
  try { & npm run build; if ($LASTEXITCODE -ne 0) { throw "npm run build failed" } }
  finally { Pop-Location }
}

$env:PI_COLLAB_HOST = $Bind
$env:PI_COLLAB_PORT = "$Port"
$env:PI_COLLAB_HOST_TOKEN = $HostToken
$env:PI_COLLAB_CLIENT_TOKEN = $ClientToken

Remove-Item (Join-Path $Runtime "relay.out.log"), (Join-Path $Runtime "relay.err.log") -Force -ErrorAction SilentlyContinue
$Process = Start-Process -FilePath node -ArgumentList $Entry -WorkingDirectory $Root -WindowStyle Hidden -PassThru
Set-Content -Path $PidFile -Value $Process.Id

$HealthHost = if ($Bind -eq "0.0.0.0" -or $Bind -eq "::") { "127.0.0.1" } else { $Bind }
$HealthUrl = "http://${HealthHost}:$Port/healthz"
for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
  Start-Sleep -Milliseconds 100
  try {
    $Response = Invoke-WebRequest -UseBasicParsing $HealthUrl -TimeoutSec 2
    if ($Response.StatusCode -eq 200) {
      Write-Host "Pi Cafe Space relay started (PID $($Process.Id))"
      Write-Host "Web: http://${HealthHost}:$Port/"
      Write-Host "Room: main"
      Write-Host "Client token: $ClientToken"
      exit 0
    }
  } catch {}
}

$ErrorText = "No server error log available"
Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
throw "Relay failed to start: $ErrorText"
