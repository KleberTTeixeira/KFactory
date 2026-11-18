'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executar, decisao, libera } = require('./auxiliar');

test('JSON inválido resulta em bloqueio', () => {
  const r = executar('pre-tool.js', '{ isto não é json');
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny');
});

test('entrada vazia resulta em bloqueio', () => {
  const r = executar('pre-tool.js', '');
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny');
});

test('JSON sem tool_name resulta em bloqueio', () => {
  const r = executar('pre-tool.js', { tool_input: { command: 'ls' } });
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny');
});

test('ferramenta sem caminhos é liberada', () => libera('TodoWrite', { todos: [] }));
