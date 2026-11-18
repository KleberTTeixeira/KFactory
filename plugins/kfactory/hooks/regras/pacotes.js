'use strict';

const { comandoEfetivo } = require('../lib/comum');

const nome = 'pacotes';

function posicionais(args) {
  return args.filter((a) => !a.startsWith('-'));
}

function instalacao(ef) {
  const pos = posicionais(ef.args);
  const sub = pos[0];
  switch (ef.nome) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
      if (['install', 'add', 'i'].includes(sub) && pos.length > 1) return `${ef.nome} ${sub} ${pos.slice(1).join(' ')}`;
      return null;
    case 'npx':
      return 'npx';
    case 'pip':
    case 'pip3':
      return sub === 'install' ? `${ef.nome} install` : null;
    case 'python':
    case 'python3': {
      const idx = ef.args.indexOf('-m');
      if (idx >= 0 && /^pip3?$/.test(ef.args[idx + 1] || '') && ef.args.slice(idx + 2).includes('install')) return `${ef.nome} -m pip install`;
      return null;
    }
    case 'apt':
    case 'apt-get':
      return sub === 'install' ? `${ef.nome} install` : null;
    case 'dotnet':
      return sub === 'add' && pos.includes('package') ? 'dotnet add package' : null;
    case 'cargo':
      return sub === 'add' ? 'cargo add' : null;
    case 'go':
      return sub === 'get' ? 'go get' : null;
    default:
      return null;
  }
}

function avaliar(entrada, ctx) {
  if (entrada.tool_name !== 'Bash') return null;
  for (const seg of ctx.segmentos()) {
    const ef = comandoEfetivo(seg.palavras);
    if (!ef || !ef.nome) continue;
    const achado = instalacao(ef);
    if (achado) return { decisao: 'ask', motivo: `instalação de pacotes ("${achado}") exige sua confirmação.` };
  }
  return null;
}

module.exports = { nome, avaliar };
