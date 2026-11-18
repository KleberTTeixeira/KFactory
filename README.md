# KFactory

Kit reutilizável de desenvolvimento para o Claude Code: regras de segurança, proteção dos arquivos `CLAUDE.md`, auditoria das ações, avisos na área de trabalho, revisão de commits e gravação de commits.

## Requisitos

- Claude Code
- `node` (os hooks são scripts Node.js)
- `bash` e `jq` (usados pelo comando `/kfactory:init`)
- `git`
- `notify-send` (opcional, para os avisos na área de trabalho)

## Instalação

No Claude Code, adicione o marketplace e instale o plugin:

```
/plugin marketplace add <pasta do KFactory ou endereço do repositório>
/plugin install kfactory@kfactory
```

## Primeiro uso em cada projeto

Abra o Claude Code na pasta do projeto e rode:

```
/kfactory:init
```

O comando:

1. Grava no `CLAUDE.md` da raiz do projeto o bloco de instruções do kfactory, entre as linhas `<!-- kfactory:inicio -->` e `<!-- kfactory:fim -->`:
   - se o arquivo tiver um título `#`, o bloco entra depois do conteúdo desse título, logo antes do primeiro subtítulo `##`; se não houver subtítulo `##`, entra no final do arquivo;
   - se o arquivo não tiver título `#`, o bloco entra no início;
   - se o arquivo não existir, é criado só com o bloco;
   - rodar de novo substitui o bloco anterior, sem mexer no resto do arquivo.
2. Cria a pasta `Vault` e o arquivo `Vault/Indice.md`, se não existirem.
3. Configura no `~/.claude/settings.json`:
   - a status line (usuário, máquina, pasta e total de tokens da sessão);
   - a variável `CLAUDE_CODE_FORK_SUBAGENT` com o valor `"0"`, no bloco `env`, para os agentes rodarem em primeiro plano (necessário para a revisão). Vale para todas as sessões e projetos do usuário.

Depois do comando, feche e abra o Claude Code para a mudança no `~/.claude/settings.json` valer.

## Comandos e skills

- `/kfactory:init`: prepara o projeto, como descrito acima. Só roda quando o usuário digita o comando.
- Revisão (`reviser`): peça a revisão com qualquer frase de mesmo sentido (por exemplo, "revise o commit"). Agentes independentes revisam os commits ainda sem push (ou o último commit, se o ramo não tiver remoto) procurando bugs, problemas de segurança, regras dos `CLAUDE.md` descumpridas, proibições do `CLAUDE.md` global descumpridas e itens do texto do commit não realizados. A revisão só aponta; não corrige nada.
- Commit (`save-commit`): peça para fazer, salvar ou gravar o commit. O texto do commit é montado a partir das alterações e mostrado para aprovação antes de gravar. Se o ramo tiver commits sem push, ou não tiver remoto, o último commit é alterado em vez de criar um novo.

## Proteções automáticas

Os hooks do plugin conferem cada ação do agente:

- **Fora do projeto**: bloqueia ler, escrever ou citar caminhos fora da pasta do projeto.
- **Comandos destrutivos**: bloqueia `sudo`, `su`, `rm -rf` e variações, `git push` forçado, `git reset --hard`, `git clean -f`, `chmod -R 777`, `mkfs`, `dd` e redirecionamentos que sobrescrevem arquivos fora do projeto.
- **Arquivos sensíveis**: bloqueia acesso a `.env` (exceto `.env.example`), chaves (`.pem`, `.key`, `.p12`, `.pfx`, `id_rsa`, `id_ed25519`) e arquivos com `secret` ou `credential` no nome.
- **Configuração**: bloqueia alterar as pastas `.claude`, `.claude-plugin`, `hooks` e `.kfactory`.
- **`CLAUDE.md`**: só pode ser alterado quando a mensagem do usuário contém a frase `autorizo alterar claude.md`, ou no comando `/kfactory:init`. Alterações feitas sem essa autorização são desfeitas automaticamente. Por comando do Bash, a alteração nunca é permitida.
- **Pacotes**: pede confirmação antes de instalar pacotes (`npm`, `pnpm`, `yarn`, `npx`, `pip`, `apt`, `dotnet add package`, `cargo add`, `go get`).
- **Commits**: o commit só pode ser gravado pela skill `save-commit`; `git push` é bloqueado (o push é feito só pelo usuário, no próprio terminal); `merge`, `cherry-pick`, `revert`, `am`, `rebase` e `pull` pedem confirmação.
- **Menção a IA**: bloqueia mensagens de commit com os termos `claude`, `anthropic`, `co-authored-by`, `generated with` ou `ai-generated`.
- **Revisão**: quando o usuário pede revisão, as ferramentas ficam bloqueadas até a skill `reviser` ser chamada.

## Outros recursos

- **Início da sessão**: informa ao agente a branch atual e os arquivos com alterações sem commit.
- **Auditoria**: cada ação do agente é registrada em `.kfactory/auditoria.log`, na pasta do projeto. A pasta `.kfactory` é ignorada pelo Git.
- **Avisos na área de trabalho**: com `notify-send`, avisa quando o Claude Code aguarda aprovação, aguarda o usuário ou conclui a tarefa.

## Licença

Este projeto está licenciado sob a [Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/). Veja o arquivo [LICENSE](LICENSE).
