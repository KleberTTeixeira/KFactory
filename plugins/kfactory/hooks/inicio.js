'use strict';

const { spawnSync } = require('child_process');
const { lerEntradaPadrao } = require('./lib/comum');
const { atualizarCopia } = require('./lib/claude-md');

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 });
}

function montarContexto(pasta) {
  const repo = git(['rev-parse', '--is-inside-work-tree'], pasta);
  if (repo.error && repo.error.code === 'ENOENT') return 'O Git não está instalado; não foi possível verificar o repositório.';
  if (repo.error || repo.status !== 0 || repo.stdout.trim() !== 'true') return 'A pasta do projeto não é um repositório Git.';

  const frases = [];
  const ramo = git(['branch', '--show-current'], pasta);
  const nomeRamo = ramo.status === 0 ? ramo.stdout.trim() : '';
  frases.push(nomeRamo ? `Branch atual: ${nomeRamo}.` : 'O repositório não está em nenhuma branch (HEAD destacado).');

  const estado = git(['status', '--porcelain'], pasta);
  if (estado.status !== 0) {
    frases.push('Não foi possível obter a lista de alterações (git status falhou).');
  } else {
    const arquivos = estado.stdout.split('\n').filter((l) => l.trim()).map((l) => l.slice(3));
    frases.push(arquivos.length
      ? `Arquivos com alterações sem commit (${arquivos.length}): ${arquivos.join(', ')}.`
      : 'Não há alterações pendentes.');
  }
  return frases.join('\n');
}

function principal() {
  let entrada = {};
  try {
    entrada = JSON.parse(lerEntradaPadrao()) || {};
  } catch {
    entrada = {};
  }
  const pasta = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
  let contexto;
  try {
    contexto = montarContexto(pasta);
  } catch (erro) {
    contexto = `Não foi possível verificar o repositório Git (${erro.message}).`;
  }
  // Alterações em CLAUDE.md feitas fora da sessão são do usuário: viram a nova cópia de segurança.
  try {
    atualizarCopia(pasta);
  } catch (erro) {
    contexto += `\nNão foi possível guardar a cópia dos CLAUDE.md (${erro.message}).`;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto },
  }));
}

principal();
process.exitCode = 0;
