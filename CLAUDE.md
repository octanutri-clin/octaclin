# Instrucoes para Claude Code - OctaClin

Voce esta trabalhando no projeto OctaClin.

## Contexto essencial

- Produto: OctaClin, SaaS clinico multi-tenant para consultoria, acompanhamento de pacientes, agenda, formularios, comunicacoes e portais por perfil.
- Repositorio GitHub: `https://github.com/octanutri-clin/octaclin`
- Branch principal: `main`
- Ultima fase concluida: Fase 129 - Staging com dados realistas.
- Proxima fase planejada: Fase 130 - Piloto interno controlado.
- Ultimo commit conhecido: `6f8ba93 Adiciona massa realista de staging`.

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

Execute a Fase 130 - Piloto interno controlado.

Objetivo:

Criar a estrutura operacional para um piloto interno controlado antes do go-live real. O piloto deve permitir testar o OctaClin com poucos usuarios ficticios/autorizados, registrar problemas, acompanhar decisoes de aceite e definir criterios claros para avancar ou bloquear producao.

Escopo sugerido:

1. Criar um runbook/checklist de piloto interno:
   - quem participa;
   - quais perfis testar: cliente, profissional, paciente, suporte/operador;
   - quais jornadas executar;
   - criterios de sucesso;
   - criterios de bloqueio;
   - como registrar bugs;
   - como decidir aceite do piloto.
2. Criar um arquivo de acompanhamento do piloto, por exemplo `RUNBOOK_PILOTO_INTERNO.md` ou `PILOTO_INTERNO_CONTROLE.md`.
3. Conectar esse material ao `CHECKLIST_GO_LIVE.md`, `PREFLIGHT_PRODUCAO.md`, `STATUS_ATUAL_PROJETO.md` e `TESTES_E_VALIDACOES.md`.
4. Se fizer sentido, criar um validador documental simples para garantir secoes obrigatorias.
5. Nao convidar clientes reais ainda. Esta fase e preparacao e controle do piloto.

Validacoes esperadas:

```powershell
git diff --check
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Se criar teste documental, rode tambem o novo teste.

Depois da Fase 130:

- Commit sugerido: `Adiciona controle de piloto interno`
- Push para `main`
- Atualizar o roadmap para apontar a Fase 131 - Producao isolada de staging.

## Dependencias operacionais

Se for necessario aplicar o seed remoto de staging antes do piloto, peca explicitamente a `DATABASE_URL` de staging ao usuario e confirme que e Neon staging, nao producao.

Comando documentado:

```powershell
$env:DATABASE_URL='<url do Neon staging>'
pnpm seed:staging
```

Nao avance para producao real sem:

- restore real em banco dedicado;
- massa ficticia aplicada e validada no staging;
- piloto interno controlado;
- producao isolada de staging;
- dominio/SSL/identidade de envio;
- checklist juridico/comercial.
