'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOKS = path.resolve(__dirname, '..');
const RAIZ = path.resolve(HOOKS, '..', '..', '..');
const TMP = path.join(__dirname, '.tmp');

function executar(script, entrada, env = {}) {
  const texto = typeof entrada === 'string' ? entrada : JSON.stringify(entrada);
  const r = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input: texto,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: RAIZ, ...env },
  });
  let json = null;
  if (r.stdout.trim()) json = JSON.parse(r.stdout);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function preTool(tool_name, tool_input, extra = {}) {
  return executar('pre-tool.js', {
    session_id: 'teste',
    cwd: RAIZ,
    hook_event_name: 'PreToolUse',
    tool_name,
    tool_input,
    ...extra,
  });
}

function decisao(r) {
  return r.json && r.json.hookSpecificOutput ? r.json.hookSpecificOutput.permissionDecision : null;
}

function motivo(r) {
  return r.json && r.json.hookSpecificOutput ? r.json.hookSpecificOutput.permissionDecisionReason : '';
}

function bloqueia(regra, tool_name, tool_input) {
  const r = preTool(tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny', `esperava bloqueio: ${JSON.stringify(tool_input)}`);
  if (regra) assert.match(motivo(r), new RegExp(`regra "${regra}"`), motivo(r));
  return r;
}

function pergunta(regra, tool_name, tool_input) {
  const r = preTool(tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'ask', `esperava pedido de confirmação: ${JSON.stringify(tool_input)} — ${motivo(r)}`);
  assert.match(motivo(r), new RegExp(`regra "${regra}"`));
  return r;
}

function libera(tool_name, tool_input) {
  const r = preTool(tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', `esperava liberação: ${JSON.stringify(tool_input)} — ${motivo(r)}`);
  return r;
}

function pastaTemporaria(nome) {
  const p = path.join(TMP, nome);
  fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function limparTemporaria(nome) {
  fs.rmSync(path.join(TMP, nome), { recursive: true, force: true });
  try {
    fs.rmdirSync(TMP);
  } catch {
    // Outra suíte ainda usa a pasta.
  }
}

module.exports = {
  HOOKS, RAIZ, TMP, executar, preTool, decisao, motivo, bloqueia, pergunta, libera, pastaTemporaria, limparTemporaria,
};
