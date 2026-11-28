'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { temPedido } = require('../lib/statusline');
const {
  resolverCaminho,
  dentroDoProjeto,
  prefixoFixo,
  caminhosDaFerramenta,
  comandoEfetivo,
  argumentosDeArquivo,
  valoresDaPalavra,
  alvoDeRedirecionamento,
  DINAMICO,
} = require('../lib/comum');
const { separarPrograma, analisarPrograma } = require('../lib/programas');

const nome = 'fora-projeto';

function fora(valor, ctx) {
  const abs = resolverCaminho(valor, ctx);
  if (abs === '/dev/null') return null;
  return dentroDoProjeto(abs, ctx) ? null : abs;
}

function padraoExterno(padrao) {
  return padrao.startsWith('/') || padrao.startsWith('~') || padrao.startsWith('..');
}

function palavraDeCaminho(p) {
  if (!p || /\s/.test(p) || p.includes('://')) return false;
  if (/^(~|\$HOME(?![A-Za-z0-9_])|\$\{HOME\})/.test(p)) return true;
  if (p.includes('$')) return false;
  return p.startsWith('/') || p === '..' || p.startsWith('../') || p.includes('/');
}

const LIMITE_VARIANTES = 256;

// Expansão de chaves do shell: "a{b,c}d" vira "abd" e "acd"; "{1..3}" vira "1", "2" e "3".
function expandirChaves(p, saida = [], nivel = 0) {
  if (saida.length > LIMITE_VARIANTES || nivel > 20) return saida;
  let abre = -1;
  let fecha = -1;
  let prof = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '{') {
      if (prof === 0) abre = i;
      prof++;
    } else if (p[i] === '}' && prof > 0) {
      prof--;
      if (prof === 0) {
        fecha = i;
        break;
      }
    }
  }
  if (abre < 0 || fecha < 0) {
    saida.push(p);
    return saida;
  }
  const antes = p.slice(0, abre);
  const meio = p.slice(abre + 1, fecha);
  const depois = p.slice(fecha + 1);
  const partes = [];
  let atual = '';
  prof = 0;
  for (const c of meio) {
    if (c === '{') prof++;
    else if (c === '}') prof--;
    if (c === ',' && prof === 0) {
      partes.push(atual);
      atual = '';
    } else atual += c;
  }
  partes.push(atual);
  const seq = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])$/.exec(meio);
  if (partes.length === 1 && !seq) {
    for (const v of expandirChaves(depois, [], nivel + 1)) saida.push(antes + '{' + meio + '}' + v);
    return saida;
  }
  const opcoes = partes.length > 1 ? partes : [meio.split('..')[0], meio.split('..')[1]];
  for (const o of opcoes) expandirChaves(antes + o + depois, saida, nivel + 1);
  return saida;
}

// Variáveis com valor conhecido no próprio comando: atribuições literais (NOME=valor, export NOME=valor)
// e listas de "for NOME in ...". PWD, HOME e CLAUDE_PROJECT_DIR têm o valor do contexto.
function variaveisConhecidas(ctx) {
  const mapa = new Map();
  const add = (nome, valor) => {
    if (!mapa.has(nome)) mapa.set(nome, []);
    const lista = mapa.get(nome);
    if (lista === null) return;
    if (valor === null) mapa.set(nome, null);
    else lista.push(valor);
  };
  const dinamico = (v) => v.includes('$') || v.includes(DINAMICO) || v.includes('`');
  for (const seg of ctx.segmentos()) {
    const pal = seg.palavras;
    if (pal[0] === 'for' && pal[2] === 'in') {
      for (const v of pal.slice(3)) add(pal[1], dinamico(v) ? null : v);
      continue;
    }
    if (pal[0] === 'for') {
      if (pal[1]) add(pal[1], null);
      continue;
    }
    if (pal[0] === 'read' || pal[0] === 'mapfile' || pal[0] === 'readarray' || pal[0] === 'getopts') {
      for (const v of pal.slice(1)) if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) add(v, null);
    }
    for (const w of pal) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\+?=(.*)$/s.exec(w);
      if (m) add(m[1], dinamico(m[2]) ? null : m[2]);
    }
  }
  mapa.set('PWD', [ctx.cwd]);
  mapa.set('HOME', [process.env.HOME || os.homedir()]);
  mapa.set('CLAUDE_PROJECT_DIR', [ctx.projeto]);
  return mapa;
}

