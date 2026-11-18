'use strict';

const fs = require('fs');
const path = require('path');
const { temConsentimento } = require('../lib/claude-md');
const {
  resolverCaminho,
  dentroDoProjeto,
  prefixoFixo,
  caminhosDaFerramenta,
  comandoEfetivo,
  argumentosDeArquivo,
  valoresDaPalavra,
  alvoDeRedirecionamento,
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

function verificarPalavra(p, ctx) {
  for (const v of valoresDaPalavra(p)) {
    if (!palavraDeCaminho(v)) continue;
    const alvo = fora(/[*?[{]/.test(v) ? prefixoFixo(v) : v, ctx);
    if (alvo) return { v, alvo };
  }
  return null;
}

// Exceção do comando /kfactory:init. Com o plugin instalado, seus arquivos ficam fora do projeto.
// Só enquanto a mensagem atual do usuário tem o consentimento para alterar CLAUDE.md, libera
// apenas: ler o arquivo modelos/ContenteClaudeMd do plugin e rodar "bash <plugin>/scripts/StatusLineGenerate.sh"
// sem nada além disso no comando. O destino real (com links resolvidos) precisa ser o próprio arquivo do plugin.
const MODELO_INIT = ['modelos', 'ContenteClaudeMd'];
const SCRIPT_INIT = ['scripts', 'StatusLineGenerate.sh'];

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
  if (typeof valor !== 'string' || !path.isAbsolute(valor)) return false;
  let real;
  try {
    real = fs.realpathSync(path.resolve(valor));
    if (!fs.lstatSync(real).isFile()) return false;
  } catch {
    return false;
  }
  return raizesDoPlugin().some((r) => real === path.join(r, ...partes));
}

function excecaoInit(entrada, ctx) {
  if (entrada.tool_name !== 'Read' && entrada.tool_name !== 'Bash') return false;
  if (!temConsentimento(ctx.projeto, entrada.session_id)) return false;
  if (entrada.tool_name === 'Read') return arquivoDoPlugin(entrada.tool_input.file_path, MODELO_INIT);
  const segmentos = ctx.segmentos();
  if (segmentos.length !== 1) return false;
  const seg = segmentos[0];
  if (seg.redirecionamentos.length || seg.heredocs.length || seg.palavras.length !== 2) return false;
  return seg.palavras[0] === 'bash' && arquivoDoPlugin(seg.palavras[1], SCRIPT_INIT);
}

function avaliar(entrada, ctx) {
  if (excecaoInit(entrada, ctx)) return null;
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

  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
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
    const palavras = ef ? [ef.palavra, ...argumentosDeArquivo(ef)].filter(Boolean) : seg.palavras;
    for (const p of palavras) {
      const achado = verificarPalavra(p, ctx);
      if (achado) return negar(`o comando referencia "${achado.v}", fora do projeto (${achado.alvo}).`);
    }
    for (const r of seg.redirecionamentos) {
      const alvoR = alvoDeRedirecionamento(r);
      if (alvoR === null || alvoR.includes('$') && !/^(\$HOME|\$\{HOME\})/.test(alvoR)) continue;
      const alvo = fora(alvoR, ctx);
      if (alvo) return negar(`o redirecionamento "${r.op} ${alvoR}" aponta para fora do projeto (${alvo}).`);
    }
  }
  return null;
}

function negar(motivo) {
  return { decisao: 'deny', motivo };
}

module.exports = { nome, avaliar };
