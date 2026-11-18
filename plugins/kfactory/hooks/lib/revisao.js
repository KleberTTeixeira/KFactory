'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Marca, por sessão, que o usuário pediu revisão e a skill reviser ainda não foi chamada.

function arquivoDaMarca(sessao) {
  const id = String(sessao || 'sem-sessao').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `kfactory-revisao-${id}`);
}

function marcar(sessao) {
  fs.writeFileSync(arquivoDaMarca(sessao), String(Date.now()));
}

function desmarcar(sessao) {
  try {
    fs.unlinkSync(arquivoDaMarca(sessao));
  } catch {
    // Já não existia.
  }
}

function marcado(sessao) {
  return fs.existsSync(arquivoDaMarca(sessao));
}

function semAcentos(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function pedeRevisao(texto) {
  return /\b(revis|review)/.test(semAcentos(texto));
}

module.exports = { arquivoDaMarca, marcar, desmarcar, marcado, pedeRevisao };
