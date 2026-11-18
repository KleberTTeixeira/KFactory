'use strict';

const { test } = require('node:test');
const { bloqueia, pergunta, libera } = require('./auxiliar');

const R = 'commit';
const cmd = (command) => ({ command });
const M = 'KFACTORY_SAVE_COMMIT=1';

test('bloqueia commit sem marca com -m', () => bloqueia(R, 'Bash', cmd('git commit -m "Ajuste"')));
test('bloqueia commit sem marca com -F -', () => bloqueia(R, 'Bash', cmd("git commit -F - <<'EOF'\nAjuste\nEOF")));
test('bloqueia commit --amend sem marca', () => bloqueia(R, 'Bash', cmd('git commit --amend --no-edit')));
test('bloqueia commit sem marca após git add', () => bloqueia(R, 'Bash', cmd('git add -A && git commit -m "Ajuste"')));
test('bloqueia commit sem marca com -C', () => bloqueia(R, 'Bash', cmd('git -C . commit -m "Ajuste"')));
test('bloqueia commit sem marca via bash -c', () => bloqueia(R, 'Bash', cmd('bash -c "git commit -m Ajuste"')));
test('bloqueia marca em outro comando', () => bloqueia(R, 'Bash', cmd(`${M} true && git commit -m "Ajuste"`)));
test('bloqueia alias definido no comando', () => bloqueia(R, 'Bash', cmd('git -c alias.ci=commit ci -m "Ajuste"')));

test('pede confirmação de commit com marca', () => pergunta(R, 'Bash', cmd(`${M} git commit -F - <<'EOF'\nAjuste\nEOF`)));
test('pede confirmação de commit --amend com marca', () => pergunta(R, 'Bash', cmd(`${M} git commit --amend -F - <<'EOF'\nAjuste\n\n- item\nEOF`)));
test('pede confirmação de commit com marca via env', () => pergunta(R, 'Bash', cmd(`env ${M} git commit -m "Ajuste"`)));
test('pede confirmação de git merge', () => pergunta(R, 'Bash', cmd('git merge outra')));
test('pede confirmação de git cherry-pick', () => pergunta(R, 'Bash', cmd('git cherry-pick abc123')));
test('pede confirmação de git revert', () => pergunta(R, 'Bash', cmd('git revert HEAD')));
test('pede confirmação de git rebase', () => pergunta(R, 'Bash', cmd('git rebase master')));
test('pede confirmação de git pull', () => pergunta(R, 'Bash', cmd('git pull')));
test('pede confirmação de git am', () => pergunta(R, 'Bash', cmd('git am patch.mbox')));
test('pede confirmação de git commit-tree', () => pergunta(R, 'Bash', cmd('git commit-tree abc123 -m "x"')));

test('libera git status', () => libera('Bash', cmd('git status --porcelain')));
test('libera git log', () => libera('Bash', cmd('git log -1 --format=%B')));
test('libera git add', () => libera('Bash', cmd('git add -A')));
test('bloqueia git push', () => bloqueia(R, 'Bash', cmd('git push')));
test('bloqueia git push com remoto', () => bloqueia(R, 'Bash', cmd('git push origin master')));
test('bloqueia git push após commit', () => bloqueia(R, 'Bash', cmd(`${M} git commit -m "Ajuste" && git push`)));
test('bloqueia git push com -C', () => bloqueia(R, 'Bash', cmd('git -C . push')));
test('bloqueia git push via bash -c', () => bloqueia(R, 'Bash', cmd('bash -c "git push"')));
