'use strict';

// Análise de programas passados a sed, awk e perl.
// separar*: divide os argumentos em programas (texto) e arquivos (candidatos a caminho).
// analisar*: extrai caminhos usados pelo programa e detecta execução de comandos.

const AWKS = new Set(['awk', 'gawk', 'mawk', 'nawk']);

function separarSed(args) {
  const programas = [];
  const arquivos = [];
  const posicionais = [];
  let temArquivoScript = false;
  let fim = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (fim || a === '-' || !a.startsWith('-')) {
      posicionais.push(a);
      continue;
    }
    if (a === '--') {
      fim = true;
      continue;
    }
    if (a.startsWith('--')) {
      const [nome, valor] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
      const pegar = () => (valor !== undefined ? valor : args[++k]);
      if (nome === '--expression') programas.push(pegar());
      else if (nome === '--file') {
        arquivos.push(pegar());
        temArquivoScript = true;
      } else if (nome === '--line-length') pegar();
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const letra = a[j];
      const resto = a.slice(j + 1);
      if (letra === 'e' || letra === 'f' || letra === 'l') {
        const valor = resto || args[++k];
        if (letra === 'e') programas.push(valor);
        else if (letra === 'f') {
          arquivos.push(valor);
          temArquivoScript = true;
        }
        break;
      }
      if (letra === 'i') break;
    }
  }
  if (!programas.length && !temArquivoScript && posicionais.length) programas.push(posicionais.shift());
  return { programas: programas.filter((p) => p !== undefined), arquivos: arquivos.concat(posicionais).filter((p) => p !== undefined) };
}

function separarAwk(args) {
  const programas = [];
  const arquivos = [];
  const posicionais = [];
  let temArquivoScript = false;
  let fim = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (fim || a === '-' || !a.startsWith('-')) {
      posicionais.push(a);
      continue;
    }
    if (a === '--') {
      fim = true;
      continue;
    }
    if (a.startsWith('--')) {
      const [nome, valor] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
      const pegar = () => (valor !== undefined ? valor : args[++k]);
      if (nome === '--source') programas.push(pegar());
      else if (nome === '--file' || nome === '--include') {
        arquivos.push(pegar());
        if (nome === '--file') temArquivoScript = true;
      } else if (nome === '--assign') arquivos.push(pegar());
      else if (nome === '--field-separator' || nome === '--load') pegar();
      continue;
    }
    const letra = a[1];
    const resto = a.slice(2);
    const valor = resto || args[++k];
    if (letra === 'e') programas.push(valor);
    else if (letra === 'f' || letra === 'i') {
      arquivos.push(valor);
      if (letra === 'f') temArquivoScript = true;
    } else if (letra === 'v') arquivos.push(valor);
    else if (letra !== 'F' && letra !== 'l') {
      if (!resto) k--;
    }
  }
  if (!programas.length && !temArquivoScript && posicionais.length) programas.push(posicionais.shift());
  return { programas: programas.filter((p) => p !== undefined), arquivos: arquivos.concat(posicionais).filter((p) => p !== undefined) };
}

const PERL_COM_RESTO = new Set(['I', 'M', 'm', 'i', 'x', '0', 'l', 'C', 'd', 'D', 'V', 'F']);

function separarPerl(args) {
  const programas = [];
  const arquivos = [];
  const posicionais = [];
  let fim = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (fim || a === '-' || !a.startsWith('-')) {
      posicionais.push(a);
      continue;
    }
    if (a === '--') {
      fim = true;
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const letra = a[j];
      const resto = a.slice(j + 1);
      if (letra === 'e' || letra === 'E') {
        programas.push(resto || args[++k]);
        break;
      }
      if (letra === 'I') {
        arquivos.push(resto || args[++k]);
        break;
      }
      if (PERL_COM_RESTO.has(letra)) break;
    }
  }
  // Sem -e, o primeiro argumento posicional é o arquivo do script.
  return { programas: programas.filter((p) => p !== undefined), arquivos: arquivos.concat(posicionais).filter((p) => p !== undefined) };
}

function separarPrograma(ef) {
  if (ef.nome === 'sed') return separarSed(ef.args);
  if (AWKS.has(ef.nome)) return separarAwk(ef.args);
  if (ef.nome === 'perl') return separarPerl(ef.args);
  return null;
}

// Trechos de texto que parecem caminho absoluto, ~ ou ..
function caminhosEmTexto(texto) {
  const saida = [];
  for (const bruto of String(texto).split(/\s+/)) {
    const t = bruto.replace(/^[<>+|&=:(]+/, '').replace(/[;,)]+$/, '');
    if (!t) continue;
    if ((t.startsWith('/') && !/^\/+$/.test(t)) || t.startsWith('~') || t.startsWith('..')) saida.push(t);
  }
  return saida;
}

