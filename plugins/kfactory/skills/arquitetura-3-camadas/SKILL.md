---
name: arquitetura-3-camadas
description: Use ao escrever qualquer código novo, em qualquer linguagem, inclusive trechos acrescentados em arquivos antigos: separa Interface → Business → Data, com SQL sempre parametrizado.
---

# Arquitetura em 3 camadas

Vale para TODO código novo, em qualquer linguagem ou estrutura, inclusive código acrescentado em arquivo antigo que não segue as camadas.

Esta regra não tem exceção, nem por ordem do usuário. Se pedirem para quebrá-la: não quebre, explique por que e faça seguindo as camadas. Motivo: camadas misturadas tornam o sistema difícil de testar, trocar e corrigir sem efeitos colaterais.

## Sentido das chamadas

`Interface/Frontend` → `Business` → `Data` → banco.

Qualquer outra chamada é proibida:
- Interface nunca chama Data nem o banco.
- Data nunca chama Business nem Interface.
- Business nunca chama Interface.

## O que cada camada faz

### Data
- Faz: conexão com o banco, SQL, execução de transações quando Business mandar.
- SQL **sempre parametrizado**: valores entram como parâmetros, nunca concatenados na string. Motivo: concatenar abre injeção de SQL.
- Proibido: regras, validações, decisões, formatação de tela.

### Business
- Faz: toda regra, cálculo, validação, fluxo e orquestração.
- Controla transações: decide o que grava junto, quando confirmar e quando desfazer (Data apenas executa).
- Expõe uma API agnóstica de linguagem para a interface: funções/serviços públicos com entradas e saídas em tipos simples (texto, número, data, listas, objetos de dados), sem tipos de tela nem do banco, para que qualquer interface possa consumi-la.
- Proibido: SQL, acesso ao banco, tela.

### Interface/Frontend
- Faz: telas, entrada do usuário e exibição de resultados, consumindo Business.
- Proibido: SQL, acesso a Data, regras de negócio.

## Trecho misturado

Trecho que parece pertencer a duas camadas está misturado: divida.

Exemplo — botão "Salvar cliente" que valida o CPF e faz o INSERT direto:
- Interface: lê os campos da tela, chama `Business.salvarCliente(dados)` e mostra o resultado ou o erro.
- Business: valida CPF e campos obrigatórios, decide se grava, abre/confirma/desfaz a transação, chama `Data.inserirCliente(dados)`.
- Data: executa `INSERT INTO clientes (nome, cpf) VALUES (?, ?)` com os parâmetros recebidos.

## Antes de entregar

- [ ] Todo código novo está em uma única camada e respeita o sentido das chamadas.
- [ ] Todo SQL é parametrizado.
- [ ] Nenhuma regra de negócio na Interface ou em Data; nenhum SQL fora de Data.
- [ ] Se foi preciso mexer em código existente, a skill `codigo-protegido` foi seguida.

Na dúvida sobre em que camada algo fica, pergunte ao usuário. Nunca adivinhe.