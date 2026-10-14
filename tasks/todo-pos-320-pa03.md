# PA03 — checklist e handoff de implementação

Contrato: [plan-pos-320-pa03.md](plan-pos-320-pa03.md).
Planejamento e implementação autorizados pelo proprietário em 2026-10-14.
Execução em worktree isolado; merge/deploy/migrations externas/ativação não
autorizados.
Branch `feat/pos320-pa03-subtotais-refeicoes`, main `5b47fb1` (#416).

## T00 — planejamento

- [x] PR #416 mergeada; workflows e jobs do HEAD aprovado conferidos.
- [x] Checkout isolado; trabalho PA02 preservado; base e diff conferidos.
- [x] Consultar somente mapa/JSON/matriz/roadmap PA03: código interno recomendado.
- [x] Auditar editor, componente ordenável, cálculo Web/backend e snapshots.
- [x] D01: editor do profissional; D02: todas recolhidas na carga inicial;
  D03: resultados parciais com aviso e sem zero fabricado.
- [x] Registrar G01–G07, arredondamento, foco, regressões, segurança e rollback.
- [x] Receber autorização explícita de implementação.
- [x] Troca manual autorizada; revisão técnica Sol e revisão cruzada independente
  pelo agente `/root/review_pa02_r4`, com fechamento do overflow final.

## T01 — subtotal estrito (depende de autorização e T00)

- [x] Primeiro RED para subtotal ausente e casos onde ausência viraria zero
  (RED comprovado por TS2305 antes da exportação do helper).
- [x] Somente itens principais; porcaoGramas é massa total; quantidade não duplica.
- [x] kcal vem da fonte; arredondar cada porção e depois soma a 4 casas/epsilon.
- [x] Zero válido; invalidade/ausência no indicador afeta seu total, mantendo outros.
- [x] Porção inválida afeta todos; opcionais ausentes não bloqueiam macros.
- [x] Sem alimentos/placeholder não aparece como subtotal completo de zeros.
- [x] G04: origem de modelo/biblioteca sem densidades não ganha zero silencioso.
- [x] Converters/view types preservam ausências; DTOs/cópia continuam validados.
- [x] Fixture sintética 250 kcal / P17 / C32,5 / G12,5; helper testado.
- [x] Sem alterar regras legadas do painel global nem instalar dependência.

Checkpoint: unitários GREEN e regressões nutricionais/PA02 intactas.

## T02 — recolhimento e cabeçalho (depende de T01)

- [x] Todas recolhidas inicialmente; nome e subtotal visíveis; controle individual.
- [x] Expandir/recolher todas; state só em memória, keyed por chaveCliente.
- [x] Corpo hidden, mantido montado; dados e estados dos editores preservados.
- [x] Toggles não alteram dirty nem payload; estado é efêmero e não há escrita.
- [x] Drag/setas/duplicar/remover separados do toggle; sem botão aninhado.
- [x] Reordenação mantém identidade; nova carga/contexto reseta recolhimento.
- [x] Adicionar/duplicar/colar abre destino explícito somente após aplicação.
- [x] Subtotais atualizam sem salvar, com nomes acessíveis e apresentação adaptável.

Checkpoint: interação desktop/mobile e keyboard sem perda de dados.

## T03 — required, erros e foco (depende de T02)

- [x] Cenário required recolhido/requestSubmit validado em desktop/mobile.
  RED histórico do handler não tem log preservado; não é declarado como prova.
- [x] Invalid capture revela e foca primeiro inválido após commit DOM, com erro.
- [x] Múltiplos inválidos são agrupados para não disputar foco nem causar loop.
- [x] Hidden inputs permanecem montados e refeições não são omitidas do PUT.
- [x] Erros de validarFormulario abrem a refeição e permitem corrigir.
- [x] Guarda síncrona de cópia #416 permanece; testes PA02 continuam passando.

Checkpoint: GREEN sem console not focusable, PUT inválido ou foco invisível.

## T04 — integração e regressões (depende de T03)

- [x] Suite consolidada 48/48 desktop/mobile em build local: PA03/axe,
  PA02, Fase269, DnD e modelos; complementos leitor/Fase297 4/4.
- [x] Submissão mantém controles e refeições recolhidas no formulário/payload.
- [x] PA01 DnD/identidade, PA02 cópia e Fase269/modelos foram preservados e
  regressões visuais relevantes passaram; catálogo/persistência continuam no
  fluxo existente.
- [x] Fixtures de edição adaptadas para abrir explicitamente sem relaxar testes.
- [x] Readonly/portal/PDF sem mudança de escopo; sem APIs ou schema novos.

## T05 — gates (depende de T04)

- [x] Lint, typecheck, build e contratos locais indicados no plano:
  unitários 19/19, cópia 6/6, BFF 26/26, proteção FND02 4/4 e domínio
  backend 21/21. Node22/pnpm11.25; lint focado sem erros (3 avisos existentes),
  typecheck e build PASS. Lint completo anterior: 0 erros/65 avisos, Node24.
- [x] Secrets e diff check final PASS; somente fixtures sintéticas. Repetir
  antes de cada push adicional.
- [ ] CI do HEAD: Web, Backend conforme impacto, Demo, Governança, PR Gate/scanners.
  Ainda não há PR/HEAD remoto; nenhum desses gates foi inferido dos comandos locais.
- [x] Revisão cruzada R4 independente: cálculo, missing, foco/required e PA02 lock.
  FAIL inicial/P2 de overflow final; correção RED/GREEN 19/19; revisor confirmou
  PASS e digest runtime em `docs/governance/REVISAO_R4_PA03_2026-10-14.md`.
- [x] Registrar PASS/FAIL/NA/SKIPPED com evidência; não alegar PG pelo teste UI.

## T06 — entrega (depende de T05)

- [ ] Uma PR PA03 reúne planejamento e código; nenhuma PR documental separada.
- [ ] Status/checklist e handoff reconciliados com código e CI do HEAD.
- [x] Rollback documentado preserva histórico; nenhuma migration externa/merge/deploy/ativação.
- [x] Pausa/troca manual para revisão Sol executada; proprietário autorizou continuar.

## Evidência da etapa atual

PASS: Git/main/merge #416, cinco workflows SUCCESS e todos os jobs do CI
`38583138559` SUCCESS; leitura direcionada das referências/contratos e D01–D03.
Isso é evidência da PA02 integrada, não testes da PA03.
PASS parcial: testes locais unitários e BFF acima, proteção FND02, PA03 visual
desktop/mobile 10/10 (axe incluído), Fase 269 desktop 4/4 na rodada anterior,
lint, typecheck, build e scanner de secrets.
PASS adicional em Node 22.21.1/pnpm 11.25.0: subtotal 19/19, cópia 6/6,
BFF 26/26, FND02 4/4, backend nutricional 21/21, typecheck e lint focado
(0 erros, 3 avisos existentes); revisão cruzada independente do runtime PASS.
PASS final: build Web e suites visuais 48/48 + 4/4 sobre build local, todos em
Node22/pnpm11.25. PENDING: PR única e CI do HEAD PA03.
SKIPPED/NA: PostgreSQL real (nenhum contrato ou schema
backend mudou), migration, staging, produção, deploy e ativação. Não inferir estes
gates a partir de build/browser.


Verificações documentais históricas do planejamento: `git diff --check` PASS;
`pnpm security:secrets` PASS (nenhum secret identificado); verificador local
Python conferiu 27 links Markdown relativos sem destino ausente. Scripts de
teste listados no handoff conferidos em package.json, não executados.
O scanner rodou no host Node 24.19.0 / pnpm 11.19.0 com aviso de engine;
para implementação usar Node 22 / pnpm 11.25.0 dos manifests. Não extrapolar
este PASS documental para testes do produto.
