#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"

command -v jq >/dev/null 2>&1 || { echo "Erro: jq não está instalado." >&2; exit 1; }

mkdir -p "$CLAUDE_DIR"

[ -s "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp=$(mktemp)
jq '.env = ((.env // {}) + {CLAUDE_CODE_FORK_SUBAGENT: "0"})' "$SETTINGS" > "$tmp"
mv "$tmp" "$SETTINGS"

echo "Agentes em primeiro plano configurados: CLAUDE_CODE_FORK_SUBAGENT=0 em $SETTINGS (vale para sessões novas)"
