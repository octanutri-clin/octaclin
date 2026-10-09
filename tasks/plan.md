# Handoff — Fase 308 pronta para revisão humana

## Estado

Implementação pronta para revisão na branch `feature/fase-308-resumo-exames`,
base `04e66efc` (PR #384/Fase 307), commit `537665ce`. PR #385 está aberta:
https://github.com/octanutri-clin/octaclin/pull/385. Worktree:
`/workspace/octaclin/.worktrees/feature-fase-308-resumo-exames`.
CI obrigatório passou; revisão humana ainda pendente. Não houve migration,
merge, deploy ou consulta a dados clínicos reais.

Escopo e decisões aprovadas pelo proprietário estão em
[`PLANO_FASE_308.md`](../docs/history/phases/PLANO_FASE_308.md); status
executável em [`todo.md`](todo.md). Não reabrir decisões nem refazer auditoria.

## Implementado

- Regra única de faixa compartilhada por PB-17 e pelo resumo; rejeita limites
  inválidos/invertidos, admite limites unilaterais e vírgula decimal.
- Leitor no mesmo `EntityManager`, com tenant/paciente/soft-delete explícitos,
  seleção mínima, 100 coletas e teto de 10.000 resultados; falhas de dados
  cifrados/malformados/overflow retornam indisponível sem parcial.
- Último resultado por grupo antes da classificação; catálogo por ID e nomes
  livres por nome + unidade + método; duplicidade sinalizada sem escolha ou
  recuperação do resultado anterior; até 10 destaques.
- DTO allowlist, autorização de papel/tenant/`pacientes.ler`, BFF
  `private, no-store`, cartão acessível na Leitura clínica com retry, limites,
  origem e navegação para Exames.
- Fixtures e regressões da fase em backend, BFF, desktop, mobile e axe.

## Evidências locais

- Backend Jest integral: PASS — 263 suítes e 2.379 testes; 3 suítes/38 testes
  ignorados pela configuração existente.
- Backend typecheck e build: PASS. Web typecheck e build: PASS.
- Web lint: PASS, 0 erros e 63 avisos de lint existentes (incluem regras de
  efeitos React no prontuário e em outros módulos).
- Playwright Fase 308: PASS — 6 testes em desktop/mobile.
- Acessibilidade focada do prontuário: PASS — 2 testes desktop/mobile com axe.
- Harness BFF do prontuário: PASS — 4/4; `pnpm security:secrets`: PASS.
- `git diff --check` da revisão final: PASS.

## Evidência da PR

- OctaClin CI `37982409232`: PASS, incluindo Backend NestJS, Web Next.js,
  Demo local smoke (16m12s), Governança, Mobile Expo, PR Gate, Operação de
  lançamento e Rollout seguro.
- Imagens `37982409141`: backend, ia-service e web PASS; Trivy warning PASS;
  `Provenance do SBOM` SKIPPED (condição do workflow).
- CodeQL `37982409220`: Python e JavaScript/TypeScript PASS.
- Dependency Review `37982409219`: PASS.
- Semgrep `37982409360`: warning PASS; Semgrep OSS PASS.
- Nenhum check obrigatório da PR ficou pendente ou falhou.
- PostgreSQL/RLS local permaneceu SKIPPED; não registrar prova local de RLS.
  A CI passou, sem comprovar aplicação em produção.

## Pendências/gates sem falsa aprovação

- `pnpm --dir octaclin-web test:authz` foi iniciado, mas interrompido após os
  harnesses de correlação, origem, autorização, sessões, profissionais,
  pacientes, agendamento, questionários e dashboard passarem. O comando
  compila 19 harnesses TypeScript isolados em série; o BFF específico da fase
  também passou diretamente. Registrar esse comando como parcial/interrompido,
  não PASS.
- A suíte a11y completa (272 testes) foi interrompida após três testes gerais;
  o teste específico do detalhe do prontuário passou em desktop/mobile.
- PostgreSQL/RLS local: SKIPPED. CI completo, Demo local smoke e Governança
  passaram. Revisão humana/independente ainda aguarda na PR #385. Não declarar
  produção validada.
- Monitor de produção separado `37977323201` falhou em “Saude externa”; causa
  ainda não diagnosticada, sem relação estabelecida com esta fase. Migration
  1064 da fase anterior não foi verificada operacionalmente neste ciclo.

## Próxima ação

Solicitar revisão humana R4 da PR #385 e resolver os comentários recebidos. O
diff foi revisado, scanner e `git diff --check` passaram, commit e PR estão na
mesma branch, e os checks foram registrados acima. Não editar inventário para
mascarar validade. Merge, migration e deploy permanecem fora deste handoff.
