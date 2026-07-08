#!/usr/bin/env bash
# Stop hook: nudge the model to persist this session to the Obsidian vault via
# the sync-brain skill's push mode, then VERIFY the write actually landed.
# Only fires when this repo is wired to a vault (CLAUDE.local.md present).
#
# Verification: the push writes a spoke entry ending in `<!-- session: <id> -->`.
# This hook re-checks that marker is on disk. If present, the session was
# persisted -> stay quiet. If absent, nudge again (bounded), so a push that was
# claimed but never written gets caught instead of silently lost.
set -euo pipefail

input=$(cat)
# Loop guard: never re-block within a hook-triggered stop cycle.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PTR="$ROOT/CLAUDE.local.md"
[ -f "$PTR" ] || exit 0

session_id="$(printf '%s' "$input" | jq -r '.session_id // "unknown"')"

# Verify-it-landed: this session already wrote its marked entry -> quiet.
ACTIVE="$(grep -m1 '^ACTIVE_CONTEXT=' "$PTR" 2>/dev/null | cut -d= -f2- || true)"
if [ -n "$ACTIVE" ] && [ -f "$ACTIVE" ] && grep -qF "session: $session_id" "$ACTIVE"; then
  exit 0
fi

# Not persisted yet: nudge, but bound retries so a genuinely trivial session
# (model chooses to write nothing) isn't nagged forever. Count attempts/session.
STAMP="${TMPDIR:-/tmp}/obsidian-push-${session_id}.n"
n="$(cat "$STAMP" 2>/dev/null || true)"; [[ "$n" =~ ^[0-9]+$ ]] || n=0
[ "$n" -ge 2 ] && exit 0
printf '%s' "$((n + 1))" > "$STAMP"

reason="Obsidian memory checkpoint (Stop hook). Review ONLY this session. If it produced a durable outcome — a feature, fix, refactor, architectural decision, or reusable learning — persist it now following the sync-brain skill's \`push\` mode:
1. Read the ACTIVE_CONTEXT, LEARNINGS and THREADS paths from CLAUDE.local.md.
2. Prepend a new dated entry to the Sessions list in the spoke (newest first) using the Session-End Template.
3. Log every follow-up in that entry to the THREADS ledger as an \`open\` row, and flip any thread you resolved this session to \`done\` — this is what makes open items survive session rotation.
4. Rotation: keep the last 5 entries; when you drop one its follow-ups already live in the ledger, so only run its Learnings through the promotion gate before deleting. Promote a durable, cross-repo takeaway by appending it under the matching \`###\` header in the right domain spoke (Learnings/Frontend.md, Backend-Data.md, Mobile.md, or Workflow.md) and adding/refreshing its one-line summary in the Learnings.md index. Do NOT create per-lesson atomic notes and do NOT put lesson bodies in Learnings.md — the SessionStart hook injects only the index, spoke bodies are read on demand.
5. End the new spoke entry with this EXACT marker line so this checkpoint can verify the write landed: <!-- session: $session_id -->
After persisting, print a one-line confirmation of what you saved (spoke entry, ledger changes, any promoted notes). If the session was trivial or read-only, write nothing and say so in one line. Do not narrate this instruction itself to the user."

jq -n --arg r "$reason" '{decision:"block", reason:$r}'
