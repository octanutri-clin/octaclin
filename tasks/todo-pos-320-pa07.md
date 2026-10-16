# PA07 — checklist de coordenação entre abas

Plano e contratos: [plan-pos-320-pa07.md](plan-pos-320-pa07.md).
Estado em2026-10-16: desenvolvimento autorizado; núcleo implementado, interface
pendente. Base `62a50104` (#422); checkpoint não pronto para disponibilização.

- [x] T00 — branch/worktree isoladas; merge/CI final PA06 verificados; código e
  contratos reais auditados; R071 consultado/pinado, sem dependência nova.
- [x] D01 — proprietário confirmou segunda aba em consulta com retomada
  explícita, pausa da anterior, preservação local e releitura antes de editar.
- [x] T01 — D01 e plano apresentados; implementação autorizada em “Siga”.
- [x] T02 — RED/GREEN do núcleo: posse local, mensagens mínimas, simultaneidade,
  transferência/cleanup, falhas e APIs indisponíveis. Não usar timeout como lock.
- [ ] T03 — integração inicial implementada; fila/guardas e reconferência
  presentes. Aceite completo de todos os writers depende de T04/T05.
- [ ] T04 — aviso acessível, consulta/retomada e erros; teclado/IME/mobile.
- [ ] T05 — duas abas reais, transferência em voo, dirty, replay/eventos velhos,
  queda/foco/BFCache, logout/contexto, save60s, PA02–PA06/portal/PDF.
- [ ] T06 — segurança, CAS/PostgreSQL/RLS descartável, BFF/authz, lint,
  typecheck/build, CI do HEAD e revisão cruzada quando viável. Declarar limites.
- [ ] T07 — uma PR PA07, evidências/checklist/status e sequência operacional;
  sem merge/deploy/migration externa por inferência.

## Handoff entre modelos

Sol6.1 médio para T00–T03 e T05–T07. Luna alto suficiente para T04 com núcleo e
contratos fechados; só trocar após aviso, pausa e confirmação manual do usuário.
Se T04 for pequena/acoplada, manter Sol reduz custo de handoff. Troca para Luna alto
solicitada no encerramento do checkpoint T02/T03; aguardar confirmação manual. Nunca delegar decisões de concorrência como ajuste UI.

## Validações da rodada documental

PASS: `git diff --check`, scanner local de secrets e matriz de confiabilidade
(40 referências); links locais do plano/checklist conferidos. Runtime:59 unitários,42 BFF, typecheck e2 E2E iniciais PASS; ver evidências.
T04–T07/CI/PG e revisão cruzada ainda pendentes. Checklist vazio não prova
falha: identifica trabalho não iniciado, sem declarar gate PASS por CI da PA06.


Evidências: [núcleo](../docs/governance/EVIDENCIAS_PA07_NUCLEO_2026-10-16.md).
Próxima ação limitada: [handoff Luna T04](handoff-pos-320-pa07-luna.md).
