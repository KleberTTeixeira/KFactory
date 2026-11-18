'use strict';

const {
  resolverCaminho,
  dentroDoProjeto,
  comandoEfetivo,
  alvoDeRedirecionamento,
  redirecionaEscrita,
} = require('../lib/comum');

const nome = 'destrutivos';

const CURTA = /^-[a-zA-Z]+$/;

function rmRecursivoForcado(args) {
  let recursivo = false;
  let forcado = false;
  for (const a of args) {
    if (a === '--') break;
    if (a === '--recursive') recursivo = true;
    else if (a === '--force') forcado = true;
    else if (CURTA.test(a)) {
      if (/[rR]/.test(a)) recursivo = true;
      if (a.includes('f')) forcado = true;
    }
  }
  return recursivo && forcado;
}

const GLOBAIS_GIT_COM_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env']);

function subcomandoGit(args) {
  let k = 0;
  while (k < args.length) {
    const a = args[k];
    if (GLOBAIS_GIT_COM_ARG.has(a)) {
      k += 2;
      continue;
    }
    if (a.startsWith('-')) {
      k++;
      continue;
    }
    return { sub: a, resto: args.slice(k + 1) };
  }
  return null;
}

function verificarGit(args) {
  const g = subcomandoGit(args);
  if (!g) return null;
  const { sub, resto } = g;
  if (sub === 'push') {
    for (const a of resto) {
      if (a === '--force' || a === '--force-if-includes' || a.startsWith('--force-with-lease')) return `"git push ${a}" (push forçado)`;
      if (CURTA.test(a) && a.includes('f')) return `"git push ${a}" (push forçado)`;
      if (a.startsWith('+') && a.length > 1) return `"git push ${a}" (refspec com "+" força o push)`;
    }
  }
  if (sub === 'reset' && resto.includes('--hard')) return '"git reset --hard"';
  if (sub === 'clean') {
    for (const a of resto) {
      if (a === '--force' || (CURTA.test(a) && a.includes('f'))) return `"git clean ${a}"`;
    }
  }
  return null;
}

function chmodRecursivo777(args) {
  const recursivo = args.some((a) => a === '--recursive' || (CURTA.test(a) && a.includes('R')));
  const modo777 = args.some((a) => /^0?777$/.test(a));
  return recursivo && modo777;
}

function avaliar(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (ef) {
      if (ef.cadeia.includes('sudo')) return negar('uso de "sudo" não é permitido.');
      if (ef.nome === 'su') return negar('uso de "su" não é permitido.');
      if (ef.nome === 'rm' && rmRecursivoForcado(ef.args)) return negar('"rm" recursivo e forçado (rm -rf e variações) não é permitido.');
      if (ef.nome === 'git') {
        const achado = verificarGit(ef.args);
        if (achado) return negar(`${achado} não é permitido.`);
      }
      if (ef.nome === 'chmod' && chmodRecursivo777(ef.args)) return negar('"chmod -R 777" não é permitido.');
      if (ef.nome.startsWith('mkfs')) return negar(`"${ef.nome}" (formatação de sistema de arquivos) não é permitido.`);
      if (ef.nome === 'dd') return negar('"dd" não é permitido.');
    }
    for (const r of seg.redirecionamentos) {
      if (!redirecionaEscrita(r)) continue;
      const alvo = alvoDeRedirecionamento(r);
      if (alvo === null) continue;
      const abs = resolverCaminho(alvo, ctx);
      if (abs !== '/dev/null' && !dentroDoProjeto(abs, ctx)) {
        return negar(`redirecionamento "${r.op} ${alvo}" sobrescreveria arquivo fora do projeto (${abs}).`);
      }
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
