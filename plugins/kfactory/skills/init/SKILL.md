---
name: init
description: Grava no CLAUDE.md do projeto, depois do conteúdo do primeiro título de nível 1 (antes do primeiro subtítulo de nível 2, ou no final se não houver), o conteúdo do arquivo ContenteClaudeMd do plugin, entre marcadores, preservando o resto do arquivo; cria a pasta memory e o arquivo memory/00-index.md se não existirem; e, com o StatusLineGenerate.sh, configura a variável CLAUDE_CODE_FORK_SUBAGENT=0 no ~/.claude/settings.json. Só pode ser chamada pelo usuário com /kfactory:init.
disable-model-invocation: true
---

# Iniciar o projeto com o kfactory

Siga os passos na ordem. Não pule nenhum. Não altere nada além do descrito.

1. Leia com a ferramenta Read o arquivo `${CLAUDE_PLUGIN_ROOT}/modelos/ContenteClaudeMd`. Se a leitura falhar, informe o erro e pare.
   Chame de CONTEUDO o texto lido, sem as quebras de linha do final.

2. Monte o BLOCO, exatamente assim (se CONTEUDO estiver vazio, a linha do meio não existe):

   ```
   <!-- kfactory:inicio -->
   CONTEUDO
   
   <!-- kfactory:fim -->
   ```

   O BLOCO termina com uma quebra de linha depois de `<!-- kfactory:fim -->`.

3. Leia com a ferramenta Read o arquivo `CLAUDE.md` da raiz do projeto.
   - Se ele não existir: o NOVO texto é o BLOCO. Vá para o passo 6.
   - Se existir, conte as linhas que são exatamente `<!-- kfactory:inicio -->` e as que são exatamente `<!-- kfactory:fim -->`.
     - Nenhuma das duas: o RESTO é o arquivo inteiro, sem nenhuma mudança.
     - Exatamente uma de cada, com a de início antes da de fim: o RESTO é o arquivo sem as linhas de `<!-- kfactory:inicio -->` até `<!-- kfactory:fim -->` (inclusive). Se logo depois da linha de fim houver uma linha em branco, ela também sai. Todo o resto fica exatamente como está, palavra por palavra.
     - Qualquer outro caso (só um dos marcadores, marcadores repetidos ou fora de ordem): não altere nada, informe ao usuário o que foi encontrado e pare.

4. Procure no RESTO o MARCADOR: a primeira linha que é um título de nível 1, isto é, que começa com `# ` (um único `#` seguido de espaço). Linhas que começam com `##` ou mais não são o MARCADOR.
   - Se não houver MARCADOR: o NOVO texto é BLOCO + linha em branco + RESTO. Se o RESTO estiver vazio, o NOVO texto é só o BLOCO.
   - Se houver MARCADOR, procure no RESTO, nas linhas depois do MARCADOR, o SUBTITULO: a primeira linha que começa com `## ` (exatamente dois `#` seguidos de espaço). Outros títulos `# ` no caminho não interrompem a procura.
     - Se houver SUBTITULO:
       - ANTES é o RESTO do começo até a linha anterior ao SUBTITULO, sem as linhas em branco do final, terminando com uma quebra de linha.
       - DEPOIS é o RESTO a partir da linha do SUBTITULO, inclusive, até o fim.
       - O NOVO texto é: ANTES + linha em branco + BLOCO + linha em branco + DEPOIS.
     - Se não houver SUBTITULO:
       - ANTES é o RESTO inteiro, sem as linhas em branco do final, terminando com uma quebra de linha.
       - O NOVO texto é: ANTES + linha em branco + BLOCO.

5. O BLOCO nunca fica entre um título `#` e o conteúdo dele: entra depois desse conteúdo, logo antes do primeiro subtítulo `##`, ou no final do arquivo se não houver subtítulo `##`.

6. Se o NOVO texto for igual ao conteúdo atual do `CLAUDE.md`, informe que ele já está atualizado e não grave. Senão, grave o NOVO texto no `CLAUDE.md` da raiz do projeto com a ferramenta Write. Nunca use comando do Bash para alterar o `CLAUDE.md`.

7. Pasta `memory` e arquivo `memory/00-index.md`, na raiz do projeto:
   - Tente ler com a ferramenta Read o arquivo `memory/00-index.md` da raiz do projeto.
   - Se ele existir: não altere nada.
   - Se ele não existir: crie-o vazio com a ferramenta Write. A ferramenta Write cria também a pasta `memory` se ela não existir. Não altere nem apague nada que já exista dentro de `memory`.

8. Execute com a ferramenta Bash exatamente este comando, sem acrescentar nada:

   ```
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/StatusLineGenerate.sh"
   ```

   O script grava `"CLAUDE_CODE_FORK_SUBAGENT": "0"` no bloco `env` do `~/.claude/settings.json` (necessário para a skill `reviser`), preservando as outras chaves.
   Se falhar, informe o erro exatamente como saiu.

9. Verificação final do `CLAUDE.md`. Leia de novo com a ferramenta Read o `CLAUDE.md` da raiz do projeto e confira, sem alterar nada:
   - Existe exatamente uma linha `<!-- kfactory:inicio -->` e exatamente uma linha `<!-- kfactory:fim -->`, com a de início antes da de fim.
   - O texto entre essas duas linhas é exatamente o CONTEUDO.
   - Se houver MARCADOR (passo 4): o MARCADOR aparece antes da linha de início; antes da linha de início há exatamente uma linha em branco, precedida de uma linha que não é em branco.
     - Se houver SUBTITULO: depois da linha de fim há exatamente uma linha em branco, seguida do SUBTITULO.
     - Se não houver SUBTITULO: a linha de fim é a última linha do arquivo.
   - Se não houver MARCADOR: a linha de início é a primeira linha do arquivo.
   - O arquivo é exatamente igual ao NOVO texto.
   Se algum item falhar, informe ao usuário qual falhou e o que foi encontrado. Não tente corrigir.

10. Informe ao usuário, em poucas linhas: se o `CLAUDE.md` foi criado, atualizado ou já estava atualizado; se a pasta `memory` e o arquivo `memory/00-index.md` foram criados ou já existiam; o resultado da verificação final; o resultado do script da variável `CLAUDE_CODE_FORK_SUBAGENT`; e que a mudança no `~/.claude/settings.json` só vale depois de fechar e abrir o Claude Code.
