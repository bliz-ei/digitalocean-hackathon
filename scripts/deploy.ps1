param(
  [string]$VapidSubject = $env:VAPID_SUBJECT,
  [string]$SttApiKey = $env:VERITY_STT_API_KEY,
  [string]$GradientAgentEndpoint = $env:VERITY_GRADIENT_AGENT_ENDPOINT,
  [string]$GradientAgentKey = $env:VERITY_GRADIENT_AGENT_KEY,
  [string]$AppId = $env:VERITY_APP_ID,
  [string]$AccessToken = $env:DIGITALOCEAN_ACCESS_TOKEN
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command doctl -ErrorAction SilentlyContinue)) {
  throw "doctl is required. Install it, then rerun this command."
}
if (-not $AccessToken) { throw "Set DIGITALOCEAN_ACCESS_TOKEN before deploying." }
if (-not $SttApiKey) { throw "Set VERITY_STT_API_KEY to a Deepgram API key before deploying." }
if (-not $GradientAgentEndpoint -or $GradientAgentEndpoint -notmatch '^https://') {
  throw "Set VERITY_GRADIENT_AGENT_ENDPOINT to the HTTPS inference endpoint for the Gradient agent."
}
if (-not $GradientAgentKey) { throw "Set VERITY_GRADIENT_AGENT_KEY to the Gradient agent access key." }
if (-not $VapidSubject -or $VapidSubject -notmatch '^(mailto:|https://)') {
  throw "Pass -VapidSubject mailto:you@example.com (or set VAPID_SUBJECT)."
}

npm ci

$stateDir = Join-Path $root ".verity"
$secretsPath = Join-Path $stateDir "deploy-secrets.json"
New-Item -ItemType Directory -Force $stateDir | Out-Null
if (Test-Path $secretsPath) {
  $saved = Get-Content $secretsPath -Raw | ConvertFrom-Json
} else {
  $vapid = (npx --no-install web-push generate-vapid-keys --json | ConvertFrom-Json)
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $saved = [pscustomobject]@{
    pairingSecret = ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
    vapidPublicKey = $vapid.publicKey
    vapidPrivateKey = $vapid.privateKey
  }
  [IO.File]::WriteAllText($secretsPath, ($saved | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
}

$env:VERITY_PAIRING_SECRET = $saved.pairingSecret
$env:VAPID_PUBLIC_KEY = $saved.vapidPublicKey
$env:VAPID_PRIVATE_KEY = $saved.vapidPrivateKey
$env:VAPID_SUBJECT = $VapidSubject
$env:VERITY_STT_API_KEY = $SttApiKey
$env:VERITY_GRADIENT_AGENT_ENDPOINT = $GradientAgentEndpoint
$env:VERITY_GRADIENT_AGENT_KEY = $GradientAgentKey
node scripts/run-python.mjs scripts/prepare_deploy.py

$spec = Join-Path $stateDir "app.yaml"
$doctl = @("--access-token", $AccessToken, "apps")
& doctl @doctl spec validate $spec | Out-Null
if ($AppId) {
  & doctl @doctl update $AppId --spec $spec --update-sources --wait | Out-Null
  $id = $AppId
} else {
  $id = (& doctl @doctl create --spec $spec --wait --format ID --no-header).Trim()
}
if (-not $id) { throw "DigitalOcean did not return an app ID." }
$url = (& doctl --access-token $AccessToken apps get $id --format DefaultIngress --no-header).Trim()
if (-not $url.StartsWith("http")) { $url = "https://$url" }

$env:VERITY_HEALTH_URL = $url
$env:VITE_API_URL = $url
npm run build -w @verity/extension
npm run preflight:release
Write-Host "Verity deployed and verified at $url"
Write-Host "App ID: $id (set VERITY_APP_ID to this value for future updates)"
