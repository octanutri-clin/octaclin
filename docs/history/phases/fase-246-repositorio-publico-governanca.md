# Fase 246 - Operacao segura de repositorio publico e reconciliacao documental

Status: concluida em 2026-08-20. Esta fase nao altera o runtime do OctaClin.
Ela registra e protege a decisao operacional de manter o repositorio publico
para usar GitHub Actions sem custo.

## Decisao

`octanutri-clin/octaclin` e publico. Isso permite o uso de Actions no plano
gratuito, mas torna obrigatorio tratar o codigo, a documentacao, issues, PRs e
logs como conteudo publicavel. Segredos e dados clinicos ficam exclusivamente
em provedores externos e GitHub Secrets.

## Controles aplicados no GitHub

- Secret Scanning: ativo.
- Push Protection: ativo.
- Dependabot Security Updates: ativo.
- Reporte privado de vulnerabilidade: ativo.
- Permissao padrao de workflow: somente leitura; workflows nao podem aprovar
  pull requests.
- Ruleset ativo `main: PR e CI obrigatorios` (id `21090674`): PR obrigatorio,
  sete checks de CI, conversa resolvida, branch atualizada, bloqueio de
  force-push e exclusao. A contagem de aprovacao e zero para o mantenedor unico
  conseguir integrar uma mudanca depois dos checks.

## Auditoria de segredo

- O scanner local encontrou somente `octaclin-backend/.env.integracao`; ele e
  ignorado por `.gitignore` e nao e rastreado pelo Git.
- A busca nos 594 commits alcancaveis nao encontrou token Meta, refresh token
  Google, chave privada ou URL autenticada real. Os candidatos de formato eram
  fixtures, testes ou documentacao.
- O GitHub nao tinha alerta aberto de Secret Scanning apos a ativacao.
- A cobertura nao substitui rotacao: qualquer alerta futuro deve revogar ou
  rotacionar o segredo antes da limpeza do texto.

## Estado real das fases adjacentes

- Fases 244 e 245 concluidas: dependencias fora do Mobile atualizadas e web em
  Next.js 16 com Turbopack.
- O PR `#73` corrigiu a Fase 201 com advisory lock PostgreSQL por
  tenant/processador. A fase continua aberta ate criar worker no Render,
  configurar `web`/`worker` e provar uma entrega sintetica unica.
- Os 37 alertas Dependabot abertos permanecem concentrados no Mobile. A Fase
  243 trata essa atualizacao e o Mobile continua fora da oferta.

## Validacao

- `git pull --ff-only origin main`: checkout alinhado ao commit `58229eb`.
- `pnpm security:secrets`: identificou apenas `.env.integracao` ignorado e nao
  rastreado; resultado esperado para o checkout local.
- `pnpm test:security`: aprovado.
- Historico Git: 594 commits examinados por padroes de alta confianca, sem
  segredo real identificado.
- GitHub: Secret Scanning sem alertas abertos e ruleset ativo; monitores e
  backup mais recentes concluidos com sucesso.

## Pendencias

- Nao escalar o backend antes do worker dedicado da Fase 201.
- Ao atualizar o Mobile na Fase 243, tratar todos os alertas Dependabot daquele
  ecossistema em conjunto.
- Reavaliar React 19 e a remocao do shim BFF em fase dedicada; Next.js 16 ja
  esta concluido.
