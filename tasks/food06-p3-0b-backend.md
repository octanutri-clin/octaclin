# FOOD06 P3-0b: pessoas nas telas de equipe (backend, R4)

- **Plano e decisões:** `tasks/food06-p3-plano.md` (Q-A, Q-C).
- **Decisões do proprietário de 2026-11-18:**
  - colaborador identificado pelo **e-mail completo**;
  - representante identificado pelo **nome da ficha ou pelo e-mail mascarado**;
  - o nome aparece **só quando a ficha pertence à carteira de quem busca**; nos outros casos, o e-mail mascarado.
- **Escopo:** sem migration. Tudo atrás da flag `restricoes.clinicas`, que continua desligada.
- **Risco:** R4, porque a fatia toca PII (e-mail e nome) e autorização da equipe.

## O que entrou

| Rota (POST) | Quem | O que devolve |
| --- | --- | --- |
| `profissional/delegacoes-carteira/candidatos/listar` (corpo `{}`) | Titular Professional ativo (`pacientes.ler` e `pacientes.gerenciar`) | `{itens: [{usuarioId, email}], noLimite}`. São os Collaborators **ativos** do tenant, com o e-mail completo e ordenados por e-mail. O teto é 200; acima disso a lista é cortada e `noLimite: true`. Há uma auditoria por listagem, sem conteúdo |
| `profissional/delegacoes-carteira/listar` e `conceder` | Titular | O mesmo de antes, mais `colaboradorEmail` |
| `pacientes/:pacienteId/representantes/candidato/buscar` (corpo `{email}`) | Equipe do paciente: Professional responsável ou Collaborator com a carteira delegada | `{candidato: null}` ou `{candidato: {usuarioId, identificacao}}` |
| `pacientes/:pacienteId/representantes/listar` e `registrar` | Equipe do paciente | O mesmo de antes, mais `identificacao` |

`identificacao` pode ser `{tipo: 'nome_ficha', nome}` ou `{tipo: 'email_mascarado', email}`. O e-mail mascarado mantém só a
primeira letra do usuário, a primeira letra do domínio e o sufixo final: `h***@e***.test`.

**Regra do nome:** ele aparece quando a conta tem uma ficha **não arquivada** cujo profissional responsável é o mesmo do
paciente atual. Isso equivale à carteira do titular, ou à carteira delegada no caso do colaborador. Os fatos que valem são
os do momento da consulta, provados sob lock.

**Busca por e-mail exato (Q-C):**

- **Resposta única:** "não existe", "inativa", "não é Patient", "é a própria conta do paciente" e "é o ator" recebem a mesma
  resposta, `{candidato: null}`. Nenhum desses casos abre e-mail nem ficha. Não existe listagem de contas.
- **Cota:** 10 buscas por usuário a cada 15 minutos, com bloqueio de 15 minutos (`ServicoProtecaoAbuso`, a mesma usada no
  login).
  - Há também uma cota agregada de 60 buscas por tenant a cada 15 minutos, com bloqueio de 15 minutos. Ela foi
    acrescentada por causa do achado MÉDIA da revisão R4: varredura feita com várias contas da mesma equipe.
  - A cota é consumida antes do banco, a cada busca com e-mail válido.
  - A chave da cota leva o tenant e o usuário, nunca o e-mail.
  - Quando a cota acaba, a rota responde 429 com mensagem fixa. Para isso, o `FiltroRestricoesClinicas` passou a deixar o
    429 passar; antes, ele virava 500.
- **Onde o e-mail não aparece:** ele vai só no corpo da requisição e nunca entra na URL, no log, na chave de cota ou na
  auditoria. A auditoria registra `representacao.candidato.buscar` com o paciente e `metadados: {}`.
- **Validação:** um e-mail inválido recebe 400 sem consumir cota.
- **Sem lock na conta:** a busca não trava a conta encontrada, porque `registrar` reconfere tudo sob lock.
- **Falha fechada:** se uma cifra não abre ou uma conta some, a resposta é 500 genérico, sem eco.

