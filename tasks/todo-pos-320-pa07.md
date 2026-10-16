# PA07 — checklist de coordenação entre abas

Plano e contratos: [plan-pos-320-pa07.md](plan-pos-320-pa07.md).
Estado em2026-10-16: desenvolvimento autorizado; núcleo e T04 de interface
implementados em checkpoint. Base `62a50104` (#422); ainda não pronto para
disponibilização. T05–T07 permanecem pendentes.

- [x] T00 — branch/worktree isoladas; merge/CI final PA06 verificados; código e
  contratos reais auditados; R071 consultado/pinado, sem dependência nova.
- [x] D01 — proprietário confirmou segunda aba em consulta com retomada
  explícita, pausa da anterior, preservação local e releitura antes de editar.
- [x] T01 — D01 e plano apresentados; implementação autorizada em “Siga”.
- [x] T02 — RED/GREEN do núcleo: posse local, mensagens mínimas, simultaneidade,
  transferência/cleanup, falhas e APIs indisponíveis. Não usar timeout como lock.
- [ ] T03 — integração inicial implementada; fila/guardas e reconferência
  presentes. Aceite completo de todos os writers depende de T04/T05.
- [x] T04 — aviso acessível, consulta/retomada, falha de reconferência,
  teclado e axe-core no painel; 6 cenários Playwright desktop/mobile PASS.
  Limite: T05 ainda deve validar recuperação completa após recarga em `reconferir`.
- [ ] T05 — duas abas reais, transferência em voo, dirty, replay/eventos velhos,
  queda/foco/BFCache, logout/contexto, save60s, PA02–PA06/portal/PDF.
- [ ] T06 — segurança, CAS/PostgreSQL/RLS descartável, BFF/authz, lint,
  typecheck/build, CI do HEAD e revisão cruzada quando viável. Declarar limites.
- [ ] T07 — uma PR PA07, evidências/checklist/status e sequência operacional;
  sem merge/deploy/migration externa por inferência.

## Handoff entre modelos

Sol6.1 médio para T00–T03 e T05–T07. Luna alto implementou T04 após confirmação
manual do usuário. Próxima etapa: retornar a Sol6.1 médio para T05–T07. Nunca
delegar decisões de concorrência como ajuste UI.

## Validações da rodada documental

PASS: `git diff --check`, scanner local de secrets e matriz de confiabilidade
(40 referências); links locais do plano/checklist conferidos. Runtime anterior:
59 unitários, 42 BFF e typecheck; núcleo E2E inicial 2/2.
T04 PASS nesta worktree, ver evidências específicas. T05–T07, CI do HEAD,
PostgreSQL/RLS integral e revisão cruzada ainda pendentes. Não declarar a PA07
liberada com base nos testes desta etapa.


Evidências: [núcleo](../docs/governance/EVIDENCIAS_PA07_NUCLEO_2026-10-16.md) e
[interface T04](../docs/governance/EVIDENCIAS_PA07_UI_2026-10-16.md).
Próxima ação: T05–T07 com Sol6.1 médio; consultar também
[handoff T04 concluído](handoff-pos-320-pa07-luna.md).
