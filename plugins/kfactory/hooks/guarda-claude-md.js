'use strict';

// PostToolUse, Stop e SubagentStop: confere os CLAUDE.md do projeto contra a cópia de segurança
// e desfaz qualquer alteração feita sem o consentimento do usuário (ver lib/claude-md.js).

const { lerEntradaPadrao } = require('./lib/comum');
const { verificar, FRASE } = require('./lib/claude-md');

function principal() {
  let entrada = {};
  try {
    entrada = JSON.parse(lerEntradaPadrao()) || {};
  } catch {
    entrada = {};
  }
  const projeto = process.env.CLAUDE_PROJECT_DIR || entrada.cwd;
  if (!projeto) return;
  const evento = entrada.hook_event_name;

  let restaurados;
  try {
    restaurados = verificar(projeto, entrada.session_id);
  } catch (erro) {
    process.stdout.write(JSON.stringify({
      systemMessage: `KFactory — falha ao conferir os CLAUDE.md (${erro.message}).`,
    }));
    return;
  }
  if (!restaurados.length) return;

  const lista = restaurados.join(', ');
  const aviso = `KFactory — CLAUDE.md alterado sem consentimento do usuário; restaurado: ${lista}.`;
  if (evento === 'PostToolUse') {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `${aviso} Alterar CLAUDE.md só é permitido quando a mensagem do usuário contém a frase "${FRASE}". Não tente de novo nem por outro meio.`,
      systemMessage: aviso,
    }));
  } else {
    process.stdout.write(JSON.stringify({ systemMessage: aviso }));
  }
}

try {
  principal();
} catch {
  // Falha aqui não deve interromper a sessão.
}
process.exitCode = 0;