## Provas

- **Unitários.**
  - Delegações: e-mail na lista e na concessão; cifra inválida e conta ausente dão 500; candidatos só para o titular (os
    outros papéis e o papel mudado no banco recebem 403); filtro `Collaborator` ativo; ordem; teto 200 com `noLimite`;
    auditoria sem e-mail.
  - Representantes: nome da ficha só na carteira atual, mascarado nos outros casos; busca com e-mail normalizado e hash;
    as cinco respostas iguais sem decifrar; cota consumida antes do banco; 429 sem tradução; e-mail inválido dá 400 sem
    cota; Patient recebe 403 sem cota; autorização da equipe exigida; auditoria sem e-mail.
  - `mascararEmail`: casos normais e casos malformados, que nunca ecoam o original.
  - O RED foi observado antes de cada implementação.
- **HTTP com guardas reais.**
  - Candidatos: só Professional com `pacientes.gerenciar`; Collaborator, Patient, Client e SuperAdmin recebem 403; a
    projeção não leva campos internos; resposta fora do formato dá 500.
  - Busca: Professional e Collaborator; `{candidato: null}`; 429 com mensagem fixa; corpo fora do contrato dá 400; papel
    errado ou flag desligada dão 403; e-mail canário ausente dos logs e das respostas; identificação fora do formato dá 500.
- **Módulo:** o módulo de autenticação sintético agora exporta a cota, como faz o `ModuloAuth` real.
- **PostgreSQL/RLS:** teste "P3-0b" em `rls-isolamento-tenant.integracao.spec.ts`. Ele usa contas sintéticas com e-mail
  cifrado de verdade e o hash do login, e cobre:
  - candidatos só deste tenant e só ativos;
  - e-mail na lista e na concessão;
  - busca com maiúsculas e espaços;
  - nome da ficha para o titular e para o colaborador delegado;
  - e-mail mascarado para ficha alheia, ficha arquivada e conta sem ficha;
  - resposta nula para inexistente, outro tenant, inativo, Collaborator e conta do próprio paciente;
  - 403 para outro profissional e para o tenant trocado no token;
  - auditoria sem e-mail;
  - identificação em `registrar` e `listar`, e a mesma conta mascarada na carteira de outro profissional.

  Os testes P2d-2, P2d-3a e P2d-3b passaram a criar as contas com e-mail cifrado de verdade, porque agora o e-mail é aberto.
  **Local: SKIPPED.** O daemon Docker subiu, mas o Docker Hub respondeu 429 no pull da imagem do PostgreSQL. O CI é a prova.

## Limites e fora desta fatia

- **Contas com mais de uma ficha na mesma carteira:** vale a primeira por id. Isso afeta só o texto mostrado; a
  autorização não muda.
- **Diferença de tempo:** a busca abre o e-mail só quando acha uma conta elegível, então existe uma diferença de tempo
  entre "achou" e "não achou". O risco é mitigado pela cota por usuário e pela exigência de que o ator seja da equipe de um
  paciente do tenant. **Sem prova de tempo constante.**
- **Risco residual (revisão R4, MÉDIA):** uma resposta não nula confirma, dentro do tenant, que aquele e-mail é de uma
  conta Patient ativa, mesmo quando a ficha é de outra carteira. Só o e-mail mascarado e o id voltam. O risco é mitigado
  pelas duas cotas e pela autorização da equipe. **Precisa de aceite do proprietário.**
- **Filtro 429 global:** a passagem do 429 vale para todos os controladores que usam `FiltroRestricoesClinicas`. A
  mensagem é fixa e sem eco. Hoje só a busca de representante gera 429.
- **Corte dos candidatos:** acima de 200, o corte é por id da conta e só depois a lista é ordenada por e-mail. O e-mail é
  cifrado, então não dá para ordenar no banco. Com `noLimite`, a tela avisa que a lista está incompleta.
- **Telas:** as telas de equipe, que delegam e registram representantes (P3-6), ficam para uma PR web depois do merge
  desta.
