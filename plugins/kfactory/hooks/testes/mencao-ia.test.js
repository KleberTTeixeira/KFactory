'use strict';

const { test, before, after } = require('node:test');
const fs = require('fs');
const path = require('path');
const { RAIZ, bloqueia, libera, pergunta, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const R = 'mencao-ia';
const cmd = (command) => ({ command });
let relMsgRuim;
let relMsgBoa;

before(() => {
  const tmp = pastaTemporaria('mencao-ia');
  fs.writeFileSync(path.join(tmp, 'ruim.txt'), 'Corrige rotina\n\nAI-Generated\n');
  fs.writeFileSync(path.join(tmp, 'boa.txt'), 'Corrige rotina de exportação\n');
  relMsgRuim = path.relative(RAIZ, path.join(tmp, 'ruim.txt'));
  relMsgBoa = path.relative(RAIZ, path.join(tmp, 'boa.txt'));
});
after(() => limparTemporaria('mencao-ia'));

test('bloqueia -m com "Claude"', () => bloqueia(R, 'Bash', cmd('git commit -m "Feito com Claude"')));
test('bloqueia -am seguido de -m com Co-Authored-By', () => bloqueia(R, 'Bash', cmd('git commit -am "Ajuste" -m "Co-Authored-By: Fulano"')));
test('bloqueia --message= com ANTHROPIC', () => bloqueia(R, 'Bash', cmd('git commit --message="via ANTHROPIC"')));
test('bloqueia mensagem por heredoc com "Generated with"', () => bloqueia(R, 'Bash', cmd(
  "git commit -m \"$(cat <<'EOF'\nAjusta testes\n\nGenerated with ferramenta\nEOF\n)\"",
)));
test('bloqueia -F com arquivo contendo ai-generated', () => bloqueia(R, 'Bash', cmd(`git commit -F ${relMsgRuim}`)));
test('bloqueia --file com arquivo contendo ai-generated', () => bloqueia(R, 'Bash', cmd(`git commit --file ${relMsgRuim}`)));

// Sem termo proibido, a mencao-ia não bloqueia; o commit marcado segue para a confirmação da regra "commit".
test('não bloqueia mensagem comum', () => pergunta('commit', 'Bash', cmd('KFACTORY_SAVE_COMMIT=1 git commit -m "Corrige bug de exportação"')));
test('não bloqueia -F com arquivo sem termos', () => pergunta('commit', 'Bash', cmd(`KFACTORY_SAVE_COMMIT=1 git commit -F ${relMsgBoa}`)));
test('libera termo fora de git commit', () => libera('Bash', cmd('git log --author=claude')));
test('libera echo com termo', () => libera('Bash', cmd('echo anthropic')));
