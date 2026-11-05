# The bench kit on Windows, started by start-bench.cmd: installs what the Forgebook benchmark needs into the user's own
# folder, without administrator rights, then hands over to the kit's Node part (tools/bench/kit/kit.mts) for the
# questions, the run and the results file. Every step is skipped when already done, so launching it again resumes.
# The pinned downloads and the commit are in kit.pins beside this file. Text for the person is Italian.
#
# Nothing here waits without a limit or without a word: each program runs with its output in a log of the kit's
# folder, a line every minute on the console, and is stopped with its whole tree when it stays silent or runs too long.
# The console's QuickEdit mode is off while the kit runs: a click in the window would otherwise select text and
# suspend every program writing to it, without a sign, until a key is pressed. When a step fails, what there is goes in
# a results file on the Desktop.
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
$LogFolder = Join-Path $KitHome 'logs'
$LauncherLog = Join-Path $LogFolder 'launcher.log'
$Gigabyte = 1GB
$script:ConsoleMode = -1
$script:StepNumber = 0
$script:Node = $null
$script:Repo = $null

New-Item -ItemType Directory -Path $LogFolder -Force | Out-Null

# Every line the person sees goes to the launcher's log first, with the time: the console is no record.
function Write-Log([string] $Text) {
  try { Add-Content -LiteralPath $LauncherLog -Value ('{0:yyyy-MM-ddTHH:mm:ss} {1}' -f (Get-Date), $Text) -Encoding UTF8 } catch { }
}

function Say([string] $Text) { Write-Log $Text; Write-Host $Text }

function Step([string] $Text) { Write-Log "» $Text"; Write-Host ''; Write-Host "» $Text" -ForegroundColor Cyan }

function Warn([string] $Text) { Write-Log "Attenzione: $Text"; Write-Host "Attenzione: $Text" -ForegroundColor Yellow }

