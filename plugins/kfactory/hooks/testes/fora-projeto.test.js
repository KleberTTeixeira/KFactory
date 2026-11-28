'use strict';

const { test, before, after } = require('node:test');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { RAIZ, executar, decisao, motivo, bloqueia, libera, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const R = 'fora-projeto';
let tmp;

before(() => {
  tmp = pastaTemporaria('fora-projeto');
  fs.symlinkSync(path.dirname(RAIZ), path.join(tmp, 'link-externo'));
  fs.mkdirSync(path.join(tmp, 'interno'));
  fs.symlinkSync(path.join(tmp, 'interno'), path.join(tmp, 'link-interno'));
  fs.symlinkSync('/etc', path.join(tmp, 'link-etc'));
  fs.mkdirSync(path.join(tmp, 'falso'));
  fs.symlinkSync('/bin/sh', path.join(tmp, 'falso', 'maestri'));
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

// Acesso fora do projeto, intencional ou não. Cada comando só passa pelo hook; nada é executado.
// Basta o bloqueio por qualquer regra do hook.
const BLOQUEADOS_BASH = {
  'caminhos absolutos': ['cat /etc/passwd', 'ls /home'],
  'til e HOME': ['cat ~/.bashrc', 'cat ~root/x', 'cat $HOME/x', 'cat ${HOME}/x'],
  'subida de diretório': ['cat ../x', 'cat ./a/../../x', 'cd .. && ls'],
  'substituição de comando e execução indireta': [
    'cat $(echo /etc)/passwd',
    'cat `echo /etc`/passwd',
    'eval "cat /etc/passwd"',
    'bash -c "cat /etc/passwd"',
    'sh -c "cat /etc/passwd"',
    'echo /etc/passwd | xargs cat',
  ],
  'caminho ofuscado': [
    "cat \"$(printf '\\x2fetc\\x2fpasswd')\"",
    "cat $(printf '\\057etc\\057passwd')",
    "printf '\\x2fetc\\x2fpasswd' | xargs cat",
    'echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh',
    'cat /e*/pas*',
    'cat {/etc,x}/passwd',
  ],
  interpretadores: [
    `python3 -c "print(open('/etc/passwd').read())"`,
    `python3 -c "open('/'+'etc/passwd')"`,
    `node -e "require('fs').readFileSync('/etc/passwd')"`,
    `perl -e 'open(F,"/etc/passwd")'`,
  ],
  'redirecionamentos e cópias para fora': ['echo x > /tmp/a', 'cp a /tmp/', 'echo x | tee /tmp/a', 'mv a ~/'],
  'links simbólicos': ['ln -s /etc link && cat link/passwd'],
  'mudanças de ambiente': [
    'export PATH=/tmp:$PATH',
    'export PATH=/tmp',
    "alias ls='cat /etc/passwd'",
    'source ~/.bashrc',
    '. ~/.profile',
  ],
  'abusos da exceção do MAESTRI_CLI': [
    'MAESTRI_CLI=/bin/sh "$MAESTRI_CLI"',
    'export MAESTRI_CLI=/bin/sh; "$MAESTRI_CLI"',
    'cat "$MAESTRI_CLI"',
    'eval "$MAESTRI_CLI"',
    '"$MAESTRI_CLI" ask X ~/.bashrc',
    '"$MAESTRI_CLI" list; cat /etc/passwd',
    '"$MAESTRI_CLI" list && cat ~/.bashrc',
    '"$MAESTRI_CLI" list | sh',
  ],
  'git e find fora do projeto': ['git -C /home status', 'find / -name x'],
};

for (const [grupo, comandos] of Object.entries(BLOQUEADOS_BASH)) {
  for (const command of comandos) {
    test(`bloqueia (${grupo}): ${command}`, () => bloqueia(null, 'Bash', { command }));
  }
}

test('bloqueia (links simbólicos): leitura por link existente que aponta para /etc', () =>
  bloqueia(R, 'Bash', { command: `cat ${path.relative(RAIZ, path.join(tmp, 'link-etc', 'passwd'))}` }));

test('bloqueia (abusos da exceção do MAESTRI_CLI): variável do ambiente aponta para "maestri" que é link para /bin/sh', () => {
  const r = executar('pre-tool.js', {
    session_id: 'teste',
    cwd: RAIZ,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: '"$MAESTRI_CLI" list' },
  }, { MAESTRI_CLI: path.join(tmp, 'falso', 'maestri') });
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny', motivo(r));
  assert.match(motivo(r), /regra "fora-projeto"/);
});

const BLOQUEADOS_FERRAMENTAS = [
  ['Read', { file_path: '/etc/passwd' }],
  ['Write', { file_path: '/tmp/a', content: 'x' }],
  ['Edit', { file_path: '/etc/hosts', old_string: 'a', new_string: 'b' }],
  ['Glob', { pattern: '/etc/*' }],
  ['Glob', { pattern: '*', path: '/etc' }],
  ['Grep', { pattern: 'x', path: '/etc' }],
  ['Grep', { pattern: 'x', path: '~' }],
];

for (const [ferramenta, entrada] of BLOQUEADOS_FERRAMENTAS) {
  test(`bloqueia ${ferramenta} fora do projeto: ${JSON.stringify(entrada)}`, () => bloqueia(R, ferramenta, entrada));
}

test('bloqueia Read por link existente que aponta para /etc', () =>
  bloqueia(R, 'Read', { file_path: path.join(tmp, 'link-etc', 'passwd') }));

const LIBERADOS_BASH = [
  'ls plugins/kfactory',
  'cat README.md',
  'git status',
  'grep -rn x plugins',
  '"$MAESTRI_CLI" list',
  '"$MAESTRI_CLI" ask "Lince" "teste"',
];

for (const command of LIBERADOS_BASH) {
  test(`libera: ${command}`, () => libera('Bash', { command }));
}
