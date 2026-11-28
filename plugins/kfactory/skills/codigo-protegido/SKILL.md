---
name: codigo-protegido
description: Use antes de alterar qualquer arquivo ou função existente, ao corrigir erros ou integrar código novo a código antigo: define o que pode ser acrescentado e quando parar e pedir autorização.
---

# Código que funciona é protegido

Todo código existente é considerado funcionando, a menos que o usuário diga o contrário. Motivo: mudar código que funciona para encaixar código novo é a principal fonte de regressão.

Esta regra não tem exceção, nem por ordem do usuário, exceto pela autorização explícita descrita abaixo.

## Pode

- Criar arquivos novos.
- Acrescentar o código necessário em arquivos e funções existentes para o pedido funcionar, **sem mudar o que eles já fazem**.
- Exemplo: incluir a opção "Esqueci a senha" dentro da tela de login, sem alterar a verificação de login.

## Proibido

- Alterar código que funciona para fazer o código novo funcionar.
- Alterar código que funciona para corrigir erro causado pelo código novo.
- Erro do código novo se corrige SOMENTE no código novo.
- Exemplo: se "Esqueci a senha" falhar, a verificação e a tela de login continuam intocadas; o conserto acontece só no código de "Esqueci a senha".

## Quando não houver outra forma

Só se não houver NENHUMA forma de atender o pedido sem alterar código existente:

1. PARE antes de alterar.
2. Explique em detalhe:
   - o que muda;
   - onde (arquivo, função, linhas);
   - por que é necessário;
   - por que não há alternativa;
   - o que pode ser afetado.
3. Espere autorização explícita do usuário.

## Código existente errado, mas funcionando

- Não altere.
- Não copie o erro no código novo.
- Avise o usuário: o que está errado, onde e qual o risco.
- Só corrija se o usuário mandar.
- Se o código novo precisar seguir o comportamento ou formato desse código errado para funcionar junto com ele: PARE e peça autorização antes de fazer.

## Antes de entregar

- [ ] Nenhum código que funcionava foi alterado sem autorização explícita.
- [ ] Todo erro do código novo foi corrigido só no código novo.
- [ ] Todo código errado encontrado foi avisado ao usuário, e não copiado.
- [ ] Código novo segue a skill `arquitetura-3-camadas`.

Na dúvida se algo conta como alteração, pergunte. Nunca adivinhe.