# FOOD06 — execução/handoff do incremento A1 (2026-10-31)

## Estado vigente e escopo

Branch `feat/food06-onda-a1`, base `0ec4cd31` da PR #455
(`docs/food06-contratos-fontes`). Incremento separado e empilhado para revisão,
sem merge/cherry-pick da #451, #446 ou outra entrega. PR própria Draft.
O planejamento integral M01–M12 e UX A permanecem na #455; todas obrigatórias.

A1 entrega **parte** de M01/M03/M09. Onda A e FOOD06 não concluídas.
Nenhuma rota, provider, tabela clínica, persistência, migration ou ativação nova.
Risco R2 de domínio, não comprovação de gates R4 de futura integração clínica.

## Alterações

- `calculo-combinado.ts`: extrair a seleção PA06 para helper compartilhado;
  preservar algoritmos de soma, limites, ON/OFF e saída legada.
- `cobertura-dietetica.ts`: projeção versionada por nutriente com cinco estados,
  contagens particionadas e causas. Somar exclusivamente pelo motor PA06.
  Zero conhecido permanece zero; ausência não vira zero. Sem duplicar alternativas.
  Impedimento técnico prevalece sobre incompatibilidade; subtotal conhecido pode
  ser preservado, mas `total` só aparece quando completo. Não projetar conteúdo
  arbitrário do snapshot. Não resolver fonte/direito/população neste helper.
- `explicacoes-dieteticas.ts`: catálogo imutável dos 11 motivos do núcleo
  comparativo e ajuda RDA/AI/UL/planejado/parcial, sem dados livres clínicos.
  Textos próprios baseados na ficha ratificada, sem importar tabelas de terceiros.
- Testes sintéticos próximos aos módulos e atualização das matrizes/plano/checklist.

## TDD realmente executado

| Ciclo | RED funcional | GREEN |
| --- | --- | --- |
| Cobertura inicial | 20 falhas / 1 passe com implementação vazia | 21/21 |
| Catálogo explicativo | 14 falhas com catálogo vazio | 14/14 |
| Achado independente: campo de nutriente malformado confundido com ausência | 4 falhas / 21 passes (`null`, número, array e booleano) | 25/25 cobertura |
| Regressão final | Não é novo RED | 148/148, cinco suítes |

A regressão final abrange cobertura25, explicações14, núcleo comparativo66 e
regressões PA0622/micronutrientes21. Comandos a partir da raiz da worktree:

```bash
node octaclin-backend/node_modules/jest/bin/jest.js \
  --config octaclin-backend/package.json --runInBand --runTestsByPath \
  octaclin-backend/src/modulos/planos-alimentares/dominio/cobertura-dietetica.spec.ts \
  octaclin-backend/src/modulos/planos-alimentares/dominio/explicacoes-dieteticas.spec.ts \
  octaclin-backend/src/modulos/planos-alimentares/dominio/comparacao-dietetica.spec.ts \
  octaclin-backend/src/modulos/planos-alimentares/dominio/calculo-combinado.spec.ts \
  octaclin-backend/src/modulos/planos-alimentares/dominio/micronutrientes.spec.ts
node octaclin-backend/node_modules/typescript/bin/tsc --noEmit -p octaclin-backend/tsconfig.json
```

Ambiente Node22.23.4. A instalação congelada exata continua BLOCKED pela política
minimumReleaseAge das versões AWS descritas na execução principal. Reutilizadas
ferramentas locais já existentes por symlink ignorado: ts-jest29.4.14 em cache
versus29.4.15 do lock. Não se trata de instalação congelada comprovada; o CI
precisa validar dependências exatas. Não alterar engines, lockfile ou políticas.

## Revisão independente delimitada

Revisor `/root/food06_a1_static_review`, instância separada, sem coautoria ou
edição. Executou inicialmente PA06+cobertura43/43; inspecionou limites10.000/10.001,
16 combinações ON/OFF e precedência de impedimentos com provas sintéticas.
Identificou P2: conteúdo malformado virava `ausente`. Após RED/GREEN, fechou o P2
e executou cobertura+explicações39/39. Nenhum novo achado reproduzível.

Limites: não revisou clinicamente a redação, não executou banco/API/UI e não é
R4 integral da FOOD06. As causas específicas da cobertura ainda precisam de
mapeamento contextual na integração M03. UX B/C aguardam interface real.

## Gates e próximos passos

- PASS local delimitado: TDD/regressão148, typecheck e revisão independente A1.
- PASS local: build Nest e verificação `dist/main.js`, `git diff --check` e
  scanner local de segredos. Build não é deploy. Suíte backend completa e
  lint separados: NOT RUN neste incremento; aguardar também gates do CI.
- CI deste incremento: PENDENTE até o HEAD próprio executar; não herdar PASS.
- Histórico `eeb552fa`: 20 success, Mobile/PR Gate FAIL e SBOM provenance SKIPPED.
- `0ec4cd31`: Mobile FAIL; Web em execução na consulta desta rodada. A auditoria
  Mobile exige triagem e correção separadas, sem supressão na FOOD06.
- Banco/RLS/Playwright: N/A para este domínio puro, NÃO aprovados para a integração.
- Direitos das tabelas: BLOCKED. M05 completo e comparação assistencial pendentes.
- M11: caminho personalizado BLOCKED até contrato confiável de restrições; não
  afirmar compatibilidade por ausência de alerta. Não retirar M11 do escopo.
- G06 operacional BLOCKED; FOOD05-MDL/D18 fora do escopo.

Próximo incremento A2: resolver fontes/contexto autorizados e rastreabilidade,
com gate de direitos; avançar independentemente no detalhamento factual B sem
habilitar comparações indevidas. Novos caminhos de API/persistência exigem testes
reais de autorização, PostgreSQL/RLS e revisão independente próprios.
Rollback A1: reversão de código aditivo/helper, sem schema ou registros a migrar.
Não fazer merge, deploy, DDL externo nem alterar Neon/Render/cobrança.
