'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HOOKS, executar, decisao, motivo, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const PLUGIN = path.resolve(HOOKS, '..');
const MODELO = path.join(PLUGIN, 'modelos', 'ContenteClaudeMd');
const SCRIPT = path.join(PLUGIN, 'scripts', 'StatusLineGenerate.sh');

let tmp;
let contador = 0;

before(() => {
  tmp = pastaTemporaria('init');
});
after(() => limparTemporaria('init'));

function novoProjeto() {
  contador += 1;
  const proj = path.join(tmp, `proj-${contador}`);
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), '# Regras\n');
  executar('inicio.js', { hook_event_name: 'SessionStart', session_id: 's1' }, { CLAUDE_PROJECT_DIR: proj, GIT_CEILING_DIRECTORIES: tmp });
  return proj;
}

function mensagem(proj, prompt) {
  return executar('pedido.js', { hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt }, { CLAUDE_PROJECT_DIR: proj });
}

function preTool(proj, tool_name, tool_input, env = {}) {
  return executar('pre-tool.js', {
    session_id: 's1', cwd: proj, hook_event_name: 'PreToolUse', tool_name, tool_input,
  }, { CLAUDE_PROJECT_DIR: proj, ...env });
}

function liberado(r) {
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', motivo(r));
}

function bloqueado(r) {
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny', 'esperava bloqueio');
  assert.match(motivo(r), /regra "fora-projeto"/);
}

test('/kfactory:init concede o consentimento para alterar CLAUDE.md', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'novo');
  const r = executar('guarda-claude-md.js', { hook_event_name: 'PostToolUse', session_id: 's1' }, { CLAUDE_PROJECT_DIR: proj });
  assert.equal(r.stdout, '');
  assert.equal(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8'), 'novo');
});

test('texto que só cita /kfactory:init não concede consentimento', () => {
  for (const prompt of ['rode o /kfactory:init', '/kfactory:initx', '/init']) {
    const proj = novoProjeto();
    mensagem(proj, prompt);
    fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'adulterado');
    executar('guarda-claude-md.js', { hook_event_name: 'PostToolUse', session_id: 's1' }, { CLAUDE_PROJECT_DIR: proj });
    assert.equal(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8'), '# Regras\n', prompt);
  }
});

test('com consentimento, libera ler o ContenteClaudeMd do plugin', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  liberado(preTool(proj, 'Read', { file_path: MODELO }));
});

test('com consentimento, libera só "bash <script da status line>"', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  liberado(preTool(proj, 'Bash', { command: `bash "${SCRIPT}"` }));
  liberado(preTool(proj, 'Bash', { command: `bash ${SCRIPT}` }));
});

test('sem consentimento, continua bloqueando o arquivo e o script do plugin', () => {
  const proj = novoProjeto();
  mensagem(proj, 'faça a tarefa');
  bloqueado(preTool(proj, 'Read', { file_path: MODELO }));
  bloqueado(preTool(proj, 'Bash', { command: `bash "${SCRIPT}"` }));
});

test('com consentimento, bloqueia qualquer variação do comando', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  const variacoes = [
    `bash "${SCRIPT}"; cat /etc/hostname`,
    `bash "${SCRIPT}" && cat /etc/hostname`,
    `bash "${SCRIPT}" /etc/hostname`,
    `bash "${SCRIPT}" > /tmp/saida`,
    `sh "${SCRIPT}"`,
    `bash -c "cat /etc/hostname" "${SCRIPT}"`,
    `X=1 bash "${SCRIPT}"`,
    `cat "${SCRIPT}"`,
    `cp /etc/hostname "${SCRIPT}"`,
    `bash "${path.join(PLUGIN, '.claude-plugin', 'plugin.json')}"`,
  ];
  for (const command of variacoes) bloqueado(preTool(proj, 'Bash', { command }));
});

test('com consentimento, bloqueia ler ou escrever outros arquivos fora do projeto', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  bloqueado(preTool(proj, 'Read', { file_path: path.join(PLUGIN, '.claude-plugin', 'plugin.json') }));
  bloqueado(preTool(proj, 'Read', { file_path: '/etc/hostname' }));
  bloqueado(preTool(proj, 'Write', { file_path: MODELO, content: 'x' }));
  bloqueado(preTool(proj, 'Edit', { file_path: SCRIPT, old_string: 'a', new_string: 'b' }));
});

test('link simbólico no lugar do arquivo do plugin não é aceito', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:init');
  const falso = path.join(tmp, `plugin-falso-${contador}`);
  fs.mkdirSync(path.join(falso, 'modelos'), { recursive: true });
  fs.symlinkSync('/etc/hostname', path.join(falso, 'modelos', 'ContenteClaudeMd'));
  bloqueado(preTool(proj, 'Read', { file_path: path.join(falso, 'modelos', 'ContenteClaudeMd') }, { CLAUDE_PLUGIN_ROOT: falso }));
});
