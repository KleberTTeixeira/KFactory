'use strict';

const fs = require('fs');
const { comandoEfetivo, resolverCaminho } = require('../lib/comum');

const nome = 'mencao-ia';

const TERMOS = ['claude', 'anthropic', 'co-authored-by', 'generated with', 'ai-generated'];

const GLOBAIS_GIT_COM_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env']);
const CURTAS_COM_ARG = new Set(['C', 'c', 't']);
const LONGAS_COM_ARG = new Set(['--author', '--date', '--template', '--reuse-message', '--reedit-message', '--fixup', '--squash', '--cleanup', '--trailer', '--pathspec-from-file']);

function argsDoCommit(args) {
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
    return a === 'commit' ? args.slice(k + 1) : null;
  }
  return null;
}

// Retorna { mensagens: [texto], arquivos: [caminho] }
function extrairMensagens(args) {
  const mensagens = [];
  const arquivos = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--') break;
    if (a === '--message' || a === '--file') {
      if (args[k + 1] !== undefined) (a === '--message' ? mensagens : arquivos).push(args[k + 1]);
      k++;
    } else if (a.startsWith('--message=')) mensagens.push(a.slice('--message='.length));
    else if (a.startsWith('--file=')) arquivos.push(a.slice('--file='.length));
    else if (a.startsWith('--')) {
      if (LONGAS_COM_ARG.has(a)) k++;
    } else if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const op = a[j];
        if (op === 'm' || op === 'F') {
          const resto = a.slice(j + 1);
          let valor = resto;
          if (!resto) {
            valor = args[k + 1];
            k++;
          }
          if (valor !== undefined) (op === 'm' ? mensagens : arquivos).push(valor);
          break;
        }
        if (CURTAS_COM_ARG.has(op)) {
          if (j === a.length - 1) k++;
          break;
        }
      }
    }
  }
  return { mensagens, arquivos };
}

function termoEncontrado(texto) {
  const t = String(texto).toLowerCase();
  return TERMOS.find((termo) => t.includes(termo)) || null;
}

function avaliar(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (!ef || ef.nome !== 'git') continue;
    const args = argsDoCommit(ef.args);
    if (!args) continue;
    const { mensagens, arquivos } = extrairMensagens(args);
    const textos = mensagens.slice();
    for (const arq of arquivos) {
      if (arq === '-') {
        textos.push(...seg.heredocs);
        for (const r of seg.redirecionamentos) if (r.op === '<<<') textos.push(r.alvo);
        continue;
      }
      try {
        textos.push(fs.readFileSync(resolverCaminho(arq, ctx), 'utf8'));
      } catch (erro) {
        return negar(`não foi possível ler o arquivo de mensagem do commit "${arq}" para verificação (${erro.code || erro.message}).`);
      }
    }
    for (const texto of textos) {
      const termo = termoEncontrado(texto);
      if (termo) return negar(`a mensagem do commit contém o termo proibido "${termo}".`);
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
