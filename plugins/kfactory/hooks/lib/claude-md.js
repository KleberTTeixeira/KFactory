'use strict';

// Proteção dos arquivos CLAUDE.md do projeto.
// - Consentimento: vale só para a mensagem do usuário que contém a FRASE e é registrado
//   pelo hook UserPromptSubmit (pedido.js), por sessão, em .kfactory/.
// - Cópia de segurança: guarda o conteúdo de todo CLAUDE.md do projeto em .kfactory/.
//   Após cada ação, se algum CLAUDE.md mudou sem consentimento, a cópia é restaurada.

const fs = require('fs');
const path = require('path');

const FRASE = 'autorizo alterar claude.md';
const PASTAS_IGNORADAS = new Set(['.git', 'node_modules', '.kfactory']);
const LIMITE_ITENS = 200000;

function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

function contemFrase(texto) {
  return normalizar(texto).includes(FRASE);
}

function ehClaudeMd(nome) {
  return String(nome).toLowerCase() === 'claude.md';
}

function pastaDados(projeto) {
  return path.join(projeto, '.kfactory');
}

function garantirPasta(projeto) {
  const pasta = pastaDados(projeto);
  fs.mkdirSync(pasta, { recursive: true });
  const ignorar = path.join(pasta, '.gitignore');
  if (!fs.existsSync(ignorar)) fs.writeFileSync(ignorar, '*\n');
  return pasta;
}

function idSessao(sessao) {
  return String(sessao || 'sem-sessao').replace(/[^A-Za-z0-9_-]/g, '_');
}

function arquivoConsentimento(projeto, sessao) {
  return path.join(pastaDados(projeto), `consentimento-claude-md-${idSessao(sessao)}`);
}

function arquivoCopia(projeto) {
  return path.join(pastaDados(projeto), 'claude-md.json');
}

function registrarConsentimento(projeto, sessao) {
  garantirPasta(projeto);
  fs.writeFileSync(arquivoConsentimento(projeto, sessao), String(Date.now()));
}

function retirarConsentimento(projeto, sessao) {
  try {
    fs.unlinkSync(arquivoConsentimento(projeto, sessao));
  } catch {
    // Já não existia.
  }
}

function temConsentimento(projeto, sessao) {
  try {
    return fs.lstatSync(arquivoConsentimento(projeto, sessao)).isFile();
  } catch {
    return false;
  }
}

// Estado atual: caminho relativo -> "arquivo:<base64>", "link:<destino>" ou "outro:".
// Links simbólicos não são seguidos.
function lerEstado(projeto) {
  const estado = {};
  let contagem = 0;
  const pilha = [projeto];
  while (pilha.length) {
    const pasta = pilha.pop();
    let itens;
    try {
      itens = fs.readdirSync(pasta, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of itens) {
      contagem += 1;
      if (contagem > LIMITE_ITENS) throw new Error('projeto com itens demais para verificar os CLAUDE.md');
      const completo = path.join(pasta, item.name);
      if (item.isDirectory()) {
        if (!PASTAS_IGNORADAS.has(item.name)) pilha.push(completo);
        continue;
      }
      if (!ehClaudeMd(item.name)) continue;
      const rel = path.relative(projeto, completo);
      if (item.isSymbolicLink()) estado[rel] = 'link:' + fs.readlinkSync(completo);
      else if (item.isFile()) estado[rel] = 'arquivo:' + fs.readFileSync(completo).toString('base64');
      else estado[rel] = 'outro:';
    }
  }
  return estado;
}

function lerCopia(projeto) {
  try {
    const dados = JSON.parse(fs.readFileSync(arquivoCopia(projeto), 'utf8'));
    if (dados && typeof dados === 'object' && dados.arquivos && typeof dados.arquivos === 'object' && !Array.isArray(dados.arquivos)) {
      return dados.arquivos;
    }
  } catch {
    // Sem cópia válida.
  }
  return null;
}

function gravarCopia(projeto, estado) {
  garantirPasta(projeto);
  const destino = arquivoCopia(projeto);
  const temporario = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify({ arquivos: estado }));
  fs.renameSync(temporario, destino);
}

function atualizarCopia(projeto) {
  gravarCopia(projeto, lerEstado(projeto));
}

function removerQualquer(completo) {
  let info;
  try {
    info = fs.lstatSync(completo);
  } catch {
    return;
  }
  if (info.isDirectory()) fs.rmSync(completo, { recursive: true, force: true });
  else fs.unlinkSync(completo);
}

// Só restaura dentro do projeto: pastas intermediárias que sejam links são substituídas.
function prepararPasta(projeto, rel) {
  let atual = projeto;
  for (const parte of path.dirname(rel).split(path.sep).filter((p) => p && p !== '.')) {
    atual = path.join(atual, parte);
    let info = null;
    try {
      info = fs.lstatSync(atual);
    } catch {
      info = null;
    }
    if (info && info.isDirectory()) continue;
    if (info) fs.unlinkSync(atual);
    fs.mkdirSync(atual);
  }
}

function restaurarUm(projeto, rel, valor) {
  const completo = path.join(projeto, rel);
  prepararPasta(projeto, rel);
  removerQualquer(completo);
  if (valor === undefined) return;
  if (valor.startsWith('arquivo:')) fs.writeFileSync(completo, Buffer.from(valor.slice('arquivo:'.length), 'base64'), { flag: 'wx' });
  else if (valor.startsWith('link:')) fs.symlinkSync(valor.slice('link:'.length), completo);
}

// Compara o estado atual com a cópia. Com consentimento (ou sem cópia ainda), aceita o estado
// atual e atualiza a cópia. Sem consentimento, desfaz as mudanças.
// Retorna a lista de caminhos relativos restaurados.
function verificar(projeto, sessao) {
  const copia = lerCopia(projeto);
  const atual = lerEstado(projeto);
  if (copia === null || temConsentimento(projeto, sessao)) {
    gravarCopia(projeto, atual);
    return [];
  }
  const alterados = [];
  const nomes = new Set([...Object.keys(copia), ...Object.keys(atual)]);
  for (const rel of nomes) {
    if (copia[rel] === atual[rel]) continue;
    restaurarUm(projeto, rel, copia[rel]);
    alterados.push(rel);
  }
  return alterados.sort();
}

module.exports = {
  FRASE,
  contemFrase,
  ehClaudeMd,
  registrarConsentimento,
  retirarConsentimento,
  temConsentimento,
  atualizarCopia,
  verificar,
  lerEstado,
};
