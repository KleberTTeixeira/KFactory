'use strict';

// UserPromptSubmit: se a mensagem do usuário pedir revisão, marca a sessão e instrui o agente
// a chamar a skill reviser. A regra "revisao" do pre-tool.js bloqueia as ferramentas até a chamada.

const { lerEntradaPadrao } = require('./lib/comum');
const { marcar, desmarcar, pedeRevisao } = require('./lib/revisao');
const claudeMd = require('./lib/claude-md');
const statusline = require('./lib/statusline');

// Lembrete injetado em toda mensagem do usuário.
const LEMBRETE = 'Siga sempre as regras obrigatórias do CLAUDE.md do projeto.';

// Pedido do /kfactory:statusline: libera só o script de alternância, só enquanto o agente responde a esta mensagem.
function pedidoStatusline(sessao, prompt) {
  const projeto = process.env.CLAUDE_PROJECT_DIR;
  if (!projeto) return;
  try {
    if (statusline.pedeStatusline(prompt)) statusline.registrarPedido(projeto, sessao);
    else statusline.retirarPedido(projeto, sessao);
  } catch {
    // Sem pedido registrado, o script continua bloqueado.
  }
}

// Consentimento para alterar CLAUDE.md: vale só enquanto o agente responde a esta mensagem.
// Alterações feitas entre o fim da resposta anterior e esta mensagem são do usuário: viram a nova cópia.
function consentimento(sessao, prompt) {
  const projeto = process.env.CLAUDE_PROJECT_DIR;
  if (!projeto) return;
  try {
    claudeMd.atualizarCopia(projeto);
    if (claudeMd.contemFrase(prompt)) claudeMd.registrarConsentimento(projeto, sessao);
    else claudeMd.retirarConsentimento(projeto, sessao);
  } catch {
    // Sem consentimento registrado, a alteração continua bloqueada.
  }
}

function principal() {
  let entrada;
  try {
    entrada = JSON.parse(lerEntradaPadrao());
  } catch {
    return;
  }
  if (!entrada || typeof entrada !== 'object') return;
  const sessao = entrada.session_id;
  const prompt = typeof entrada.prompt === 'string' ? entrada.prompt : '';
  // Retorno de agente (subagente) não é mensagem do usuário: não marca nem desmarca.
  if (/^\s*<agent-message\b/.test(prompt)) return;
  consentimento(sessao, prompt);
  pedidoStatusline(sessao, prompt);
  // Chamada direta da skill pelo comando: ela já está rodando, não há o que forçar.
  if (/^\s*\/(kfactory:)?reviser(\s|$)/i.test(prompt)) {
    desmarcar(sessao);
    return;
  }
  let contexto = LEMBRETE;
  if (pedeRevisao(prompt)) {
    marcar(sessao);
    contexto += '\nO usuário pediu uma revisão. Chame a skill "kfactory:reviser" com a ferramenta Skill antes de qualquer outra ação. Não faça a revisão por conta própria: as demais ferramentas ficam bloqueadas até a skill ser chamada.';
  } else {
    desmarcar(sessao);
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: contexto,
    },
  }));
}

try {
  principal();
} catch {
  // Falha aqui não deve impedir o envio da mensagem.
}
process.exitCode = 0;
