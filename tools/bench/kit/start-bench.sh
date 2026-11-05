#!/usr/bin/env bash
# The bench kit on Linux (macOS too): installs what the Forgebook benchmark needs into the user's own folder, without
# administrator rights, then hands over to the kit's Node part (tools/bench/kit/kit.mts) for the questions, the run and
# the results file. Every step is skipped when already done, so launching it again resumes. The pinned downloads and
# the commit are in kit.pins beside this file. Git comes from the system. Text for the person is Italian.
#
# Nothing here waits without a limit or without a word: each program runs with its output in a log of the kit's
# folder, a line every minute on the terminal, and is stopped with its whole process group when it stays silent or
# runs too long. When a step fails, what there is goes in a results file.
set -euo pipefail

KIT_FOLDER="$(cd "$(dirname "$0")" && pwd)"
KIT_HOME="${FORGEBOOK_BENCH_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/forgebook-bench}"
GIGABYTE_KB=$((1024 * 1024))
LOG_FOLDER="$KIT_HOME/logs"
LAUNCHER_LOG="$LOG_FOLDER/launcher.log"
step_number=0
node_bin=""
repo="$KIT_HOME/repo"
# The file that marks the kit's own folder: only a folder holding it is ever deleted
KIT_MARKER=.forgebook-bench-kit
is_new_folder=0
[ -d "$KIT_HOME" ] || is_new_folder=1
mkdir -p "$LOG_FOLDER"
if [ "$is_new_folder" = 1 ] || [ -f "$KIT_HOME/state.json" ] || [ -d "$KIT_HOME/tools" ]; then
  touch "$KIT_HOME/$KIT_MARKER"
fi
# the step running now, stopped with its group when the launcher is interrupted
watched_pid=""
trap 'if [ -n "$watched_pid" ]; then kill -KILL -- "-$watched_pid" 2>/dev/null || true; fi; exit 130' INT TERM

