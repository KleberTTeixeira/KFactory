'use strict';

const { spawnSync } = require('child_process');
const { lerEntradaPadrao } = require('./lib/comum');

const MENSAGENS_NOTIFICACAO = {
  permission_prompt: 'Aguardando sua aprovação',
  idle_prompt: 'Aguardando você',
};

function mensagemPara(entrada) {
  if (!entrada || typeof entrada !== 'object') return null;
  if (entrada.hook_event_name === 'Stop') return 'Tarefa concluída';
  if (entrada.hook_event_name === 'Notification') return MENSAGENS_NOTIFICACAO[entrada.notification_type] || null;
  return null;
}

function principal() {
  try {
    const mensagem = mensagemPara(JSON.parse(lerEntradaPadrao()));
    if (!mensagem) return;
    spawnSync('notify-send', ['KFactory', mensagem], { stdio: 'ignore', timeout: 5000 });
  } catch {
    // Sem notify-send ou entrada inválida: termina sem erro.
  }
}

principal();
process.exitCode = 0;
