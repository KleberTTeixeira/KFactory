'use strict';

const { lerEntradaPadrao, criarContexto, segmentosDoComando } = require('./lib/comum');

const REGRAS = [
  require('./regras/revisao'),
  require('./regras/fora-projeto'),
  require('./regras/destrutivos'),
  require('./regras/segredos'),
  require('./regras/mencao-ia'),
  require('./regras/configuracao'),
  require('./regras/pacotes'),
  require('./regras/commit'),
];

function responder(decisao, motivo) {
  const saida = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decisao,
      permissionDecisionReason: motivo,
    },
  };
  process.stdout.write(JSON.stringify(saida));
  process.exitCode = 0;
}

function principal() {
  let entrada;
  try {
    entrada = JSON.parse(lerEntradaPadrao());
  } catch {
    responder('deny', 'KFactory — bloqueado: a entrada do hook não é um JSON válido; a ação foi bloqueada por segurança.');
    return;
  }
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) || typeof entrada.tool_name !== 'string') {
    responder('deny', 'KFactory — bloqueado: a entrada do hook não contém tool_name; a ação foi bloqueada por segurança.');
    return;
  }
  if (!entrada.tool_input || typeof entrada.tool_input !== 'object') entrada.tool_input = {};

  let ctx;
  try {
    ctx = criarContexto(entrada);
    let cache = null;
    ctx.segmentos = () => {
      if (cache) return cache;
      const comando = entrada.tool_input.command;
      cache = entrada.tool_name === 'Bash' && typeof comando === 'string' ? segmentosDoComando(comando) : [];
      return cache;
    };
  } catch (erro) {
    responder('deny', `KFactory — bloqueado: erro ao preparar a verificação (${erro.message}); a ação foi bloqueada por segurança.`);
    return;
  }

  for (const regra of REGRAS) {
    let resultado;
    try {
      resultado = regra.avaliar(entrada, ctx);
    } catch (erro) {
      responder('deny', `KFactory — regra "${regra.nome}" bloqueou: erro interno ao avaliar (${erro.message}); a ação foi bloqueada por segurança.`);
      return;
    }
    if (resultado) {
      const verbo = resultado.decisao === 'ask' ? 'pede confirmação' : 'bloqueou';
      responder(resultado.decisao, `KFactory — regra "${regra.nome}" ${verbo}: ${resultado.motivo}`);
      return;
    }
  }
  process.exitCode = 0;
}

principal();
