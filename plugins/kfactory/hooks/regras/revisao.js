'use strict';

const { marcado, desmarcar } = require('../lib/revisao');

const nome = 'revisao';

function chamaReviser(entrada) {
  if (entrada.tool_name !== 'Skill') return false;
  return /(^|:)reviser$/.test(String(entrada.tool_input.skill || entrada.tool_input.name || '').trim())
    || Object.values(entrada.tool_input).some((v) => typeof v === 'string' && /(^|:)reviser$/.test(v.trim()));
}

function avaliar(entrada) {
  // Ferramentas usadas pelos agentes revisores (subagentes) não são bloqueadas.
  if (entrada.agent_id) return null;
  const sessao = entrada.session_id;
  if (!marcado(sessao)) return null;
  if (chamaReviser(entrada)) {
    desmarcar(sessao);
    return null;
  }
  return {
    decisao: 'deny',
    motivo: 'o usuário pediu revisão. Chame primeiro a skill "kfactory:reviser" com a ferramenta Skill; não revise por conta própria.',
  };
}

module.exports = { nome, avaliar };
