'use strict';

// Comandos que executam código não analisável ou que afetam algo fora do projeto
// mesmo sem citar caminhos: processos, serviços, agendamentos, acesso remoto, configuração global.

const { comandoEfetivo } = require('../lib/comum');

const nome = 'efeito-externo';

const BLOQUEADOS = new Set([
  'kill', 'pkill', 'killall', 'skill', 'crontab', 'at', 'batch', 'systemctl', 'service', 'launchctl',
  'loginctl', 'ssh', 'scp', 'sftp', 'mount', 'umount', 'chroot', 'nsenter', 'unshare', 'su', 'pkexec',
  'reboot', 'shutdown', 'poweroff', 'halt', 'gsettings', 'dconf', 'xdg-open', 'gio', 'xargs', 'osascript',
]);
const ELEVACAO = new Set(['sudo', 'doas']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'csh', 'tcsh']);

// Opções que passam o código do programa na própria linha de comando.
const CODIGO_NA_LINHA = [
  { nomes: /^python[0-9.]*$|^pypy[0-9.]*$/, opcoes: /^-[A-Za-z]*c/ },
  { nomes: /^(node|nodejs|bun)$/, opcoes: /^(-[A-Za-z]*[ep]|--eval|--print)(=|$)/ },
  { nomes: /^(ruby|perl)$/, opcoes: /^-[A-Za-z]*[eE]/ },
  { nomes: /^php[0-9.]*$/, opcoes: /^-[A-Za-z]*r|^--run$/ },
  { nomes: /^lua[0-9.]*$|^luajit$/, opcoes: /^-[A-Za-z]*e/ },
  { nomes: /^(Rscript)$/, opcoes: /^(-e|--expr)/ },
  { nomes: /^(tclsh|wish)$/, opcoes: /^-e/ },
];
const INTERPRETADORES = /^(python[0-9.]*|pypy[0-9.]*|node|nodejs|bun|deno|ruby|perl|php[0-9.]*|lua[0-9.]*|luajit|Rscript|tclsh|wish)$/;

function posicionais(args) {
  const saida = [];
  let fim = false;
  for (const a of args) {
    if (!fim && a === '--') {
      fim = true;
      continue;
    }
    if (!fim && a.startsWith('-') && a !== '-') continue;
    saida.push(a);
  }
  return saida;
}

function verificarInterpretador(ef, seg) {
  for (const r of CODIGO_NA_LINHA) {
    if (r.nomes.test(ef.nome) && ef.args.some((a) => r.opcoes.test(a))) {
      return `"${ef.nome}" com código na própria linha de comando`;
    }
  }
  if (ef.nome === 'deno' && ef.args[0] === 'eval') return '"deno eval"';
  if (!INTERPRETADORES.test(ef.nome)) return null;
  if (ef.nome === 'deno' || ef.nome === 'bun') return null;
  const pos = posicionais(ef.args);
  if (/^python/.test(ef.nome) && ef.args.includes('-m')) return null;
  if (pos.length === 0 || pos[0] === '-') {
    return `"${ef.nome}" lendo o programa da entrada padrão${seg.heredocs.length ? ' (heredoc)' : ''}`;
  }
  return null;
}

// Shell sem -c e sem arquivo de script lê os comandos da entrada (pipe ou redirecionamento), que não são analisados.
// Heredoc e "<<<" são analisados em lib/comum.js.
function verificarShell(ef, seg) {
  if (!SHELLS.has(ef.nome)) return null;
  if (ef.args.some((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a))) return null;
  const pos = posicionais(ef.args);
  const leEntrada = pos.length === 0 || pos[0] === '-' || ef.args.some((a) => /^-[a-zA-Z]*s[a-zA-Z]*$/.test(a));
  if (!leEntrada) return null;
  const analisado = seg.heredocs.length || seg.redirecionamentos.some((r) => r.op === '<<<');
  if (analisado && !seg.redirecionamentos.some((r) => r.op === '<')) return null;
  return `"${ef.nome}" lendo comandos da entrada padrão`;
}

