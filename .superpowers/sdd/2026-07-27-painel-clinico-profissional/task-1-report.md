# Task 1 - Ciclo de vida e desfecho de consulta

## Resultado

Implementacao concluida na branch `integrate/producao-hardening`, sem push.
O escopo ficou restrito ao brief da Task 1: ciclo de vida da consulta,
endpoint auditado, BFF, cliente web e controles da agenda.

## TDD

### RED 1

Foram adicionados primeiro os testes para:

- profissional registrar desfecho apenas na propria consulta;
- remarcacao produzir o estado ativo `reagendada`;
- consulta terminal rejeitar um segundo desfecho;
- `reagendada` continuar bloqueando conflito;
- `concluida` liberar o horario.

Comando:

```powershell
pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand
```

Falha observada: `TS2339`, pois `ServicoAgenda.registrarDesfecho` ainda nao
existia.

### RED 2

Depois do primeiro GREEN, foi adicionado um teste para o endpoint legado de
cancelamento nao transformar `concluida` ou `falta` em `cancelada`.

Falha observada: a promessa resolvia e alterava uma consulta concluida para
`cancelada`.

### GREEN

O servico passou a bloquear transicoes posteriores para qualquer estado
terminal e os 18 testes focados ficaram verdes.

## Implementacao

- `StatusAgendaConsulta` agora aceita `agendada`, `reagendada`, `concluida`,
  `falta` e `cancelada`.
- A migracao `1720000001002-AdicionarDesfechosConsultaAgenda.ts` adiciona a
  constraint PostgreSQL dos cinco estados e uma exclusion constraint por
  tenant, profissional e intervalo para consultas ativas. O `down` remove a
  exclusion constraint e restaura os dois estados anteriores sem remover a
  extensao compartilhada `btree_gist`.
- Remarcacoes bem-sucedidas persistem `reagendada`.
- Conflitos locais consideram `agendada` e `reagendada`; estados terminais nao
  ocupam horario.
- `registrarDesfecho` aplica tenant e escopo do profissional, rejeita consulta
  ausente ou encerrada, persiste o desfecho e adiciona historico ao payload.
- O cancelamento legado preserva idempotencia para `cancelada`, mas rejeita
  alteracao de `concluida` ou `falta`.
- `POST /agenda/consultas/:consultaId/desfecho` exige
  `agenda.consultas.criar` e registra auditoria
  `agenda.consulta.desfecho`.
- O BFF usa parametros dinamicos assincronos, valida permissao e encaminha
  `x-octaclin-origem: agenda`.
- O cliente web expõe `registrarDesfechoConsulta`.
- O painel renderiza rotulos para os cinco estados, mantem o editor de
  remarcacao para `agendada` e `reagendada` e apresenta botoes de icone com
  tooltip para concluir, registrar falta e cancelar.

## Validacoes

Obrigatorias do brief:

- `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand`:
  1 suite, 18 testes aprovados.
- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.

Regressoes adicionais:

- `pnpm --dir octaclin-backend test --runInBand`: 52 suites e 276 testes
  aprovados.
- `pnpm --dir octaclin-web test:next15`: 41 arquivos validados.
- `pnpm --dir octaclin-web test:authz`: 11 testes aprovados.
- `pnpm --dir octaclin-web build`: build Next.js 15.5.22 aprovado, incluindo
  `/api/agenda/consultas/[consultaId]/desfecho`.
- `git diff --check`: sem erros de whitespace; apenas avisos esperados de
  conversao LF/CRLF no Windows.

## Correcoes apos revisao

- As transicoes que encerram, remarcam ou atualizam integracao agora usam
  bloqueio pessimista dentro da transacao tenant-aware, impedindo que dois
  desfechos terminais concorrentes sejam persistidos.
- O desfecho `cancelada` usa o mesmo fluxo de cancelamento legado para remover
  o evento Google Calendar e persistir o resultado da sincronizacao.
- O `down` da migracao converte `reagendada`, `concluida` e `falta` antes de
  restaurar a constraint anterior.
- A regressao visual agora simula a sessao completa do SuperAdmin e cobre
  reagendamento e cancelamento pelo endpoint de desfecho.

## Validacao complementar

- `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts 1720000001002-AdicionarDesfechosConsultaAgenda.spec.ts --runInBand`:
  2 suites e 20 testes aprovados.
- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list`:
  38 cenarios aprovados em 2,4 minutos.

## Correcao SDD round 2

Finding corrigido: a validacao antecipada de conflito nao serializava duas
criacoes ou remarcacoes concorrentes de consultas diferentes.

- A migracao agora habilita `btree_gist` e cria
  `ex_agenda_consultas_profissional_horario_ativo` com `EXCLUDE USING gist`
  sobre `(tenant_id, profissional_id, tstzrange(inicio_em, fim_em, '[)'))`.
- O predicado parcial inclui apenas `agendada` e `reagendada`, portanto
  `concluida`, `falta` e `cancelada` continuam liberando o horario.
- Criacao e remarcacao traduzem somente a violacao PostgreSQL `23P01` dessa
  constraint para o mesmo `BadRequestException` de conflito ja usado pela
  validacao antecipada.
- A protecao preserva o tenant na propria chave de exclusao e nao altera RLS,
  desmarcamento ou notificacoes futuras.

TDD:

- RED: os quatro novos testes falharam porque a migracao nao continha a
  exclusion constraint e `QueryFailedError` escapava nas duas operacoes.
- GREEN:
  `pnpm --dir octaclin-backend exec jest src/infraestrutura/banco-dados/migracoes/1720000001002-AdicionarDesfechosConsultaAgenda.spec.ts src/modulos/agenda/aplicacao/servico-agenda.spec.ts --runInBand`;
  2 suites e 23 testes aprovados.
- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `git diff --check`: sem erros de whitespace; apenas avisos esperados de
  conversao LF/CRLF no Windows.

## Limites e preocupacoes

- A migracao foi validada estaticamente e pelo typecheck, mas nao foi aplicada
  contra um PostgreSQL real nesta tarefa.
- O brief nao inclui o fluxo autenticado de desmarcamento pelo paciente nem a
  comunicacao dirigida por origem. Ambos foram planejados como Task 5 apos o
  dashboard clinico disponibilizar alerta seguro ao profissional.
- Nenhum dashboard, formulario, documento de fase ou integracao Google
  adicional foi implementado.
