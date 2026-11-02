# The bench kit on Windows, started by start-bench.cmd: installs what the Forgebook benchmark needs into the user's own
# folder, without administrator rights, then hands over to the kit's Node part (tools/bench/kit/kit.mts) for the
# questions, the run and the results file. Every step is skipped when already done, so launching it again resumes.
# The pinned downloads and the commit are in kit.pins beside this file. Text for the person is Italian.
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $KitArgs)

$ErrorActionPreference = 'Stop'
# Invoke-WebRequest's progress bar slows a download many times over in Windows PowerShell
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# A short title for the window: Node reading a long one (the whole command line Windows puts there) can fail an
# assertion in libuv and die, which made Playwright's install fail in a console window
$Host.UI.RawUI.WindowTitle = 'Benchmark di Forgebook'
$KitFolder = $PSScriptRoot
$KitHome = if ($env:FORGEBOOK_BENCH_HOME) { $env:FORGEBOOK_BENCH_HOME } else { Join-Path $env:LOCALAPPDATA 'ForgebookBench' }
$Gigabyte = 1GB

function Say([string] $Text) { Write-Host $Text }

function Step([string] $Text) { Write-Host ''; Write-Host "» $Text" -ForegroundColor Cyan }

function Wait-Close {
  if (-not $env:FORGEBOOK_BENCH_NO_PAUSE) { Write-Host ''; [void](Read-Host 'Premi Invio per chiudere') }
}

function Fail([string] $Text) {
  Write-Host ''
  Write-Host "Errore: $Text" -ForegroundColor Red
  Wait-Close
  exit 1
}

# Runs a program and stops the kit when it fails: Windows PowerShell does not stop on a native program's exit code.
function Invoke-Checked([string] $What, [string] $Program, [string[]] $Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { Fail "$What non è riuscito (codice $LASTEXITCODE)." }
}

function Read-Pins([string] $File) {
  $pins = @{}
  foreach ($line in Get-Content -LiteralPath $File) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $key, $value = $line -split '=', 2
    $pins[$key.Trim()] = $value.Trim()
  }
  return $pins
}

# Downloads a file once, and keeps it only when its SHA-256 is the one pinned.
function Get-Verified([string] $Url, [string] $Sha256, [string] $Destination) {
  if ((Test-Path -LiteralPath $Destination) -and ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -eq $Sha256)) {
    return
  }
  $partial = "$Destination.part"
  Say "Scarico $Url"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing
  } catch {
    Fail "non riesco a scaricare $Url. Controlla la connessione a Internet e rilancia."
  }
  $actual = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
  if ($actual -ne $Sha256) {
    Remove-Item -LiteralPath $partial -Force
    Fail "il file scaricato da $Url non è quello atteso (SHA-256 $actual). Non lo uso."
  }
  Move-Item -LiteralPath $partial -Destination $Destination -Force
}

# Unpacks a zip once: Windows' own tar is many times faster than Expand-Archive, which stays the fallback.
function Expand-Once([string] $Zip, [string] $Destination) {
  if (Test-Path -LiteralPath (Join-Path $Destination '.kit-unpacked')) { return }
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
  New-Item -ItemType Directory -Path $Destination | Out-Null
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (Test-Path -LiteralPath $tar) {
    Invoke-Checked 'Lo scompattamento' $tar @('-xf', $Zip, '-C', $Destination)
  } else {
    Expand-Archive -LiteralPath $Zip -DestinationPath $Destination -Force
  }
  New-Item -ItemType File -Path (Join-Path $Destination '.kit-unpacked') | Out-Null
}

# Whether the Visual C++ runtime is installed: native modules Storybook and Ladle load (oxc-resolver, Rollup's) need
# it, and a fresh Windows may not have it.
function Test-VcRuntime([string] $Platform) {
  $system = Join-Path $env:SystemRoot 'System32'
  $files = @('vcruntime140.dll', 'msvcp140.dll') + $(if ($Platform -eq 'win-x64') { @('vcruntime140_1.dll') } else { @() })
  return -not ($files | Where-Object { -not (Test-Path -LiteralPath (Join-Path $system $_)) })
}

