'use strict';

// Pedido do comando /kfactory:statusline: vale só para a mensagem do usuário que chama o comando
// e é registrado pelo hook UserPromptSubmit (pedido.js), por sessão, em .kfactory/.

const fs = require('fs');
const path = require('path');

function pedeStatusline(texto) {
  return /^\s*\/kfactory:statusline(\s|$)/i.test(String(texto));
}

function idSessao(sessao) {
  return String(sessao || 'sem-sessao').replace(/[^A-Za-z0-9_-]/g, '_');
}

function arquivoPedido(projeto, sessao) {
  return path.join(projeto, '.kfactory', `pedido-statusline-${idSessao(sessao)}`);
}

function registrarPedido(projeto, sessao) {
  const pasta = path.join(projeto, '.kfactory');
  fs.mkdirSync(pasta, { recursive: true });
  const ignorar = path.join(pasta, '.gitignore');
  if (!fs.existsSync(ignorar)) fs.writeFileSync(ignorar, '*\n');
  fs.writeFileSync(arquivoPedido(projeto, sessao), String(Date.now()));
}

function retirarPedido(projeto, sessao) {
  try {
    fs.unlinkSync(arquivoPedido(projeto, sessao));
  } catch {
    // Já não existia.
  }
}

function temPedido(projeto, sessao) {
  try {
    return fs.lstatSync(arquivoPedido(projeto, sessao)).isFile();
  } catch {
    return false;
  }
}

module.exports = { pedeStatusline, registrarPedido, retirarPedido, temPedido };
