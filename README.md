# OctaClin

Sistema SaaS clinico para consultoria, acompanhamento de pacientes, agenda, formularios, comunicacoes e portais por perfil.

## Documentacao principal para continuidade

Antes de qualquer nova fase de desenvolvimento, leia:

- `AGENTS.md` - guia obrigatorio para agentes de IA.
- `RESUMO_FASES_CONCLUIDAS.md` - resumo das fases concluidas ate aqui.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` - checklist vivo das proximas fases ate producao.
- `DECISOES_ARQUITETURA.md` - decisoes de arquitetura ja tomadas.
- `VARIAVEIS_AMBIENTE.md` - variaveis necessarias sem valores secretos.
- `RUNBOOK_PRODUCAO.md` - operacao, deploy, validacao e incidentes.
- `CHECKLIST_GO_LIVE.md` - criterios antes de incluir clientes reais.

## Estrutura

- `octaclin-backend` - backend NestJS/TypeORM/PostgreSQL.
- `octaclin-web` - frontend Next.js com BFF.
- `fase-*.md` - documentacao incremental de cada fase.

## Regra de continuidade

O projeto evolui por fases numeradas. Ao concluir uma fase, atualize o checklist vivo, crie/atualize o arquivo da fase, valide, commite e faca push.
