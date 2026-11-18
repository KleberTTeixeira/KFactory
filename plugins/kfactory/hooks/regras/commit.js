'use strict';

const { comandoEfetivo } = require('../lib/comum');

const nome = 'commit';

const MARCA = 'KFACTORY_SAVE_COMMIT=1';

const GLOBAIS_GIT_COM_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env']);

// Subcomandos que gravam commit com texto que o usuário não viu.
const GERAM_COMMIT = new Set(['merge', 'cherry-pick', 'revert', 'am', 'rebase', 'pull', 'commit-tree']);

function analisarGit(args) {
  let alias = false;
  let k = 0;
  while (k < args.length) {
    const a = args[k];
    if (GLOBAIS_GIT_COM_ARG.has(a)) {
      if ((a === '-c' || a === '--config-env') && /^alias\./i.test(args[k + 1] || '')) alias = true;
      k += 2;
      continue;
    }
    if (/^-c?alias\./i.test(a) || /^--config-env=alias\./i.test(a)) alias = true;
    if (a.startsWith('-')) {
      k++;
      continue;
    }
    return { sub: a, alias };
  }
  return { sub: null, alias };
}

function avaliar(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return null;
  let pedir = null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (!ef || ef.nome !== 'git') continue;
    const { sub, alias } = analisarGit(ef.args);
    if (alias) return negar('definir alias do git no próprio comando não é permitido.');
    if (sub === 'push') return negar('"git push" não é permitido ao agente. O push é feito só pelo usuário, no próprio terminal.');
    if (sub === 'commit') {
      if (!seg.palavras.includes(MARCA)) {
        return negar('commit só pode ser gravado pela skill "save-commit" do kfactory. Chame a skill save-commit.');
      }
      pedir = pedir || 'confira o texto do commit no comando acima antes de aprovar.';
    } else if (GERAM_COMMIT.has(sub)) {
      pedir = pedir || `"git ${sub}" pode gravar commit; aprove só se concordar.`;
    }
  }
  return pedir ? { decisao: 'ask', motivo: pedir } : null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar, MARCA };