// Chaves do git que só mudam dados do repositório, sem executar programas.
const GIT_CHAVES_SEGURAS = /^(user\.(name|email)|core\.(autocrlf|filemode|ignorecase|quotepath|eol|safecrlf)|color\..*|pull\.(rebase|ff)|push\.(default|autosetupremote)|init\.defaultbranch|branch\.[^.]+\.(remote|merge|rebase)|advice\..*|log\..*|status\..*|commit\.(verbose|cleanup)|merge\.(ff|conflictstyle)|diff\.(renames|algorithm|colormoved|mnemonicprefix)|i18n\..*)$/i;
const GIT_GLOBAIS_COM_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--exec-path']);
const GIT_CONFIG_LEITURA = new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '-l']);

function verificarGit(ef) {
  const args = ef.args;
  let k = 0;
  while (k < args.length && args[k].startsWith('-')) {
    const a = args[k];
    if (a === '-c' || a === '--config-env') {
      const valor = args[k + 1] || '';
      const chave = valor.split('=')[0];
      if (a === '--config-env' || !GIT_CHAVES_SEGURAS.test(chave)) return `"git ${a} ${valor}" (configuração que pode executar programas)`;
    }
    if (/^--config-env=/.test(a) || /^--exec-path=/.test(a)) return `"git ${a}"`;
    k += GIT_GLOBAIS_COM_ARG.has(a) ? 2 : 1;
  }
  if (args[k] !== 'config') return null;
  const resto = args.slice(k + 1);
  for (const a of resto) {
    if (['--global', '--system', '--file', '-f', '--blob', '--worktree', '--edit', '-e'].includes(a) || /^--(file|blob)=/.test(a)) {
      return `"git config ${a}"`;
    }
  }
  const pos = resto.filter((a) => !a.startsWith('-'));
  if (['get', 'list'].includes(pos[0])) return null;
  if (resto.some((a) => GIT_CONFIG_LEITURA.has(a))) return null;
  const altera = ['set', 'unset', 'rename-section', 'remove-section', 'edit'].includes(pos[0])
    || pos.length >= 2
    || resto.some((a) => /^--(add|replace-all|unset|unset-all|rename-section|remove-section)$/.test(a));
  if (!altera) return null;
  const chave = ['set', 'unset'].includes(pos[0]) ? pos[1] : pos[0];
  if (!chave || !GIT_CHAVES_SEGURAS.test(chave)) return `"git config" alterando "${chave || '?'}" (pode executar programas)`;
  return null;
}

function verificarTar(ef) {
  if (ef.nome !== 'tar' && ef.nome !== 'bsdtar') return null;
  for (let k = 0; k < ef.args.length; k++) {
    const a = ef.args[k];
    if (a === '--absolute-names' || a === '-P') return `"${ef.nome} ${a}" (caminhos absolutos)`;
    if (/^-[A-Za-z]+$/.test(a) && a.includes('P')) return `"${ef.nome} ${a}" (caminhos absolutos)`;
    if (k === 0 && /^[A-Za-z]+$/.test(a) && a.includes('P')) return `"${ef.nome} ${a}" (caminhos absolutos)`;
  }
  return null;
}

function avaliar(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (!ef) continue;
    const elevacao = ef.cadeia.find((n) => ELEVACAO.has(n));
    if (elevacao) return negar(`"${elevacao}" não é permitido.`);
    const bloqueado = ef.cadeia.find((n) => BLOQUEADOS.has(n));
    if (bloqueado) return negar(`"${bloqueado}" não é permitido: executa ou afeta algo fora do projeto.`);
    if (!ef.nome) continue;
    const achado = verificarInterpretador(ef, seg)
      || verificarShell(ef, seg)
      || (ef.nome === 'git' ? verificarGit(ef) : null)
      || verificarTar(ef);
    if (achado) return negar(`${achado} não é permitido: pode executar ou alterar algo fora do projeto.`);
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
