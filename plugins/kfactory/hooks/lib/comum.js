'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { separarPrograma } = require('./programas');

function lerEntradaPadrao() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function pastaPessoal() {
  return process.env.HOME || os.homedir();
}

function dentroLexico(caminho, base) {
  if (caminho === base) return true;
  const prefixo = base.endsWith(path.sep) ? base : base + path.sep;
  return caminho.startsWith(prefixo);
}

function criarContexto(entrada) {
  const cwdEntrada = entrada && typeof entrada.cwd === 'string' && path.isAbsolute(entrada.cwd)
    ? path.resolve(entrada.cwd)
    : null;
  const projetoBruto = path.resolve(process.env.CLAUDE_PROJECT_DIR || cwdEntrada || process.cwd());
  let projeto = projetoBruto;
  try {
    projeto = fs.realpathSync(projetoBruto);
  } catch {
    projeto = projetoBruto;
  }
  const ctx = { projeto, projetoBruto, cwd: projeto };
  if (cwdEntrada) ctx.cwd = mapearProjeto(cwdEntrada, ctx);
  return ctx;
}

function mapearProjeto(abs, ctx) {
  if (ctx.projetoBruto !== ctx.projeto && dentroLexico(abs, ctx.projetoBruto)) {
    return path.join(ctx.projeto, path.relative(ctx.projetoBruto, abs));
  }
  return abs;
}

function expandirPessoal(valor) {
  let v = valor.replace(/^\$\{HOME\}|^\$HOME(?![A-Za-z0-9_])/, '~');
  if (v === '~' || v.startsWith('~/')) return path.join(pastaPessoal(), v.slice(1));
  if (/^~[^/]/.test(v)) {
    const barra = v.indexOf('/');
    const usuario = barra < 0 ? v.slice(1) : v.slice(1, barra);
    const resto = barra < 0 ? '' : v.slice(barra);
    return path.join(path.dirname(pastaPessoal()), usuario, resto);
  }
  return v;
}

// Segue links simbólicos apenas dentro do projeto: se um link aponta para fora,
// o caminho é considerado fora sem acessar o destino.
function resolverLinks(abs, projeto) {
  if (!dentroLexico(abs, projeto)) return abs;
  const fila = path.relative(projeto, abs).split(path.sep).filter(Boolean);
  let atual = projeto;
  let saltos = 0;
  while (fila.length) {
    const parte = fila.shift();
    const proximo = path.join(atual, parte);
    if (!dentroLexico(proximo, projeto)) return path.join(proximo, ...fila);
    let info;
    try {
      info = fs.lstatSync(proximo);
    } catch {
      return path.join(proximo, ...fila);
    }
    if (info.isSymbolicLink()) {
      saltos += 1;
      if (saltos > 40) throw new Error('excesso de links simbólicos em ' + abs);
      const alvo = path.resolve(atual, fs.readlinkSync(proximo));
      if (!dentroLexico(alvo, projeto)) return path.join(alvo, ...fila);
      fila.unshift(...path.relative(projeto, alvo).split(path.sep).filter(Boolean));
      atual = projeto;
      continue;
    }
    atual = proximo;
  }
  return atual;
}

function resolverCaminho(valor, ctx) {
  const expandido = expandirPessoal(String(valor));
  const abs = mapearProjeto(path.resolve(ctx.cwd, expandido), ctx);
  return resolverLinks(abs, ctx.projeto);
}

function dentroDoProjeto(abs, ctx) {
  return dentroLexico(abs, ctx.projeto);
}

const CARACTERES_GLOB = /[*?[{]/;

function prefixoFixo(padrao) {
  const idx = padrao.search(CARACTERES_GLOB);
  if (idx < 0) return padrao;
  const antes = padrao.slice(0, idx);
  const barra = antes.lastIndexOf('/');
  return barra < 0 ? '.' : antes.slice(0, barra + 1);
}

function globParaRegex(glob) {
  let r = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        r += '.*';
        i++;
      } else r += '[^/]*';
    } else if (c === '?') r += '[^/]';
    else if (c === '{') r += '(?:';
    else if (c === '}') r += ')';
    else if (c === ',') r += '|';
    else if (c === '[') {
      const fim = glob.indexOf(']', i + 1);
      if (fim < 0) r += '\\[';
      else {
        r += '[' + glob.slice(i + 1, fim).replace(/^!/, '^').replace(/\\/g, '\\\\') + ']';
        i = fim;
      }
    } else r += c.replace(/[.+^$()|\\\]]/g, '\\$&');
  }
  return new RegExp('^' + r + '$', 'i');
}

