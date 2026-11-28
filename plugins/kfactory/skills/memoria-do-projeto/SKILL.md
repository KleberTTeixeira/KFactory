---
name: memoria-do-projeto
description: Use ao ler ou gravar contexto do projeto (decisões, convenções, comandos, bugs, preferências, tarefas e perguntas em aberto) na pasta memory/, seguindo hubs, notas e links.
---

# Memória do projeto

Leia e grave memórias SOMENTE em `memory/` (raiz do projeto). Nunca use auto memory nem `~/.claude`. Nunca grave segredos (senhas, tokens, chaves).

## Hubs

Arquivos em `memory/` (crie se faltar). Hubs contêm SOMENTE linhas `- [[Nota]]: resumo de 1 linha`, nunca conteúdo.

| Hub | Conteúdo |
|---|---|
| `00-index.md` | links para os hubs abaixo |
| `01-context.md` | objetivo, arquitetura, stack, módulos |
| `02-decisions.md` | decisões técnicas + motivo |
| `03-conventions.md` | padrões de código, nomes, pastas |
| `04-commands.md` | comandos de build, teste, lint, deploy |
| `05-bugs.md` | bug, causa raiz, correção |
| `06-user-prefs.md` | correções e preferências do usuário |
| `07-questions.md` | perguntas em aberto |
| `08-pending.md` | pendências  em aberto ou ações postergadas |
| `99-todo.md` | tarefas em aberto (só tarefas) |

Cada fato vai para o hub do seu tipo. Ex.: decisão mencionada numa tarefa ⇒ nota em 02 + linha `Related`.

## Notas

- Local: `memory/<hub>/<Nota>.md`, onde `<hub>` é o nome do hub sem `.md` (ex.: `memory/02-decisions/Login.md`). Plano, sem subpastas (sub-hubs também ficam ali).
- Nome do arquivo = título do link, único em todo `memory/`. Nome já usado ⇒ acrescente o tipo (`Auth bugs`).
- Uma nota = um módulo/entidade (`Users`, `Payments`, `Login`); as funcionalidades são entradas dentro dela.
- Antes de criar, procure no hub a nota desse módulo/entidade e acrescente nela.
- O nome cobre o assunto inteiro, não só as entradas atuais. Se não cobrir, renomeie e corrija os links.
- Não crie nota sem fatos.
- Cada nota é linkada por exatamente um hub.

### Entrada

```
### AAAA-MM-DD Título
- o quê
- por quê
- onde
```

1 a 3 bullets curtos. Sempre acrescente; se o fato já existe, atualize em vez de duplicar.

### Relacionamento

Linha `Related: [[A]], [[B]]` nas DUAS notas ligadas.

### Divisão

Quando as entradas de uma nota formam sub-assuntos que seriam buscados separadamente, mova cada um para sua própria nota (`Login 2FA`). A nota pai fica só com os [[links]] (vira sub-hub).

## Ler

`00-index` → hub → só as notas cujo resumo combina com a tarefa → [[links]] só se relevantes.

Navegue só por [[links]]. Nunca liste, use glob ou leia pastas inteiras. `grep` só para corrigir links ao renomear ou apagar.

## Gravar

- Grave imediatamente quando surgir um fato do tema de algum hub.
- Nota nova ⇒ link no hub no mesmo passo.
- O código prevalece sobre a memória: se uma nota estiver desatualizada, corrija.

## Tarefas concluídas

Mova os fatos duradouros para o hub certo e apague a entrada da tarefa. Nota vazia ⇒ apague a nota e todos os links para ela.

## Perguntas em aberto (07-questions)

- Só quando necessário: pergunta em aberto com mais de uma resposta possível ⇒ nota própria com alternativas, prós/contras e fontes.
- Perguntas ficam SÓ em 07-questions, nunca em 99-todo (99-todo é só tarefas).
- Respondida: grave a resposta no hub do seu tipo (ex.: 02-decisions, decisão + motivo) com `Related: [[pergunta]]`, depois apague a nota da pergunta e o link dela.

Antes de encerrar uma rodada de perguntas, verifique:
- [ ] Toda pergunta respondida virou entrada de hub com `Related`, e a nota dela em 07-questions foi apagada.
- [ ] Nenhuma pergunta em aberto fora de 07-questions.
- [ ] Qualquer erro encontrado foi informado ao usuário antes de terminar.