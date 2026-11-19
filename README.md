# KFactory

![Licença CC BY-NC-SA 4.0](https://img.shields.io/badge/licen%C3%A7a-CC%20BY--NC--SA%204.0-lightgrey)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-4EAA25?logo=gnubash&logoColor=white)
![JSON](https://img.shields.io/badge/JSON-000000?logo=json&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?logo=git&logoColor=white)
![IA](https://img.shields.io/badge/desenvolvido%20com-IA-8A2BE2)

O **KFactory** é um plugin para o Claude Code que facilita e padroniza a criação de projetos dentro do [Kobsidian](https://kobsidian.com.br/).

Ao ser instalado, ele prepara cada projeto com uma estrutura de trabalho pronta e aplica, de forma automática, um conjunto de regras que tornam o uso do assistente mais seguro e previsível:

- **Estrutura do projeto**: cria o `Vault` com o índice de notas e grava no `CLAUDE.md` as instruções de trabalho do projeto.
- **Segurança**: impede ações fora da pasta do projeto, comandos destrutivos, acesso a arquivos sensíveis e alterações não autorizadas nos arquivos de configuração e no `CLAUDE.md`.
- **Rastreabilidade**: registra cada ação do agente em um log de auditoria.
- **Fluxo de commits**: revisa os commits pendentes e grava commits com texto montado a partir das alterações, sempre com aprovação do usuário.
- **Acompanhamento**: envia avisos na área de trabalho e oferece uma status line com modelo, nível de esforço e consumo de tokens.

---

## Requisitos

- Claude Code
- `node` (os hooks são scripts Node.js)
- `bash` e `jq` (usados pelos comandos `/kfactory:init` e `/kfactory:statusline`)
- `git`
- `notify-send` (opcional, para os avisos na área de trabalho; disponível apenas no Linux)

### Instalação das dependências

#### Windows

No PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install jqlang.jq
npm install -g @anthropic-ai/claude-code
```

O `bash` vem junto com o Git for Windows (Git Bash).

#### macOS

Com o [Homebrew](https://brew.sh/):

```bash
brew install node git jq
npm install -g @anthropic-ai/claude-code
```

O `bash` já vem instalado no sistema.

#### Linux

Debian / Ubuntu:

```bash
sudo apt install nodejs npm git jq libnotify-bin
```

Fedora:

```bash
sudo dnf install nodejs npm git jq libnotify
```

Arch:

```bash
sudo pacman -S nodejs npm git jq libnotify
```

Depois, em qualquer distribuição:

```bash
npm install -g @anthropic-ai/claude-code
```

O `notify-send` é instalado pelo pacote `libnotify-bin` (Debian/Ubuntu) ou `libnotify` (Fedora/Arch).

## Instalação

No Claude Code, adicione o marketplace e instale o plugin:

```
/plugin marketplace add https://github.com/KleberTTeixeira/KFactory
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
3. Configura no `~/.claude/settings.json` a variável `CLAUDE_CODE_FORK_SUBAGENT` com o valor `"0"`, no bloco `env`, para os agentes rodarem em primeiro plano (necessário para a revisão). Vale para todas as sessões e projetos do usuário.

Depois do comando, feche e abra o Claude Code para a mudança no `~/.claude/settings.json` valer.

## Comandos e skills

- `/kfactory:init`: prepara o projeto, como descrito acima. Só roda quando o usuário digita o comando.
- `/kfactory:statusline`: habilita a status line (modelo, nível de esforço e total de tokens da sessão) no `~/.claude/settings.json`; se ela já estiver habilitada, remove. Só roda quando o usuário digita o comando. Feche e abra o Claude Code para a mudança valer.
- Revisão (`reviser`): peça a revisão com qualquer frase de mesmo sentido (por exemplo, "revise o commit"). Agentes independentes revisam os commits ainda sem push (ou o último commit, se o ramo não tiver remoto) procurando bugs, problemas de segurança, regras dos `CLAUDE.md` descumpridas, proibições do `CLAUDE.md` global descumpridas e itens do texto do commit não realizados. A revisão só aponta; não corrige nada.
- Commit (`save-commit`): peça para fazer, salvar ou gravar o commit. O texto do commit é montado a partir das alterações e mostrado para aprovação antes de gravar. Se o ramo tiver commits sem push, ou não tiver remoto, o último commit é alterado em vez de criar um novo.

## Proteções automáticas

Os hooks do plugin conferem cada ação do agente:

- **Fora do projeto**: bloqueia ler, escrever ou citar caminhos fora da pasta do projeto, inclusive por variáveis, expansão de chaves (`{a,b}`) e valores que só existem na execução (`$(...)`, crases, `$'...'`); bloqueia alterar a variável `IFS`.
- **Efeito externo**: bloqueia código passado na própria linha a interpretadores (`python -c`, `node -e`, `perl -e`, `ruby -e`, `php -r` e semelhantes) ou pela entrada padrão, shell lendo comandos de pipe, `xargs`, `git config` global ou com chaves que executam programas, `git -c` com essas chaves, `tar -P`, e comandos de processos, serviços, agendamento e acesso remoto (`kill`, `pkill`, `crontab`, `systemctl`, `ssh`, `scp`, `mount`, `chroot` e semelhantes).
- **Comandos destrutivos**: bloqueia `sudo`, `su`, `rm -rf` e variações, `git push` forçado, `git reset --hard`, `git clean -f`, `chmod -R 777`, `mkfs`, `dd` e redirecionamentos que sobrescrevem arquivos fora do projeto.
- **Arquivos sensíveis**: bloqueia acesso a `.env` (exceto `.env.example`), chaves (`.pem`, `.key`, `.p12`, `.pfx`, `id_rsa`, `id_ed25519`) e arquivos com `secret` ou `credential` no nome.
- **Configuração**: bloqueia alterar as pastas `.claude`, `.claude-plugin`, `hooks`, `.kfactory` e `.git`.
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

Este projeto está licenciado sob a [Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/). 
Veja o arquivo [LICENSE](LICENSE).
