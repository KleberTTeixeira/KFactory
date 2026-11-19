'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HOOKS, executar, decisao, motivo, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const PLUGIN = path.resolve(HOOKS, '..');
const SCRIPT = path.join(PLUGIN, 'scripts', 'StatusLineToggle.sh');
const SCRIPT_INIT = path.join(PLUGIN, 'scripts', 'StatusLineGenerate.sh');

let tmp;
let contador = 0;

before(() => {
  tmp = pastaTemporaria('statusline');
});
after(() => limparTemporaria('statusline'));

function novoProjeto() {
  contador += 1;
  const proj = path.join(tmp, `proj-${contador}`);
  fs.mkdirSync(proj, { recursive: true });
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

test('/kfactory:statusline libera só "bash <script de alternância>"', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:statusline');
  liberado(preTool(proj, 'Bash', { command: `bash "${SCRIPT}"` }));
  liberado(preTool(proj, 'Bash', { command: `bash ${SCRIPT}` }));
});

test('sem o comando, continua bloqueando o script', () => {
  for (const prompt of ['faça a tarefa', 'rode o /kfactory:statusline', '/kfactory:statuslinex']) {
    const proj = novoProjeto();
    mensagem(proj, prompt);
    bloqueado(preTool(proj, 'Bash', { command: `bash "${SCRIPT}"` }));
  }
});

test('o pedido vale só para a mensagem do comando', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:statusline');
  mensagem(proj, 'outra coisa');
  bloqueado(preTool(proj, 'Bash', { command: `bash "${SCRIPT}"` }));
});

test('com o comando, bloqueia qualquer variação e outros arquivos do plugin', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:statusline');
  const variacoes = [
    `bash "${SCRIPT}"; cat /etc/hostname`,
    `bash "${SCRIPT}" && cat /etc/hostname`,
    `bash "${SCRIPT}" /etc/hostname`,
    `bash "${SCRIPT}" > /tmp/saida`,
    `sh "${SCRIPT}"`,
    `X=1 bash "${SCRIPT}"`,
    `cat "${SCRIPT}"`,
    `bash "${SCRIPT_INIT}"`,
  ];
  for (const command of variacoes) bloqueado(preTool(proj, 'Bash', { command }));
  bloqueado(preTool(proj, 'Read', { file_path: SCRIPT }));
});

test('link simbólico no lugar do script do plugin não é aceito', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:statusline');
  const falso = path.join(tmp, `plugin-falso-${contador}`);
  fs.mkdirSync(path.join(falso, 'scripts'), { recursive: true });
  fs.symlinkSync('/etc/hostname', path.join(falso, 'scripts', 'StatusLineToggle.sh'));
  bloqueado(preTool(proj, 'Bash', { command: `bash "${path.join(falso, 'scripts', 'StatusLineToggle.sh')}"` }, { CLAUDE_PLUGIN_ROOT: falso }));
});

test('/kfactory:statusline aceita o caminho escrito com ${CLAUDE_PLUGIN_ROOT}', () => {
  const proj = novoProjeto();
  mensagem(proj, '/kfactory:statusline');
  liberado(preTool(proj, 'Bash', { command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/StatusLineToggle.sh"' }, { CLAUDE_PLUGIN_ROOT: PLUGIN }));
  bloqueado(preTool(proj, 'Bash', { command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/StatusLineToggle.sh"' }, { CLAUDE_PLUGIN_ROOT: '' }));
});
