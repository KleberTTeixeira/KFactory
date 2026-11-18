'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { executar, pastaTemporaria, limparTemporaria } = require('./auxiliar');

let tmp;

before(() => {
  tmp = pastaTemporaria('outros-hooks');
});
after(() => limparTemporaria('outros-hooks'));

test('auditoria grava linha com data, ferramenta e caminho, sem conteúdo', () => {
  const proj = path.join(tmp, 'proj');
  fs.mkdirSync(proj);
  const r = executar('auditoria.js', {
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: path.join(proj, 'a.txt'), content: 'CONTEUDO-SIGILOSO' },
    tool_response: {},
  }, { CLAUDE_PROJECT_DIR: proj });
  assert.equal(r.status, 0);
  const log = fs.readFileSync(path.join(proj, '.kfactory', 'auditoria.log'), 'utf8');
  const [data, ferramenta, detalhe] = log.trim().split('\t');
  assert.match(data, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(ferramenta, 'Write');
  assert.equal(detalhe, path.join(proj, 'a.txt'));
  assert.ok(!log.includes('CONTEUDO-SIGILOSO'));
  assert.equal(fs.readFileSync(path.join(proj, '.kfactory', '.gitignore'), 'utf8'), '*\n');
});

test('auditoria grava comando do Bash', () => {
  const proj = path.join(tmp, 'proj-bash');
  fs.mkdirSync(proj);
  executar('auditoria.js', { tool_name: 'Bash', tool_input: { command: 'ls -la' } }, { CLAUDE_PROJECT_DIR: proj });
  const log = fs.readFileSync(path.join(proj, '.kfactory', 'auditoria.log'), 'utf8');
  assert.match(log, /\tBash\tls -la\n$/);
});

test('auditoria não falha quando não consegue gravar', () => {
  const arquivo = path.join(tmp, 'nao-e-pasta');
  fs.writeFileSync(arquivo, '');
  const r = executar('auditoria.js', { tool_name: 'Read', tool_input: { file_path: 'x' } }, { CLAUDE_PROJECT_DIR: arquivo });
  assert.equal(r.status, 0);
});

function prepararNotifySend() {
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const registro = path.join(tmp, 'notificacoes.txt');
  const script = path.join(bin, 'notify-send');
  fs.writeFileSync(script, `#!${process.execPath}\nrequire('fs').appendFileSync(${JSON.stringify(registro)}, process.argv.slice(2).join('|') + '\\n');\n`);
  fs.chmodSync(script, 0o755);
  return { bin, registro };
}

test('aviso envia as mensagens corretas', () => {
  const { bin, registro } = prepararNotifySend();
  const env = { PATH: bin };
  executar('aviso.js', { hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'x' }, env);
  executar('aviso.js', { hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'x' }, env);
  executar('aviso.js', { hook_event_name: 'Stop', stop_hook_active: false }, env);
  const linhas = fs.readFileSync(registro, 'utf8').trim().split('\n');
  assert.deepEqual(linhas, [
    'KFactory|Aguardando sua aprovação',
    'KFactory|Aguardando você',
    'KFactory|Tarefa concluída',
  ]);
});

test('aviso termina com código 0 sem notify-send', () => {
  const vazia = path.join(tmp, 'sem-bin');
  fs.mkdirSync(vazia, { recursive: true });
  const r = executar('aviso.js', { hook_event_name: 'Stop' }, { PATH: vazia });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

function contexto(r) {
  return r.json.hookSpecificOutput.additionalContext;
}

test('inicio informa branch e arquivos pendentes', () => {
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  spawnSync('git', ['init', '-q', '-b', 'principal'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'novo.txt'), 'x');
  const r = executar('inicio.js', { hook_event_name: 'SessionStart', source: 'startup' }, { CLAUDE_PROJECT_DIR: repo });
  assert.equal(r.status, 0);
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(contexto(r), /Branch atual: principal\./);
  assert.match(contexto(r), /novo\.txt/);
});

test('inicio informa quando não há alterações', () => {
  const repo = path.join(tmp, 'repo-limpo');
  fs.mkdirSync(repo);
  spawnSync('git', ['init', '-q', '-b', 'principal'], { cwd: repo });
  const r = executar('inicio.js', { hook_event_name: 'SessionStart' }, { CLAUDE_PROJECT_DIR: repo });
  assert.match(contexto(r), /Não há alterações pendentes\./);
});

test('inicio informa quando a pasta não é repositório Git', () => {
  const pasta = path.join(tmp, 'sem-git');
  fs.mkdirSync(pasta);
  const r = executar('inicio.js', { hook_event_name: 'SessionStart' }, { CLAUDE_PROJECT_DIR: pasta, GIT_CEILING_DIRECTORIES: tmp });
  assert.equal(contexto(r), 'A pasta do projeto não é um repositório Git.');
});
