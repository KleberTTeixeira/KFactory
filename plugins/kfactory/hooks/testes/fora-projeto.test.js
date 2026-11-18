'use strict';

const { test, before, after } = require('node:test');
const fs = require('fs');
const path = require('path');
const { RAIZ, bloqueia, libera, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const R = 'fora-projeto';
let tmp;

before(() => {
  tmp = pastaTemporaria('fora-projeto');
  fs.symlinkSync(path.dirname(RAIZ), path.join(tmp, 'link-externo'));
  fs.mkdirSync(path.join(tmp, 'interno'));
  fs.symlinkSync(path.join(tmp, 'interno'), path.join(tmp, 'link-interno'));
});
after(() => limparTemporaria('fora-projeto'));

test('bloqueia Read de caminho absoluto externo', () => bloqueia(R, 'Read', { file_path: '/etc/passwd' }));
test('bloqueia Read com ".." saindo do projeto', () => bloqueia(R, 'Read', { file_path: path.join(RAIZ, '..', 'outro', 'a.txt') }));
test('bloqueia Write por link simbólico que aponta para fora', () => bloqueia(R, 'Write', { file_path: path.join(tmp, 'link-externo', 'x.txt'), content: 'x' }));
test('bloqueia Bash com "~"', () => bloqueia(R, 'Bash', { command: 'cat ~/.bashrc' }));
test('bloqueia Bash com "../"', () => bloqueia(R, 'Bash', { command: 'ls ../' }));
test('bloqueia Bash "cd .."', () => bloqueia(R, 'Bash', { command: 'cd .. && ls' }));
test('bloqueia Bash em substituição de comando', () => bloqueia(R, 'Bash', { command: 'echo "$(cat /etc/hostname)"' }));
test('bloqueia Glob com pattern absoluto externo', () => bloqueia(R, 'Glob', { pattern: '/etc/**/*.conf' }));
test('bloqueia Glob com pattern iniciado por ~', () => bloqueia(R, 'Glob', { pattern: '~/**/*.js' }));
test('bloqueia Grep com glob iniciado por ..', () => bloqueia(R, 'Grep', { pattern: 'x', glob: '../**/*.js' }));
test('bloqueia Grep com path externo', () => bloqueia(R, 'Grep', { pattern: 'x', path: '/var/log' }));
test('bloqueia ferramenta não documentada com caminho externo', () => bloqueia(R, 'NotebookEdit', { notebook: '/tmp/a.ipynb', new_source: 'print(1)' }));

test('libera Read dentro do projeto', () => libera('Read', { file_path: path.join(RAIZ, 'README.md') }));
test('libera Read por link simbólico interno', () => libera('Read', { file_path: path.join(tmp, 'link-interno', 'a.txt') }));
test('libera Bash com caminho relativo interno', () => libera('Bash', { command: 'ls plugins/kfactory' }));
test('libera redirecionamento para /dev/null', () => libera('Bash', { command: 'ls 2>/dev/null' }));
test('libera Glob com pattern relativo', () => libera('Glob', { pattern: '**/*.js' }));
test('libera Grep com path e glob internos', () => libera('Grep', { pattern: 'x', path: path.join(RAIZ, 'plugins'), glob: '*.js' }));
test('libera sed cujo script começa com "/"', () => libera('Bash', { command: "sed -n '/^#/p' README.md" }));
