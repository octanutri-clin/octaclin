# Instrucoes para Claude Code - OctaClin

Voce esta trabalhando no projeto OctaClin.

## Contexto essencial

- Produto: OctaClin, SaaS clinico multi-tenant para consultoria, acompanhamento de pacientes, agenda, formularios, comunicacoes e portais por perfil.
- Repositorio GitHub: `https://github.com/octanutri-clin/octaclin`
- Branch principal: `main`
- Ultima fase concluida: Fase 224 - Oferta comercial e ativacao assistida.
- Proxima fase recomendada: Fase 225 - Dominio, identidade e comunicacoes
  transacionais. Confirme a prioridade no checklist antes de iniciar.
- Ultimo commit conhecido: consulte `git log --oneline --max-count=8`; este
  arquivo nao deve fixar um hash que rapidamente fica defasado.

## Antes de desenvolver

Rode:

```powershell
git status --short
git pull
git log --oneline --max-count=8
```

Leia obrigatoriamente:

- `AGENTS.md`
- `STATUS_ATUAL_PROJETO.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`
- `HANDOFF-TECNICO-OCTACLIN.md`
- `PREFLIGHT_PRODUCAO.md`
- `TESTES_E_VALIDACOES.md`
- `RUNBOOK_STAGING_DADOS.md`
- `CHECKLIST_GO_LIVE.md`

## Regras de trabalho

- Continue por fases numeradas.
- Ao concluir cada fase:
  - atualize `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`;
  - atualize `RESUMO_FASES_CONCLUIDAS.md`;
  - atualize `STATUS_ATUAL_PROJETO.md`;
  - crie/atualize o arquivo `fase-XXX-*.md`;
  - atualize runbooks/checklists afetados;
  - rode validacoes;
  - faca commit e push para `main`.
- Nao exponha secrets, tokens, senhas reais, URLs reais de banco/cache ou chaves API.
- Nao use dados reais de pacientes/clientes em fixtures.
- Nunca rode seed de staging em producao.
- Preserve alteracoes existentes do usuario; nao use `git reset --hard`.
- Use padroes existentes do repo. Nao introduza arquitetura paralela desnecessaria.

## Estado atual

Ja existem:

- login, permissoes, BFF e cookies HttpOnly;
- portal do cliente, profissional e paciente;
- agenda com Google Calendar;
- comunicacoes por email e WhatsApp Meta;
- LGPD, auditoria, outbox, alertas e runbooks;
- backup/restore documentado;
- suite E2E critica;
- massa ficticia de staging pronta.
- producao isolada, backups/restore, monitoramento externo e smokes de leitura
  dos quatro papeis em producao;
- Gmail API e Google Calendar com OAuth de producao e sincronizacao validada;
- controle manual de planos, limites e assinatura para venda assistida.

Fase 128 adicionou:

- `pnpm test:e2e:criticas`
- `validar-jornadas-criticas.ps1`
- `octaclin-web/tests/visual/jornadas-criticas.spec.mjs`

Fase 129 adicionou:

- `RUNBOOK_STAGING_DADOS.md`
- `octaclin-backend/src/infraestrutura/banco-dados/seeds/staging-fixtures.json`
- `octaclin-backend/src/infraestrutura/banco-dados/seeds/seed-staging.ts`
- `scripts/test-staging-fixtures.mjs`
- `pnpm test:staging-fixtures`
- `pnpm seed:staging`

## Proxima fase

Use `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` como fonte de verdade. A sequencia
pos-Fase 223 inicia pela Fase 224 - oferta comercial, planos e ativacao
assistida; as fases 225 a 233 registram dominio e identidade, juridico,
pagamentos, onboarding, seguranca, WhatsApp, E2E mutavel, operacao e piloto
real. Nao trate uma fase como concluida sem atualizar seus documentos vivos e
sem distinguir validacao local, staging e producao.

## Dependencias operacionais

Se for necessario aplicar o seed remoto de staging antes do piloto, peca explicitamente a `DATABASE_URL` de staging ao usuario e confirme que e Neon staging, nao producao.

Comando documentado:

```powershell
$env:DATABASE_URL='<url do Neon staging>'
pnpm seed:staging
```

Nao avance para clientes reais sem:

- restore real em banco dedicado;
- massa ficticia aplicada e validada no staging;
- piloto interno controlado;
- producao isolada de staging;
- dominio e identidade de envio;
- aceite juridico/comercial;
- jornadas mutaveis em staging com dados sinteticos;
- onboarding e suporte assistido preparados.
