'use strict';

const path = require('path');
const {
  resolverCaminho,
  dentroDoProjeto,
  caminhosDaFerramenta,
  comandoEfetivo,
  argumentosDeArquivo,
  valoresDaPalavra,
  alvoDeRedirecionamento,
  redirecionaEscrita,
} = require('../lib/comum');
const { separarPrograma, analisarSed } = require('../lib/programas');
const { FRASE, temConsentimento } = require('../lib/claude-md');

const nome = 'configuracao';

const FERRAMENTAS_EDICAO = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

function protegido(valor, ctx) {
  const abs = resolverCaminho(valor, ctx);
  const rel = dentroDoProjeto(abs, ctx) ? path.relative(ctx.projeto, abs) : abs;
  const partes = rel.split(path.sep).filter(Boolean);
  const base = partes.length ? partes[partes.length - 1] : '';
  if (base.toLowerCase() === 'claude.md') return true;
  return partes.some((p) => p === '.claude' || p === 'hooks' || p === '.claude-plugin' || p === '.kfactory' || p === '.git');
}

function semOpcoes(args) {
  const saida = [];
  let fim = false;
  for (const a of args) {
    if (!fim && a === '--') {
      fim = true;
      continue;
    }
    if (!fim && a.startsWith('-') && a !== '-') continue;
    saida.push(a);
  }
  return saida;
}

function edicaoNoLugar(ef) {
  return ef.args.some((a) => a === '--in-place' || a.startsWith('--in-place=') || /^-[a-zA-Z]*i/.test(a) && !a.startsWith('--'));
}

const MODIFICAM_TODOS = new Set(['rm', 'rmdir', 'unlink', 'mv', 'touch', 'truncate', 'tee', 'shred', 'chmod', 'chown']);

function alvosModificados(ef) {
  if (MODIFICAM_TODOS.has(ef.nome)) return semOpcoes(ef.args);
  if (ef.nome === 'cp' || ef.nome === 'ln' || ef.nome === 'install' || ef.nome === 'rsync') {
    const idxT = ef.args.findIndex((a) => a === '-t' || a === '--target-directory');
    if (idxT >= 0 && ef.args[idxT + 1]) return [ef.args[idxT + 1]];
    const direto = ef.args.find((a) => a.startsWith('--target-directory='));
    if (direto) return [direto.slice('--target-directory='.length)];
    const pos = semOpcoes(ef.args);
    return pos.length ? [pos[pos.length - 1]] : [];
  }
  if ((ef.nome === 'sed' || ef.nome === 'perl') && edicaoNoLugar(ef)) {
    return semOpcoes(argumentosDeArquivo(ef));
  }
  return [];
}

const FERRAMENTAS_DA_EXCECAO = new Set(['Write', 'Edit', 'MultiEdit']);

// Única exceção: criar ou editar, com as ferramentas de edição, um arquivo chamado CLAUDE.md
// dentro do projeto, e somente se a mensagem atual do usuário contém a frase de consentimento.
// Por comando do Bash continua sempre bloqueado.
function claudeMdDoProjeto(entrada, valor, ctx) {
  if (!FERRAMENTAS_DA_EXCECAO.has(entrada.tool_name)) return false;
  const abs = resolverCaminho(valor, ctx);
  return dentroDoProjeto(abs, ctx) && abs !== ctx.projeto && path.basename(abs) === 'CLAUDE.md';
}

const SEM_CONSENTIMENTO = `alterar CLAUDE.md exige o consentimento do usuário: a mensagem dele precisa conter a frase "${FRASE}". Não tente alterar por outro meio.`;

// Comandos que não alteram arquivos (desde que não haja redirecionamento de escrita).
const SO_LEITURA = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'rg', 'wc', 'diff', 'cmp', 'ls',
  'stat', 'file', 'sha1sum', 'sha256sum', 'sha512sum', 'md5sum', 'echo', 'printf', 'true', 'false',
  'test', '[', '[[', 'basename', 'dirname', 'realpath', 'readlink', 'sort', 'uniq', 'cut', 'tr', 'nl',
  'column', 'hexdump', 'od', 'cd', 'pwd',
]);
const GIT_SO_LEITURA = new Set([
  'status', 'diff', 'log', 'show', 'blame', 'ls-files', 'grep', 'add', 'commit', 'rev-parse', 'branch',
]);
const MENCAO_PROTEGIDA = /claude\.md|\.kfactory|guarda-claude-md|claude-md\.js|pedido\.js/i;

