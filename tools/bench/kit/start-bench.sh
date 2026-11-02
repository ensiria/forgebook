#!/usr/bin/env bash
# The bench kit on Linux (macOS too): installs what the Forgebook benchmark needs into the user's own folder, without
# administrator rights, then hands over to the kit's Node part (tools/bench/kit/kit.mts) for the questions, the run and
# the results file. Every step is skipped when already done, so launching it again resumes. The pinned downloads and
# the commit are in kit.pins beside this file. Git comes from the system. Text for the person is Italian.
set -euo pipefail

KIT_FOLDER="$(cd "$(dirname "$0")" && pwd)"
KIT_HOME="${FORGEBOOK_BENCH_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/forgebook-bench}"
GIGABYTE_KB=$((1024 * 1024))

say() { printf '%s\n' "$1"; }
step() { printf '\n\033[36m» %s\033[0m\n' "$1"; }
wait_close() {
  if [ -z "${FORGEBOOK_BENCH_NO_PAUSE:-}" ] && [ -t 0 ]; then
    printf '\n'
    read -r -p 'Premi Invio per chiudere ' _ || true
  fi
}
fail() {
  printf '\n\033[31mErrore: %s\033[0m\n' "$1"
  wait_close
  exit 1
}
pin() { grep "^$1=" "$KIT_FOLDER/kit.pins" | head -n 1 | cut -d= -f2-; }
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Downloads a file once, and keeps it only when its SHA-256 is the one pinned.
get_verified() {
  local url="$1" expected="$2" destination="$3"
  if [ -f "$destination" ] && [ "$(sha256 "$destination")" = "$expected" ]; then return; fi
  say "Scarico $url"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$destination.part" "$url" || fail "non riesco a scaricare $url. Controlla la connessione e rilancia."
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$destination.part" "$url" || fail "non riesco a scaricare $url. Controlla la connessione e rilancia."
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
say "Il kit installa quello che gli serve in $KIT_HOME, senza diritti di amministratore, e alla fine scrive un file di risultati sul Desktop."

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

node_version="$(pin node.version)"
step "Node $node_version"
node_archive="$downloads/node-$node_version-$platform.tar.gz"
get_verified "$(pin "node.$platform.url")" "$(pin "node.$platform.sha256")" "$node_archive"
node_home="$tools/node-$node_version-$platform"
if [ ! -f "$node_home/.kit-unpacked" ]; then
  rm -rf "$node_home"
  mkdir -p "$node_home"
  tar -xzf "$node_archive" -C "$node_home" --strip-components 1
  touch "$node_home/.kit-unpacked"
fi

# Everything the tools write stays in the kit's folder; Git asks for nothing and reads no configuration of the user's.
touch "$KIT_HOME/gitconfig"
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
corepack enable --install-directory "$bin" pnpm || fail "l'attivazione di pnpm non è riuscita."

commit="$(pin forgebook.commit)"
repo="$KIT_HOME/repo"
step "Forgebook al commit ${commit:0:12}"
if [ ! -d "$repo/.git" ]; then
  git init --quiet "$repo"
  git -C "$repo" remote add origin "$(pin forgebook.repository)"
fi
if [ "$(git -C "$repo" rev-parse --verify --quiet HEAD || true)" != "$commit" ]; then
  git -C "$repo" fetch --quiet --depth 1 origin "$commit" || fail "non riesco a scaricare Forgebook. Controlla la connessione e rilancia."
  git -C "$repo" checkout --quiet --force "$commit"
fi
[ -z "$(git -C "$repo" status --porcelain)" ] || git -C "$repo" reset --quiet --hard "$commit"

cd "$repo"
if [ "$(cat node_modules/.kit-installed 2>/dev/null || true)" != "$commit" ]; then
  step 'Dipendenze di Forgebook (qualche minuto)'
  pnpm install --frozen-lockfile || fail "pnpm install non è riuscito."
  printf '%s\n' "$commit" >node_modules/.kit-installed
fi
if [ "$(cat "$PLAYWRIGHT_BROWSERS_PATH/.kit-chromium" 2>/dev/null || true)" != "$commit" ]; then
  step 'Chromium per le misure'
  pnpm --filter @forgebook/tools exec playwright install chromium || fail "l'installazione di Chromium non è riuscita."
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
desktop="$( (command -v xdg-user-dir >/dev/null 2>&1 && xdg-user-dir DESKTOP) || printf '%s' "$HOME/Desktop")"
status=0
"${keep_awake[@]+"${keep_awake[@]}"}" node "$repo/tools/bench/kit/kit.mts" --home "$KIT_HOME" --desktop "$desktop" "$@" || status=$?
if [ -f "$KIT_HOME/clean-requested" ]; then
  cd "$HOME"
  rm -rf "$KIT_HOME"
  say "Cartella $KIT_HOME cancellata."
fi
wait_close
exit "$status"
