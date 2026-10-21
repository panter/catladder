#!/usr/bin/env bash
# Watch upstream releases and entries in upstream-watch.d/ (plus legacy TSV).
# Create upstream-labelled city beads on changes. DRY_RUN=1 only reports.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RIG_DIR="$HOME/git/maw-city-src"
entries="$(mktemp)"
new_state="$(mktemp)"
trap 'rm -f "$entries" "$new_state"' EXIT
python3 "$ROOT/scripts/upstream-watch-entries.py" "$ROOT" > "$entries"
STATE_DIR="$HOME/.local/state/maw-city"; mkdir -p "$STATE_DIR"
STATE="$STATE_DIR/upstream-state.tsv"; touch "$STATE"
bd() { (cd "$RIG_DIR" && env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin" /opt/homebrew/bin/bd "$@"); }
# Upstream operations deliberately keep maw's stored login, never the city App token.
gh() { env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin" /opt/homebrew/bin/gh "$@"; }
changes=()
prev(){ awk -F'\t' -v k="$1" '$1==k{print $2; exit}' "$STATE"; }
# A failed GitHub lookup ("?", or "-" for releases/pack) keeps the last known state and is not a change: recording it
# created dozens of false "Upstream: … (open → ?)" beads on 2026-10-13/14 that were dispatched again and again.
record(){
  local p; p="$(prev "$1")"
  if [ "$2" = "?" ] || [ "$2" = "-" ]; then
    printf '%s\t%s\n' "$1" "${p:-$2}" >> "$new_state"; echo "lookup failed for $1, keeping ${p:-nothing}" >&2; return 0
  fi
  printf '%s\t%s\n' "$1" "$2" >> "$new_state"
  # From "?" only a watched tag counts (the tag did not exist yet and now does); for issues it was a failed lookup.
  if [ -n "$p" ] && [ "$p" != "$2" ] && { { [ "$p" != "?" ] && [ "$p" != "-" ]; } || [ "${3:-}" = tag ]; }; then
    changes+=("$1|$p|$2")
  fi
}

# Releases
for repo in gastownhall/gascity gastownhall/beads; do
  tag="$(gh api "repos/$repo/releases/latest" --jq .tag_name 2>/dev/null)" || tag="-"
  case "$tag" in v*) ;; *) tag="-";; esac
  record "release:$repo" "$tag"
done
# The gascity pack has no releases: last commit in the pack directory (city-city uses gascity since 2026-10-08)
pk="$(gh api "repos/gastownhall/gascity-packs/commits?path=gascity&per_page=1" --jq '.[0].sha[0:7]' 2>/dev/null)" || pk="-"
record "pack:gascity-packs/gascity" "$pk"
# Installierte Versionen (zur Info im Bead)
gcv="$(/opt/homebrew/opt/gascity/bin/gc version 2>/dev/null | head -1 || true)"
bdv="$(bd version 2>/dev/null | head -1 || true)"
# Issues, PRs and explicitly watched version tags
while IFS=$'\t' read -r repo num typ grund bead; do
  case "$repo" in ''|\#*) continue;; esac
  if [ "$typ" = tag ]; then
    st="$(gh api "repos/$repo/git/ref/tags/$num" --jq .object.sha 2>/dev/null || echo "?")"
  else
    st="$(gh api "repos/$repo/issues/$num" --jq '.state + (if .pull_request.merged_at then "/merged" else "" end)' 2>/dev/null || echo "?")"
  fi
  record "$repo#$num" "$st" "$typ"
done < "$entries"

if [ "${DRY_RUN:-}" = "1" ]; then echo "DRY_RUN: ${#changes[@]} Änderung(en)"; printf '%s\n' "${changes[@]:-}"; rm -f "$new_state"; exit 0; fi
mv "$new_state" "$STATE"
[ "${#changes[@]}" -eq 0 ] && exit 0
cd "$RIG_DIR"
existing="$(bd list --json --limit 1000 2>/dev/null | jq -r '.[] | select(.status!="closed") | .title')"
for c in "${changes[@]}"; do
  IFS='|' read -r key old new <<< "$c"
  title="Upstream: $key ($old → $new)"
  printf '%s\n' "$existing" | grep -qxF "$title" && continue
  grund="$(awk -F'\t' -v r="${key%#*}" -v n="${key#*#}" '$1==r && $2==n {print $4}' "$entries")"
  id="$(bd create --silent -t task -p 2 "$title" -d "Upstream-Änderung erkannt von der Order upstream-watch.
Eintrag: $key
Vorher: $old – jetzt: $new
Grund der Beobachtung: ${grund:-neues Release}
Installiert: gc ${gcv:-?}; bd ${bdv:-?}
Aufgabe: Release-Notes bzw. Issue/PR lesen und bewerten: Betrifft es uns? Kann ein lokaler Workaround weg? Lohnt ein Upgrade (Schritte für maw)? Ergebnis als Kommentar; konkrete Folgearbeit als Beads vorschlagen. Siehe AGENTS.md, Abschnitt «Upstream beobachten».")"
  bd label add "$id" upstream >/dev/null; bd label add "$id" core >/dev/null
  echo "bead $id: $title"
done
