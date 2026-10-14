# Handoff — Fase 320: decisão de ingestão TBCA

## Estado

`NO-GO` nesta rodada para importar ou usar dados TBCA por falta de autorização
documentada de direitos. TACO, USDA e IBGE permanecem no catálogo. A decisão
está registrada em [`PLANO_FASE_320.md`](../docs/history/phases/PLANO_FASE_320.md).

## Escopo entregue neste handoff

- Registrar decisão, limites, condições para reabrir e próxima ação.
- Atualizar checklist/roadmap pós-320 sem tratar merge como prova de produção.
- Preservar todos os artefatos e fontes existentes; nenhum dado TBCA foi
  importado, testado ou incluído no runtime.
- Iniciar somente FND02 da Onda 0, na mesma PR, por autorização explícita.

## Gates

| Gate | Estado | Evidência/razão |
| --- | --- | --- |
| Direitos de uso e redistribuição TBCA | `BLOCKED` | Autorização documentada não apresentada; não inferir licença. |
| Ingestão/runtime TBCA | `NO-GO` nesta rodada | Nenhum dado, importador ou dependência criado. |
| Catálogo factual existente | `PRESERVED` | TACO, USDA e IBGE mantidos; nenhuma carga alterada. |
| Handoff pós-320 | `PASS` documental após revisão da PR | Decisão e sequência registradas; demais IDs não autorizados automaticamente. |

## Retomada

Reabrir apenas após obter e revisar documentação de direitos da base e dos
artefatos, incluindo uso comercial, armazenamento, transformação, derivados,
redistribuição, atribuição, atualização e limites. A equipe responsável deve
ratificar a avaliação e autorizar uma nova fase/PR. Até lá, TBCA deve permanecer
ausente dos dados e do runtime.