function parecerCaminho(s) {
  return typeof s === 'string'
    && s.length > 0
    && s.length < 4096
    && !/\s/.test(s)
    && !s.includes('://')
    && (s.startsWith('/') || s.startsWith('~') || s.startsWith('.') || s.includes('/'));
}

function textosGenericos(valor, saida = [], profundidade = 0) {
  if (profundidade > 6 || valor === null || valor === undefined) return saida;
  if (typeof valor === 'string') {
    if (parecerCaminho(valor)) saida.push(valor);
  } else if (Array.isArray(valor)) {
    for (const v of valor) textosGenericos(v, saida, profundidade + 1);
  } else if (typeof valor === 'object') {
    for (const v of Object.values(valor)) textosGenericos(v, saida, profundidade + 1);
  }
  return saida;
}

const FERRAMENTAS_DOCUMENTADAS = new Set(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);

// Caminhos informados diretamente nos campos da ferramenta.
// tipo "arquivo": caminho; tipo "padrao": padrão glob.
function caminhosDaFerramenta(entrada) {
  const nome = entrada.tool_name;
  const ti = entrada.tool_input && typeof entrada.tool_input === 'object' ? entrada.tool_input : {};
  const lista = [];
  const add = (valor, tipo) => {
    if (typeof valor === 'string' && valor.length) lista.push({ valor, tipo });
  };
  if (nome === 'Read' || nome === 'Write' || nome === 'Edit') add(ti.file_path, 'arquivo');
  else if (nome === 'Glob') {
    add(ti.path, 'arquivo');
    add(ti.pattern, 'padrao');
  } else if (nome === 'Grep') {
    add(ti.path, 'arquivo');
    add(ti.glob, 'padrao');
  } else if (!FERRAMENTAS_DOCUMENTADAS.has(nome)) {
    for (const t of textosGenericos(ti)) add(t, 'arquivo');
  }
  return lista;
}

// ---------- Análise de comandos shell ----------

