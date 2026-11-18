'use strict';

const { test } = require('node:test');
const path = require('path');
const { RAIZ, bloqueia, libera } = require('./auxiliar');

const R = 'segredos';
const arq = (nome) => ({ file_path: path.join(RAIZ, nome) });

test('bloqueia Read de .env', () => bloqueia(R, 'Read', arq('.env')));
test('bloqueia Read de .env.local', () => bloqueia(R, 'Read', arq('config/.env.local')));
test('bloqueia Edit de .pem', () => bloqueia(R, 'Edit', { ...arq('certs/server.pem'), old_string: 'a', new_string: 'b' }));
test('bloqueia Write de .key', () => bloqueia(R, 'Write', { ...arq('tls.key'), content: 'x' }));
test('bloqueia Read de .p12 e .pfx', () => {
  bloqueia(R, 'Read', arq('a.p12'));
  bloqueia(R, 'Read', arq('a.pfx'));
});
test('bloqueia Read de id_rsa e id_ed25519', () => {
  bloqueia(R, 'Read', arq('chaves/id_rsa'));
  bloqueia(R, 'Read', arq('chaves/id_ed25519.pub'));
});
test('bloqueia arquivo com secret/credential no nome', () => {
  bloqueia(R, 'Read', arq('client_secret.json'));
  bloqueia(R, 'Read', arq('aws-Credentials.txt'));
});
test('bloqueia cat .env', () => bloqueia(R, 'Bash', { command: 'cat .env' }));
test('bloqueia grep em .env.production', () => bloqueia(R, 'Bash', { command: 'grep API_KEY .env.production' }));
test('bloqueia tail com glob .env*', () => bloqueia(R, 'Bash', { command: 'tail -n 5 .env*' }));
test('bloqueia Grep com glob de .env', () => bloqueia(R, 'Grep', { pattern: 'KEY', glob: '.env*' }));
test('bloqueia Glob por arquivos .pem', () => bloqueia(R, 'Glob', { pattern: '**/*.pem' }));

test('libera Read de .env.example', () => libera('Read', arq('.env.example')));
test('libera cat .env.example', () => libera('Bash', { command: 'cat .env.example' }));
test('libera Read de arquivo comum', () => libera('Read', arq('README.md')));
test('libera Grep com glob comum', () => libera('Grep', { pattern: 'KEY', glob: '*.js' }));
test('libera grep de padrão com a palavra secret', () => libera('Bash', { command: 'grep -r secret src' }));
test('libera Glob comum', () => libera('Glob', { pattern: '**/*.json' }));
