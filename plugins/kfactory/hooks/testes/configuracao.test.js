'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { RAIZ, bloqueia, libera, executar, decisao, motivo, pastaTemporaria, limparTemporaria } = require('./auxiliar');

const R = 'configuracao';
const p = (rel) => path.join(RAIZ, rel);
const cmd = (command) => ({ command });

test('bloqueia Write em .claude/', () => bloqueia(R, 'Write', { file_path: p('.claude/settings.json'), content: '{}' }));
test('bloqueia Edit de CLAUDE.md sem consentimento', () => bloqueia(R, 'Edit', { file_path: p('CLAUDE.md'), old_string: 'a', new_string: 'b' }));
test('bloqueia Write em pasta hooks/', () => bloqueia(R, 'Write', { file_path: p('plugins/kfactory/hooks/novo.js'), content: '' }));
test('bloqueia Edit de plugin.json', () => bloqueia(R, 'Edit', { file_path: p('plugins/kfactory/.claude-plugin/plugin.json'), old_string: 'a', new_string: 'b' }));
test('bloqueia sed -i em CLAUDE.md', () => bloqueia(R, 'Bash', cmd("sed -i 's/a/b/' CLAUDE.md")));
test('bloqueia rm em .claude/', () => bloqueia(R, 'Bash', cmd('rm .claude/settings.local.json')));
test('bloqueia mv de .claude', () => bloqueia(R, 'Bash', cmd('mv .claude copia')));
test('bloqueia cp para .claude/', () => bloqueia(R, 'Bash', cmd('cp a.json .claude/settings.json')));
test('bloqueia redirecionamento para hooks.json', () => bloqueia(R, 'Bash', cmd('echo {} > plugins/kfactory/hooks/hooks.json')));

test('libera Read de CLAUDE.md', () => libera('Read', { file_path: p('CLAUDE.md') }));
test('libera cat CLAUDE.md', () => libera('Bash', cmd('cat CLAUDE.md')));
test('libera cp a partir de .claude/', () => libera('Bash', cmd('cp .claude/settings.json copia.json')));
test('libera sed sem -i em CLAUDE.md', () => libera('Bash', cmd("sed 's/a/b/' CLAUDE.md")));
test('libera Write em skills/', () => libera('Write', { file_path: p('plugins/kfactory/skills/nova/SKILL.md'), content: 'x' }));

// Exceção do CLAUDE.md dentro do projeto, em projetos temporários.
let semClaude;
let comClaude;

before(() => {
  const base = pastaTemporaria('configuracao');
  semClaude = path.join(base, 'sem');
  comClaude = path.join(base, 'com');
  fs.mkdirSync(semClaude);
  fs.mkdirSync(comClaude);
  fs.writeFileSync(path.join(comClaude, 'CLAUDE.md'), '# Regras\n');
});
after(() => limparTemporaria('configuracao'));

function noProjeto(projeto, tool_name, tool_input) {
  return executar('pre-tool.js', {
    session_id: 'teste', cwd: projeto, hook_event_name: 'PreToolUse', tool_name, tool_input,
  }, { CLAUDE_PROJECT_DIR: projeto });
}

