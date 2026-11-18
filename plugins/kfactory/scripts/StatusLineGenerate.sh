#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SCRIPT="$CLAUDE_DIR/statusline-command.sh"
SETTINGS="$CLAUDE_DIR/settings.json"

command -v jq >/dev/null 2>&1 || { echo "Erro: jq não está instalado." >&2; exit 1; }

mkdir -p "$CLAUDE_DIR"

cat > "$SCRIPT" <<'EOF'
#!/usr/bin/env bash
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd')
cwd="${cwd/#$HOME/~}"
transcript=$(echo "$input" | jq -r '.transcript_path // empty')
tokens=0
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  tokens=$(jq -s '
    [ .[] | select(.message.usage != null and .message.id != null) ]
    | group_by(.message.id)
    | map(.[-1].message.usage
          | (.input_tokens // 0) + (.output_tokens // 0)
            + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))
    | add // 0' "$transcript" 2>/dev/null)
  [ -z "$tokens" ] && tokens=0
fi
printf '\033[01;32m%s@%s\033[00m:\033[01;34m%s\033[00m | tokens: %s' "$(whoami)" "$(hostname -s)" "$cwd" "$tokens"
EOF
chmod +x "$SCRIPT"

[ -s "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp=$(mktemp)
jq --arg cmd "bash $SCRIPT" '
  .statusLine = {type: "command", command: $cmd}
  | .env = ((.env // {}) + {CLAUDE_CODE_FORK_SUBAGENT: "0"})
' "$SETTINGS" > "$tmp"
mv "$tmp" "$SETTINGS"

echo "Status line configurada: $SCRIPT"
echo "Agentes em primeiro plano configurados: CLAUDE_CODE_FORK_SUBAGENT=0 em $SETTINGS (vale para sessões novas)"
