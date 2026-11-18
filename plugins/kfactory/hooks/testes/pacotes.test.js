'use strict';

const { test } = require('node:test');
const { pergunta, libera } = require('./auxiliar');

const R = 'pacotes';
const cmd = (command) => ({ command });

test('pergunta npm install <pacote>', () => pergunta(R, 'Bash', cmd('npm install lodash')));
test('pergunta npm i <pacote>', () => pergunta(R, 'Bash', cmd('npm i -D vitest')));
test('pergunta pnpm add', () => pergunta(R, 'Bash', cmd('pnpm add react')));
test('pergunta yarn add', () => pergunta(R, 'Bash', cmd('yarn add axios')));
test('pergunta npx', () => pergunta(R, 'Bash', cmd('npx create-vite app')));
test('pergunta pip install', () => pergunta(R, 'Bash', cmd('pip install requests')));
test('pergunta pip3 install', () => pergunta(R, 'Bash', cmd('pip3 install -r requisitos.txt')));
test('pergunta apt-get install', () => pergunta(R, 'Bash', cmd('apt-get install curl')));
test('pergunta apt install', () => pergunta(R, 'Bash', cmd('apt install jq')));
test('pergunta dotnet add package', () => pergunta(R, 'Bash', cmd('dotnet add package Serilog')));
test('pergunta cargo add', () => pergunta(R, 'Bash', cmd('cargo add serde')));
test('pergunta go get', () => pergunta(R, 'Bash', cmd('go get example.com/pacote')));

test('libera npm install sem pacote', () => libera('Bash', cmd('npm install')));
test('libera npm test', () => libera('Bash', cmd('npm test')));
test('libera yarn sem argumentos', () => libera('Bash', cmd('yarn')));
test('libera pip list', () => libera('Bash', cmd('pip list')));
test('libera cargo build', () => libera('Bash', cmd('cargo build')));