function acharFechamento(s, inicio) {
  let nivel = 1;
  for (let j = inicio; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === "'") {
      const k = s.indexOf("'", j + 1);
      if (k < 0) return s.length;
      j = k;
      continue;
    }
    if (c === '"') {
      let k = j + 1;
      while (k < s.length && s[k] !== '"') {
        if (s[k] === '\\') k++;
        k++;
      }
      j = k;
      continue;
    }
    if (c === '<' && s[j + 1] === '<' && s[j + 2] !== '<') {
      const m = /^<<-?[ \t]*(['"]?)([^\s'"<>;|&()]+)\1/.exec(s.slice(j));
      if (m) {
        const recuo = s[j + 2] === '-';
        const nl = s.indexOf('\n', j);
        if (nl < 0) return s.length;
        let k = nl + 1;
        let achou = false;
        while (k < s.length) {
          let fimLinha = s.indexOf('\n', k);
          if (fimLinha < 0) fimLinha = s.length;
          let linha = s.slice(k, fimLinha);
          if (recuo) linha = linha.replace(/^\t+/, '');
          k = fimLinha + 1;
          if (linha === m[2]) {
            achou = true;
            break;
          }
        }
        if (!achou) return s.length;
        j = k - 2;
        continue;
      }
    }
    if (c === '(') nivel++;
    else if (c === ')') {
      nivel--;
      if (nivel === 0) return j;
    }
  }
  return s.length;
}

// Marca, dentro da palavra, o trecho que só é conhecido na execução ($(...), `...`, <(...)).
const DINAMICO = '\u0001';

function novoSegmento() {
  return { palavras: [], redirecionamentos: [], heredocs: [] };
}

function analisarShell(texto, profundidade) {
  if (profundidade > 8) throw new Error('aninhamento excessivo no comando');
  const s = String(texto);
  const resultado = [];
  const extras = [];
  const heredocsPendentes = [];
  let seg = novoSegmento();
  let palavra = null;
  let redirPendente = null;

  const anexar = (t) => {
    palavra = (palavra === null ? '' : palavra) + t;
  };
  const fecharPalavra = () => {
    if (palavra === null) return;
    if (redirPendente) {
      seg.redirecionamentos.push({ op: redirPendente, alvo: palavra });
      if (redirPendente === '<<' || redirPendente === '<<-') {
        heredocsPendentes.push({ seg, delim: palavra, recuo: redirPendente === '<<-' });
      }
      redirPendente = null;
    } else seg.palavras.push(palavra);
    palavra = null;
  };
  const fecharSegmento = () => {
    fecharPalavra();
    if (seg.palavras.length || seg.redirecionamentos.length) resultado.push(seg);
    seg = novoSegmento();
  };
  const lerHeredocs = (i) => {
    let k = i;
    while (heredocsPendentes.length) {
      const h = heredocsPendentes.shift();
      let corpo = '';
      let achou = false;
      while (k < s.length) {
        let fimLinha = s.indexOf('\n', k);
        if (fimLinha < 0) fimLinha = s.length;
        let linha = s.slice(k, fimLinha);
        k = fimLinha + 1;
        if (h.recuo) linha = linha.replace(/^\t+/, '');
        if (linha === h.delim) {
          achou = true;
          break;
        }
        corpo += linha + '\n';
      }
      h.seg.heredocs.push(corpo);
      if (!achou) k = s.length;
    }
    return k;
  };
  const substituicao = (i, inicioInterno) => {
    const k = acharFechamento(s, inicioInterno);
    const interno = s.slice(inicioInterno, k);
    extras.push(...segmentosDoComando(interno, profundidade + 1));
    anexar(DINAMICO + interno);
    return k + 1;
  };
  const crase = (i) => {
    let k = i + 1;
    while (k < s.length && s[k] !== '`') {
      if (s[k] === '\\') k++;
      k++;
    }
    const interno = s.slice(i + 1, Math.min(k, s.length));
    extras.push(...segmentosDoComando(interno, profundidade + 1));
    anexar(DINAMICO + interno);
    return k + 1;
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\r') {
      fecharPalavra();
      i++;
    } else if (c === '\n') {
      fecharPalavra();
      i++;
      if (heredocsPendentes.length) i = lerHeredocs(i);
      fecharSegmento();
    } else if (c === '#' && palavra === null) {
      const k = s.indexOf('\n', i);
      i = k < 0 ? s.length : k;
    } else if (c === '\\') {
      if (s[i + 1] === '\n') i += 2;
      else {
        anexar(s[i + 1] === undefined ? '' : s[i + 1]);
        i += 2;
      }
    } else if (c === "'") {
      const k = s.indexOf("'", i + 1);
      const fim = k < 0 ? s.length : k;
      anexar(s.slice(i + 1, fim));
      i = fim + 1;
    } else if (c === '"') {
      anexar('');
      let j = i + 1;
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\' && '"\\$`\n'.includes(s[j + 1])) {
          if (s[j + 1] !== '\n') anexar(s[j + 1]);
          j += 2;
        } else if (s[j] === '$' && s[j + 1] === '(') {
          j = substituicao(j, j + 2);
        } else if (s[j] === '`') {
          j = crase(j);
        } else {
          anexar(s[j]);
          j++;
        }
      }
      i = j + 1;
    } else if (c === '$' && s[i + 1] === '(') {
      if (s[i + 2] === '(') {
        const k = acharFechamento(s, i + 3);
        anexar(s.slice(i, k + 2));
        i = k + 2;
      } else i = substituicao(i, i + 2);
    } else if (c === '`') {
      i = crase(i);
    } else if ((c === '<' || c === '>') && s[i + 1] === '(' && palavra === null) {
      i = substituicao(i, i + 2);
    } else if (c === '&') {
      if (s[i + 1] === '>') {
        fecharPalavra();
        const op = s[i + 2] === '>' ? '&>>' : '&>';
        redirPendente = op;
        i += op.length;
      } else {
        fecharSegmento();
        i += s[i + 1] === '&' ? 2 : 1;
      }
    } else if (c === '|') {
      fecharSegmento();
      i += s[i + 1] === '|' || s[i + 1] === '&' ? 2 : 1;
    } else if (c === ';' || c === '(' || c === ')') {
      fecharSegmento();
      i++;
    } else if (c === '>' || c === '<') {
      if (palavra !== null && /^\d+$/.test(palavra)) palavra = null;
      else fecharPalavra();
      let op;
      if (c === '>') {
        op = s[i + 1] === '>' ? '>>' : s[i + 1] === '|' ? '>|' : s[i + 1] === '&' ? '>&' : '>';
      } else if (s.startsWith('<<<', i)) op = '<<<';
      else if (s.startsWith('<<-', i)) op = '<<-';
      else if (s.startsWith('<<', i)) op = '<<';
      else op = s[i + 1] === '&' ? '<&' : s[i + 1] === '>' ? '<>' : '<';
      redirPendente = op;
      i += op.length;
    } else {
      anexar(c);
      i++;
    }
  }
  fecharPalavra();
  if (heredocsPendentes.length) lerHeredocs(s.length);
  fecharSegmento();
  return resultado.concat(extras);
}

