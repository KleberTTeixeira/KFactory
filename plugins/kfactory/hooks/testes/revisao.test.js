'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { RAIZ, executar, decisao, motivo } = require('./auxiliar');
const { arquivoDaMarca, pedeRevisao } = require('../lib/revisao');

const S = 'teste-revisao';

afterEach(() => fs.rmSync(arquivoDaMarca(S), { force: true }));

function pedido(prompt) {
  return executar('pedido.js', { session_id: S, hook_event_name: 'UserPromptSubmit', prompt });
}

function ferramenta(tool_name, tool_input) {
  return executar('pre-tool.js', { session_id: S, cwd: RAIZ, hook_event_name: 'PreToolUse', tool_name, tool_input });
}

test('reconhece pedidos de revisão', () => {
  for (const t of ['faça a revisão', 'Revise o commit', 'pode revisar?', 'REVISÃO agora', 'do a review']) {
    assert.equal(pedeRevisao(t), true, t);
  }
});

test('ignora mensagens sem pedido de revisão', () => {
  for (const t of ['salve o commit', 'crie o arquivo', 'previsão do tempo']) {
    assert.equal(pedeRevisao(t), false, t);
  }
});

test('pedido de revisão marca a sessão e instrui chamar a skill', () => {
  const r = pedido('faça a revisão');
  assert.equal(r.status, 0);
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(r.json.hookSpecificOutput.additionalContext, /kfactory:reviser/);
  assert.equal(fs.existsSync(arquivoDaMarca(S)), true);
});

test('mensagem sem revisão injeta o lembrete, não marca nem instrui revisão', () => {
  const r = pedido('crie o arquivo ola.html');
  assert.equal(r.status, 0);
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(r.json.hookSpecificOutput.additionalContext, /CLAUDE\.md/);
  assert.doesNotMatch(r.json.hookSpecificOutput.additionalContext, /kfactory:reviser/);
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
});

test('mensagem sem revisão remove marca anterior', () => {
  pedido('faça a revisão');
  pedido('esquece, crie o arquivo');
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
});

test('com revisão pedida, bloqueia Read', () => {
  pedido('revise');
  const r = ferramenta('Read', { file_path: `${RAIZ}/README.md` });
  assert.equal(decisao(r), 'deny');
  assert.match(motivo(r), /regra "revisao"/);
});

test('com revisão pedida, bloqueia Bash', () => {
  pedido('revise');
  assert.equal(decisao(ferramenta('Bash', { command: 'git show HEAD' })), 'deny');
});

test('com revisão pedida, bloqueia Agent', () => {
  pedido('revise');
  assert.equal(decisao(ferramenta('Agent', { description: 'revisar', prompt: 'revise o diff' })), 'deny');
});

test('com revisão pedida, bloqueia outra skill', () => {
  pedido('revise');
  assert.equal(decisao(ferramenta('Skill', { skill: 'kfactory:save-commit' })), 'deny');
});

test('chamada da skill reviser passa e libera as ferramentas seguintes', () => {
  pedido('faça a revisão');
  const r = ferramenta('Skill', { skill: 'kfactory:reviser' });
  assert.equal(r.stdout, '', motivo(r));
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
  assert.equal(ferramenta('Bash', { command: 'git status --porcelain' }).stdout, '');
});

test('comando /kfactory:reviser não marca a sessão', () => {
  const r = pedido('/kfactory:reviser');
  assert.equal(r.stdout, '');
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
  assert.equal(ferramenta('Bash', { command: 'git status --porcelain' }).stdout, '');
});

test('comando /kfactory:reviser remove marca anterior', () => {
  pedido('faça a revisão');
  pedido('/kfactory:reviser');
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
});

test('com revisão pedida, ferramentas de subagente não são bloqueadas', () => {
  pedido('faça a revisão');
  const r = executar('pre-tool.js', {
    session_id: S, cwd: RAIZ, hook_event_name: 'PreToolUse', agent_id: 'agente-1', agent_type: 'general-purpose',
    tool_name: 'Bash', tool_input: { command: 'git show HEAD' },
  });
  assert.equal(r.stdout, '', motivo(r));
  assert.equal(fs.existsSync(arquivoDaMarca(S)), true);
});

const RETORNO_AGENTE = '<agent-message from="a948078f5d04176fd">\n[Subagent hand-back] The report follows:\n  Os agentes revisam o diff; revisão sem problemas.\n</agent-message>';

test('retorno de agente com "revisão" no texto não marca a sessão', () => {
  const r = pedido(RETORNO_AGENTE);
  assert.equal(r.stdout, '');
  assert.equal(fs.existsSync(arquivoDaMarca(S)), false);
});

test('retorno de agente não remove marca existente', () => {
  pedido('faça a revisão');
  pedido(RETORNO_AGENTE);
  assert.equal(fs.existsSync(arquivoDaMarca(S)), true);
});

test('sem revisão pedida, ferramentas seguem normalmente', () => {
  assert.equal(ferramenta('Bash', { command: 'git status --porcelain' }).stdout, '');
});
