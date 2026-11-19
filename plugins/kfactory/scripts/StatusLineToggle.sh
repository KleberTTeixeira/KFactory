#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
DESTINO="$CLAUDE_DIR/statusline-command.sh"
SETTINGS="$CLAUDE_DIR/settings.json"
ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/statusline-command.sh"
COMANDO="bash $DESTINO"

command -v jq >/dev/null 2>&1 || { echo "Erro: jq não está instalado." >&2; exit 1; }
[ -f "$ORIGEM" ] || { echo "Erro: $ORIGEM não encontrado." >&2; exit 1; }

mkdir -p "$CLAUDE_DIR"
[ -s "$SETTINGS" ] || echo '{}' > "$SETTINGS"

atual=$(jq -r '.statusLine.command // empty' "$SETTINGS")
tmp=$(mktemp)

if [ "$atual" = "$COMANDO" ]; then
  jq 'del(.statusLine)' "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"
  rm -f "$DESTINO"
  echo "Status line removida."
else
  cp "$ORIGEM" "$DESTINO"
  chmod +x "$DESTINO"
  jq --arg cmd "$COMANDO" '.statusLine = {type: "command", command: $cmd}' "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"
  echo "Status line habilitada: $DESTINO"
fi