const INVOLUCROS = new Set([
  '!', '{', '}', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time',
  'exec', 'command', 'builtin', 'nohup', 'env', 'nice', 'timeout', 'xargs',
  'stdbuf', 'sudo', 'doas', 'ionice',
]);

const OPCOES_COM_ARGUMENTO = {
  env: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']),
  nice: new Set(['-n', '--adjustment']),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  xargs: new Set(['-I', '-n', '-P', '-d', '-L', '-s', '-a', '-E', '--max-args', '--max-procs', '--delimiter', '--arg-file']),
  stdbuf: new Set(['-i', '-o', '-e']),
  sudo: new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-U', '-r', '-t']),
  doas: new Set(['-u', '-C']),
  ionice: new Set(['-c', '-n', '-p']),
};

function comandoEfetivo(palavras) {
  const cadeia = [];
  let k = 0;
  while (k < palavras.length) {
    const p = palavras[k];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(p)) {
      k++;
      continue;
    }
    const nome = path.basename(p);
    if (!INVOLUCROS.has(nome)) break;
    cadeia.push(nome);
    k++;
    const comArgumento = OPCOES_COM_ARGUMENTO[nome] || new Set();
    while (k < palavras.length && palavras[k].startsWith('-') && palavras[k] !== '-') {
      const o = palavras[k];
      k++;
      if (o === '--') break;
      if (comArgumento.has(o)) k++;
    }
    if (nome === 'timeout' && k < palavras.length) k++;
  }
  if (k >= palavras.length) {
    return cadeia.length ? { nome: '', args: [], cadeia } : null;
  }
  const nome = path.basename(palavras[k]);
  cadeia.push(nome);
  return { nome, palavra: palavras[k], args: palavras.slice(k + 1), cadeia };
}

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

