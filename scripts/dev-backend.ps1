$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param(
    [Parameter(Mandatory=$true)][string]$Text
  )

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hashBytes = $sha.ComputeHash($bytes)
    return ($hashBytes | ForEach-Object { $_.ToString('x2') }) -join ''
  } finally {
    $sha.Dispose()
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$venvPath = Join-Path $backendRoot '.venv'
$pythonExe = Join-Path $venvPath 'Scripts/python.exe'

Set-Location $backendRoot

if (!(Test-Path $venvPath)) {
  Write-Host "[backend] Creating venv (Python 3.11)" -ForegroundColor Cyan
  py -3.11 -m venv .venv
}

$requirementsPath = Join-Path $backendRoot 'requirements.txt'
$setupPyPath = Join-Path $backendRoot 'setup.py'
$setupCfgPath = Join-Path $backendRoot 'setup.cfg'

if (!(Test-Path $pythonExe)) {
  throw "Python executable not found at: $pythonExe"
}

# Only upgrade pip if it's not already at the expected version.
$pipVersionLine = & $pythonExe -m pip --version
if ($pipVersionLine -notmatch '^pip 25\.3(\.|\b)') {
  Write-Host "[backend] Upgrading pip" -ForegroundColor Cyan
  & $pythonExe -m pip install --upgrade pip
}

# Install base deps only when requirements (excluding '-e .') change.
$requirementsRaw = Get-Content -Raw -Path $requirementsPath
$requirementsLines = $requirementsRaw -split "`r?`n" |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -ne '' } |
  Where-Object { $_ -notmatch '^#' }

$baseRequirementsLines = $requirementsLines |
  Where-Object { $_ -notmatch '^-e\s+\.?\/?$' }

$baseRequirementsNormalized = ($baseRequirementsLines -join "`n") + "`n"
$depsHash = Get-Sha256Hex -Text $baseRequirementsNormalized
$depsStatePath = Join-Path $venvPath '.deps.sha256'

$shouldInstallBaseDeps = $true
if (Test-Path $depsStatePath) {
  $existingDepsHash = (Get-Content -Raw -Path $depsStatePath).Trim()
  if ($existingDepsHash -eq $depsHash) {
    $shouldInstallBaseDeps = $false
  }
}

if ($shouldInstallBaseDeps) {
  Write-Host "[backend] Installing/updating deps" -ForegroundColor Cyan
  $tmpReq = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $tmpReq -Value $baseRequirementsNormalized -Encoding UTF8 -NoNewline
    & $pythonExe -m pip install -r $tmpReq
    Set-Content -Path $depsStatePath -Value $depsHash -Encoding ASCII -NoNewline
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmpReq
  }
} else {
  Write-Host "[backend] Deps unchanged; skipping pip install" -ForegroundColor DarkGray
}

# Install editable package only when missing or when packaging metadata changes.
$editableMetaInput = ''
if (Test-Path $setupPyPath) { $editableMetaInput += (Get-Content -Raw -Path $setupPyPath) + "`n" }
if (Test-Path $setupCfgPath) { $editableMetaInput += (Get-Content -Raw -Path $setupCfgPath) + "`n" }
$editableMetaHash = Get-Sha256Hex -Text $editableMetaInput
$editableMetaStatePath = Join-Path $venvPath '.editable-meta.sha256'

$editableInstalled = $true
try {
  & $pythonExe -c "import django_classified" | Out-Null
} catch {
  $editableInstalled = $false
}

$editableMetaChanged = $true
if (Test-Path $editableMetaStatePath) {
  $existingEditableMetaHash = (Get-Content -Raw -Path $editableMetaStatePath).Trim()
  if ($existingEditableMetaHash -eq $editableMetaHash) {
    $editableMetaChanged = $false
  }
}

if (-not $editableInstalled -or $editableMetaChanged) {
  Write-Host "[backend] Installing editable package (-e .)" -ForegroundColor Cyan
  & $pythonExe -m pip install -e .
  Set-Content -Path $editableMetaStatePath -Value $editableMetaHash -Encoding ASCII -NoNewline
} else {
  Write-Host "[backend] Editable package unchanged; skipping -e install" -ForegroundColor DarkGray
}

if (!(Test-Path (Join-Path $backendRoot '.env'))) {
  Copy-Item (Join-Path $backendRoot '.env.example') (Join-Path $backendRoot '.env')
}

Write-Host "[backend] Migrating DB" -ForegroundColor Cyan
& $pythonExe manage.py migrate

Write-Host "[backend] Starting server on http://127.0.0.1:8000" -ForegroundColor Cyan
& $pythonExe manage.py runserver 127.0.0.1:8000
