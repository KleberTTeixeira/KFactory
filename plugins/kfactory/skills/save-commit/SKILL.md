---
name: save-commit
description: Grava as alterações do projeto em commit. Usar somente quando o usuário pedir para fazer, salvar ou gravar o commit, com qualquer frase de mesmo sentido. Nunca usar por iniciativa própria.
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git rev-list:*), Bash(git add:*)
---

# Gravar commit

Siga os passos na ordem. Não pule nenhum.

1. Rode `git status --porcelain`. Se não houver alterações, informe "Não há alterações para gravar." e pare.

2. Defina o tipo do commit:
   - Rode `git rev-parse --verify HEAD`. Se falhar (repositório sem commits): NOVO.
   - Rode `git rev-parse --abbrev-ref @{u}`. Se falhar (ramo sem remoto): ALTERAR.
   - Senão, rode `git rev-list --count @{u}..HEAD`. Maior que 0: ALTERAR. Igual a 0: NOVO.

3. Monte o texto do commit a partir de `git diff HEAD` (ou `git diff` se não houver HEAD) e dos arquivos novos listados no `git status --porcelain`:
   - NOVO: primeira linha com resumo curto do que foi realizado; linha em branco; um item "- " para cada alteração realizada.
   - ALTERAR: pegue o texto atual com `git log -1 --format=%B`.
     - Copie todos os itens "- " existentes, palavra por palavra, sem mudar nem apagar nenhum, e acrescente ao final um item "- " para cada nova alteração.
     - Reescreva a primeira linha para resumir todos os itens, os antigos e os novos.
   - Cada item novo tem uma linha curta: o que mudou e em qual arquivo.
   - Escreva em português.
   - Nunca cite ferramentas de IA, assistentes ou quem escreveu o código.

4. Mostre ao usuário:
   - o tipo: "Commit novo" ou "Alteração do commit <hash curto>";
   - os arquivos que entrarão (saída do `git status --porcelain`);
   - o texto completo do commit.

   Pergunte com AskUserQuestion, com as opções: Sim, Não, Editar.
   - Não: pare sem gravar nada.
   - Editar: peça o texto ao usuário, use exatamente o texto dele e volte ao início do passo 4.
   - Sim: siga para o passo 5.

5. Grave:
   - `git add -A`
   - NOVO: `KFACTORY_SAVE_COMMIT=1 git commit -F - <<'EOF'` + texto aprovado + `EOF`
   - ALTERAR: `KFACTORY_SAVE_COMMIT=1 git commit --amend -F - <<'EOF'` + texto aprovado + `EOF`
   - Use exatamente o texto aprovado. O Claude Code mostrará o comando com o texto e pedirá a confirmação final do usuário. Se o usuário recusar, pare sem gravar.

6. Rode `git log -1 --stat` e informe o hash e os arquivos gravados.