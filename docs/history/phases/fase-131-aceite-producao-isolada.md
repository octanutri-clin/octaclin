# Fase 131 - Aceite da producao isolada

Status: concluida em 2026-07-26.

## Escopo aceito

- Banco Neon, Redis Upstash e servicos Render de producao separados do staging.
- Migrations aplicadas no banco dedicado sem massa de staging.
- Credenciais expostas rotacionadas e atualizadas apenas no Render.
- Auditoria operacional confirmou ausencia de referencias de staging nos
  ambientes de producao e ausencia de dados do tenant de staging no banco.
- Runtime revalidado: backend, banco, Redis, email, WhatsApp e web saudaveis.

## Evidencia final

Em 2026-07-26, `/health` retornou `ok`; `/health/detalhado` confirmou `ok`
para backend, banco, Redis, email e WhatsApp; e o login web respondeu HTTP
200. O scanner local de secrets tambem passou.

## Ressalva

Google Calendar permanece `degradado` exclusivamente pela configuracao do
callback OAuth de producao. Essa pendencia pertence a Fase 136 e nao bloqueia
o isolamento entre staging e producao aceito nesta fase. Nao habilitar fluxo
Google Calendar para clientes reais ate a validacao ponta a ponta dessa fase.

## Proxima fase

Fase 132: dominio, SSL e identidade de envio.
