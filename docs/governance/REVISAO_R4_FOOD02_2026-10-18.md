# Revisão independente R4 — FOOD02

**Data:** 2026-10-18  
**Branch:** `feat/pos320-food02-planejamento`  
**Base:** `95e9f33d` (PR424)  
**Revisor:** agente independente `/root/food02_r4_final`  
**Escopo:** leitura estática da camada Web/BFF e dos contratos de aplicação,
autorização, snapshot e persistência. O revisor não alterou código, não executou
testes ou SQL e não consultou ambiente externo.

## Achados e correções TDD

| Achado | Severidade | Reprodução no HEAD revisado | Correção | Verificação |
|---|---|---|---|---|
| Seleção de alimento personalizado aguardava GET e depois aplicava um callback capturado no início da requisição. Nesse intervalo, mudanças em porção, outros itens ou no vínculo escolhido podiam ser perdidas ou substituídas. | Important | Playwright: a porção alterada para `42` voltou a `100`; ao escolher o catálogo enquanto o GET estava pendente, o alimento personalizado ainda era aplicado. | Guardar o callback atual em ref atualizado no layout e invalidar a resposta pendente quando muda vínculo do item ou permissão de edição. A resposta só aplica se o contexto ainda corresponde. | RED antes da correção; GREEN nos dois testes `FOOD02 detalhe tardio...` e `FOOD02 detalhe anterior...` em desktop. |
| Campos da biblioteca continuavam editáveis durante o salvamento e o sucesso fechava o formulário, descartando alterações digitadas durante o POST. | Important | Revisão estática. O teste de criação verifica que os campos ficam desabilitados enquanto o pedido está em voo. | Desabilitar campos, edição e desativação enquanto salva. | Novo teste Playwright GREEN; typecheck e build final requeridos em T08. |
| Após resultado de criação incerto, mudar o formulário produzia outra chave idempotente, permitindo duplicar um cadastro cuja resposta foi perdida. | Important | Playwright: após abortar o primeiro POST, o campo continuava habilitado. | Preservar payload imutável e chave; bloquear edição após resultado incerto; repetir exatamente o mesmo pedido ou cancelar com confirmação explícita. Respostas HTTP 4xx são tratadas como rejeição conhecida e liberam edição. | RED antes da correção; GREEN em `FOOD02 criação incerta...`, comparando payload e chave dos dois POSTs. |

Os testes em RED foram introduzidos antes das correções e os três falharam no
código então existente. Após uma única rodada de correções, os três passaram.
Não houve segunda revisão independente do patch; não se atribui ao revisor a
confirmação dos resultados GREEN. A execução local e a leitura do diff final
foram realizadas pelo autor.

## Limites e risco herdado

- A revisão não é uma prova de segurança dinâmica, teste de PostgreSQL, RLS,
  concorrência ou CI.
- Foi apontada uma limitação preexistente: o caminho de preservação de uma
  aplicação já salva não serializa em todos os casos com arquivamento concorrente
  do vínculo profissional como faz a primeira aplicação. O comportamento de
  transferência/revogação exercitado em T05 continua registrado; esta rodada não
  alterou o contrato legado de arquivamento. Registrar como risco residual para
  revisão da PR, sem declarar que o caso foi provado por este exame estático.
- Não foram encontrados, dentro do escopo lido, novos caminhos de exposição de
  IDs internos/capacidades na projeção nem uma falha adicional de tenant/RLS.
  Isso não substitui a cobertura dos testes existentes.

## Estado

Revisão independente realizada com três achados Important. As correções estão
implementadas e os casos novos passaram localmente em desktop. R4 fica **PASS
COM RESSALVA DE VALIDAÇÃO** somente após typecheck, lint, build, `test:authz`,
regressões e CI do HEAD final. Não é autorização para merge, deploy, migração
externa ou ativação.
