# Fase 8 - Operacoes e confiabilidade OctaClin

## Objetivo

Transformar os mecanismos de confiabilidade da Fase 7 em superficie operacional para suporte, implantacao e acompanhamento de producao.

## Backend

Novo modulo `operacoes`, protegido por JWT e papel `SuperAdmin`:

- `GET /operacoes/resumo`
- `GET /operacoes/outbox/falhas?limite=50`
- `POST /operacoes/outbox/:id/reprocessar`
- `GET /operacoes/mobile/sincronizacoes?limite=50`

O endpoint de reprocessamento recoloca eventos `falhou` como `pendente`, limpa erro/processamento e permite que o processador de outbox publique o job novamente.

## Web

Nova rota:

- `/operacoes`

A tela apresenta indicadores de outbox, lista de falhas com acao de reprocessamento e ultimas sincronizacoes mobile. Nesta fase a pagina usa dados estaticos de demonstracao; a integracao autenticada com a API fica pronta para o proximo incremento.

## Risco reduzido

- Falhas de notificacao deixam de depender somente de logs.
- Suporte passa a ter um ponto claro para diagnosticar outbox e sync mobile.
- Retentativas operacionais ficam separadas do fluxo clinico do paciente.

## Validacao executada

- Backend `tsc --noEmit`: passou.
- Backend `jest`: 10 suites e 25 testes passando.
- Backend `nest build`: passou.
- Web `tsc --noEmit`: passou.
- Web `next build`: passou, incluindo rota `/operacoes`.
- `work/checar-imports-relativos.js`: 112 imports backend OK.
- `work/checar-imports-web.js`: 11 imports web OK.
- Varredura de nome legado em `outputs`: sem ocorrencias.
