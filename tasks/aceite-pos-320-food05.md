# FOOD05 — matriz vigente de aceite e preparação para revisão

Esta matriz substitui estados conflitantes dos checkpoints históricos, preservados nos demais documentos. Não amplia o escopo nem autoriza operação. PR #446 permanece Draft.

## Evidências e limites

- Código validado: `8ed8525926a3548d7f6630205fd885ccd6fb785d`; documentação subsequente `81e738f38f12bba01cc2f87f622ff66c86bd02dc` confirmada neste ciclo pelo conector GitHub. CI `40592988233`, CodeQL `40592988221`, Semgrep `40592988339`, Trivy `40592988292` e Dependency Review `40592988231`: success. O usuário confirmou 21 checks success, SBOM provenance skipped; a consulta dos workflows confirma conclusão sem falhas. Novo commit somente documental exige verificar seu próprio CI antes de recomendar revisão sem ressalva de checks pendentes.
- CI Backend Node 22 é a evidência compatível com `engines >=22 <23`; a última execução local de 206 testes e typecheck usou Node 24.19.0 e não substitui essa prova.
- R4 independente integral do código: favorável e **estática**; revisor `/root/food05_final_r4`, sem execução própria de testes. Evidência de execução pertence às suítes/CI, não ao parecer estático.
- PASS abaixo significa critérios exercitados pelas fontes indicadas, reconhecidos pelo proprietário. Não certifica toda combinação possível, avaliação humana de leitor de tela nem disponibilidade de produção. Artefatos/testes são exclusivamente sintéticos. Testes locais PostgreSQL/Playwright antes bloqueados não foram reclassificados: a prova posterior é o CI descartável.

## Matriz D01–D17 aplicáveis

Paths BE abaixo relativos a `../octaclin-backend/src/modulos/planos-alimentares/`. As suítes estão executadas pelo Backend CI; a spec visual citada é executada pelo Demo smoke nos projetos desktop/mobile. Mapeamento é por propriedade coberta, não equivalência entre um teste e todo o requisito.

| Decisão | Evidência rastreável e critério coberto | Estado / limite |
| --- | --- | --- |
| D01 | [Motor e oráculo](../octaclin-backend/src/modulos/planos-alimentares/dominio/equivalencia-nutriente.spec.ts): quatro alvos, bases, zero, inválidos e frações | PASS matemático exercitado |
| D02 | [Serviço](../octaclin-backend/src/modulos/planos-alimentares/aplicacao/servico-planos-alimentares.spec.ts) e [visual individual/FOOD04](../octaclin-web/tests/visual/pa07-coordenacao-abas.spec.mjs): aplicação por ambos os contextos | PASS casos individual/grupo |
| D03 | Spec visual PA07: cancelar prévia, descartar resposta antiga, editar porção e recálculo explícito | PASS casos testados |
| D04 | M01–M08 abaixo permanecem obrigatórias | PASS rastreabilidade; sem exclusão de escopo |
| D05 | [Resolvedor](../octaclin-backend/src/modulos/planos-alimentares/aplicacao/resolver-equivalencias-edicao.spec.ts): identidade, origem e snapshot; serviço revalida catálogo | PASS fatos autorizados; sem fator de cocção |
| D06 | Motor/oráculo e spec visual: razão periódica, alvo/obtido/resíduo após edição | PASS precisão e porção efetiva |
| D07 | [Impacto](../octaclin-backend/src/modulos/planos-alimentares/dominio/impacto-equivalencia-refeicao.spec.ts): remove principal, preserva outros, subtotal parcial explícito | PASS simulação determinística |
| D08 | Serviço, [cópia Web](../octaclin-web/lib/copia-refeicoes-plano.ts) e spec visual FOOD04: grupo preservado, seleção parcial, flags não herdadas | PASS caminhos de aplicação/cópia testados |
| D09 | [PostgreSQL/RLS](../octaclin-backend/src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts), serviço, spec PA07: CAS, locks, rollback, histórico, ACK/posse | PASS matriz integrada executada; A04/A05 mantidos |
| D10 | Motor parcial, impacto e [medidas](../octaclin-backend/src/modulos/planos-alimentares/dominio/medida-equivalencia.spec.ts): ausência não vira zero e g/ml depende de cadastro | PASS sem inferência clínica |
| D11 | [Preferências](../octaclin-backend/src/modulos/planos-alimentares/aplicacao/servico-preferencias-equivalencia.spec.ts), RLS e spec visual preferências pessoais | PASS CAS/isolamento e apresentação |
| D12 | Resolvedores/serviço: fonte atual autorizada; indisponibilidade falha fechada | PASS caminhos inspecionados; nenhuma nova licença/base comprovada |
| D13 | Motor local determinístico e contratos de alvos; código da entrega não integra inferência externa | PASS escopo estático; sem micronutrientes-alvo |
| D14 | [Registro FOOD04](../docs/governance/EVIDENCIAS_ROLLOUT_FOOD04_2026-10-24.md) e checklist operacional abaixo | BLOCKED operacional; sem nova consulta externa |
| D15 | Serviço/resolvedor, RLS e spec PA07 de cópia: identidade nova, pendência obrigatória, flags false/false, linhagem cifrada | PASS provas RED/GREEN e CI; snapshots anteriores preservados |
| D16 | [Modelos](../octaclin-backend/src/modulos/planos-alimentares/aplicacao/servico-modelos-plano-alimentar.spec.ts): validação completa e falha segura de snapshot | PASS negativos e regressões executados |
| D17 | Serviço de modelos e spec visual de bloqueio: não transportar proveniência por biblioteca compartilhada | PASS contenção; aplicação FOOD05 por modelo indisponível |

## Matriz M01–M08 obrigatórias

