#!/usr/bin/env bash
input=$(cat)
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "?"')
effort=$(echo "$input" | jq -r '.effort.level // "?"')
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
tokens_fmt=$(echo "$tokens" | sed ':a;s/\B[0-9]\{3\}\>/.&/;ta')
printf '[%s]-%s | Tokens %s' "$model" "$effort" "$tokens_fmt"
