'use strict';

const fs = require('fs');
const path = require('path');
const { lerEntradaPadrao, parecerCaminho } = require('./lib/comum');

function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const deslocamento = -d.getTimezoneOffset();
  const sinal = deslocamento >= 0 ? '+' : '-';
  const abs = Math.abs(deslocamento);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${sinal}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

function detalhe(ti) {
  if (!ti || typeof ti !== 'object') return '';
  for (const campo of ['file_path', 'command', 'path', 'pattern']) {
    if (typeof ti[campo] === 'string' && ti[campo]) return ti[campo];
  }
  for (const v of Object.values(ti)) {
    if (parecerCaminho(v)) return v;
  }
  return '';
}

function limpar(texto) {
  return String(texto).replace(/[\r\n\t]+/g, ' ');
}

function principal() {
  try {
    const entrada = JSON.parse(lerEntradaPadrao());
    const projeto = process.env.CLAUDE_PROJECT_DIR || (entrada && entrada.cwd);
    if (!projeto) return;
    const pasta = path.join(projeto, '.kfactory');
    fs.mkdirSync(pasta, { recursive: true });
    const ignorar = path.join(pasta, '.gitignore');
    if (!fs.existsSync(ignorar)) fs.writeFileSync(ignorar, '*\n');
    const linha = [isoLocal(), limpar(entrada.tool_name || ''), limpar(detalhe(entrada.tool_input))].join('\t') + '\n';
    fs.appendFileSync(path.join(pasta, 'auditoria.log'), linha);
  } catch {
    // Falhas de gravação nunca interrompem a sessão.
  }
}

principal();
process.exitCode = 0;