# Installs the Visual C++ runtime from Microsoft, when it is missing. It is the one step that needs an administrator:
# Windows asks for permission, and a refusal leaves the kit going without Storybook and Ladle.
function Install-VcRuntime([string] $Platform, [hashtable] $Pins, [string] $Downloads) {
  if (Test-VcRuntime $Platform) { return }
  Step 'Runtime Microsoft Visual C++'
  Say 'Su questo PC manca il runtime Microsoft Visual C++, che serve a Storybook e a Ladle. Lo installo dal sito di Microsoft.'
  Say 'Windows chiederà il permesso di un amministratore: è l''unico passo che lo richiede.'
  $installer = Join-Path $Downloads "vc_redist-$Platform.exe"
  Get-Verified $Pins["vcredist.$Platform.url"] $Pins["vcredist.$Platform.sha256"] $installer
  $signature = Get-AuthenticodeSignature -LiteralPath $installer
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    Fail 'il programma di installazione del runtime non è firmato da Microsoft. Non lo uso.'
  }
  try {
    Start-Process -FilePath $installer -ArgumentList '/install', '/quiet', '/norestart' -Verb RunAs -Wait
  } catch {
    Say 'Permesso negato.'
  }
  if (-not (Test-VcRuntime $Platform)) {
    Say 'Attenzione: il runtime non è installato, quindi Storybook e Ladle non potranno essere misurati. Il resto della prova va avanti.'
  }
}

# Keeps the PC awake while the benchmark runs: the flag holds as long as this PowerShell's thread waits for Node.
function Stop-Sleep {
  try {
    Add-Type -Namespace ForgebookBench -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
    # ES_CONTINUOUS | ES_SYSTEM_REQUIRED: no sleep, the screen may turn off
    [void][ForgebookBench.Power]::SetThreadExecutionState([uint32]'0x80000001')
  } catch {
    Say 'Attenzione: non riesco a impedire lo standby. Se il PC va in standby durante la prova, rilancia il kit: riprende da dove era.'
  }
}

# Removes the kit's folder, asked for by the Node part: Node removes the deep folders, whose paths Remove-Item cannot
# always handle, then the rest goes, Node included.
function Remove-Kit([string] $Node) {
  Set-Location -LiteralPath $env:USERPROFILE
  foreach ($child in Get-ChildItem -LiteralPath $KitHome -Force) {
    if ($child.Name -eq 'tools') { continue }
    # single quotes inside: Windows PowerShell passes a native program an argument's double quotes stripped
    & $Node -e 'require(''fs'').rmSync(process.argv[1], { recursive: true, force: true })' $child.FullName
  }
  Remove-Item -LiteralPath $KitHome -Recurse -Force
  Say "Cartella $KitHome cancellata."
}

Write-Host 'Benchmark di Forgebook' -ForegroundColor Cyan
Say "Il kit installa quello che gli serve in $KitHome, senza diritti di amministratore, e alla fine scrive un file di risultati sul Desktop."

