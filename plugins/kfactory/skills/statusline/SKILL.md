---
name: statusline
description: Habilita a status line do kfactory (modelo, nível de esforço e total de tokens da sessão) no ~/.claude/settings.json; se ela já estiver habilitada, remove. Só pode ser chamada pelo usuário com /kfactory:statusline.
disable-model-invocation: true
---

# Habilitar ou remover a status line

1. Execute com a ferramenta Bash exatamente este comando, sem acrescentar nada:

   ```
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/StatusLineToggle.sh"
   ```

   Se a status line do kfactory não estiver configurada, o script copia `statusline-command.sh` do plugin para `~/.claude/statusline-command.sh` e grava a chave `statusLine` no `~/.claude/settings.json`. Se já estiver configurada, remove a chave `statusLine` e o arquivo `~/.claude/statusline-command.sh`. As outras chaves do `settings.json` são preservadas.

2. Informe ao usuário a saída do script. Se falhar, informe o erro exatamente como saiu.
