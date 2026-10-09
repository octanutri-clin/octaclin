# Handoff — Fase 308 implementada

## Estado

Implementação pronta para revisão na branch `feature/fase-308-resumo-exames`,
base `04e66efc` (PR #384/Fase 307). Worktree:
`/workspace/octaclin/.worktrees/feature-fase-308-resumo-exames`.
PR ainda não aberta; preparar um único PR com código, testes e documentação.
Não houve migration, merge, deploy ou consulta a dados clínicos reais.

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
- `git diff --check`: repetir após as últimas edições documentais, antes do
  commit/push.

## Pendências/gates sem falsa aprovação

- `pnpm --dir octaclin-web test:authz` foi iniciado, mas interrompido após os
  harnesses de correlação, origem, autorização, sessões, profissionais,
  pacientes, agendamento, questionários e dashboard passarem. O comando
  compila 19 harnesses TypeScript isolados em série; o BFF específico da fase
  também passou diretamente. Registrar esse comando como parcial/interrompido,
  não PASS.
- A suíte a11y completa (272 testes) foi interrompida após três testes gerais;
  o teste específico do detalhe do prontuário passou em desktop/mobile.
- PostgreSQL/RLS local: SKIPPED. CI completo, Demo local smoke, Governança e
  revisão humana/independente aguardam PR. Não declarar produção validada.
- Monitor de produção separado `37977323201` falhou em “Saude externa”; causa
  ainda não diagnosticada, sem relação estabelecida com esta fase. Migration
  1064 da fase anterior não foi verificada operacionalmente neste ciclo.

## Próxima ação

Revisar o diff final, confirmar scanner e `git diff --check`, commitar, abrir a
PR nesta branch e acompanhar cada check pelo run ID. Tratar qualquer falha de
Governança/Smoke com evidência do job; não editar inventário para mascarar
validade. Solicitar revisão R4 humana. Merge, migration e deploy permanecem
fora deste handoff.
