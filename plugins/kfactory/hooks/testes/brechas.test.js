'use strict';

// Tentativas de ler, executar ou alterar algo fora da raiz do projeto.
// Todas precisam ser bloqueadas (deny) por alguma regra.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preTool, decisao, motivo } = require('./auxiliar');

function negado(tool_name, tool_input) {
  const r = preTool(tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny', `esperava bloqueio: ${JSON.stringify(tool_input)} — ${motivo(r)}`);
}

const COMANDOS = [
  // Variáveis e expansões
  'D=/etc; cat $D/passwd',
  'a=.; cat $a$a/x',
  'cat $PWD/../x',
  'cat "${PWD}/../x"',
  'cat $OLDPWD/x',
  'cat $TMPDIR/x',
  'cat ${HOME:-x}/.bashrc',
  'cat $\'\\x2fetc/passwd\'',
  'cat $\'\\057etc/passwd\'',
  'cat {/etc/passwd,x}',
  'cat x{/../..,}/y',
  'cat "$(dirname "$PWD")/x"',
  'cat `dirname $PWD`/x',
  'cat $(echo L2V0Yy9wYXNzd2Q= | base64 -d)',
  'cat $(printf "\\x2fetc\\x2fpasswd")',
  'cat $(rev <<< dwssap/cte/)',
  'p=$(pwd); cat ${p%/*}/x',
  'cd "$(dirname "$PWD")" && ls',
  'cd $OLDPWD',
  'cd ${PWD%/*}',
  'pushd ..',
  'cd -',
  'IFS=x; c=catx/etc/passwd; $c',
  // Interpretadores com código na linha
  'python3 -c "open(\'/etc/passwd\').read()"',
  'python3 -c "import os; os.chdir(\'..\'); print(os.listdir())"',
  'python -c "print(open(\'../x\').read())"',
  'node -e "require(\'fs\').readFileSync(\'/etc/passwd\')"',
  'node -e "process.chdir(\'..\')"',
  'node --eval "require(\'fs\').writeFileSync(\'/tmp/x\',\'1\')"',
  'node -p "require(\'os\').homedir()"',
  'ruby -e "File.read(\'/etc/passwd\')"',
  'php -r "echo file_get_contents(\'/etc/passwd\');"',
  'perl -e \'open F, "<", "/etc/passwd"\'',
  'python3 - <<EOF\nopen("/etc/passwd")\nEOF',
  'node <<EOF\nrequire("fs").readFileSync("/etc/passwd")\nEOF',
  'bash -c \'cat /etc/passwd\'',
  'sh <<< "cat /etc/passwd"',
  'echo "cat /etc/passwd" | bash',
  'echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh',
  'source <(echo cat /etc/passwd)',
  // Configurações e serviços fora do projeto
  'git config --global user.name x',
  'git config --system core.editor x',
  'git config core.fsmonitor "cat /etc/passwd"',
  'git config core.hooksPath /tmp',
  'git -c core.fsmonitor=x status',
  'crontab -r',
  'crontab -l',
  'echo "* * * * * x" | crontab -',
  'systemctl --user stop x',
  'npm config set prefix /tmp',
  'kill -9 1',
  'pkill node',
  'killall node',
  'ssh host ls',
  'scp a host:b',
  // Arquivos compactados e cópias que saem do projeto
  'tar xf a.tar -C ..',
  'tar -xPf a.tar',
  'tar --absolute-names -xf a.tar',
  'unzip a.zip -d ..',
  'ln -s .. up',
  'ln -s $(echo ..) up',
  'ln -s "$PWD/.." up',
  'cp -r . ..',
  'mv x ..',
  'docker run -v /:/h alpine',
  'mount --bind / x',
  'chroot / ls',
  'curl -o ../x https://exemplo',
  'wget -P .. https://exemplo',
  'wget -O ~/x https://exemplo',
  // Escrita em arquivos executados pelo git ou pelo shell
  'echo x > .git/hooks/pre-commit',
  'cp x .git/hooks/pre-commit',
  'echo "[core] fsmonitor = x" >> .git/config',
];

for (const command of COMANDOS) {
  test(`Bash bloqueado: ${command.replace(/\n/g, '\\n')}`, () => negado('Bash', { command }));
}

test('Write em .git/hooks é bloqueado', () => negado('Write', { file_path: '.git/hooks/pre-commit', content: '#!/bin/sh\ncat /etc/passwd\n' }));
test('Write em .git/config é bloqueado', () => negado('Write', { file_path: '.git/config', content: '[core]\nfsmonitor = x\n' }));
test('Edit em .git/config é bloqueado', () => negado('Edit', { file_path: '.git/config', old_string: 'a', new_string: 'b' }));
test('Read com caminho relativo que sai do projeto', () => negado('Read', { file_path: 'a/../../x' }));
test('Glob com path externo', () => negado('Glob', { pattern: '*', path: '..' }));
test('Grep com path "~"', () => negado('Grep', { pattern: 'x', path: '~' }));
test('ferramenta desconhecida com caminho relativo que sai', () => negado('Outra', { alvo: '../x' }));

// Uso comum dentro do projeto continua liberado.
const { libera } = require('./auxiliar');

const LIBERADOS = [
  'git tag -a v1 -m "$(cat <<\'EOF\'\nVersão 1\nEOF\n)"',
  'for f in README.md LICENSE; do cat "$f"; done',
  'mkdir -p plugins/x/{a,b}',
  'X=plugins; ls $X/kfactory',
  'ls "$PWD/plugins"',
  'echo "$PATH"',
  'echo $(date)',
  'node plugins/kfactory/hooks/pre-tool.js < /dev/null',
  'python3 -m pytest',
  'npm test',
  'git config user.name x',
  'git config --get user.name',
  'git config --list',
  'tar xf a.tar',
  'bash plugins/kfactory/scripts/StatusLineGenerate.sh',
  'bash <<EOF\nls\nEOF',
  'git log --oneline -5',
  'ls 2>/dev/null',
];

for (const command of LIBERADOS) {
  test(`Bash liberado: ${command.replace(/\n/g, '\\n')}`, () => libera('Bash', { command }));
}
