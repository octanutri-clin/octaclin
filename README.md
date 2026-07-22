# OctaClin

Sistema SaaS clinico para consultoria, acompanhamento de pacientes, agenda, formularios, comunicacoes e portais por perfil.

## Documentacao principal para continuidade

Antes de qualquer nova fase de desenvolvimento, leia:

- `AGENTS.md` - guia obrigatorio para agentes de IA.
- `RESUMO_FASES_CONCLUIDAS.md` - resumo das fases concluidas ate aqui.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` - checklist vivo das proximas fases ate producao.
- `DECISOES_ARQUITETURA.md` - decisoes de arquitetura ja tomadas.
- `STATUS_ATUAL_PROJETO.md` - snapshot do estado atual e riscos.
- `PREFLIGHT_PRODUCAO.md` - prontidao por area e gates antes/depois de cada fase.
- `HANDOFF-TECNICO-OCTACLIN.md` - handoff tecnico atualizado.
- `ONBOARDING_DESENVOLVEDOR.md` - entrada de novo desenvolvedor/agente.
- `COORDENACAO_DESENVOLVIMENTO_IA.md` - regras para trabalhar com multiplas IAs/desenvolvedores.
- `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md` - escopo recomendado para avancar por varias fases.
- `MENSAGEM_HANDOFF_DESENVOLVEDOR.md` - mensagem pronta para repassar o contexto.
- `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md` - ferramentas, plugins e acessos recomendados.
- `DEVELOPMENT_LOG.md` - diario curto de fases concluidas por devs/agentes.
- `RETORNO_APOS_DESENVOLVEDOR.md` - checklist para retomar apos trabalho externo.
- `MAPA_ROTAS_PERMISSOES.md` - mapa de papeis, permissoes e rotas.
- `TESTES_E_VALIDACOES.md` - matriz de comandos de validacao.
- `VARIAVEIS_AMBIENTE.md` - variaveis necessarias sem valores secretos.
- `RUNBOOK_PRODUCAO.md` - operacao, deploy, validacao e incidentes.
- `CHECKLIST_GO_LIVE.md` - criterios antes de incluir clientes reais.

## Estrutura

- `octaclin-backend` - backend NestJS/TypeORM/PostgreSQL.
- `octaclin-web` - frontend Next.js com BFF.
- `fase-*.md` - documentacao incremental de cada fase.

## Regra de continuidade

O projeto evolui por fases numeradas. Ao concluir uma fase, atualize o checklist vivo, crie/atualize o arquivo da fase, valide, commite e faca push.

Quando outro desenvolvedor ou agente assumir, ele pode avancar por varias fases, mas deve fechar cada fase separadamente com documentacao, validacao, commit e push antes de iniciar a proxima.

## Validacao rapida

```powershell
pnpm validate:docs
```

Validacao ampliada:

```powershell
pnpm validate
```