# QuickEdit and Insert off for this console, and back as they were at the end. The mode belongs to the console's input
# buffer, shared by every program in the window, Node included; CONIN$ reaches it whatever stdin is.
Add-Type -Namespace ForgebookBench -Name Console -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
[DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr handle, out uint mode);
[DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr handle, uint mode);
[DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
const uint InsertMode = 0x20, QuickEditMode = 0x40, ExtendedFlags = 0x80;
static IntPtr Input() { return CreateFileW("CONIN$", 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero); }
public static long DisableQuickEdit() {
  IntPtr handle = Input();
  if (handle == new IntPtr(-1)) return -1;
  try {
    uint mode;
    if (!GetConsoleMode(handle, out mode)) return -1;
    // ExtendedFlags must be set for QuickEdit and Insert to change at all
    if (!SetConsoleMode(handle, (mode | ExtendedFlags) & ~(QuickEditMode | InsertMode))) return -1;
    return mode;
  } finally { CloseHandle(handle); }
}
public static void Restore(long mode) {
  if (mode < 0) return;
  IntPtr handle = Input();
  if (handle == new IntPtr(-1)) return;
  try { SetConsoleMode(handle, (uint)mode | ExtendedFlags); } finally { CloseHandle(handle); }
}
'@

function Disable-QuickEdit {
  try { $script:ConsoleMode = [ForgebookBench.Console]::DisableQuickEdit() } catch { $script:ConsoleMode = -1 }
  if ($script:ConsoleMode -lt 0) { Warn 'non riesco a disattivare la modalità «Modifica rapida» della finestra: non cliccare dentro la finestra durante la prova, ferma tutto finché non premi un tasto.' }
}

function Restore-Console {
  if ($script:ConsoleMode -ge 0) {
    try { [ForgebookBench.Console]::Restore($script:ConsoleMode) } catch { }
    $script:ConsoleMode = -1
  }
}

function Wait-Close {
  Restore-Console
  if (-not $env:FORGEBOOK_BENCH_NO_PAUSE) { Write-Host ''; [void](Read-Host 'Premi Invio per chiudere') }
}

# The person's identity out of a text: the home folder as ~, the user's and the computer's names as placeholders, as
# the kit's Node part does (kitResults.ts) for the results file.
function Hide-Identity([string] $Text) {
  if ($null -eq $Text) { return '' }
  $result = $Text
  $profileFolder = $env:USERPROFILE
  if ($profileFolder) {
    # as written, with /, and with JSON's doubled \; the longest first, so a doubled one is not cut in half
    $spellings = @($profileFolder.Replace('\', '\\'), $profileFolder, $profileFolder.Replace('\', '/'))
    foreach ($spelling in $spellings) { $result = [regex]::Replace($result, [regex]::Escape($spelling), '~', 'IgnoreCase') }
  }
  foreach ($pair in @(@($env:USERNAME, '<user>'), @($env:COMPUTERNAME, '<computer>'))) {
    if ($pair[0] -and $pair[0].Length -ge 3) {
      $result = [regex]::Replace($result, '(?<![\w-])' + [regex]::Escape($pair[0]) + '(?![\w-])', $pair[1], 'IgnoreCase')
    }
  }
  return $result
}

function Get-Desktop {
  if ($env:FORGEBOOK_BENCH_DESKTOP) { return $env:FORGEBOOK_BENCH_DESKTOP }
  $folder = [Environment]::GetFolderPath('Desktop')
  if ($folder -and (Test-Path -LiteralPath $folder)) { return $folder }
  return $KitHome
}

# The results file of what there is: the kit's own, through Node, once Node and Forgebook are in place; the launcher's
# logs alone, cleaned of the person's identity, before that.
function Write-WhatThereIs {
  if ($script:Node -and $script:Repo -and (Test-Path -LiteralPath (Join-Path $script:Repo 'node_modules\.kit-installed'))) {
    & $script:Node (Join-Path $script:Repo 'tools\bench\kit\kit.mts') --home $KitHome --desktop (Get-Desktop) --results
    if ($LASTEXITCODE -eq 0) { return }
  }
  try {
    $stage = Join-Path ([IO.Path]::GetTempPath()) ('forgebook-bench-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach ($file in Get-ChildItem -LiteralPath $LogFolder -File) {
      $text = Hide-Identity ([IO.File]::ReadAllText($file.FullName))
      [IO.File]::WriteAllText((Join-Path $stage $file.Name), $text, (New-Object Text.UTF8Encoding $false))
    }
    $zip = Join-Path (Get-Desktop) ('forgebook-bench-registri-{0:yyyyMMdd-HHmm}.zip' -f (Get-Date))
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
    Remove-Item -LiteralPath $stage -Recurse -Force
    Say "Ho scritto i registri, senza nome utente né nome del computer, in $zip. Mandalo così com'è."
  } catch {
    Say "Non riesco a creare il file dei registri ($($_.Exception.Message)). I registri sono in $LogFolder."
  }
}

function Fail([string] $Text) {
  Write-Log "Errore: $Text"
  Write-Host ''
  Write-Host "Errore: $Text" -ForegroundColor Red
  Write-Host ''
  Say 'Creo il file dei risultati con quello che c''è, da mandare indietro.'
  Write-WhatThereIs
  Say "Rilanciando start-bench.cmd il kit riprende da dove si è fermato. I registri sono in $LogFolder."
  Wait-Close
  exit 1
}

# An argument as a Windows program's command line reads it back: quoted when it holds a space or a quote, with the
# backslashes before a quote doubled.
function ConvertTo-Argument([string] $Value) {
  if ($Value -ne '' -and $Value -notmatch '[\s"]') { return $Value }
  $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}

function Stop-Tree([int] $Id) {
  try { & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $Id /T /F 2>&1 | Out-Null } catch { }
}

function Get-Size([string] $File) {
  if (Test-Path -LiteralPath $File) { return (Get-Item -LiteralPath $File).Length }
  return 0
}

# Runs a program to its end, watched: its output in a log of its own, its stdin empty so a question reads its end
# instead of waiting, a line every minute, and the whole tree stopped when it stays silent or runs past its limit.
function Invoke-Watched([string] $What, [string] $Program, [string[]] $Arguments, [int] $SilentMinutes, [int] $MaxMinutes) {
  $script:StepNumber += 1
  $command = Get-Command $Program -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $command) { Fail "non trovo il programma $Program." }
  $stepLog = Join-Path $LogFolder ('launcher-{0:D2}.log' -f $script:StepNumber)
  $errorLog = "$stepLog.err"
  $emptyInput = Join-Path $LogFolder 'empty-input'
  [IO.File]::WriteAllText($emptyInput, '')
  Write-Log "$What`: $($command.Source) $($Arguments -join ' ') (registro $stepLog)"
  $line = ($Arguments | ForEach-Object { ConvertTo-Argument $_ }) -join ' '
  $process = Start-Process -FilePath $command.Source -ArgumentList $line -NoNewWindow -PassThru `
    -RedirectStandardOutput $stepLog -RedirectStandardError $errorLog -RedirectStandardInput $emptyInput
  # read once now: Windows PowerShell loses the exit code of a process whose handle was never taken
  $null = $process.Handle
  $started = Get-Date
  $lastSign = $started
  $lastBeat = $started
  $lastSize = -1
  while (-not $process.WaitForExit(5000)) {
    $now = Get-Date
    $size = (Get-Size $stepLog) + (Get-Size $errorLog)
    if ($size -ne $lastSize) { $lastSize = $size; $lastSign = $now }
    $silent = ($now - $lastSign).TotalMinutes
    $elapsed = ($now - $started).TotalMinutes
    if ($silent -ge $SilentMinutes -or $elapsed -ge $MaxMinutes) {
      Stop-Tree $process.Id
      $why = if ($silent -ge $SilentMinutes) { "nessun segnale da $([int]$silent) minuti" } else { "oltre il limite di $MaxMinutes minuti" }
      Fail "$What si è bloccato ($why) e l'ho fermato. Il suo registro è $stepLog."
    }
    if (($now - $lastBeat).TotalSeconds -ge 60) {
      $lastBeat = $now
      Say ('  {0}: ancora in corso da {1} min{2}' -f $What, [int]$elapsed, $(if ($silent -ge 2) { ", nessun segnale da $([int]$silent) min" } else { '' }))
    }
  }
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    foreach ($file in @($errorLog, $stepLog)) {
      if ((Get-Size $file) -gt 0) { Get-Content -LiteralPath $file -Tail 15 | ForEach-Object { Write-Host "  $_" } }
    }
    Fail "$What non è riuscito (codice $($process.ExitCode)). Il registro è $stepLog."
  }
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

# Downloads a file once, and keeps it only when its SHA-256 is the one pinned. A transfer that stalls fails: the
# connection gives up after its time, and the download is tried again on the next launch.
function Get-Verified([string] $Url, [string] $Sha256, [string] $Destination) {
  if ((Test-Path -LiteralPath $Destination) -and ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -eq $Sha256)) {
    return
  }
  $partial = "$Destination.part"
  Say "Scarico $Url (qualche minuto al massimo)"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing -TimeoutSec 600
  } catch {
    Fail "non riesco a scaricare $Url ($($_.Exception.Message)). Controlla la connessione a Internet e rilancia."
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
    Invoke-Watched 'Lo scompattamento' $tar @('-xf', $Zip, '-C', $Destination) 10 30
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

# How long the request for an administrator's permission is waited for, in minutes: nobody may be there to answer it.
$VcRuntimeWait = 10

# Installs the Visual C++ runtime from Microsoft, when it is missing. It is the one step that needs an administrator:
# Windows asks for permission, and a refusal, or no answer within the wait, leaves the kit going without Storybook and
# Ladle. The request runs in a helper PowerShell of its own, since asking for elevation blocks its caller until someone
# answers; the helper is stopped when the wait is over.
function Install-VcRuntime([string] $Platform, [hashtable] $Pins, [string] $Downloads) {
  if (Test-VcRuntime $Platform) { return }
  Step 'Runtime Microsoft Visual C++'
  Say 'Su questo PC manca il runtime Microsoft Visual C++, che serve a Storybook e a Ladle. Lo installo dal sito di Microsoft.'
  Say "Windows chiederà il permesso di un amministratore: è l'unico passo che lo richiede. Aspetto al massimo $VcRuntimeWait minuti."
  $installer = Join-Path $Downloads "vc_redist-$Platform.exe"
  Get-Verified $Pins["vcredist.$Platform.url"] $Pins["vcredist.$Platform.sha256"] $installer
  $signature = Get-AuthenticodeSignature -LiteralPath $installer
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    Fail 'il programma di installazione del runtime non è firmato da Microsoft. Non lo uso.'
  }
  $quoted = $installer -replace "'", "''"
  $script = "try { `$p = Start-Process -FilePath '$quoted' -ArgumentList '/install','/quiet','/norestart' -Verb RunAs -Wait -PassThru; exit `$p.ExitCode } catch { exit 1602 }"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  $helper = Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded" -WindowStyle Hidden -PassThru
  $null = $helper.Handle
  $started = Get-Date
  $lastBeat = $started
  while (-not $helper.WaitForExit(5000)) {
    $now = Get-Date
    $minutes = ($now - $started).TotalMinutes
    if ($minutes -ge $VcRuntimeWait) {
      Stop-Tree $helper.Id
      Warn "nessuna risposta alla richiesta di permesso in $VcRuntimeWait minuti: vado avanti senza il runtime."
      break
    }
    if (($now - $lastBeat).TotalSeconds -ge 60) {
      $lastBeat = $now
      Say "  aspetto il permesso dell'amministratore (da $([int]$minutes) min)"
    }
  }
  if ($helper.HasExited -and $helper.ExitCode -ne 0) { Say "Permesso negato o installazione non riuscita (codice $($helper.ExitCode))." }
  if (-not (Test-VcRuntime $Platform)) {
    Warn 'il runtime non è installato, quindi Storybook e Ladle non potranno essere misurati. Il resto della prova va avanti.'
  }
}

# Keeps the PC awake while the benchmark runs: the flag holds as long as this PowerShell's thread waits for Node.
function Stop-Sleep {
  try {
    Add-Type -Namespace ForgebookBench -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
    # ES_CONTINUOUS | ES_SYSTEM_REQUIRED: no sleep, the screen may turn off
    [void][ForgebookBench.Power]::SetThreadExecutionState([uint32]'0x80000001')
  } catch {
    Warn 'non riesco a impedire lo standby. Se il PC va in standby durante la prova, rilancia il kit: riprende da dove era.'
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
  Write-Host "Cartella $KitHome cancellata."
}

try {
  Disable-QuickEdit
  Write-Host 'Benchmark di Forgebook' -ForegroundColor Cyan
  Write-Log "Avvio: $($KitArgs -join ' ')"
  Say "Il kit installa quello che gli serve in $KitHome, senza diritti di amministratore, e alla fine scrive un file di risultati sul Desktop."
  Say "Durante la prova non serve toccare nulla: ogni minuto una riga dice a che punto è. I registri sono in $LogFolder."

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
  $tools = Join-Path $KitHome 'tools'
  $downloads = Join-Path $KitHome 'downloads'
  $nodeUnpacked = Join-Path $tools "node-$($pins['node.version'])"
  $script:Repo = Join-Path $KitHome 'repo'
  $existingNode = if (Test-Path -LiteralPath $nodeUnpacked) { Get-ChildItem -LiteralPath $nodeUnpacked -Directory | Select-Object -First 1 } else { $null }
  if ($null -ne $existingNode) { $script:Node = Join-Path $existingNode.FullName 'node.exe' }

  # --results: only the results file of what there is, with nothing installed or run
  if ($KitArgs -contains '--results') {
    Write-WhatThereIs
    Wait-Close
    exit 0
  }

  Step 'Controllo il PC'
  $drive = New-Object System.IO.DriveInfo ([System.IO.Path]::GetPathRoot($KitHome))
  $memory = (Get-CimInstance Win32_ComputerSystem -OperationTimeoutSec 60).TotalPhysicalMemory
  Say ('Windows {0}, {1}, memoria {2:N1} GB, spazio libero {3:N1} GB.' -f [Environment]::OSVersion.Version, $platform, ($memory / $Gigabyte), ($drive.AvailableFreeSpace / $Gigabyte))
  if ($drive.AvailableFreeSpace -lt 6 * $Gigabyte) { Fail 'servono almeno 6 GB liberi sul disco per installare il kit; la prova completa ne chiede circa 25.' }
  if ($memory -lt 4 * $Gigabyte) { Fail 'servono almeno 4 GB di memoria.' }

  New-Item -ItemType Directory -Path $tools, $downloads -Force | Out-Null

  Step "Node $($pins['node.version'])"
  $nodeZip = Join-Path $downloads "node-$($pins['node.version'])-$platform.zip"
  Get-Verified $pins["node.$platform.url"] $pins["node.$platform.sha256"] $nodeZip
  Expand-Once $nodeZip $nodeUnpacked
  $node = (Get-ChildItem -LiteralPath $nodeUnpacked -Directory | Select-Object -First 1).FullName
  $script:Node = Join-Path $node 'node.exe'

  Install-VcRuntime $platform $pins $downloads

  Step "Git (MinGit $($pins['mingit.version']))"
  $gitZip = Join-Path $downloads "mingit-$($pins['mingit.version'])-$platform.zip"
  Get-Verified $pins["mingit.$platform.url"] $pins["mingit.$platform.sha256"] $gitZip
  $git = Join-Path $tools "mingit-$($pins['mingit.version'])"
  Expand-Once $gitZip $git

  # Everything the tools write stays in the kit's folder; nothing asks a question, and Git reads no configuration of the
  # user's, asks for no credentials and gives up on a transfer that stalls.
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
  $env:GIT_CONFIG_COUNT = '3'
  $env:GIT_CONFIG_KEY_0 = 'core.longpaths'
  $env:GIT_CONFIG_VALUE_0 = 'true'
  $env:GIT_CONFIG_KEY_1 = 'http.lowSpeedLimit'
  $env:GIT_CONFIG_VALUE_1 = '1000'
  $env:GIT_CONFIG_KEY_2 = 'http.lowSpeedTime'
  $env:GIT_CONFIG_VALUE_2 = '300'

  Step 'pnpm'
  Invoke-Watched 'L''attivazione di pnpm' (Join-Path $node 'corepack.cmd') @('enable', '--install-directory', $bin, 'pnpm') 5 10

  Step "Forgebook al commit $($pins['forgebook.commit'].Substring(0, 12))"
  $repo = $script:Repo
  $commit = $pins['forgebook.commit']
  if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) {
    Invoke-Watched 'git init' 'git' @('init', '--quiet', $repo) 2 5
    Invoke-Watched 'git remote' 'git' @('-C', $repo, 'remote', 'add', 'origin', $pins['forgebook.repository']) 2 5
  }
  $head = (& git -C $repo rev-parse --verify --quiet HEAD) | Out-String
  if ($head.Trim() -ne $commit) {
    Invoke-Watched 'Lo scaricamento di Forgebook' 'git' @('-C', $repo, 'fetch', '--quiet', '--depth', '1', 'origin', $commit) 20 60
    Invoke-Watched 'git checkout' 'git' @('-C', $repo, 'checkout', '--quiet', '--force', $commit) 10 20
  }
  if ((& git -C $repo status --porcelain | Out-String).Trim() -ne '') {
    Invoke-Watched 'git reset' 'git' @('-C', $repo, 'reset', '--quiet', '--hard', $commit) 10 20
  }

  Set-Location -LiteralPath $repo
  $installed = Join-Path $repo 'node_modules\.kit-installed'
  if (-not ((Test-Path -LiteralPath $installed) -and ((Get-Content -LiteralPath $installed -Raw).Trim() -eq $commit))) {
    Step 'Dipendenze di Forgebook (qualche minuto)'
    Invoke-Watched 'pnpm install' 'pnpm' @('install', '--frozen-lockfile', '--reporter', 'append-only') 30 90
    Set-Content -LiteralPath $installed -Value $commit
  }

  $chromium = Join-Path $env:PLAYWRIGHT_BROWSERS_PATH '.kit-chromium'
  if (-not ((Test-Path -LiteralPath $chromium) -and ((Get-Content -LiteralPath $chromium -Raw).Trim() -eq $commit))) {
    Step 'Chromium per le misure'
    Invoke-Watched 'L''installazione di Chromium' 'pnpm' @('--filter', '@forgebook/tools', 'exec', 'playwright', 'install', 'chromium') 20 60
    Set-Content -LiteralPath $chromium -Value $commit
  }

  Stop-Sleep
  Write-Log 'Passo al kit (Node): il suo registro è kit.log.'
  # the kit asks its questions itself, and writes the results file of what there is when a run fails
  & $script:Node (Join-Path $repo 'tools\bench\kit\kit.mts') --home $KitHome --desktop (Get-Desktop) @KitArgs
  $status = $LASTEXITCODE
  Write-Log "Kit finito (codice $status)."
  if (Test-Path -LiteralPath (Join-Path $KitHome 'clean-requested')) { Restore-Console; Remove-Kit $script:Node }
  Wait-Close
  exit $status
} finally {
  Restore-Console
}