function bloqueiaNo(projeto, tool_name, tool_input) {
  const r = noProjeto(projeto, tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(decisao(r), 'deny', `esperava bloqueio: ${JSON.stringify(tool_input)}`);
  assert.match(motivo(r), new RegExp(`regra "${R}"`), motivo(r));
}

function liberaNo(projeto, tool_name, tool_input) {
  const r = noProjeto(projeto, tool_name, tool_input);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', `esperava liberação: ${JSON.stringify(tool_input)} — ${motivo(r)}`);
}

function consentir(projeto) {
  fs.mkdirSync(path.join(projeto, '.kfactory'), { recursive: true });
  fs.writeFileSync(path.join(projeto, '.kfactory', 'consentimento-claude-md-teste'), '1');
}

function retirar(projeto) {
  fs.rmSync(path.join(projeto, '.kfactory', 'consentimento-claude-md-teste'), { force: true });
}

test('bloqueia Write criando CLAUDE.md na raiz sem consentimento', () => bloqueiaNo(semClaude, 'Write', { file_path: path.join(semClaude, 'CLAUDE.md'), content: 'x' }));
test('bloqueia Edit de CLAUDE.md da raiz sem consentimento', () => bloqueiaNo(comClaude, 'Edit', { file_path: path.join(comClaude, 'CLAUDE.md'), old_string: 'a', new_string: 'b' }));
test('bloqueia Write de CLAUDE.md em subpasta sem consentimento', () => bloqueiaNo(semClaude, 'Write', { file_path: path.join(semClaude, 'src', 'CLAUDE.md'), content: 'x' }));
test('consentimento de outra sessão não vale', () => {
  fs.mkdirSync(path.join(comClaude, '.kfactory'), { recursive: true });
  fs.writeFileSync(path.join(comClaude, '.kfactory', 'consentimento-claude-md-outra'), '1');
  bloqueiaNo(comClaude, 'Edit', { file_path: path.join(comClaude, 'CLAUDE.md'), old_string: 'a', new_string: 'b' });
});

test('com consentimento libera Write criando CLAUDE.md na raiz', () => {
  consentir(semClaude);
  liberaNo(semClaude, 'Write', { file_path: path.join(semClaude, 'CLAUDE.md'), content: 'x' });
  retirar(semClaude);
});
test('com consentimento libera Edit de CLAUDE.md da raiz', () => {
  consentir(comClaude);
  liberaNo(comClaude, 'Edit', { file_path: path.join(comClaude, 'CLAUDE.md'), old_string: 'a', new_string: 'b' });
  retirar(comClaude);
});
test('com consentimento libera Write de CLAUDE.md em subpasta', () => {
  consentir(semClaude);
  liberaNo(semClaude, 'Write', { file_path: path.join(semClaude, 'src', 'CLAUDE.md'), content: 'x' });
  retirar(semClaude);
});
test('com consentimento continua bloqueando por Bash', () => {
  consentir(comClaude);
  bloqueiaNo(comClaude, 'Bash', { command: 'echo x > CLAUDE.md' });
  bloqueiaNo(comClaude, 'Bash', { command: "sed -i 's/a/b/' CLAUDE.md" });
  retirar(comClaude);
});
test('bloqueia Write de claude.md minúsculo na raiz', () => bloqueiaNo(semClaude, 'Write', { file_path: path.join(semClaude, 'claude.md'), content: 'x' }));
test('bloqueia criação de CLAUDE.md por redirecionamento', () => bloqueiaNo(semClaude, 'Bash', { command: 'echo x > CLAUDE.md' }));

// Comandos do Bash que citam CLAUDE.md ou os arquivos da proteção.
const BASH_BLOQUEADOS = [
  "python3 -c \"open('CLAUDE.md','w').write('x')\"",
  "node -e \"require('fs').writeFileSync('CLAUDE.md','x')\"",
  'git checkout -- CLAUDE.md',
  'git restore CLAUDE.md',
  'git -C . checkout CLAUDE.md',
  "sed 'w CLAUDE.md' a.txt",
  "sed -f roteiro.sed CLAUDE.md",
  'cat a.txt | tee CLAUDE.md',
  'ls | xargs cat CLAUDE.md',
  "bash -c 'cat CLAUDE.md'",
  'f=CLAUDE.md; cp a.txt "$f"',
  'rm .kfactory/claude-md.json',
  "python3 -c \"open('.kfactory/consentimento-claude-md-x','w')\"",
  "echo '{}' | node plugins/kfactory/hooks/pedido.js",
  'node plugins/kfactory/hooks/guarda-claude-md.js',
];
for (const c of BASH_BLOQUEADOS) {
  test(`bloqueia Bash: ${c}`, () => bloqueia(R, 'Bash', cmd(c)));
}

const BASH_LIBERADOS = [
  'grep -n regra CLAUDE.md',
  'head -20 CLAUDE.md',
  'wc -l CLAUDE.md',
  'cat CLAUDE.md > copia.txt',
  'git diff -- CLAUDE.md',
  'git log --oneline -- CLAUDE.md',
  'git add CLAUDE.md',
  'cat .kfactory/auditoria.log',
  'ls -la .kfactory',
];
for (const c of BASH_LIBERADOS) {
  test(`libera Bash: ${c}`, () => libera('Bash', cmd(c)));
}

test('bloqueia Bash: dd of=CLAUDE.md (por qualquer regra)', () => bloqueia(null, 'Bash', cmd('dd if=/dev/null of=CLAUDE.md')));
test('bloqueia Bash: cat com redirecionamento para alvo variável', () => bloqueia(R, 'Bash', cmd('cat CLAUDE.md > "$alvo"')));

test('bloqueia Write em .kfactory/', () => bloqueia(R, 'Write', { file_path: p('.kfactory/consentimento-claude-md-teste'), content: '1' }));
