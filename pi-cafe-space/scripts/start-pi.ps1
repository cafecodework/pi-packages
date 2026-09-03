param(
  [string]$RelayUrl = "ws://127.0.0.1:37891/ws",
  [string]$Room = "main",
  [string]$HostToken = "local-dev-host-token",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PiArgs
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Extension = Join-Path $Root "packages\pi-extension\dist\index.js"

if (-not (Test-Path $Extension)) {
  Push-Location $Root
  try { & pnpm build; if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" } }
  finally { Pop-Location }
}

$env:PI_COLLAB_ENABLED = "1"
$env:PI_COLLAB_RELAY_URL = $RelayUrl
$env:PI_COLLAB_ROOM = $Room
$env:PI_COLLAB_HOST_TOKEN = $HostToken

& pi --collab @PiArgs
exit $LASTEXITCODE