function segmentosDoComando(texto, profundidade = 0) {
  const base = analisarShell(texto, profundidade);
  const todos = [];
  for (const seg of base) {
    todos.push(seg);
    const ef = comandoEfetivo(seg.palavras);
    if (!ef || !ef.nome) continue;
    if (SHELLS.has(ef.nome)) {
      let usouC = false;
      for (let k = 0; k < ef.args.length; k++) {
        if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(ef.args[k]) && ef.args[k + 1] !== undefined) {
          todos.push(...segmentosDoComando(ef.args[k + 1], profundidade + 1));
          usouC = true;
          break;
        }
      }
      if (!usouC) {
        for (const corpo of seg.heredocs) todos.push(...segmentosDoComando(corpo, profundidade + 1));
        for (const r of seg.redirecionamentos) {
          if (r.op === '<<<') todos.push(...segmentosDoComando(r.alvo, profundidade + 1));
        }
      }
    } else if (ef.nome === 'eval') {
      todos.push(...segmentosDoComando(ef.args.join(' '), profundidade + 1));
    } else if (ef.nome === 'alias') {
      // O valor do alias é um comando que roda depois; é analisado como os demais.
      for (const a of ef.args) {
        const igual = a.indexOf('=');
        if (igual > 0) todos.push(...segmentosDoComando(a.slice(igual + 1), profundidade + 1));
      }
    } else if (ef.nome === 'find') {
      for (let k = 0; k < ef.args.length; k++) {
        if (['-exec', '-execdir', '-ok', '-okdir'].includes(ef.args[k])) {
          const grupo = [];
          k++;
          while (k < ef.args.length && ef.args[k] !== ';' && ef.args[k] !== '+') {
            grupo.push(ef.args[k]);
            k++;
          }
          if (grupo.length) todos.push({ palavras: grupo, redirecionamentos: [], heredocs: [] });
        }
      }
    }
  }
  return todos;
}

const COMANDOS_COM_PADRAO = new Set(['grep', 'egrep', 'fgrep', 'rg', 'jq']);

// Argumentos que podem ser arquivos: exclui o padrão de grep/rg/jq e o programa de sed/awk/perl
// (o programa é analisado à parte em lib/programas.js).
function argumentosDeArquivo(ef) {
  const separado = separarPrograma(ef);
  if (separado) return separado.arquivos;
  if (!COMANDOS_COM_PADRAO.has(ef.nome)) return ef.args.slice();
  const saida = [];
  let temPadrao = false;
  let fimOpcoes = false;
  const args = ef.args;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (!fimOpcoes && a === '--') {
      fimOpcoes = true;
      continue;
    }
    if (!fimOpcoes && a.startsWith('-') && a !== '-') {
      if (['-e', '--regexp', '--expression'].includes(a)) {
        k++;
        temPadrao = true;
      } else if (/^--(regexp|expression)=/.test(a)) {
        temPadrao = true;
      } else if (['-f', '--file'].includes(a)) {
        temPadrao = true;
        if (args[k + 1] !== undefined) saida.push(args[k + 1]);
        k++;
      } else {
        saida.push(a);
      }
      continue;
    }
    if (!temPadrao) {
      temPadrao = true;
      continue;
    }
    saida.push(a);
  }
  return saida;
}

// Valores a examinar numa palavra: a palavra e, se houver "=", o valor após ele.
function valoresDaPalavra(p) {
  const valores = [p];
  const igual = p.indexOf('=');
  if (igual > 0) valores.push(p.slice(igual + 1));
  return valores;
}

const REDIR_ESCRITA = new Set(['>', '>>', '>|', '&>', '&>>', '<>']);
const REDIR_LEITURA = new Set(['<']);

function alvoDeRedirecionamento(r) {
  if (r.op === '>&' || r.op === '<&') {
    if (/^\d+-?$/.test(r.alvo) || r.alvo === '-') return null;
    return r.alvo;
  }
  if (REDIR_ESCRITA.has(r.op) || REDIR_LEITURA.has(r.op)) return r.alvo;
  return null;
}

function redirecionaEscrita(r) {
  return REDIR_ESCRITA.has(r.op) || (r.op === '>&' && alvoDeRedirecionamento(r) !== null);
}

function resumir(texto, max = 120) {
  const t = String(texto).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}

module.exports = {
  lerEntradaPadrao,
  criarContexto,
  resolverCaminho,
  dentroDoProjeto,
  prefixoFixo,
  globParaRegex,
  parecerCaminho,
  caminhosDaFerramenta,
  segmentosDoComando,
  comandoEfetivo,
  argumentosDeArquivo,
  valoresDaPalavra,
  alvoDeRedirecionamento,
  redirecionaEscrita,
  resumir,
  CARACTERES_GLOB,
  DINAMICO,
};
