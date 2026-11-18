'use strict';

const { test } = require('node:test');
const { bloqueia, libera } = require('./auxiliar');

const R = 'destrutivos';
const cmd = (command) => ({ command });

test('bloqueia rm -rf', () => bloqueia(R, 'Bash', cmd('rm -rf src')));
test('bloqueia rm -fr', () => bloqueia(R, 'Bash', cmd('rm -fr build')));
test('bloqueia rm -r -f', () => bloqueia(R, 'Bash', cmd('rm -r -f dist')));
test('bloqueia rm --recursive --force', () => bloqueia(R, 'Bash', cmd('rm --recursive --force dist')));
test('bloqueia rm -rf via find -exec', () => bloqueia(R, 'Bash', cmd('find . -name x -exec rm -rf {} \\;')));
test('bloqueia rm -rf via bash -c', () => bloqueia(R, 'Bash', cmd('bash -c "rm -rf src"')));
test('bloqueia git push --force', () => bloqueia(R, 'Bash', cmd('git push --force')));
test('bloqueia git push -f', () => bloqueia(R, 'Bash', cmd('git push -f origin main')));
test('bloqueia git push --force-with-lease', () => bloqueia(R, 'Bash', cmd('git push --force-with-lease origin main')));
test('bloqueia git reset --hard', () => bloqueia(R, 'Bash', cmd('git reset --hard HEAD~1')));
test('bloqueia git clean -fd', () => bloqueia(R, 'Bash', cmd('git clean -fd')));
test('bloqueia sudo', () => bloqueia(R, 'Bash', cmd('sudo ls')));
test('bloqueia su', () => bloqueia(R, 'Bash', cmd('su -c whoami')));
test('bloqueia chmod -R 777', () => bloqueia(R, 'Bash', cmd('chmod -R 777 .')));
test('bloqueia mkfs', () => bloqueia(R, 'Bash', cmd('mkfs.ext4 disco.img')));
test('bloqueia dd', () => bloqueia(R, 'Bash', cmd('dd if=a.img of=b.img')));

test('libera rm de arquivo', () => libera('Bash', cmd('rm arquivo.txt')));
test('libera rm -r sem -f', () => libera('Bash', cmd('rm -r build')));
test('libera git reset --soft', () => libera('Bash', cmd('git reset --soft HEAD~1')));
test('libera git clean -n', () => libera('Bash', cmd('git clean -n')));
test('libera chmod 644', () => libera('Bash', cmd('chmod 644 README.md')));
test('libera redirecionamento interno', () => libera('Bash', cmd('echo ok > saida.txt')));
