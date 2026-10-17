# PA07 — checklist de coordenação entre abas

Plano e contratos: [plan-pos-320-pa07.md](plan-pos-320-pa07.md).
Estado em2026-10-16: desenvolvimento autorizado; núcleo e T04 de interface
implementados e integração Sol validada localmente. Base `62a50104` (#422);
entrega em PR única, com gates do HEAD e revisão ainda a conferir antes de
disponibilização. Resultados no relatório final.

- [x] T00 — branch/worktree isoladas; merge/CI final PA06 verificados; código e
  contratos reais auditados; R071 consultado/pinado, sem dependência nova.
- [x] D01 — proprietário confirmou segunda aba em consulta com retomada
  explícita, pausa da anterior, preservação local e releitura antes de editar.
- [x] T01 — D01 e plano apresentados; implementação autorizada em “Siga”.
- [x] T02 — RED/GREEN do núcleo: posse local, mensagens mínimas, simultaneidade,
  transferência/cleanup, falhas e APIs indisponíveis. Não usar timeout como lock.
- [x] T03 — fila/guardas/writers e reconferência integrados; callback de cópia
  mantém geração de início mesmo após perder/retomar posse.
- [x] T04 — aviso acessível, consulta/retomada, falha de reconferência,
  teclado e axe-core no painel; 6 cenários Playwright desktop/mobile PASS.
  Recuperação completa após recarga em `reconferir` validada em T05.
- [x] T05 — testes puros/nativos e duas abas reais: transferência em voo, dirty,
  releitura, fechamento, foco/403, restauração por evento persistido, modo sem
  APIs e cópia ABA. Regressões PA02–PA06/portal/impressão e Axe executados;
  falhas de harness corrigidas e retestadas, detalhes/limites no relatório.
- [ ] T06 — locais PASS: revisão própria, PostgreSQL15/CAS/RLS descartável,
  backend, BFF/authz focados, lint/typecheck/build e secrets. CI integral do HEAD
  a conferir; Timescale/pgvector local e revisão independente SKIPPED, com
  motivos explícitos. Não transformar revisão própria em independente.
- [ ] T07 — entrega em PR única Draft, evidências/checklist/status preparados;
  acompanhar gates e revisão antes do fechamento. Sem merge/deploy/migration externa.

## Handoff entre modelos

Sol6.1 médio para T00–T03 e T05–T07. Luna alto implementou T04 após confirmação
manual do usuário. Sol6.1 médio retomou T05–T07. Nunca
delegar decisões de concorrência como ajuste UI.

## Validações da rodada documental

PASS: `git diff --check`, scanner local de secrets e matriz de confiabilidade
(40 referências); links locais do plano/checklist conferidos. Runtime anterior:
59 unitários, 42 BFF e typecheck; núcleo E2E inicial 2/2.
T03–T05 e gates locais PASS; CI do HEAD e revisão cruzada continuam sujeitos à
conferência na PR. Relatório registra também falhas intermediárias e cobertura
local parcial de extensões. Não declarar disponibilização em produção.


Evidências: [núcleo](../docs/governance/EVIDENCIAS_PA07_NUCLEO_2026-10-16.md) e
[interface T04](../docs/governance/EVIDENCIAS_PA07_UI_2026-10-16.md).
[Integração final/limites](../docs/governance/RELATORIO_PA07_2026-10-16.md).
Próxima ação: PR/gates com Sol6.1 médio; consultar também
[handoff T04 concluído](handoff-pos-320-pa07-luna.md).
