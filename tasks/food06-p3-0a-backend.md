# FOOD06 P3-0a — leituras que faltavam para as telas do profissional (backend, R4)

Plano e decisões: `tasks/food06-p3-plano.md` (Q-A e Q-B). Autorização do proprietário para fazer a P3-0a e a P3-0b em seguida:
2026-11-18. Sem migration. Tudo atrás da flag `restricoes.clinicas` (desligada), exceto a rota de disponibilidade (ver abaixo).

## O que entrou

| Rota (POST, corpo `{}`) | Quem | O que devolve |
| --- | --- | --- |
| `pacientes/:pacienteId/restricoes/listar` | Professional responsável (`pacientes.ler`) | `{escopo, itens}`. Com a concessão `restricoes.confirmar`: todas as restrições do paciente (`completo`). Sem ela: só as que registrou (`autoria`, Q6) |
| `colaborador/pacientes/:pacienteId/restricoes/listar` | Collaborator com a carteira delegada | Só as que registrou (`autoria`) |
| `pacientes/:pacienteId/restricoes/avaliacao/consultar` | Professional com a concessão | `{avaliacao: null}` ou `{id, revisao, situacao, confirmadoEm, venceEm}`, sem quem confirmou e sem criar a avaliação |
| `restricoes/disponibilidade` | Professional, Collaborator ou Patient autenticado | `{habilitada}` da flag do tenant do JWT. **Sem a guarda da flag, de propósito**: é a própria pergunta. Corrige o achado MÉDIA da revisão R4 da #555 |

- **Itens da listagem:** `{id, revisao, origem, estado, confirmacao, criadoEm, conteudo}`. O conteúdo inclui a observação, porque é a equipe que lê; o colaborador só vê as próprias. A carteira é provada sob lock por `autorizarPendenciaRestricao`. Cada linha é conferida com o histórico e com o conteúdo decifrado, e qualquer divergência falha fechado (409). Acima de 200 registros, responde 409 em vez de cortar em silêncio. Há uma auditoria por listagem, sem conteúdo.
- **F3 (decisão Q-B), corrigido por outro caminho:**
  - A constraint da 1083 exige atestação (quem confirmou, quando e vencimento) em toda situação diferente de `nao_informado`. Por isso, confirmar uma restrição isolada não pode levar a avaliação a `restricoes_registradas` sem fabricar uma atestação, o que a Q10 proíbe.
  - A correção ficou na reconfirmação global: `sem_alteracao` a partir de `nao_informado` grava `restricoes_registradas` por 180 dias, se houver restrição confirmada e nenhuma pendência. Sem restrição confirmada, continua 409, porque a ausência exige a declaração explícita.
  - O efeito que você aprovou (a reconfirmação "sem alteração" funcionar para quem tem restrição) está preservado.

## Provas

- Unitários: listagem (escopo completo e por autoria, papéis, ids inválidos, teto, histórico divergente) e avaliação (com e sem
  avaliação, sem a concessão); reconfirmação de "não informada" com e sem restrição confirmada (RED observado antes).
- HTTP com guardas reais (`controlador-restricoes-listagem.jwt.http.spec.ts`): identidade do token, papéis trocados, corpo não vazio,
  projeção sem campos internos, resposta malformada → 500 genérico, flag desligada, disponibilidade sem a flag.
- Guardas estruturais: arquivo novo na lista nominal; o módulo prova que a disponibilidade é a única rota sem a flag e só depende do
  serviço de flags.
- PostgreSQL/RLS (teste "P3-0a" em `rls-isolamento-tenant.integracao.spec.ts`): escopo completo × autoria, carteira alheia, outro
  tenant, Patient, auditoria sem metadados, avaliação lida sem criar, F3 com pendência (409) e depois `restricoes_registradas` com
  180 dias, RLS por SQL direto. **Local: SKIPPED (sem Docker); o CI é a prova.**

## Fora desta fatia

- NUX-24: decidido e incluído nesta PR (ver abaixo).
- P3-0b (pessoas: candidatos a colaborador, busca de representante por e-mail, nomes nas listas): próxima PR.
- Telas do profissional (P3-3 a P3-5) e a web consumindo a disponibilidade do tenant: depois.

## NUX-24 (decisão do proprietário de 2026-11-18: sim)

- Campo opcional e fechado no conteúdo cifrado: `classificacaoPeloPaciente: 'nao_sabe'`. Só vale em `outra_restricao_clinica`. Sem migration, porque o conteúdo já é JSON cifrado validado pelo domínio.
- **Só a declaração do paciente grava o campo;** o registro pela equipe ou pelo colaborador recebe 400.
- **A listagem da equipe mostra o campo;** o resumo do portal não o mostra (projeção por allowlist).
- **Parte web**, em PR de web depois do merge desta: o BFF do portal manda a marca quando o paciente escolhe "Não sei dizer", e a tela do profissional mostra "Tipo não informado pelo paciente". Antes do merge desta, o backend recusaria a marca.
- **Provas:**
  - domínio: valor único, só no subtipo certo, ausente quando não enviado;
  - registro: equipe 400, paciente grava;
  - PostgreSQL: titular recebe 400.

NUX-25 (campo de reação): BACKLOG, por decisão do proprietário. NUX-27 (texto de urgência): web, fora desta PR.

## Revisão R4 cruzada (subagente `tenant-security-reviewer`, mesmo modelo, não independente)

- **Segurança: sem bloqueante.** Tenant e carteira estão corretos.
  - O fallback sem a concessão não amplia a leitura.
  - Não há ciclo de locks com os escritores de concessão.
  - O `try/catch` da concessão não mascara erro de banco.
  - A disponibilidade devolve só o booleano do tenant do JWT.
- **Corrigido nesta PR:**
  - teste de que um erro de banco na concessão é relançado (409) e não vira "autoria";
  - o histórico agora é buscado só na revisão atual de cada restrição (BAIXA, desempenho);
  - prova PostgreSQL de corrida entre duas reconfirmações "sem alteração" (só uma vence) e da ausência recusada com restrição confirmada.
- **Bloqueante de processo:** a correção da F3 seguiu outro caminho que não o da Q-B aprovada (ver acima). **Pendente de aceite do proprietário** antes do merge.
- **Sem cobertura em banco:** revogação concorrente da concessão durante a listagem. É seguro pela análise de locks, mas não foi provado.
- Avaliação inexistente (`{avaliacao: null}`) não gera auditoria, porque não houve leitura de dado. Decisão registrada.
