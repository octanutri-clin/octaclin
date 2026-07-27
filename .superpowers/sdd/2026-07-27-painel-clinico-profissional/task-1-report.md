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
  constraint PostgreSQL dos cinco estados e restaura os dois estados anteriores
  no `down`.
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

## Limites e preocupacoes

- A migracao foi validada estaticamente e pelo typecheck, mas nao foi aplicada
  contra um PostgreSQL real nesta tarefa.
- O brief nao inclui teste visual/E2E novo para os tres botoes de desfecho; a
  verificacao web desta tarefa cobre lint, tipos, autorizacao, contrato de rota
  dinamica e build.
- Conforme o limite explicito do brief, registrar um desfecho nao adiciona
  comportamento novo de sincronizacao com Google Calendar.
- Nenhum dashboard, formulario, documento de fase ou integracao Google
  adicional foi implementado.
