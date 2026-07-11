param(
  [string]$VapidSubject = $env:VAPID_SUBJECT,
  [string]$SttApiKey = $env:VERITY_STT_API_KEY,
  [string]$GradientAgentEndpoint = $env:VERITY_GRADIENT_AGENT_ENDPOINT,
  [string]$GradientAgentKey = $env:VERITY_GRADIENT_AGENT_KEY,
  [string]$AppId = $env:VERITY_APP_ID,
  [string]$WebAppId = $env:VERITY_WEB_APP_ID,
  [string]$AccessToken = $env:DIGITALOCEAN_ACCESS_TOKEN
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$doctlCommand = (Get-Command doctl -ErrorAction SilentlyContinue).Source
if (-not $doctlCommand) {
  $wingetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  $doctlCommand = Get-ChildItem $wingetRoot -Filter doctl.exe -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $doctlCommand) {
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
$env:VERITY_ALLOWED_ORIGINS = '${APP_URL}'
node scripts/run-python.mjs scripts/prepare_deploy.py
node scripts/run-python.mjs scripts/smoke_gradient.py

$spec = Join-Path $stateDir "app.yaml"
$doctlArgs = @("--access-token", $AccessToken, "apps")
& $doctlCommand @doctlArgs spec validate $spec | Out-Null
if ($AppId) {
  & $doctlCommand @doctlArgs update $AppId --spec $spec --update-sources --wait | Out-Null
  $id = $AppId
} else {
  $id = (& $doctlCommand @doctlArgs create --spec $spec --wait --format ID --no-header).Trim()
}
if (-not $id) { throw "DigitalOcean did not return an app ID." }
$url = (& $doctlCommand --access-token $AccessToken apps get $id --format DefaultIngress --no-header).Trim()
if (-not $url.StartsWith("http")) { $url = "https://$url" }

$env:VERITY_APP_URL = $url
$env:VITE_API_URL = $url
$env:VITE_PWA_URL = $url
node scripts/run-python.mjs scripts/prepare_web_deploy.py
$webSpec = Join-Path $stateDir "web.yaml"
& $doctlCommand @doctlArgs spec validate $webSpec | Out-Null
if ($WebAppId) {
  & $doctlCommand @doctlArgs update $WebAppId --spec $webSpec --update-sources --wait | Out-Null
  $webId = $WebAppId
} else {
  $webId = (& $doctlCommand @doctlArgs create --spec $webSpec --wait --format ID --no-header).Trim()
}
if (-not $webId) { throw "DigitalOcean did not return a marketing app ID." }
$webUrl = (& $doctlCommand --access-token $AccessToken apps get $webId --format DefaultIngress --no-header).Trim()
if (-not $webUrl.StartsWith("http")) { $webUrl = "https://$webUrl" }

# The PWA shares the API origin, but allow the separate marketing origin as well
# so future marketing-side API calls cannot silently fail CORS.
$env:VERITY_ALLOWED_ORIGINS = "$url,$webUrl"
node scripts/run-python.mjs scripts/prepare_deploy.py
& $doctlCommand @doctlArgs spec validate $spec | Out-Null
& $doctlCommand @doctlArgs update $id --spec $spec --update-sources --wait | Out-Null

$env:VERITY_HEALTH_URL = $url
npm run build -w @verity/extension
npm run build -w @verity/pwa
npm run build -w @verity/web
$env:VERITY_WEB_URL = $webUrl
npm run preflight:release
Write-Host "Verity deployed and verified at $url"
Write-Host "App ID: $id (set VERITY_APP_ID to this value for future updates)"
Write-Host "Marketing site deployed and verified at $webUrl"
Write-Host "Web app ID: $webId (set VERITY_WEB_APP_ID to this value for future updates)"
