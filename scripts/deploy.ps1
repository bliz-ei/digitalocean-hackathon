param(
  [string]$VapidSubject = $env:VAPID_SUBJECT,
  [string]$SttApiKey = $env:VERITY_STT_API_KEY,
  [string]$GradientAgentEndpoint = $env:VERITY_GRADIENT_AGENT_ENDPOINT,
  [string]$GradientAgentKey = $env:VERITY_GRADIENT_AGENT_KEY,
  [string]$GradientModelKey = $env:VERITY_GRADIENT_MODEL_KEY,
  [string]$FastModel = $env:VERITY_FAST_MODEL,
  [string]$ReasoningModel = $env:VERITY_REASONING_MODEL,
  [string]$AppId = $env:VERITY_APP_ID,
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
$FastApiKey = if ($env:VERITY_FAST_API_KEY) { $env:VERITY_FAST_API_KEY } else { $GradientModelKey }
$ReasoningApiKey = if ($env:VERITY_REASONING_API_KEY) { $env:VERITY_REASONING_API_KEY } else { $GradientModelKey }
if (-not $FastApiKey -or -not $ReasoningApiKey) {
  throw "Set VERITY_GRADIENT_MODEL_KEY to one Gradient model access key (reused for the classifier and reasoner), or set VERITY_FAST_API_KEY and VERITY_REASONING_API_KEY individually."
}
if (-not $FastModel -or -not $ReasoningModel) {
  throw "Set VERITY_FAST_MODEL and VERITY_REASONING_MODEL to Gradient serverless model slugs (see the Gradient console model list)."
}
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
$env:VERITY_FAST_API_KEY = $FastApiKey
$env:VERITY_FAST_MODEL = $FastModel
if (-not $env:VERITY_FAST_BASE_URL) { $env:VERITY_FAST_BASE_URL = "https://inference.do-ai.run" }
$env:VERITY_REASONING_API_KEY = $ReasoningApiKey
$env:VERITY_REASONING_MODEL = $ReasoningModel
if (-not $env:VERITY_REASONING_BASE_URL) { $env:VERITY_REASONING_BASE_URL = "https://inference.do-ai.run" }
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

$env:VERITY_HEALTH_URL = $url
$env:VITE_API_URL = $url
npm run build -w @verity/extension
npm run preflight:release
Write-Host "Verity deployed and verified at $url"
Write-Host "App ID: $id (set VERITY_APP_ID to this value for future updates)"
