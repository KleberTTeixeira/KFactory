---
name: reviser
description: Revisa os commits ainda sem push com agentes independentes, procurando bugs, problemas de segurança, descumprimento das regras dos CLAUDE.md e das proibições do CLAUDE.md global, e itens do texto do commit não realizados no código. Usar somente quando o usuário pedir a revisão, com qualquer frase de mesmo sentido. Nunca usar por iniciativa própria.
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git show:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git rev-list:*)
---

# Revisão dos commits sem push

Esta revisão lê e aponta problemas. Não corrija nada e não faça commit. O único arquivo que ela pode criar é o CLAUDE.md da raiz do projeto, no passo 3, e só quando ele não existir.

Regras para todos os agentes:
- Os revisores não recebem a conversa, nem opiniões ou explicações do agente principal. Cada agente recebe somente o que cada passo indica.
- Chame ferramentas somente quando necessário.
- Lance os agentes de um mesmo passo na mesma mensagem, para rodarem em paralelo, e espere o resultado de todos antes de seguir para o próximo passo. Não deixe agentes rodando enquanto continua: o retorno de um agente em segundo plano chega como mensagem e dispara o hook de pedido de revisão.

1. Rode `git status --porcelain`. Se houver alterações fora do commit, mostre a lista e pergunte com AskUserQuestion, com as opções: "Continuar só com o commit" ou "Parar". Se a resposta for Parar, encerre.

2. Defina o que revisar e colete:
   - Rode `git rev-parse --abbrev-ref @{u}`.
   - Se funcionar (ramo com remoto), revise só os commits sem push:
     - rode `git rev-list --count @{u}..HEAD`; se for 0, mostre "Não há commit sem push para revisar." e encerre;
     - hashes e primeiras linhas: `git log @{u}..HEAD --format='%h %s'`
     - texto: `git log @{u}..HEAD --format=%B`
     - arquivos: `git diff --stat @{u}...HEAD`
     - diff: `git diff @{u}...HEAD`
   - Se falhar (ramo sem remoto), revise o último commit:
     - hash e primeira linha: `git log -1 --format='%h %s'`
     - texto: `git log -1 --format=%B`
     - arquivos: `git show --stat --format= HEAD`
     - diff: `git show --format= HEAD`
   - Nos passos seguintes, "texto do commit" é o texto coletado aqui e "diff" é o diff coletado aqui.

3. Proibições do CLAUDE.md global:
   - O CLAUDE.md global do usuário (`~/.claude/CLAUDE.md`) já está carregado nesta sessão. Não tente ler o arquivo: ele fica fora do projeto e o hook bloqueia a leitura.
   - Monte a lista PROIBIÇÕES: copie dele, palavra por palavra, somente as linhas que proíbem algo. Não copie as demais linhas. Não reescreva, não resuma, não junte e não acrescente nada.
   - Se o CLAUDE.md global não estiver carregado ou não tiver proibições, PROIBIÇÕES fica vazia.
   - Se PROIBIÇÕES não estiver vazia e não existir `CLAUDE.md` na raiz do projeto: crie esse arquivo com a ferramenta Write, contendo o título `# Proibições (copiadas do CLAUDE.md global)`, uma linha em branco e as linhas de PROIBIÇÕES. Em seguida mostre ao usuário: "Aviso: o arquivo CLAUDE.md foi criado na raiz do projeto com as proibições copiadas do CLAUDE.md global. Revise o arquivo."
   - Se o `CLAUDE.md` da raiz já existir, não o altere.

4. Lance um agente haiku que devolva só os caminhos dos CLAUDE.md do projeto que se aplicam: o da raiz e os das pastas dos arquivos alterados e das pastas acima delas. Ele recebe a lista de arquivos do commit.

5. Lance em paralelo, com a ferramenta Agent, os agentes abaixo. Cada um recebe: o texto do commit, o diff, a lista de CLAUDE.md do projeto e a lista PROIBIÇÕES, identificada como "Proibições do CLAUDE.md global (valem para todos os arquivos)". Cada um devolve uma lista de problemas, com arquivo, linha, descrição e motivo (regra de CLAUDE.md, proibição global, bug, segurança ou item não realizado).
   - Agentes 1 e 2 (sonnet): conferem as regras dos CLAUDE.md do projeto e as PROIBIÇÕES. Um CLAUDE.md do projeto só vale para arquivos da mesma pasta ou de pastas abaixo dela. Citam a regra ou proibição exata descumprida. Se não houver nenhum CLAUDE.md no projeto e PROIBIÇÕES estiver vazia, não lance os agentes 1 e 2.
   - Agente 3 (opus): procura bugs evidentes só no diff, sem ler contexto extra.
   - Agente 4 (opus): procura problemas no código introduzido (segurança, lógica errada), só no código alterado.
   - Agente 5 (opus): para cada item do texto do commit, confere se o diff realiza o que o item diz. Aponta item não realizado ou realizado de forma diferente.

   Apontar só o que é certo:
   - código que não compila;
   - resultado errado para qualquer entrada;
   - regra ou proibição citável descumprida;
   - item do commit não realizado.

   Não apontar:
   - estilo;
   - sugestões;
   - problemas que já existiam antes do commit;
   - problemas que dependem de entradas específicas;
   - o que um linter pega.

   Se o diff for grande demais para um agente, divida os arquivos entre mais agentes do mesmo tipo.

6. Para cada problema, lance em paralelo um agente validador: opus para bug, segurança e item não realizado; sonnet para regra de CLAUDE.md ou proibição global. Ele recebe o texto do commit e o problema (e, se o problema for de proibição global, a lista PROIBIÇÕES), lê o código para confirmar e devolve "confirmado" ou "não confirmado".

7. Descarte os problemas não confirmados.

8. Mostre ao usuário, em português:
   - os commits revisados: hash e primeira linha de cada um;
   - para cada problema confirmado: arquivo:linha, descrição e motivo;
   - se o CLAUDE.md foi criado no passo 3, repita o aviso: "O arquivo CLAUDE.md foi criado na raiz do projeto com as proibições copiadas do CLAUDE.md global. Revise o arquivo."

   Se não houver problemas, mostre: "Nenhum problema encontrado. Conferidos: bugs, segurança, regras dos CLAUDE.md, proibições do CLAUDE.md global e itens do commit."
   Se os agentes 1 e 2 não foram lançados, troque o trecho das regras por: "regras dos CLAUDE.md não conferidas (não há CLAUDE.md nem proibições globais)".