function analisarSed(script) {
  const s = String(script);
  const n = s.length;
  const arquivos = [];
  let execucao = null;
  let i = 0;

  const ateFimLinha = () => {
    let k = s.indexOf('\n', i);
    if (k < 0) k = n;
    const t = s.slice(i, k);
    i = k;
    return t;
  };
  const pularEspacos = () => {
    while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
  };
  const lerDelimitado = (d) => {
    while (i < n) {
      if (s[i] === '\\') {
        i += 2;
        continue;
      }
      if (s[i] === d) {
        i++;
        return;
      }
      i++;
    }
  };
  const lerEndereco = () => {
    pularEspacos();
    if (s[i] === '/') {
      i++;
      lerDelimitado('/');
    } else if (s[i] === '\\' && i + 1 < n) {
      const d = s[i + 1];
      i += 2;
      lerDelimitado(d);
    } else if (s[i] === '$') {
      i++;
      return true;
    } else {
      const m = /^\d+(~\d+)?/.exec(s.slice(i));
      if (!m) return false;
      i += m[0].length;
      return true;
    }
    while (i < n && /[IM]/.test(s[i])) i++;
    return true;
  };

  while (i < n) {
    while (i < n && /[\s;]/.test(s[i])) i++;
    if (i >= n) break;
    if (s[i] === '#') {
      ateFimLinha();
      continue;
    }
    if (lerEndereco()) {
      pularEspacos();
      if (s[i] === ',') {
        i++;
        pularEspacos();
        if (s[i] === '+' || s[i] === '~') {
          i++;
          const m = /^\d+/.exec(s.slice(i));
          if (m) i += m[0].length;
        } else lerEndereco();
      }
    }
    pularEspacos();
    while (s[i] === '!') {
      i++;
      pularEspacos();
    }
    if (i >= n) break;
    const c = s[i];
    i++;
    if (c === '{' || c === '}') continue;
    if (c === 's') {
      const d = s[i];
      i++;
      lerDelimitado(d);
      lerDelimitado(d);
      while (i < n) {
        const f = s[i];
        if (f === 'w') {
          i++;
          pularEspacos();
          arquivos.push(ateFimLinha().trim());
          break;
        }
        if (f === 'e') {
          execucao = execucao || 'flag "e" do comando s/// do sed';
          i++;
          continue;
        }
        if (/[gpiImM0-9]/.test(f)) {
          i++;
          continue;
        }
        break;
      }
      continue;
    }
    if (c === 'y') {
      const d = s[i];
      i++;
      lerDelimitado(d);
      lerDelimitado(d);
      continue;
    }
    if ('rRwW'.includes(c)) {
      pularEspacos();
      arquivos.push(ateFimLinha().trim());
      continue;
    }
    if (c === 'e') {
      execucao = execucao || 'comando "e" do sed';
      ateFimLinha();
      continue;
    }
    if ('aic'.includes(c)) {
      let linha;
      do {
        linha = ateFimLinha();
        if (i < n) i++;
      } while (linha.endsWith('\\') && i < n);
      continue;
    }
    if (':btTv'.includes(c)) {
      while (i < n && s[i] !== ';' && s[i] !== '\n') i++;
      continue;
    }
    if ('qQlL'.includes(c)) {
      pularEspacos();
      const m = /^\d+/.exec(s.slice(i));
      if (m) i += m[0].length;
    }
  }
  return { caminhos: arquivos.filter(Boolean), execucao };
}

function lerAspas(s, i, aspa) {
  let k = i + 1;
  let texto = '';
  while (k < s.length && s[k] !== aspa) {
    if (s[k] === '\\' && k + 1 < s.length) {
      texto += s[k + 1];
      k += 2;
      continue;
    }
    texto += s[k];
    k++;
  }
  return { texto, fim: k + 1 };
}

function analisarAwk(programa) {
  const p = String(programa);
  let execucao = null;
  if (p.includes('`')) execucao = 'crases (backticks) no programa awk';
  const m = /\b(system|exec)\b/.exec(p);
  if (!execucao && m) execucao = `uso de "${m[1]}" no programa awk`;
  const caminhos = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '"') {
      const { texto, fim } = lerAspas(p, i, '"');
      caminhos.push(...caminhosEmTexto(texto));
      i = fim - 1;
    }
  }
  return { caminhos, execucao };
}

const PARES = { '(': ')', '[': ']', '{': '}', '<': '>' };

function lerDelimitadoPerl(s, i, abre) {
  const fecha = PARES[abre] || abre;
  let nivel = 1;
  let k = i + 1;
  let texto = '';
  while (k < s.length) {
    const c = s[k];
    if (c === '\\' && k + 1 < s.length) {
      texto += s[k + 1];
      k += 2;
      continue;
    }
    if (PARES[abre] && c === abre) nivel++;
    else if (c === fecha) {
      nivel--;
      if (nivel === 0) break;
    }
    texto += c;
    k++;
  }
  return { texto, fim: k + 1 };
}

function analisarPerl(programa) {
  const p = String(programa);
  let execucao = null;
  if (p.includes('`')) execucao = 'crases (backticks) no programa perl';
  const m = /\b(system|exec|qx|readpipe)\b/.exec(p);
  if (!execucao && m) execucao = `uso de "${m[1]}" no programa perl`;
  const caminhos = [];
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '"' || c === "'") {
      const { texto, fim } = lerAspas(p, i, c);
      caminhos.push(...caminhosEmTexto(texto));
      i = fim;
      continue;
    }
    if (c === 'q' && (i === 0 || !/[\w$@%&]/.test(p[i - 1]))) {
      const q = /^(qq|q)\s*([^\w\s])/.exec(p.slice(i));
      if (q && !(q[2] === '=' && p[i + q[0].length] === '>') && q[2] !== ',' && q[2] !== ';') {
        const inicio = i + q[0].length - 1;
        const { texto, fim } = lerDelimitadoPerl(p, inicio, q[2]);
        caminhos.push(...caminhosEmTexto(texto));
        i = fim;
        continue;
      }
    }
    i++;
  }
  return { caminhos, execucao };
}

function analisarPrograma(nome, texto) {
  if (nome === 'sed') return analisarSed(texto);
  if (AWKS.has(nome)) return analisarAwk(texto);
  if (nome === 'perl') return analisarPerl(texto);
  return { caminhos: [], execucao: null };
}

module.exports = { separarPrograma, analisarPrograma, analisarSed, analisarAwk, analisarPerl, caminhosEmTexto };
