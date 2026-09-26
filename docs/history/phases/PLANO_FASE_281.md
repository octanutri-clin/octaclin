# Fase 281 - PB-27: auditoria da propria clinica

## Decisao confirmada

Em 2026-09-26, o proprietario confirmou acesso exclusivo de `Client` ao
proprio tenant, mostrando data, usuario responsavel, acao e tipo de recurso;
consulta com filtros e paginacao; ocultacao de conteudo clinico, IP, navegador
e metadados internos; preservacao dos 3650 dias da politica existente.
Essa confirmacao define o escopo desta entrega e nao altera os gates externos
de aceite juridico/go-live do projeto.

Modelo escolhido: Sol / alto, substituindo Astra / alto conforme preferencia
do proprietario. Skills: context-engineering, planning-and-task-breakdown,
test-driven-development, security-review, gdpr-compliance,
nestjs-best-practices e typeorm; fechar-fase para documentacao.
Revisao independente: tenant-security-reviewer. Plugins externos nao recebem
dados de pacientes ou de producao. Somente fixtures sinteticas nas provas.

## Contrato e menor escopo (R4)

- `GET /cliente/auditoria` e BFF `GET /api/cliente/auditoria`.
- Guards JWT, papel exato Client e permissao `cliente.acessar`.
- Tenant somente da credencial; RLS transacional mais predicado SQL. Join
  da identidade pelo mesmo tenant. Ator ausente ou externo tem `usuarioId: null`.
- Resposta `{ itens, pagina, limite, temMais }`; cada item tem exclusivamente
  `{ criadoEm, usuarioId, acao, recursoTipo }`. Usuario e identificado por
  UUID opaco, sem descriptografar nome/email, inclusive em registros antigos.
- Filtros: `usuarioId` UUID, `acao`/`recursoTipo` codigos exatos ate 120
  caracteres; `inicio` e `fim` datas reais AAAA-MM-DD em UTC, ambas inclusivas
  por dia civil (SQL converte o fim em limite exclusivo do dia seguinte).
- `pagina` 1..10000 e `limite` 1..100 (padrao 25); consulta busca uma linha a
  mais para `temMais`. Ordem decrescente por data e ID interno para desempate.
  A trilha e viva: novas acoes entre paginas podem deslocar resultados.
- Campos desconhecidos, tenant arbitrario e parametros repetidos sao rejeitados.
- Aba Auditoria com filtros, anterior/proxima, estados vazio/carregando/erro,
  nova tentativa, datas UTC explicitas e limpeza completa do formulario.
- Leitura gera `cliente.auditoria.consultar` com retentativa pelo outbox
  existente, sem filtros ou conteudo da resposta nos metadados.
- Sem migration, alteracao de retencao, exclusao, exportacao ou nova integracao.

## Execucao e aceite

1. Testes de contrato em vermelho; implementar validacao/projecao minima.
2. Integrar controller, modulo, BFF, tipos e interface.
3. Provar Client 200, demais papeis 403, anonimo 401, entrada indevida 400;
   provar isolamento A/B e ator externo/nulo em PostgreSQL no gate RLS do CI.
4. Revisar tenancy e dados, executar gates locais, registrar limitacoes.
5. Atualizar docs e abrir PR. Por pedido do proprietario, parar apos abrir;
   checks remotos e merge ficam com ele. PB-21 vem depois do aceite.

## Rollback

Reverter a entrega remove endpoint, BFF e aba. Nao ha DDL ou migracao de dados.
Eventos de consulta ja gravados permanecem na trilha imutavel e seguem a
retencao vigente; nao apagar registros como parte do rollback.
Nenhuma acao de staging/producao esta incluida nesta fase.