// Valores possíveis da palavra depois de trocar as variáveis conhecidas.
// Retorna null quando parte do valor só é conhecida na execução.
function expandirVariaveis(p, conhecidas) {
  if (p.includes(DINAMICO) || p.includes('`')) return null;
  let variantes = [''];
  let i = 0;
  while (i < p.length) {
    if (p[i] !== '$') {
      const j = p.indexOf('$', i);
      const fim = j < 0 ? p.length : j;
      variantes = variantes.map((v) => v + p.slice(i, fim));
      i = fim;
      continue;
    }
    const m = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/.exec(p.slice(i));
    if (!m) return null;
    const valores = conhecidas.get(m[1] || m[2]);
    if (!valores || !valores.length) return null;
    const novas = [];
    for (const v of variantes) for (const x of valores) novas.push(v + x);
    if (novas.length > LIMITE_VARIANTES) return null;
    variantes = novas;
    i += m[0].length;
  }
  return variantes;
}

// null: a palavra fica dentro do projeto; { dinamico }: valor só conhecido na execução; { v, alvo }: aponta para fora.
function verificarPalavra(p, ctx, conhecidas) {
  const expandidas = expandirVariaveis(p, conhecidas || new Map([['HOME', [process.env.HOME || os.homedir()]]]));
  if (expandidas === null) return { dinamico: true, v: p.split(DINAMICO).join('$(') };
  for (const e of expandidas) {
    for (const c of expandirChaves(e)) {
      for (const v of valoresDaPalavra(c)) {
        if (!palavraDeCaminho(v)) continue;
        const alvo = fora(/[*?[{]/.test(v) ? prefixoFixo(v) : v, ctx);
        if (alvo) return { v, alvo };
      }
    }
  }
  return null;
}

// Comandos em que um valor só conhecido na execução não é usado como caminho nem como comando.
const ACEITAM_DINAMICO = new Set([
  'echo', 'printf', 'test', '[', '[[', 'true', 'false', ':', 'exit', 'return', 'shift', 'sleep',
  'expr', 'let', 'wait', 'export', 'local', 'declare', 'readonly', 'typeset', 'read',
]);

function aceitaDinamico(ef, palavra) {
  if (palavra === ef.palavra) return false;
  if (ACEITAM_DINAMICO.has(ef.nome)) return true;
  if (ef.nome === 'git') {
    const k = ef.args.indexOf(palavra);
    const anterior = k > 0 ? ef.args[k - 1] : '';
    const sub = ef.args.find((a) => !a.startsWith('-'));
    return (sub === 'commit' || sub === 'tag') && (anterior === '-m' || anterior === '--message');
  }
  return false;
}

// Palavras do segmento que atribuem valor a variáveis: as que vêm antes do comando
// (NOME=valor cmd, env NOME=valor cmd) e os argumentos de export/declare/local/readonly/typeset.
const DECLARADORES = new Set(['export', 'declare', 'local', 'readonly', 'typeset']);

function palavrasDeAtribuicao(seg, ef) {
  if (!ef || !ef.nome) return seg.palavras.slice();
  const k = seg.palavras.length - ef.args.length - 1;
  const saida = seg.palavras.slice(0, k);
  if (DECLARADORES.has(ef.nome)) saida.push(...ef.args);
  return saida;
}

// Cada parte de um novo PATH precisa ficar dentro do projeto; só "$PATH" (o valor atual) é aceito como está.
function verificarPath(seg, ef, ctx, conhecidas) {
  for (const w of palavrasDeAtribuicao(seg, ef)) {
    const m = /^PATH\+?=(.*)$/s.exec(w);
    if (!m) continue;
    for (const parte of m[1].split(':')) {
      if (parte === '' || /^\$(?:PATH|\{PATH\})$/.test(parte)) continue;
      const achado = verificarPalavra(parte, ctx, conhecidas);
      if (achado && achado.dinamico) return negar(`a variável PATH recebe "${achado.v}", valor só conhecido na execução.`);
      if (achado) return negar(`a variável PATH recebe "${parte}", fora do projeto (${achado.alvo}).`);
    }
  }
  return null;
}

// Exceção do MAESTRI_CLI: a palavra do comando "$MAESTRI_CLI" (ou "${MAESTRI_CLI}") é liberada quando a
// variável, no ambiente do hook, aponta para um arquivo executável chamado "maestri" (com links resolvidos).
// Não vale se o próprio comando atribui valor à variável. Os demais argumentos seguem a regra normal.
const REFERENCIA_MAESTRI = /^\$(?:MAESTRI_CLI|\{MAESTRI_CLI\})$/;

function maestriLiberado(palavra, ef, conhecidas) {
  if (!ef || palavra !== ef.palavra || !REFERENCIA_MAESTRI.test(palavra)) return false;
  if (conhecidas.has('MAESTRI_CLI')) return false;
  const valor = process.env.MAESTRI_CLI;
  if (!valor || !path.isAbsolute(valor) || path.basename(valor) !== 'maestri') return false;
  try {
    const real = fs.realpathSync(valor);
    if (path.basename(real) !== 'maestri' || !fs.statSync(real).isFile()) return false;
    fs.accessSync(real, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Com o plugin instalado, seus arquivos ficam fora do projeto. O destino real (com links resolvidos)
// precisa ser o próprio arquivo do plugin.
function raizesDoPlugin() {
  const raizes = [path.resolve(__dirname, '..', '..')];
  const env = process.env.CLAUDE_PLUGIN_ROOT;
  if (env && path.isAbsolute(env)) raizes.push(path.resolve(env));
  const reais = new Set();
  for (const r of raizes) {
    try {
      reais.add(fs.realpathSync(r));
    } catch {
      // Raiz inexistente não libera nada.
    }
  }
  return [...reais];
}

function arquivoDoPlugin(valor, partes) {
  if (typeof valor !== 'string') return false;
  const env = process.env.CLAUDE_PLUGIN_ROOT;
  if (env && path.isAbsolute(env)) valor = valor.replace(/^\$\{CLAUDE_PLUGIN_ROOT\}|^\$CLAUDE_PLUGIN_ROOT(?![A-Za-z0-9_])/, env);
  if (!path.isAbsolute(valor)) return false;
  let real;
  try {
    real = fs.realpathSync(path.resolve(valor));
    if (!fs.lstatSync(real).isFile()) return false;
  } catch {
    return false;
  }
  return raizesDoPlugin().some((r) => real === path.join(r, ...partes));
}

// Exceção do comando /kfactory:statusline. Só enquanto a mensagem atual do usuário é o comando,
// libera apenas rodar "bash <plugin>/scripts/StatusLineToggle.sh" sem nada além disso no comando.
const SCRIPT_STATUSLINE = ['scripts', 'StatusLineToggle.sh'];

function excecaoStatusline(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return false;
  if (!temPedido(ctx.projeto, entrada.session_id)) return false;
  const segmentos = ctx.segmentos();
  if (segmentos.length !== 1) return false;
  const seg = segmentos[0];
  if (seg.redirecionamentos.length || seg.heredocs.length || seg.palavras.length !== 2) return false;
  return seg.palavras[0] === 'bash' && arquivoDoPlugin(seg.palavras[1], SCRIPT_STATUSLINE);
}

function avaliar(entrada, ctx) {
  if (excecaoStatusline(entrada, ctx)) return null;

  // Ferramentas MCP que gravam em disco escolhendo o destino internamente
  // (ex.: save_to_disk do Chrome, que grava em /tmp). O caminho nao aparece
  // no tool_input, entao nega-se qualquer gravacao desse tipo.
  if (!['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(entrada.tool_name)) {
    const ti = entrada.tool_input && typeof entrada.tool_input === 'object' ? entrada.tool_input : {};
    const GRAVA_FLAG = /save[_-]?to[_-]?disk|save[_-]?to[_-]?file|write[_-]?to[_-]?disk|to[_-]?disk|download/i;
    const GRAVA_NOME = /screenshot|save_file|\bexport\b|download|capture|gif_creator|upload_image|file_upload/i;
    for (const [k, v] of Object.entries(ti)) {
      if (GRAVA_FLAG.test(k) && v) {
        return negar(`a ferramenta "${entrada.tool_name}" tenta gravar em disco (parametro "${k}") com destino nao verificavel; gravacao fora do projeto sem autorizacao nao e permitida.`);
      }
    }
    if (GRAVA_NOME.test(entrada.tool_name)) {
      return negar(`a ferramenta "${entrada.tool_name}" grava em disco com destino escolhido por ela mesma; gravacao fora do projeto sem autorizacao nao e permitida.`);
    }
  }

  for (const c of caminhosDaFerramenta(entrada)) {
    if (c.tipo === 'padrao') {
      if (!padraoExterno(c.valor)) continue;
      const alvo = fora(prefixoFixo(c.valor), ctx);
      if (alvo) return negar(`o padrão "${c.valor}" aponta para fora do projeto (${alvo}).`);
    } else {
      const alvo = fora(c.valor, ctx);
      if (alvo) return negar(`o caminho "${c.valor}" aponta para fora do projeto (${alvo}).`);
    }
  }

  if (entrada.tool_name !== 'Bash') return null;

  const conhecidas = variaveisConhecidas(ctx);
  for (const seg of ctx.segmentos()) {
    if (seg.palavras.some((w) => /^IFS\+?=/.test(w))) return negar('alterar a variável IFS não é permitido.');
    const ef = comandoEfetivo(seg.palavras);
    const negadoPath = verificarPath(seg, ef, ctx, conhecidas);
    if (negadoPath) return negadoPath;
    if (ef && ef.nome === 'cd') {
      const destinos = ef.args.filter((a) => !a.startsWith('-'));
      if (destinos.length === 0) return negar('"cd" sem argumento leva à pasta pessoal, fora do projeto.');
      if (destinos[0] === '..' || !destinos[0].includes('/')) {
        const alvo = fora(destinos[0], ctx);
        if (alvo) return negar(`o comando "cd ${destinos[0]}" leva para fora do projeto (${alvo}).`);
      }
    }
    const separado = ef ? separarPrograma(ef) : null;
    if (separado) {
      for (const programa of separado.programas) {
        const analise = analisarPrograma(ef.nome, programa);
        if (analise.execucao) return negar(`${analise.execucao} executa comandos e não é permitido.`);
        for (const caminho of analise.caminhos) {
          if (caminho.includes('$') && !/^(\$HOME|\$\{HOME\})/.test(caminho)) continue;
          const alvo = fora(caminho, ctx);
          if (alvo) return negar(`o programa do ${ef.nome} referencia "${caminho}", fora do projeto (${alvo}).`);
        }
      }
    }
    const palavras = ef ? [ef.palavra, ...argumentosDeArquivo(ef)].filter(Boolean) : [];
    for (const p of palavras) {
      if (maestriLiberado(p, ef, conhecidas)) continue;
      const achado = verificarPalavra(p, ctx, conhecidas);
      if (!achado) continue;
      if (achado.dinamico) {
        if (aceitaDinamico(ef, p)) continue;
        return negar(`o valor "${achado.v}" só é conhecido na execução e pode apontar para fora do projeto.`);
      }
      return negar(`o comando referencia "${achado.v}", fora do projeto (${achado.alvo}).`);
    }
    for (const r of seg.redirecionamentos) {
      const alvoR = alvoDeRedirecionamento(r);
      if (alvoR === null) continue;
      const achado = verificarPalavra(alvoR, ctx, conhecidas);
      if (achado && achado.dinamico) return negar(`o redirecionamento "${r.op} ${achado.v}" só é conhecido na execução.`);
      if (achado) return negar(`o redirecionamento "${r.op} ${alvoR}" aponta para fora do projeto (${achado.alvo}).`);
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
