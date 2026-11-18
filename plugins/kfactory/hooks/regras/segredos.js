'use strict';

const path = require('path');
const {
  caminhosDaFerramenta,
  comandoEfetivo,
  argumentosDeArquivo,
  valoresDaPalavra,
  alvoDeRedirecionamento,
  globParaRegex,
  CARACTERES_GLOB,
} = require('../lib/comum');

const nome = 'segredos';

function nomeSecreto(arquivo) {
  const b = path.basename(arquivo).toLowerCase();
  if (b === '.env.example') return false;
  if (b === '.env' || b.startsWith('.env.')) return true;
  if (/\.(pem|key|p12|pfx)$/.test(b)) return true;
  if (b.startsWith('id_rsa') || b.startsWith('id_ed25519')) return true;
  return b.includes('secret') || b.includes('credential');
}

const EXEMPLOS = ['.env', '.env.local', '.env.production', 'a.pem', 'a.key', 'a.p12', 'a.pfx', 'id_rsa', 'id_ed25519', 'secret', 'secrets.json', 'credentials', 'credentials.json'];
const TERMOS = /env|pem|key|p12|pfx|id_rsa|id_ed25519|secret|credential/i;

function globSecreto(glob) {
  const base = glob.split('/').pop();
  if (!base || !TERMOS.test(base)) return false;
  let regex;
  try {
    regex = globParaRegex(base);
  } catch {
    return false;
  }
  return EXEMPLOS.some((e) => regex.test(e));
}

function alvoSecreto(valor) {
  return CARACTERES_GLOB.test(valor) ? globSecreto(valor) : nomeSecreto(valor);
}

function palavraDeArquivo(p) {
  if (!p || /\s/.test(p) || p.includes('$') || p.includes('://')) return false;
  const b = path.basename(p).toLowerCase();
  return p.includes('/') || p.includes('.') || b.startsWith('id_rsa') || b.startsWith('id_ed25519');
}

function avaliar(entrada, ctx) {
  for (const c of caminhosDaFerramenta(entrada)) {
    if (alvoSecreto(c.valor)) return negar(`acesso a arquivo sensível ("${c.valor}") não é permitido.`);
  }
  if (entrada.tool_name !== 'Bash') return null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    const palavras = ef ? argumentosDeArquivo(ef) : seg.palavras;
    for (const p of palavras) {
      for (const v of valoresDaPalavra(p)) {
        if (palavraDeArquivo(v) && alvoSecreto(v)) return negar(`o comando referencia arquivo sensível ("${v}").`);
      }
    }
    for (const r of seg.redirecionamentos) {
      const alvo = alvoDeRedirecionamento(r);
      if (alvo !== null && alvoSecreto(alvo)) return negar(`o redirecionamento usa arquivo sensível ("${alvo}").`);
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar, nomeSecreto };
