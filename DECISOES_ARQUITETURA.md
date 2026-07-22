# OctaClin - Decisoes de arquitetura

Este arquivo registra decisoes ja tomadas para evitar que outro agente reprojete o produto sem necessidade.

## ADR-001 - Nome e referencia

- Decisao: o produto se chama OctaClin.
- Contexto: LiveClin foi usado apenas como sistema de referencia/modelagem.
- Consequencia: textos, docs, commits e UI devem usar OctaClin.

## ADR-002 - Multi-tenancy

- Decisao: tenant e derivado do JWT autenticado e aplicado no backend.
- Nao usar: tenant livre em header ou body como fonte de verdade.
- Consequencia: todo servico sensivel deve receber `tenantId` do usuario autenticado e usar `ExecutorTenant`.

## ADR-003 - Backend

- Decisao: backend principal em NestJS com TypeORM e PostgreSQL.
- Consequencia: novos dominios devem seguir modulo NestJS, service, controller, DTOs e specs focadas.

## ADR-004 - Frontend e BFF

- Decisao: frontend em Next.js App Router com BFF em `app/api`.
- Consequencia: chamadas autenticadas do browser devem passar pelo BFF para usar cookies HttpOnly e renovar sessao.

## ADR-005 - Sessao

- Decisao: access token e refresh token ficam em cookies HttpOnly no BFF.
- Consequencia: evitar expor tokens ao JavaScript do browser.

## ADR-006 - Criptografia e PII

- Decisao: dados sensiveis devem ser criptografados no backend ou retornados apenas por DTO autorizado.
- Consequencia: nao retornar entidades ORM cruas quando elas contem hash, token, senha, PII criptografada ou payload sensivel.

## ADR-007 - Auditoria

- Decisao: leituras sensiveis e mutacoes administrativas devem gerar trilha.
- Consequencia: novas funcoes de suporte, LGPD, usuario, paciente, agenda e comunicacao precisam considerar auditoria.

## ADR-008 - Arquivamento

- Decisao: preferir arquivamento logico a delete fisico em dados clinicos e operacionais.
- Consequencia: deletes de pacientes/profissionais/usuarios devem ser avaliados como `ativo=false`, `arquivadoEm` ou status equivalente.

## ADR-009 - Email

- Decisao: suportar SMTP Gmail e Gmail API.
- Consequencia: novas mensagens transacionais devem usar adaptador existente, outbox quando aplicavel e nao implementar provedor isolado sem necessidade.

## ADR-010 - WhatsApp

- Decisao: usar Meta WhatsApp Cloud API.
- Consequencia: templates precisam ser aprovados na Meta e mapeados no OctaClin antes de automacoes reais.

## ADR-011 - Agenda

- Decisao: agenda interna deve sincronizar com Google Calendar.
- Consequencia: OctaClin deve manter estado proprio da consulta e tratar Google Calendar como integracao externa, nao unica fonte de verdade.

## ADR-012 - Convites administrativos

- Decisao: convites administrativos reutilizam `tokens_redefinicao_senha`.
- Contexto: isso evita criar tabela nova antes de amadurecer o fluxo.
- Consequencia: token recebe `payload.origem = convite_usuario_cliente`, expiracao, criador, reenviador/revogador e link para `/recuperar-senha`.

## ADR-013 - Portal do cliente

- Decisao: `Client` gerencia a conta SaaS, nao rotinas clinicas.
- Consequencia: portal do cliente deve mostrar conta, assinatura, usuarios, convites, configuracoes e billing; nao deve virar console clinico.

## ADR-014 - Portal do paciente

- Decisao: `Patient` usa portal isolado.
- Consequencia: paciente nao acessa console operacional nem portal do cliente.

## ADR-015 - Deploy

- Decisao atual: GitHub privado, Render, Neon e Upstash.
- Consequencia: documentacao de producao deve considerar esses provedores ate decisao explicita de troca.

## ADR-016 - Desenvolvimento por fases

- Decisao: continuar por fases numeradas.
- Consequencia: cada fase deve ter commit, validacao e documentacao propria. O checklist vivo deve ser atualizado.
