# PA03 — checklist e handoff de implementação

Contrato: [plan-pos-320-pa03.md](plan-pos-320-pa03.md).
Planejamento autorizado; implementação ainda não autorizada.
Branch `docs/pos320-pa03-planejamento`, main `5b47fb1` (#416).

## T00 — planejamento

- [x] PR #416 mergeada; workflows e jobs do HEAD aprovado conferidos.
- [x] Checkout isolado; trabalho PA02 preservado; base e diff conferidos.
- [x] Consultar somente mapa/JSON/matriz/roadmap PA03: código interno recomendado.
- [x] Auditar editor, componente ordenável, cálculo Web/backend e snapshots.
- [x] D01: editor do profissional; D02: todas recolhidas na carga inicial;
  D03: resultados parciais com aviso e sem zero fabricado.
- [x] Registrar G01–G07, arredondamento, foco, regressões, segurança e rollback.
- [ ] Receber autorização de implementação e confirmar troca manual para Luna alto.

## T01 — subtotal estrito (depende de autorização e T00)

- [ ] Primeiro RED para subtotal ausente e casos onde ausência viraria zero.
- [ ] Somente itens principais; porcaoGramas é massa total; quantidade não duplica.
- [ ] kcal vem da fonte; arredondar cada porção e depois soma a 4 casas/epsilon.
- [ ] Zero válido; invalidade/ausência no indicador afeta seu total, mantendo outros.
- [ ] Porção inválida afeta todos; opcionais ausentes não bloqueiam macros.
- [ ] Sem alimentos/placeholder não aparece como subtotal completo de zeros.
- [ ] G04: origem de modelo/biblioteca sem densidades não ganha zero silencioso.
- [ ] Converters/view types preservam ausências; DTOs/cópia continuam validados.
- [ ] Fixture independente 250 kcal / P17 / C32,5 / G12,5 e bordas backend passam.
- [ ] Sem alterar regras legadas do painel global nem instalar dependência.

Checkpoint: unitários GREEN e regressões nutricionais/PA02 intactas.

## T02 — recolhimento e cabeçalho (depende de T01)

- [ ] Todas recolhidas inicialmente; nome e subtotal visíveis; controle individual.
- [ ] Expandir/recolher todas; state só em memória, keyed por chaveCliente.
- [ ] Corpo hidden, mantido montado; dados e estados dos editores preservados.
- [ ] Toggles não alteram dirty, payload, snapshot, auditoria nem geram requests.
- [ ] Drag/setas/duplicar/remover separados do toggle; sem button dentro de button.
- [ ] Reordenação mantém identidade; carga/novo contexto reseta recolhimento.
- [ ] Adicionar/duplicar/colar abre destino explícito somente após aplicação.
- [ ] Subtotais atualizam sem salvar, com nomes acessíveis, unidades e wrap mobile.

Checkpoint: interação desktop/mobile e keyboard sem perda de dados.

## T03 — required, erros e foco (depende de T02)

- [ ] RED do save com campo required recolhido, incluindo requestSubmit.
- [ ] Invalid capture revela e foca primeiro inválido após commit DOM, com erro.
- [ ] Múltiplos inválidos não disputam foco nem causam loop de reportValidity.
- [ ] Não desabilitar hidden inputs nem omitir refeições do PUT.
- [ ] Erros de validarFormulario também permitem corrigir refeição recolhida.
- [ ] Guarda síncrona de cópia #416 continua bloqueando persistência.

Checkpoint: GREEN sem console not focusable, PUT inválido ou foco invisível.

## T04 — integração e regressões (depende de T03)

- [ ] PA03 desktop/mobile/axe: padrão recolhido, incompletos, zero, contexto e foco.
- [ ] Save inclui refeições recolhidas; resposta persistida atualiza snapshots/totais.
- [ ] Catálogo atualizado no save não deixa subtotal antigo como atual.
- [ ] PA01 alça DnD + setas; PA02 cópia/limites/concorrência; Fase269 e modelos.
- [ ] Adaptar fixtures de edição para expandir explicitamente, sem reduzir asserções.
- [ ] Readonly, biblioteca de receitas e FND02 preservados; portal/PDF sem alteração.

## T05 — gates (depende de T04)

- [ ] Lint, typecheck, build e contratos indicados no plano.
- [ ] Secrets e diff check antes de push; somente fixtures sintéticas.
- [ ] CI do HEAD: Web, Backend conforme impacto, Demo, Governança, PR Gate/scanners.
- [ ] Revisão cruzada R4 quando viável: cálculo, missing, foco/required e PA02 lock.
- [ ] Registrar PASS/FAIL/NA/SKIPPED com evidência; não alegar PG pelo teste UI.

## T06 — entrega (depende de T05)

- [ ] Uma PR PA03 reúne planejamento e código; nenhuma PR documental separada.
- [ ] Status/checklist e handoff reconciliados com código e CI do HEAD.
- [ ] Rollback preserva histórico; nenhuma migration externa/merge/deploy/ativação.
- [ ] Avisar/pausar para Sol médio na revisão final se a implementação ocorreu em Luna.

## Evidência da etapa atual

PASS: Git/main/merge #416, cinco workflows SUCCESS e todos os jobs do CI
`38583138559` SUCCESS; leitura direcionada das referências/contratos e D01–D03.
Isso é evidência da PA02 integrada, não testes da PA03.
SKIPPED: testes de implementação PA03, CI PA03, revisão de código PA03, bancos
e ambientes externos. Nenhum arquivo runtime foi alterado nesta etapa.


Verificações documentais desta etapa: `git diff --check` PASS;
`pnpm security:secrets` PASS (nenhum secret identificado); verificador local
Python conferiu 27 links Markdown relativos sem destino ausente. Scripts de
teste listados no handoff conferidos em package.json, não executados.
O scanner rodou no host Node 24.19.0 / pnpm 11.19.0 com aviso de engine;
para implementação usar Node 22 / pnpm 11.25.0 dos manifests. Não extrapolar
este PASS documental para testes do produto.