# Every line the person sees goes to the launcher's log first, with the time: the terminal is no record.
log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$1" >>"$LAUNCHER_LOG" 2>/dev/null || true; }
say() { log "$1"; printf '%s\n' "$1"; }
step() { log "» $1"; printf '\n\033[36m» %s\033[0m\n' "$1"; }
wait_close() {
  if [ -z "${FORGEBOOK_BENCH_NO_PAUSE:-}" ] && [ -t 0 ]; then
    printf '\n'
    read -r -p 'Premi Invio per chiudere ' _ || true
  fi
}
# Whether the Node part of the pinned commit is installed. A folder an earlier launch left holds the kit of that launch's
# commit, which need not know the options this launcher passes.
kit_is_installed() {
  [ -n "$node_bin" ] && [ -f "$repo/node_modules/.kit-installed" ] && [ -f "$KIT_FOLDER/kit.pins" ] &&
    [ "$(cat "$repo/node_modules/.kit-installed")" = "$(pin forgebook.commit)" ]
}
# A text as a regular expression matching it literally and whatever its case, as kitResults.ts matches, in a sed command
# delimited by #: not every sed has a flag for case. A letter outside ASCII keeps its case here, and the search for what
# is left finds it.
any_case() {
  local LC_ALL=C text="$1" index character lower upper result=""
  for ((index = 0; index < ${#text}; index++)); do
    character="${text:index:1}"
    case "$character" in
      [A-Za-z])
        lower="$(printf '%s' "$character" | tr 'A-Z' 'a-z')"
        upper="$(printf '%s' "$character" | tr 'a-z' 'A-Z')"
        result+="[$lower$upper]"
        ;;
      [][\\.*^\$\(\)+?{}\|#]) result+="\\$character" ;;
      *) result+="$character" ;;
    esac
  done
  printf '%s' "$result"
}
# The logs alone, cleaned of the person's identity as kitResults.ts cleans the kit's file, and searched again: anything
# left and nothing is archived. They need nothing installed, so what packs them is what the machine has.
write_logs_archive() {
  local not_word='[^[:alnum:]_-]'
  # a user's folder in any account's name and any spelling, as kitResults.ts writes it
  local folder_name='[^~\\/"'"'"'[:space:]:][^\\/"'"'"'[:space:]:]*' separator='(\\{1,2}|/)' users home_word
  users="$(any_case Users)"
  home_word="$(any_case home)"
  local unix_folder="(^|[^[:alnum:]_.~-])/($users|$home_word)/$folder_name"
  local windows_folder="(^|[^[:alnum:]_])[A-Za-z]:$separator$users$separator$folder_name"
  local onedrive_left='OneDrive - ([^<]|<[^o])'
  local user_name host_name pattern placeholder rules=() left=("$unix_folder" "$windows_folder" "$onedrive_left")
  local stage log_file cleaned name folder stem archive
  user_name="${USER:-$(id -un 2>/dev/null || true)}"
  host_name="$(hostname 2>/dev/null || true)"
  if [ "${#HOME}" -ge 3 ]; then
    rules+=(-e "s#$(any_case "$HOME")#~#g")
    left+=("$(any_case "$HOME")")
  fi
  for name in "$user_name" "$host_name" "${host_name%%.*}"; do
    [ "${#name}" -ge 3 ] || continue
    placeholder='<computer>'
    [ "$name" = "$user_name" ] && placeholder='<user>'
    pattern="(^|$not_word)$(any_case "$name")(\$|$not_word)"
    # twice: a match takes the character after it, which may be the one before the next match
    rules+=(-e "s#$pattern#\\1$placeholder\\2#g" -e "s#$pattern#\\1$placeholder\\2#g")
    left+=("$pattern")
  done
  rules+=(-e "s#$unix_folder#\\1~#g" -e "s#$windows_folder#\\1~#g")
  rules+=(-e "s#OneDrive - [^\\\\/\"']+#OneDrive - <organisation>#g")
  stage="$(mktemp -d)" || {
    say "Non riesco a creare il file dei registri. I registri sono in $LOG_FOLDER."
    return 0
  }
  for log_file in "$LOG_FOLDER"/*; do
    [ -f "$log_file" ] || continue
    name="$(basename "$log_file")"
    cleaned="$stage/$name"
    LC_ALL=C sed -E "${rules[@]}" "$log_file" >"$cleaned" || {
      rm -rf "$stage"
      say "Non riesco a creare il file dei registri. I registri sono in $LOG_FOLDER."
      return 0
    }
    # the placeholders are no leak, though a user named user finds its name in them; the locale's own rules for case, so
    # a capital outside ASCII is found too
    LC_ALL=C sed -e 's/<user>//g' -e 's/<computer>//g' "$cleaned" >"$stage/.searched"
    for pattern in "${left[@]}"; do
      if grep -Eqai -e "$pattern" "$stage/.searched"; then
        rm -rf "$stage"
        say "Non creo il file dei registri: $name contiene ancora dati personali. I registri sono in $LOG_FOLDER."
        return 0
      fi
    done
  done
  rm -f "$stage/.searched"
  folder="$(desktop_folder)"
  [ -d "$folder" ] || folder="$KIT_HOME"
  stem="$folder/forgebook-bench-registri-$(date '+%Y%m%d-%H%M')"
  archive="$stem.zip"
  if command -v zip >/dev/null 2>&1; then
    # no extra fields: they would hold the owner's ids
    (cd "$stage" && zip -q -X -r "$archive" .) || archive=""
  elif command -v python3 >/dev/null 2>&1; then
    python3 -I -m zipfile -c "$archive" "$stage"/* || archive=""
  else
    # tar is what every system here has, and the launcher already asks for it; its headers would name the owner
    archive="$stem.tar.gz"
    tar --numeric-owner -czf "$archive" -C "$stage" . || archive=""
  fi
  rm -rf "$stage"
  if [ -z "$archive" ]; then
    say "Non riesco a creare il file dei registri. I registri sono in $LOG_FOLDER."
    return 0
  fi
  # the name alone: the folder names the user
  say "Ho scritto i registri, senza nome utente né nome del computer, sul Desktop: $(basename "$archive"). Mandalo così com'è."
}
# The results file of what there is: the kit's own, through Node, once the pinned commit is in place; otherwise, or when
# the kit cannot write it, the launcher's logs alone.
write_what_there_is() {
  if kit_is_installed; then
    "$node_bin" "$repo/tools/bench/kit/kit.mts" --home "$KIT_HOME" --desktop "$(desktop_folder)" --results && return 0
    say "Il kit non ha creato il file dei risultati: metto insieme solo i registri."
  fi
  write_logs_archive
}
fail() {
  log "Errore: $1"
  printf '\n\033[31mErrore: %s\033[0m\n\n' "$1"
  say "Creo il file dei risultati con quello che c'è, da mandare indietro."
  write_what_there_is || true
  say "Rilanciando il kit riprende da dove si è fermato."
  wait_close
  exit 1
}
desktop_folder() {
  printf '%s' "${FORGEBOOK_BENCH_DESKTOP:-$( (command -v xdg-user-dir >/dev/null 2>&1 && xdg-user-dir DESKTOP) || printf '%s' "$HOME/Desktop")}"
}

# Runs a program to its end, watched: its output in a log of its own, its stdin empty so a question reads its end
# instead of waiting, a line every minute, and its whole process group stopped when it stays silent for the given
# minutes or runs past the other limit.
run_watched() {
  local what="$1" silent_minutes="$2" max_minutes="$3"
  shift 3
  step_number=$((step_number + 1))
  local step_log
  step_log="$(printf '%s/launcher-%02d.log' "$LOG_FOLDER" "$step_number")"
  log "$what: $* (registro $step_log)"
  # job control on: the program gets a process group of its own, which stops with everything it started
  set -m
  "$@" </dev/null >"$step_log" 2>&1 &
  local pid=$!
  set +m
  watched_pid=$pid
  local started=$SECONDS last_sign=$SECONDS last_beat=$SECONDS last_size=-1 size
  while kill -0 "$pid" 2>/dev/null; do
    sleep 1
    size="$(wc -c <"$step_log" | tr -d ' ')"
    if [ "$size" != "$last_size" ]; then
      last_size="$size"
      last_sign=$SECONDS
    fi
    if [ $((SECONDS - last_sign)) -ge $((silent_minutes * 60)) ] || [ $((SECONDS - started)) -ge $((max_minutes * 60)) ]; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      fail "$what si è bloccato (nessun segnale da $(((SECONDS - last_sign) / 60)) minuti, o oltre $max_minutes minuti) e l'ho fermato. Il suo registro è $step_log."
    fi
    if [ $((SECONDS - last_beat)) -ge 60 ]; then
      last_beat=$SECONDS
      say "  $what: ancora in corso da $(((SECONDS - started) / 60)) min"
    fi
  done
  local code=0
  wait "$pid" || code=$?
  watched_pid=""
  if [ "$code" -ne 0 ]; then
    tail -n 15 "$step_log" | sed 's/^/  /'
    fail "$what non è riuscito (codice $code). Il registro è $step_log."
  fi
}
pin() { grep "^$1=" "$KIT_FOLDER/kit.pins" | head -n 1 | cut -d= -f2-; }
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Downloads a file once, and keeps it only when its SHA-256 is the one pinned.
get_verified() {
  local url="$1" expected="$2" destination="$3"
  if [ -f "$destination" ] && [ "$(sha256 "$destination")" = "$expected" ]; then return; fi
  say "Scarico $url (qualche minuto al massimo)"
  # a transfer slower than 1 kB/s for five minutes gives up, as a stalled one would never end
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --connect-timeout 60 --speed-limit 1000 --speed-time 300 -o "$destination.part" "$url" ||
      fail "non riesco a scaricare $url. Controlla la connessione e rilancia."
  elif command -v wget >/dev/null 2>&1; then
    wget -q --timeout=300 -O "$destination.part" "$url" || fail "non riesco a scaricare $url. Controlla la connessione e rilancia."
  else
    fail "serve curl o wget per scaricare i file."
  fi
  local actual
  actual="$(sha256 "$destination.part")"
  if [ "$actual" != "$expected" ]; then
    rm -f "$destination.part"
    fail "il file scaricato da $url non è quello atteso (SHA-256 $actual). Non lo uso."
  fi
  mv -f "$destination.part" "$destination"
}

printf '\033[36mBenchmark di Forgebook\033[0m\n'
log "Avvio: $*"
say "Il kit installa quello che gli serve in $KIT_HOME, senza diritti di amministratore, e alla fine scrive un file di risultati sul Desktop."
say "Durante la prova non serve toccare nulla: ogni minuto una riga dice a che punto è. I registri sono in $LOG_FOLDER."

case "$(uname -s)" in
  Linux) system=linux ;;
  Darwin) system=darwin ;;
  *) fail "questo sistema ($(uname -s)) non è supportato." ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) machine=x64 ;;
  aarch64 | arm64) machine=arm64 ;;
  *) fail "questo processore ($(uname -m)) non è supportato: serve un sistema a 64 bit." ;;
esac
platform="$system-$machine"
[ -f "$KIT_FOLDER/kit.pins" ] || fail "manca kit.pins accanto a questo file: copia tutta la cartella del kit."
node_version="$(pin node.version)"
node_home="$KIT_HOME/tools/node-$node_version-$platform"
[ -x "$node_home/bin/node" ] && node_bin="$node_home/bin/node"

# --results: only the results file of what there is, with nothing installed or run
for argument in "$@"; do
  if [ "$argument" = --results ]; then
    write_what_there_is || true
    wait_close
    exit 0
  fi
done

step 'Controllo il PC'
mkdir -p "$KIT_HOME"
free_kb="$(df -Pk "$KIT_HOME" | awk 'NR == 2 { print $4 }')"
if [ "$system" = linux ]; then
  memory_kb="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
else
  memory_kb=$(($(sysctl -n hw.memsize) / 1024))
fi
say "$platform, memoria $((memory_kb / GIGABYTE_KB)) GB, spazio libero $((free_kb / GIGABYTE_KB)) GB."
[ "$free_kb" -ge $((6 * GIGABYTE_KB)) ] || fail 'servono almeno 6 GB liberi sul disco per installare il kit; la prova completa ne chiede circa 25.'
[ "$memory_kb" -ge $((4 * GIGABYTE_KB - 262144)) ] || fail 'servono almeno 4 GB di memoria.'
command -v git >/dev/null 2>&1 || fail "serve Git, che si installa con il gestore dei pacchetti (per esempio: sudo apt install git) e richiede un amministratore."
command -v tar >/dev/null 2>&1 || fail "serve tar."

tools="$KIT_HOME/tools"
downloads="$KIT_HOME/downloads"
bin="$KIT_HOME/bin"
mkdir -p "$tools" "$downloads" "$bin"

step "Node $node_version"
node_archive="$downloads/node-$node_version-$platform.tar.gz"
get_verified "$(pin "node.$platform.url")" "$(pin "node.$platform.sha256")" "$node_archive"
if [ ! -f "$node_home/.kit-unpacked" ]; then
  rm -rf "$node_home"
  mkdir -p "$node_home"
  run_watched 'Lo scompattamento di Node' 10 30 tar -xzf "$node_archive" -C "$node_home" --strip-components 1
  touch "$node_home/.kit-unpacked"
fi
node_bin="$node_home/bin/node"

# Everything the tools write stays in the kit's folder; nothing asks a question, and Git reads no configuration of the
# user's, asks for no credentials and gives up on a transfer that stalls.
# Git's settings in the kit's own file, which every Git the benchmark starts reads too: a transfer slower than 1 kB/s
# for five minutes is given up
printf '[http]\n\tlowSpeedLimit = 1000\n\tlowSpeedTime = 300\n' >"$KIT_HOME/gitconfig"
export PATH="$node_home/bin:$bin:$PATH"
export COREPACK_HOME="$KIT_HOME/corepack"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTO_PIN=0
export npm_config_cache="$KIT_HOME/npm-cache"
export npm_config_store_dir="$KIT_HOME/pnpm-store"
export npm_config_update_notifier=false
export npm_config_fund=false
export PLAYWRIGHT_BROWSERS_PATH="$KIT_HOME/browsers"
export YARN_GLOBAL_FOLDER="$KIT_HOME/yarn"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL="$KIT_HOME/gitconfig"
export GIT_TERMINAL_PROMPT=0

step 'pnpm'
# Yarn too, though the launcher never runs it: a library's tasks call it by name (Carbon's build), and without it on the
# PATH they fail at once and that library is lost from the run
run_watched "L'attivazione di pnpm" 5 10 corepack enable --install-directory "$bin" pnpm yarn

commit="$(pin forgebook.commit)"
step "Forgebook al commit ${commit:0:12}"
if [ ! -d "$repo/.git" ]; then
  run_watched 'git init' 2 5 git init --quiet "$repo"
  run_watched 'git remote' 2 5 git -C "$repo" remote add origin "$(pin forgebook.repository)"
fi
if [ "$(git -C "$repo" rev-parse --verify --quiet HEAD || true)" != "$commit" ]; then
  run_watched 'Lo scaricamento di Forgebook' 20 60 git -C "$repo" fetch --quiet --depth 1 origin "$commit"
  run_watched 'git checkout' 10 20 git -C "$repo" checkout --quiet --force "$commit"
fi
[ -z "$(git -C "$repo" status --porcelain)" ] || run_watched 'git reset' 10 20 git -C "$repo" reset --quiet --hard "$commit"

cd "$repo"
if [ "$(cat node_modules/.kit-installed 2>/dev/null || true)" != "$commit" ]; then
  step 'Dipendenze di Forgebook (qualche minuto)'
  run_watched 'pnpm install' 30 90 pnpm install --frozen-lockfile --reporter append-only
  printf '%s\n' "$commit" >node_modules/.kit-installed
fi
if [ "$(cat "$PLAYWRIGHT_BROWSERS_PATH/.kit-chromium" 2>/dev/null || true)" != "$commit" ]; then
  step 'Chromium per le misure'
  run_watched "L'installazione di Chromium" 20 60 pnpm --filter @forgebook/tools exec playwright install chromium
  printf '%s\n' "$commit" >"$PLAYWRIGHT_BROWSERS_PATH/.kit-chromium"
fi
if [ "$system" = linux ]; then
  # Chromium needs system libraries a desktop usually has; installing missing ones needs an administrator
  shell="$(find "$PLAYWRIGHT_BROWSERS_PATH" -type f \( -name headless_shell -o -name chrome-headless-shell \) | head -n 1)"
  if [ -n "$shell" ] && ldd "$shell" 2>/dev/null | grep -q 'not found'; then
    say "Mancano librerie di sistema per Chromium. Un amministratore le installa con:"
    say "  sudo \"$node_home/bin/node\" \"$repo/tools/node_modules/@playwright/test/cli.js\" install-deps chromium"
    fail 'poi rilancia il kit.'
  fi
fi

# Keeps the machine awake while the benchmark runs, where the system lets a user ask
keep_awake=()
if [ "$system" = darwin ]; then
  keep_awake=(caffeinate -i)
elif command -v systemd-inhibit >/dev/null 2>&1 && systemd-inhibit --what=idle:sleep true >/dev/null 2>&1; then
  keep_awake=(systemd-inhibit --what=idle:sleep --who=forgebook-bench --why=benchmark)
fi
status=0
log 'Passo al kit (Node): il suo registro è kit.log.'
# the kit asks its questions itself, and writes the results file of what there is when a run fails
"${keep_awake[@]+"${keep_awake[@]}"}" node "$repo/tools/bench/kit/kit.mts" --home "$KIT_HOME" --desktop "$(desktop_folder)" "$@" || status=$?
log "Kit finito (codice $status)."
if [ -f "$KIT_HOME/clean-requested" ]; then
  cd "$HOME"
  # only a folder the kit made: never the user's own folder or the root, whatever FORGEBOOK_BENCH_HOME says
  kit_full="$(cd "$KIT_HOME" && pwd -P)"
  if [ ! -f "$KIT_HOME/$KIT_MARKER" ] || [ "$kit_full" = "$(cd "$HOME" && pwd -P)" ] || [ "$kit_full" = / ]; then
    fail "non cancello $KIT_HOME: non è una cartella creata dal kit."
  fi
  rm -rf "$KIT_HOME"
  say "Cartella $KIT_HOME cancellata."
fi
wait_close
exit "$status"
