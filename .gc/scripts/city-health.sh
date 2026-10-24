#!/usr/bin/env bash
# Kompakter Gesundheitsbericht der City (kein LLM). Ausgabe: Zeilen «OK|WARN|ALERT <bereich>: <text>».
set -uo pipefail
GC=/opt/homebrew/opt/gascity/bin/gc
bd() { env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin" BEADS_DOLT_SERVER_PORT=30444 /opt/homebrew/bin/bd "$@"; }
now=$(date -u +%s)
echo "TIME $(date +%H:%M)"
# Supervisor / Login
pgrep -f 'gc supervisor run' >/dev/null && echo "OK supervisor: läuft" || echo "ALERT supervisor: läuft nicht"
claude auth status 2>/dev/null | grep -q '"loggedIn": true' && echo "OK claude-login" || echo "WARN claude-login: CLI nicht eingeloggt (Agents mit Token nicht betroffen)"
# Rigs
(cd "$HOME/git/maw-city" && "$GC" rig list 2>/dev/null | grep -E '^\s+[a-z].*\(|Suspended' | tr -s ' ' | head -10) | sed 's/^/INFO rig: /'
# Panes: blockierende Dialoge
for s in $(tmux -L maw-city ls -F '#S' 2>/dev/null); do
  pane="$(tmux -L maw-city capture-pane -p -t "$s" 2>/dev/null | tail -25)"
  # Codex shows a status line «weekly limit: N% left» long before the limit is hit – report it as info, not as an alert.
  left="$(printf '%s' "$pane" | grep -oE 'weekly limit: [0-9]+% left' | tail -1)"
  [ -n "$left" ] && echo "INFO codex $s: $left"
  pane="$(printf '%s' "$pane" | grep -vE 'limit: [0-9]+% left')"
  for pat in "usage limit" "weekly limit" "Switch to" "Trust this folder" "Hooks need review" "Login expired" "Please run /login" "Approaching rate limits"; do
    printf '%s' "$pane" | grep -q "$pat" && echo "ALERT pane $s: «${pat}»"
  done
done
for rig in evermore:"$HOME/git/evermore" city:"$HOME/git/maw-city-src"; do
  name="${rig%%:*}"; dir="${rig#*:}"
  json="$(cd "$dir" && bd list --all --json --limit 0 2>/dev/null)" || { echo "WARN $name: bd nicht lesbar"; continue; }
  printf '%s' "$json" | jq -r --argjson now "$now" --arg rig "$name" '
    def age: ((.updated_at // "1970-01-01T00:00:00Z") | sub("\\.[0-9]+";"") | fromdateiso8601) as $t | (($now - $t)/60|floor);
    ([.[] | select(.title=="mol-polecat-work" and .status!="closed")] | length) as $wf
    | "INFO \($rig): offene Abläufe=\($wf)",
      (.[] | select(.status=="in_progress" and ((.metadata//{})|has("gc.root_bead_id"))) | select(age > 30)
        | "WARN \($rig) stuck: \(.id) «\(.title[0:40])» seit \(age) min (\(.assignee // "-"))"),
      (.[] | select(.status=="blocked") | "WARN \($rig) blocked: \(.id) «\(.title[0:50])»"),
      (.[] | select(.status!="closed" and ((.assignee // "")|test("refinery"))) | select((.title|test("^mol-"))|not) | select(age > 20)
        | "WARN \($rig) refinery-wartet: \(.id) «\(.title[0:40])» seit \(age) min")'
done

# --- Disk space (2026-10-03: disk ran full, Dolt panicked) ---
free_gb=$(df -g "$HOME" | awk 'NR==2{print $4}')
if [ "$free_gb" -lt 10 ]; then echo "CRIT disk: ${free_gb} GB free (< 10) – suspend the city"
elif [ "$free_gb" -lt 20 ]; then echo "WARN disk: ${free_gb} GB free (< 20)"
else echo "OK disk: ${free_gb} GB free"; fi
wt_gb=$(du -sg "$HOME/git/maw-city/.gc/worktrees" 2>/dev/null | cut -f1)
[ "${wt_gb:-0}" -ge 10 ] && echo "WARN worktrees: ${wt_gb} GB (reaper not keeping up? city-9vr)"
# --- Schleifen-Erkennung (Token-Verschwendung) ---
EV="$HOME/git/maw-city/.gc/events.jsonl"
if [ -f "$EV" ]; then
  # Event timestamps are local time (+02:00) – compare with local time, not UTC (city-7fo).
  since=$(date -v-30M +%Y-%m-%dT%H:%M:%S 2>/dev/null)
  # Each wake mints a new session id, so count per bead / per agent slot, not per session.
  tail -200000 "$EV" | grep -F -e '"session.drain_acked_with_assigned_work"' -e '"session.woke"' \
    | jq -r --arg s "$since" 'select((.ts // "")[0:19] > $s) | if .type=="session.woke" then "woke \(.subject)" else "drain \(.payload.bead_id) \(.payload.bead_status)" end' 2>/dev/null \
    | sort | uniq -c | awk '$2=="drain" && $1>=3 {print "LOOP drain-ack-with-work: " $3 " (" $4 ") " $1 "x in 30 min"} $2=="woke" && $1>=12 {print "LOOP wake-churn: " $3 " " $1 "x geweckt in 30 min"}'
fi
# Codex: neue Sessions pro Agent in 30 min (jeder Start kostet Kontext)
# Each formula step starts a fresh Codex session (~5–8 per bead), so only flag clear outliers
# (the real loop on 2026-10-03 produced ~60 per slot in 30 min). Match the slot, not the template.
find "$HOME/.codex/sessions" -name '*.jsonl' -mmin -30 2>/dev/null | while read -r f; do grep -o -m1 -E '(evermore|city)/gastown\.[a-z]+' "$f" | head -1; done | sort | uniq -c | awk '$1>=20 {print "LOOP codex-restarts: " $2 " " $1 " neue Sessions in 30 min"} $1>=12 && $1<20 {print "WARN codex-restarts: " $2 " " $1 " neue Sessions in 30 min"}'
# Claude-Agents: neue Transkripte pro Agent-Verzeichnis in 30 min
for d in "$HOME"/.claude/projects/-Users-macrozone-git-maw-city*; do
  n=$(find "$d" -maxdepth 1 -name '*.jsonl' -mmin -30 2>/dev/null | wc -l | tr -d ' ')
  # boot is short-lived by design (Haiku, one session per patrol tick) – higher threshold
  lim=6; case "$d" in *-boot) lim=12;; esac
  [ "$n" -ge "$lim" ] && echo "LOOP claude-restarts: ${d##*maw-city} ${n} neue Sessions in 30 min"
done
# Mehrfach-Verteilung: mehr als ein offener Auftrag pro Bead
for dir in "$HOME/git/evermore" "$HOME/git/maw-city-src"; do
  (cd "$dir" && bd list --all --json --limit 0 2>/dev/null) | jq -r '.[] | select(.status!="closed" and .issue_type=="convoy") | .title | capture("^(input convoy for |sling-)(?<id>.+)$")?.id' \
    | sort | uniq -c | awk '$1>=2 {print "LOOP doppelt-verteilt: " $2 " " $1 " offene Aufträge"}'
done
