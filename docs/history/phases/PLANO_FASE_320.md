# Fase 320 — Direitos da TBCA e decisão de ingestão

**Estado nesta rodada:** `NO-GO` para ingestão ou uso da TBCA.
**Data da decisão:** 2026-10-14.
**Escopo desta decisão:** esta rodada; a questão pode ser reaberta quando houver documentação suficiente.

## Decisão e efeito no produto

Não foi apresentada autorização documentada que permita ao OctaClin copiar,
armazenar, transformar e distribuir os dados da TBCA nos termos necessários ao
produto. Assim, não importar, extrair, espelhar, incluir em builds, disponibilizar
na busca, em cálculos ou em exportações quaisquer dados da TBCA nesta rodada.

O catálogo atual permanece com TACO, USDA FoodData Central e IBGE, conforme as
integrações já existentes. Esta decisão não altera as licenças, atribuições,
versões, cobertura nem estado operacional dessas fontes.

## Condições para reabrir

Reavaliar somente após a equipe responsável fornecer documentação verificável
que cubra, separadamente, direitos sobre a base/dados e sobre qualquer software,
API ou artefato usado para obtê-los; usos comerciais; armazenamento e
transformação; redistribuição/derivados; atribuição; atualização; limites de
usuários/instalações; e obrigações contratuais. A autorização deve ser revisada
por quem responde pela conformidade jurídica/comercial. A eventual retomada
exige nova decisão de produto e autorização de implementação; este NO-GO não se
converte automaticamente em GO quando um arquivo de licença for localizado.

## Limites e controles

- Nenhuma ingestão, scraping, chamada de API, importação de dump ou teste com
  dados TBCA foi realizada nesta rodada.
- Nenhuma migration, dependência, runtime ou ambiente externo foi alterado para
  a Fase 320.
- Repositórios candidatos no catálogo pós-320 são referências de engenharia,
  não autorização para importar dados ou contornar direitos.
- A decisão não impede melhorias que usem exclusivamente os catálogos atuais e
  passem por reconciliação própria.

## Handoff 320 → ondas pós-320

O proprietário autorizou formalizar o encerramento desta rodada e iniciar o
backlog pós-320. A primeira atividade autorizada é `FND02`, a consolidação de
proteções existentes contra saída com alterações não salvas, registrada em
`tasks/plan-pos-320-fnd02.md`. O handoff e FND02 podem compartilhar uma PR; os
demais IDs do backlog seguem um recurso por PR, após auditoria do código e
confirmação de lacuna. Nenhuma outra onda/feature está automaticamente
autorizada.

## Evidências de estado

- Revisão documental da base e do backlog pós-320 na branch `docs/fase320-no-go-handoff`,
  baseada em `bd4e436b` (`origin/main`) em 2026-10-14.
- Checklist de estado e limites: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Roadmap canônico: `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`.
- Backlog de ondas: `docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md`.

Nenhuma revisão jurídica independente ou consulta a ambiente de produção foi
executada nesta rodada. `NO-GO` descreve a falta de autorização para a ingestão,
não uma conclusão jurídica sobre a TBCA.