function sedSoLeitura(ef) {
  if (edicaoNoLugar(ef)) return false;
  if (ef.args.some((a) => a === '-f' || a.startsWith('--file') || /^-[a-zA-Z]*f/.test(a) && !a.startsWith('--'))) return false;
  const separado = separarPrograma(ef);
  if (!separado) return false;
  return separado.programas.every((p) => {
    const r = analisarSed(p);
    return !r.caminhos.length && !r.execucao;
  });
}

function segmentoSoLeitura(seg, ctx) {
  for (const r of seg.redirecionamentos) {
    if (!redirecionaEscrita(r)) continue;
    const alvo = alvoDeRedirecionamento(r);
    if (alvo === null || /[$`]/.test(alvo) || MENCAO_PROTEGIDA.test(alvo) || protegido(alvo, ctx)) return false;
  }
  const ef = comandoEfetivo(seg.palavras);
  if (!ef) return true;
  if (ef.cadeia.some((n) => n === 'xargs' || n === 'exec' || n === 'sudo' || n === 'doas')) return false;
  if (!ef.nome) return true;
  if (SO_LEITURA.has(ef.nome)) return true;
  if (ef.nome === 'sed') return sedSoLeitura(ef);
  if (ef.nome === 'git') {
    const sub = ef.args.find((a) => !a.startsWith('-'));
    return ef.args.every((a) => a !== '-C' && !a.startsWith('--git-dir') && !a.startsWith('--work-tree') && !a.startsWith('-c'))
      && sub !== undefined && GIT_SO_LEITURA.has(sub);
  }
  return false;
}

// Comando do Bash que cita CLAUDE.md (ou os arquivos da proteção) e não é só de leitura.
function bashCitaProtegido(entrada, ctx) {
  const comando = String(entrada.tool_input.command || '');
  const segmentos = ctx.segmentos();
  const textos = [comando, ...segmentos.map((s) => s.palavras.concat(s.redirecionamentos.map((r) => r.alvo)).join(' '))];
  if (!textos.some((t) => MENCAO_PROTEGIDA.test(t))) return false;
  return !segmentos.every((s) => segmentoSoLeitura(s, ctx));
}

function avaliar(entrada, ctx) {
  if (FERRAMENTAS_EDICAO.has(entrada.tool_name)) {
    for (const c of caminhosDaFerramenta(entrada)) {
      if (c.tipo !== 'arquivo' || !protegido(c.valor, ctx)) continue;
      if (claudeMdDoProjeto(entrada, c.valor, ctx)) {
        if (!temConsentimento(ctx.projeto, entrada.session_id)) return negar(SEM_CONSENTIMENTO);
        continue;
      }
      return negar(`alteração de configuração protegida ("${c.valor}") não é permitida.`);
    }
  }
  if (entrada.tool_name !== 'Bash') return null;
  if (bashCitaProtegido(entrada, ctx)) {
    return negar(`o comando cita CLAUDE.md ou os arquivos da proteção e não é só de leitura; por comando do Bash essa alteração nunca é permitida.`);
  }
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (ef) {
      for (const alvo of alvosModificados(ef)) {
        for (const v of valoresDaPalavra(alvo)) {
          if (v.includes('$') || /\s/.test(v)) continue;
          if (protegido(v, ctx)) return negar(`o comando "${ef.nome}" alteraria configuração protegida ("${v}").`);
        }
      }
    }
    for (const r of seg.redirecionamentos) {
      if (!redirecionaEscrita(r)) continue;
      const alvo = alvoDeRedirecionamento(r);
      if (alvo !== null && protegido(alvo, ctx)) {
        return negar(`o redirecionamento "${r.op} ${alvo}" alteraria configuração protegida.`);
      }
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
