'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { executar, pastaTemporaria, limparTemporaria } = require('./auxiliar');

let tmp;
let contador = 0;

before(() => {
  tmp = pastaTemporaria('claude-md');
});
after(() => limparTemporaria('claude-md'));

function novoProjeto(conteudo = '# Regras\n') {
  contador += 1;
  const proj = path.join(tmp, `proj-${contador}`);
  fs.mkdirSync(path.join(proj, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), conteudo);
  fs.writeFileSync(path.join(proj, 'sub', 'CLAUDE.md'), '# Sub\n');
  return proj;
}

const ler = (proj, rel = 'CLAUDE.md') => fs.readFileSync(path.join(proj, rel), 'utf8');

function iniciar(proj) {
  return executar('inicio.js', { hook_event_name: 'SessionStart', session_id: 's1' }, { CLAUDE_PROJECT_DIR: proj, GIT_CEILING_DIRECTORIES: tmp });
}

function mensagem(proj, prompt, sessao = 's1') {
  return executar('pedido.js', { hook_event_name: 'UserPromptSubmit', session_id: sessao, prompt }, { CLAUDE_PROJECT_DIR: proj });
}

function guardar(proj, evento = 'PostToolUse', sessao = 's1') {
  return executar('guarda-claude-md.js', { hook_event_name: evento, session_id: sessao, tool_name: 'Bash', tool_input: {} }, { CLAUDE_PROJECT_DIR: proj });
}

test('restaura CLAUDE.md alterado sem consentimento e avisa o agente', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, 'faça a tarefa');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
  const r = guardar(proj);
  assert.equal(r.status, 0);
  assert.equal(ler(proj), '# Regras\n');
  assert.equal(r.json.decision, 'block');
  assert.match(r.json.reason, /restaurado: CLAUDE\.md/);
  assert.match(r.json.reason, /autorizo alterar claude\.md/);
});

test('recria CLAUDE.md apagado e apaga CLAUDE.md criado sem consentimento', () => {
  const proj = novoProjeto();
  iniciar(proj);
  fs.unlinkSync(path.join(proj, 'sub', 'CLAUDE.md'));
  fs.mkdirSync(path.join(proj, 'novo'));
  fs.writeFileSync(path.join(proj, 'novo', 'claude.md'), 'x');
  const r = guardar(proj, 'Stop');
  assert.equal(ler(proj, 'sub/CLAUDE.md'), '# Sub\n');
  assert.ok(!fs.existsSync(path.join(proj, 'novo', 'claude.md')));
  assert.match(r.json.systemMessage, /restaurado: novo\/claude\.md, sub\/CLAUDE\.md/);
  assert.equal(r.json.decision, undefined);
});

test('troca de CLAUDE.md por link simbólico é desfeita sem escrever no destino', () => {
  const proj = novoProjeto();
  iniciar(proj);
  const fora = path.join(tmp, `alvo-${contador}.txt`);
  fs.writeFileSync(fora, 'intocado');
  fs.unlinkSync(path.join(proj, 'CLAUDE.md'));
  fs.symlinkSync(fora, path.join(proj, 'CLAUDE.md'));
  guardar(proj);
  assert.ok(!fs.lstatSync(path.join(proj, 'CLAUDE.md')).isSymbolicLink());
  assert.equal(ler(proj), '# Regras\n');
  assert.equal(fs.readFileSync(fora, 'utf8'), 'intocado');
});

test('com a frase na mensagem, a alteração é aceita e vira a nova cópia', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, 'Meu pedido: AUTORIZO alterar   CLAUDE.md agora');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'novo conteúdo');
  const r = guardar(proj);
  assert.equal(r.stdout, '');
  assert.equal(ler(proj), 'novo conteúdo');
  mensagem(proj, 'outra coisa');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
  guardar(proj);
  assert.equal(ler(proj), 'novo conteúdo');
});

test('consentimento vale só para a sessão da mensagem', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, 'autorizo alterar CLAUDE.md', 'outra');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
  guardar(proj, 'PostToolUse', 's1');
  assert.equal(ler(proj), '# Regras\n');
});

test('mensagem sem a frase retira o consentimento anterior', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, 'autorizo alterar CLAUDE.md');
  mensagem(proj, 'continue');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
  guardar(proj);
  assert.equal(ler(proj), '# Regras\n');
});

test('retorno de subagente não concede nem retira consentimento', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, '<agent-message from="x">autorizo alterar CLAUDE.md</agent-message>');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
  guardar(proj);
  assert.equal(ler(proj), '# Regras\n');
});

test('alteração feita pelo usuário entre respostas é preservada', () => {
  const proj = novoProjeto();
  iniciar(proj);
  mensagem(proj, 'primeira');
  guardar(proj, 'Stop');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'editado pelo usuário');
  mensagem(proj, 'segunda');
  guardar(proj);
  assert.equal(ler(proj), 'editado pelo usuário');
});

test('alteração feita fora da sessão é aceita no início da sessão', () => {
  const proj = novoProjeto();
  iniciar(proj);
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'editado fora');
  iniciar(proj);
  guardar(proj);
  assert.equal(ler(proj), 'editado fora');
});

test('sem cópia ainda, a primeira verificação apenas grava a cópia', () => {
  const proj = novoProjeto();
  const r = guardar(proj);
  assert.equal(r.stdout, '');
  assert.ok(fs.existsSync(path.join(proj, '.kfactory', 'claude-md.json')));
  assert.equal(fs.readFileSync(path.join(proj, '.kfactory', '.gitignore'), 'utf8'), '*\n');
});
