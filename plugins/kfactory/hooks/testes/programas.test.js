'use strict';

const { test } = require('node:test');
const { bloqueia, libera } = require('./auxiliar');

const R = 'fora-projeto';
const cmd = (command) => ({ command });

// sed
test('sed: bloqueia comando e', () => bloqueia(R, 'Bash', cmd("sed '1e ls' README.md")));
test('sed: bloqueia flag e do s///', () => bloqueia(R, 'Bash', cmd("sed 's/.*/date/e' README.md")));
test('sed: bloqueia w com caminho absoluto externo', () => bloqueia(R, 'Bash', cmd("sed -n 'w /tmp/saida.txt' README.md")));
test('sed: bloqueia W com ~', () => bloqueia(R, 'Bash', cmd("sed -n '/x/W ~/saida.txt' README.md")));
test('sed: bloqueia flag w do s/// com ..', () => bloqueia(R, 'Bash', cmd("sed -e 's/a/b/w ../fora.txt' README.md")));
test('sed: bloqueia r com caminho externo', () => bloqueia(R, 'Bash', cmd("sed '1r /etc/hostname' README.md")));

test('sed: libera substituição comum', () => libera('Bash', cmd("sed 's/foo/bar/g' README.md")));
test('sed: libera endereço com regex iniciada por /', () => libera('Bash', cmd("sed -n '/^#/p' README.md")));
test('sed: libera s com delimitador | e caminhos no texto', () => libera('Bash', cmd("sed 's|/usr/local|/opt|g' README.md")));
test('sed: libera w para arquivo interno', () => libera('Bash', cmd("sed -n 'w saida.txt' README.md")));
test('sed: libera texto do comando a', () => libera('Bash', cmd("sed '$a fim do arquivo' README.md")));

// awk
test('awk: bloqueia system', () => bloqueia(R, 'Bash', cmd("awk 'BEGIN{system(\"ls\")}'")));
test('awk: bloqueia exec', () => bloqueia(R, 'Bash', cmd("awk '{exec(\"ls\")}' README.md")));
test('awk: bloqueia crases', () => bloqueia(R, 'Bash', cmd("awk '{print `id`}' README.md")));
test('awk: bloqueia print > caminho externo', () => bloqueia(R, 'Bash', cmd("awk '{print > \"/tmp/x.txt\"}' README.md")));
test('awk: bloqueia getline de ..', () => bloqueia(R, 'Bash', cmd("awk 'BEGIN{while((getline l < \"../fora.txt\")>0) print l}'")));

test('awk: libera regex iniciada por /', () => libera('Bash', cmd("awk '/^#/ {print $1}' README.md")));
test('awk: libera -F /', () => libera('Bash', cmd("awk -F / '{print $2}' README.md")));
test('awk: libera print > arquivo interno', () => libera('Bash', cmd("awk '{print > \"saida.txt\"}' README.md")));
test('awk: libera split com "/"', () => libera('Bash', cmd("awk 'BEGIN{n=split(\"a/b\", p, \"/\"); print n}'")));

// perl
test('perl: bloqueia system', () => bloqueia(R, 'Bash', cmd("perl -e 'system(\"ls\")'")));
test('perl: bloqueia exec', () => bloqueia(R, 'Bash', cmd("perl -e 'exec \"ls\"'")));
test('perl: bloqueia crases', () => bloqueia(R, 'Bash', cmd("perl -ne 'print `id`' README.md")));
test('perl: bloqueia qx', () => bloqueia(R, 'Bash', cmd("perl -e 'my $x = qx{ls}; print $x'")));
test('perl: bloqueia readpipe', () => bloqueia(R, 'Bash', cmd("perl -e 'print readpipe(\"ls\")'")));
test('perl: bloqueia caminho externo em string com aspas', () => bloqueia(R, 'Bash', cmd("perl -e 'open(my $f, \"<\", \"/etc/hostname\")'")));
test('perl: bloqueia caminho externo em q{}', () => bloqueia(R, 'Bash', cmd("perl -e 'open F, q{</etc/hostname}'")));
test('perl: bloqueia caminho externo em qq()', () => bloqueia(R, 'Bash', cmd("perl -e 'print qq(~/.bashrc)'")));
test('perl: bloqueia caminho externo em qq com delimitador |', () => bloqueia(R, 'Bash', cmd("perl -e 'open F, qq|../fora.txt|'")));

test('perl: libera substituição comum', () => libera('Bash', cmd("perl -pe 's/a/b/' README.md")));
test('perl: libera regex com barras', () => libera('Bash', cmd("perl -ne 'print if /^\\/api\\//' README.md")));
test('perl: libera string comum', () => libera('Bash', cmd("perl -e 'print \"ok\\n\"'")));
test('perl: libera q{} com caminho interno', () => libera('Bash', cmd("perl -e 'open F, q{<README.md}'")));
test('perl: libera palavra que contém exec', () => libera('Bash', cmd("perl -e 'print \"execute\"'")));

// grep, rg, jq continuam ignorando o primeiro argumento
test('grep: libera padrão iniciado por /', () => libera('Bash', cmd("grep '/api/' README.md")));
test('rg: libera padrão iniciado por /', () => libera('Bash', cmd("rg '/api/' README.md")));
test('jq: libera filtro', () => libera('Bash', cmd("jq '.a' plugins/kfactory/.claude-plugin/plugin.json")));
