#!/usr/bin/env bash
# Injects Obsidian long-term memory (Learnings + Coding Rules + Active Context) into context.
# SessionStart hook. Reads absolute vault paths from the repo's gitignored
# CLAUDE.local.md so no personal paths live in git.
# No-ops silently if CLAUDE.local.md or the target files are missing.
# Arg $1 = hook event name (default: SessionStart).
set -euo pipefail

EVENT="${1:-SessionStart}"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PTR="$ROOT/CLAUDE.local.md"
[ -f "$PTR" ] || exit 0

# Value after the first '=' for a KEY line (paths may contain spaces).
getpath() { grep -m1 "^$1=" "$PTR" 2>/dev/null | cut -d= -f2- || true; }

LEARNINGS="$(getpath LEARNINGS)"
STANDARDS="$(getpath STANDARDS)"
RULES="$(getpath CODING_RULES)"
ACTIVE="$(getpath ACTIVE_CONTEXT)"
THREADS="$(getpath THREADS)"

out=""
if [ -n "$LEARNINGS" ] && [ -f "$LEARNINGS" ]; then
  # Inject the index (MOC) ONLY — one summary line per lesson, grouped by domain
  # spoke. Full detail lives in Learnings/<Spoke>.md (Frontend, Backend-Data,
  # Mobile, Workflow) and is read on demand, NOT injected, to keep per-session
  # tokens low (~2K vs the old ~11K that expanded every atomic note body).
  out+="# Global Master Learnings (Obsidian hub — index)"$'\n\n'"$(cat "$LEARNINGS")"$'\n\n'
fi
# Org standards: shared conventions for every repo in this org's vault. Injected
# in FULL every session (unlike Learnings) — they apply to all work, not just
# situationally. General (org) before specific (repo). Keep the file tight.
if [ -n "$STANDARDS" ] && [ -f "$STANDARDS" ]; then
  out+="# Org Coding Standards (Obsidian — shared across this org's repos)"$'\n\n'"$(cat "$STANDARDS")"$'\n\n'
fi
if [ -n "$RULES" ] && [ -f "$RULES" ]; then
  out+="# Coding Rules — this repo (Obsidian spoke)"$'\n\n'"$(cat "$RULES")"$'\n\n'
fi
if [ -n "$ACTIVE" ] && [ -f "$ACTIVE" ]; then
  out+="# Active Context — this repo (Obsidian spoke)"$'\n\n'"$(cat "$ACTIVE")"$'\n'
fi
# Open threads: inject only the ledger's `open` rows — unfinished action items
# that survived session rotation. Done rows stay out of context.
if [ -n "$THREADS" ] && [ -f "$THREADS" ]; then
  open_rows="$(grep -E '^\|[[:space:]]*open[[:space:]]*\|' "$THREADS" 2>/dev/null || true)"
  if [ -n "$open_rows" ]; then
    out+=$'\n'"# Open Threads — this repo (unfinished action items; close them or they carry forward)"$'\n\n'"| status | thread | opened | source |"$'\n'"|---|---|---|---|"$'\n'"$open_rows"$'\n'
  fi
fi

[ -z "$out" ] && exit 0

jq -n --arg e "$EVENT" --arg c "Obsidian long-term memory (hub-and-spoke). Read before architectural changes; persist with /sync-brain push.

$out" '{hookSpecificOutput:{hookEventName:$e,additionalContext:$c}}'