| Melhoria | Evidência / aceite exercitado | Limite |
| --- | --- | --- |
| M01 | Resolvedor/serviço: identificação exata, fonte, preparo e composição congelada | PASS; preparo ausente não é inferido |
| M02 | `medida-equivalencia.spec.ts`, resolvedores e UI: gramas, conversão cadastrada, aproximação e ausência | PASS cenários cadastrados; não inventa densidade |
| M03 | Motor/oráculo e visual de edição: porção racional, aplicada, resíduos e recálculo de indicadores | PASS exemplos e bordas; precisão visual não muda armazenamento |
| M04 | `impacto-equivalencia-refeicao.spec.ts`: 350→300, sem dupla contribuição, outros itens e parciais | PASS simulação; prévia não grava |
| M05 | Motor: razões extremas, limites técnicos, avisos e ajuste manual | PASS critérios matemáticos/praticidade; não é juízo clínico |
| M06 | Spec visual: 20 alternativas, seleção parcial, individual/FOOD04, cancelamento/respostas tardias | PASS desktop/mobile; não afirma cobertura de todo layout possível |
| M07 | Serviço/`obter()` e resolvedor: catálogo atual, metadados sem stale falso, revisão pendente e recálculo explícito; visual de recálculo | PASS P2-02; snapshots históricos não são reescritos |
| M08 | Preferências domínio/serviço, PostgreSQL 1079 e visual: CAS, usuário, casas/passo e formato | PASS; 1079 ainda depende de liberação operacional fora do CI |

## Gates e tarefas

| Item | Estado vigente | Evidência / condição |
| --- | --- | --- |
| G00–G03 / T07-A / T14 | PASS técnico nos critérios executados | Código, contratos, domínio, snapshots e PostgreSQL/RLS com role runtime; A04/A05 não reabertos |
| G04 / T15–T16 | PASS critérios automatizados e R4 estática | Individual e FOOD04, PA07, a11y automatizada, regressões e scanners; não reivindica auditoria humana de acessibilidade |
| G05 / T17–T18 | PASS em `81e738f3` | Novo HEAD documental requer checks próprios; isso não invalida evidência anterior |
| G06 | BLOCKED operacional | 1078/1079, ledger/alvos/roles, configuração efetiva de deploy, ensaio autorizado e prontidão/jornada em produção não comprovados neste ciclo |
| T07-B / D18 / A06 | PENDENTE FOOD05-MDL | Escopo futuro separado, D17 contém risco; não é requisito de código da FOOD05 principal |

## Merge e deploy — conferência documental

- [Deploy AWS](../.github/workflows/deploy-aws.yml) e [Deploy Azure](../.github/workflows/deploy-azure.yml) usam `workflow_dispatch`; esses workflows não disparam por merge. Isso não prova inexistência de automação externa.
- [Runbook de produção](../RUNBOOK_PRODUCAO.md), seção Deploy, prevê Render auto-deploy após push em main **se configurado**. O registro FOOD04 documenta falha anterior de deploy automático. Não existe manifesto Render versionado encontrado neste ciclo que comprove a configuração efetiva atual. Portanto um merge **pode disparar deploy**, e não pode ser tratado como ação apenas documental ou sem consequência operacional. A configuração efetiva não foi consultada/alterada nesta rodada documental.
- [Opções TypeORM](../octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts) registram 1078 e 1079. `BANCO_EXECUTAR_MIGRACOES` ausente/false desabilita boot migrations; true as habilita. Uma eventual configuração true pode tentar executar migrations pendentes; não presumir valor no serviço real. Readiness sinaliza migrations pendentes com 503 conforme runbook.
- [1078](../octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001078-GruposSubstituicoes.ts) cria grupos/favoritos, índices e FORCE RLS. Ausência deixa FOOD04 sem estruturas requeridas. [1079](../octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001079-PreferenciasEquivalencia.ts) adiciona colunas/constraints em profissionais; [ORM](../octaclin-backend/src/modulos/profissionais/infraestrutura/profissional.orm.ts) já as mapeia, podendo afetar consultas gerais de profissionais se o código novo chegar antes do schema.
- Ambas recusam `down` destrutivo: rollback deve preservar schema/dados e respeitar compatibilidade reader/writer dos snapshots schema 3; não publicar reader antigo incompatível. Não basta reverter imagem sem revisar esse contrato.
- Não foi consultado ledger de produção nesta rodada. Mantém-se a pendência 1078/1079 conforme registro e instrução do proprietário; merge/CI não comprovam aplicação nem disponibilidade.

## Checklist pré-merge (separado da revisão formal)

- [ ] Autorização expressa para revisão formal e retirada manual de Draft; recomendar Ready for Review quando checks do novo HEAD concluírem.
- [ ] Conferir checks do HEAD efetivamente escolhido e ausência de novo achado aberto; preservar SBOM skipped como tal.
- [ ] Antes de autorizar merge, confirmar configuração efetiva Render (branch, auto-deploy/pre-deploy/start e `BANCO_EXECUTAR_MIGRACOES`) por leitura autorizada; definir janela e responsável operacional sem alterar serviços nesta rodada.
- [ ] Regularizar G06 com autorização própria: reconciliar ledger/schema 1078/1079, alvos/roles, backup, ensaio, RLS/ACL/runtime e sequência schema/reader/writer. Não executar DDL como efeito indireto de merge.
- [ ] Validar plano de rollback compatível com snapshots; manter schema e histórico.
- [ ] Receber autorização distinta para merge e operações, executar/verificar readiness e jornada nos ambientes autorizados.

Não há novo bloqueio técnico de código identificado por esta conferência documental. Ready for Review é recomendado condicionado à conclusão dos checks do novo commit documental; G06 impede considerar a entrega liberada para produção ou autorizar merge com deploy implícito sem resolver a sequência operacional.