# What this PC is
$machine = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
try {
  $machine = [string][System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
} catch {
}
switch -Regex ($machine) {
  '^(X64|AMD64)$' { $platform = 'win-x64' }
  '^(Arm64|ARM64)$' { $platform = 'win-arm64' }
  default { Fail "questo PC ($machine) non è supportato: serve Windows a 64 bit." }
}
if ([Environment]::OSVersion.Version.Major -lt 10) { Fail 'serve Windows 10 o 11.' }

$pinsFile = Join-Path $KitFolder 'kit.pins'
if (-not (Test-Path -LiteralPath $pinsFile)) { Fail "manca kit.pins accanto a questo file: copia tutta la cartella del kit." }
$pins = Read-Pins $pinsFile

Step 'Controllo il PC'
New-Item -ItemType Directory -Path $KitHome -Force | Out-Null
$drive = New-Object System.IO.DriveInfo ([System.IO.Path]::GetPathRoot($KitHome))
$memory = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
Say ('Windows {0}, {1}, memoria {2:N1} GB, spazio libero {3:N1} GB.' -f [Environment]::OSVersion.Version, $platform, ($memory / $Gigabyte), ($drive.AvailableFreeSpace / $Gigabyte))
if ($drive.AvailableFreeSpace -lt 6 * $Gigabyte) { Fail 'servono almeno 6 GB liberi sul disco per installare il kit; la prova completa ne chiede circa 25.' }
if ($memory -lt 4 * $Gigabyte) { Fail 'servono almeno 4 GB di memoria.' }

$tools = Join-Path $KitHome 'tools'
$downloads = Join-Path $KitHome 'downloads'
New-Item -ItemType Directory -Path $tools, $downloads -Force | Out-Null

Step "Node $($pins['node.version'])"
$nodeZip = Join-Path $downloads "node-$($pins['node.version'])-$platform.zip"
Get-Verified $pins["node.$platform.url"] $pins["node.$platform.sha256"] $nodeZip
$nodeUnpacked = Join-Path $tools "node-$($pins['node.version'])"
Expand-Once $nodeZip $nodeUnpacked
$node = (Get-ChildItem -LiteralPath $nodeUnpacked -Directory | Select-Object -First 1).FullName

Install-VcRuntime $platform $pins $downloads

Step "Git (MinGit $($pins['mingit.version']))"
$gitZip = Join-Path $downloads "mingit-$($pins['mingit.version'])-$platform.zip"
Get-Verified $pins["mingit.$platform.url"] $pins["mingit.$platform.sha256"] $gitZip
$git = Join-Path $tools "mingit-$($pins['mingit.version'])"
Expand-Once $gitZip $git

# Everything the tools write stays in the kit's folder; Git asks for nothing and reads no configuration of the user's.
$bin = Join-Path $KitHome 'bin'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
# MinGit's shell tools go last: Fluent's preparation needs its sh, and Windows' own find and sort must win
$env:Path = "$node;$(Join-Path $git 'cmd');$bin;$env:Path;$(Join-Path $git 'usr\bin')"
$env:COREPACK_HOME = Join-Path $KitHome 'corepack'
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
$env:COREPACK_ENABLE_AUTO_PIN = '0'
$env:npm_config_cache = Join-Path $KitHome 'npm-cache'
$env:npm_config_store_dir = Join-Path $KitHome 'pnpm-store'
$env:npm_config_update_notifier = 'false'
$env:npm_config_fund = 'false'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $KitHome 'browsers'
$env:YARN_GLOBAL_FOLDER = Join-Path $KitHome 'yarn'
$gitConfig = Join-Path $KitHome 'gitconfig'
if (-not (Test-Path -LiteralPath $gitConfig)) { New-Item -ItemType File -Path $gitConfig | Out-Null }
$env:GIT_CONFIG_NOSYSTEM = '1'
$env:GIT_CONFIG_GLOBAL = $gitConfig
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'core.longpaths'
$env:GIT_CONFIG_VALUE_0 = 'true'

Step 'pnpm'
Invoke-Checked 'L''attivazione di pnpm' (Join-Path $node 'corepack.cmd') @('enable', '--install-directory', $bin, 'pnpm')

Step "Forgebook al commit $($pins['forgebook.commit'].Substring(0, 12))"
$repo = Join-Path $KitHome 'repo'
$commit = $pins['forgebook.commit']
if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) {
  Invoke-Checked 'git init' 'git' @('init', '--quiet', $repo)
  Invoke-Checked 'git remote' 'git' @('-C', $repo, 'remote', 'add', 'origin', $pins['forgebook.repository'])
}
$head = (& git -C $repo rev-parse --verify --quiet HEAD) | Out-String
if ($head.Trim() -ne $commit) {
  Invoke-Checked 'Lo scaricamento di Forgebook' 'git' @('-C', $repo, 'fetch', '--quiet', '--depth', '1', 'origin', $commit)
  Invoke-Checked 'git checkout' 'git' @('-C', $repo, 'checkout', '--quiet', '--force', $commit)
}
if ((& git -C $repo status --porcelain | Out-String).Trim() -ne '') {
  Invoke-Checked 'git reset' 'git' @('-C', $repo, 'reset', '--quiet', '--hard', $commit)
}

Set-Location -LiteralPath $repo
$installed = Join-Path $repo 'node_modules\.kit-installed'
if (-not ((Test-Path -LiteralPath $installed) -and ((Get-Content -LiteralPath $installed -Raw).Trim() -eq $commit))) {
  Step 'Dipendenze di Forgebook (qualche minuto)'
  Invoke-Checked 'pnpm install' 'pnpm' @('install', '--frozen-lockfile')
  Set-Content -LiteralPath $installed -Value $commit
}

$chromium = Join-Path $env:PLAYWRIGHT_BROWSERS_PATH '.kit-chromium'
if (-not ((Test-Path -LiteralPath $chromium) -and ((Get-Content -LiteralPath $chromium -Raw).Trim() -eq $commit))) {
  Step 'Chromium per le misure'
  Invoke-Checked 'L''installazione di Chromium' 'pnpm' @('--filter', '@forgebook/tools', 'exec', 'playwright', 'install', 'chromium')
  Set-Content -LiteralPath $chromium -Value $commit
}

Stop-Sleep
$desktop = if ($env:FORGEBOOK_BENCH_DESKTOP) { $env:FORGEBOOK_BENCH_DESKTOP } else { [Environment]::GetFolderPath('Desktop') }
$nodeExe = Join-Path $node 'node.exe'
& $nodeExe (Join-Path $repo 'tools\bench\kit\kit.mts') --home $KitHome --desktop $desktop @KitArgs
$status = $LASTEXITCODE
if (Test-Path -LiteralPath (Join-Path $KitHome 'clean-requested')) { Remove-Kit $nodeExe }
Wait-Close
exit $status
