# Evidências Web/BFF FOOD02 — 2026-10-17

## Escopo

Checkpoint local de T06–T07 na branch `feat/pos320-food02-planejamento`, sobre
base `95e9f33d`; backend T01–T05 já estava implementado. Os dados de navegador
são sintéticos e as chamadas da funcionalidade nova foram interceptadas localmente.
Nenhuma dependência foi adicionada. Não houve migration externa, deploy, merge,
PR, uso de dado real ou ativação operacional.

## Alterações cobertas

- BFF com listagem, pesquisa POST, criação, detalhe, edição por revisão esperada
  e medidas caseiras; allowlists, UUIDs, limites de corpo e `private, no-store`.
- Cliente tipado da API e editor com criação separada de aplicação; aplicação
  exige leitura da revisão atual. Autosave transporta somente o descriptor
  explícito e um `aplicacaoId`; composição/snapshot é materializada pelo backend.
- Formulário preserva a base informada (100 g ou porção com gramas explícitas),
  não transforma campo vazio em zero e não envia composição normalizada pelo cliente.
- Escopo pessoal/clínica, confirmação de edição/desativação e medidas
  personalizadas seguem as permissões do backend. Rotas documentadas no
  `MAPA_ROTAS_PERMISSOES.md`.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` em `octaclin-web` | PASS |
| `node scripts/test-nutricao-plano.mjs` | PASS, 67/67; cobre formulário FOOD02 e regressões de cálculo existentes |
| `node scripts/test-planos-alimentares-bff.mjs` | PASS, 52/52 |
| `pnpm test:origem-backend:bff` | PASS, 9/9; inventário informa 305 rotas BFF sem leitura própria de origem |
| `node scripts/test-autorizacao-rotas.mjs` | PASS, 30/30 |
| `pnpm test:calculo-combinado-planos` | PASS, 4/4 |
| `node scripts/test-copia-refeicoes-plano.mjs` | PASS, 10/10; preservação factual, IDs locais e micronutrientes |
| `git diff --check`, `node --check` do spec visual e `pnpm security:secrets` | PASS; nenhum secret local identificado |
| Playwright FOOD02, desktop + mobile | PASS, 2/2; cadastro parcial, busca mínima, base explícita, aplicação, autosave e Axe |
| Regressões visuais focadas, desktop + mobile | PASS, 14/14; leitura sem mutação, resposta histórica tardia, permissões, resumos de versão, troca de paciente, reordenação por teclado e modelos/cópia |
| ESLint nos arquivos Web alterados | PASS sem erros; 8 avisos de hooks/ref no editor preexistente `plano-alimentar-profissional.tsx`; o componente novo não tem avisos |

O Playwright foi executado localmente com `next dev --webpack`, em `localhost`,
`E2E_REUSE_EXISTING_SERVER=true` e fixtures sem pacientes reais. As regressões
escolhidas exercitam o editor antigo para confirmar que a integração não quebra
os fluxos de plano já presentes; não equivalem à suíte visual completa.

## Gates não cobertos por este checkpoint

- Web build completo, suíte visual integral, CI da PR e scanners do HEAD final: não executados.
- Revisão R4 independente: não executada; permanece necessária antes da PR final.
- Migration1076: foi exercitada somente no PostgreSQL descartável pela etapa T05;
  estado externo não foi consultado nem alterado.
- Não foi aberta uma sessão E2E separada no portal ou na impressão. As rotas e
  telas de portal/print não foram modificadas nesta etapa; a preservação factual
  dessas projeções foi validada pelos testes do backend T04/T05 já registrados.
- T08 permanece pendente. Testes locais não aprovam protocolo clínico, direitos,
  revisão independente, migration externa ou liberação operacional.

## Complemento de T08 — 2026-10-18

### Revisão R4 e RED/GREEN

Revisão estática independente encontrou três achados Important de preservação
de estado e idempotência na UI; escopo e ressalva herdada estão registrados em
[`REVISAO_R4_FOOD02_2026-10-18.md`](REVISAO_R4_FOOD02_2026-10-18.md).
Foram adicionados primeiro três testes Playwright que falharam no HEAD revisado:

- detalhe tardio sobrescrevia porção (`42` voltava a `100`);
- detalhe tardio aplicava alimento custom depois de trocar para o catálogo;
- após POST incerto, o campo permanecia editável.

As correções guardam a callback atual e invalidam requisições quando o vínculo
ou permissão muda; congelam o formulário durante escrita; e preservam payload e
chave idempotente até repetição/cancelamento explícito. Depois da correção:

| Verificação | Resultado |
|---|---|
| Typecheck Web com Node22 | PASS |
| Os três testes TDD FOOD02 em desktop Chromium | PASS, 3/3 |
| Suíte completa `pa07-coordenacao-abas.spec.mjs` desktop Chromium | PASS, 19/19 |
| Os quatro testes FOOD02 finais em desktop Chromium | PASS, 4/4 |
| Os quatro testes FOOD02 finais em mobile Chromium | PASS, 4/4 |
| `pnpm build` Web (Node22) | PASS; 188 páginas geradas. Avisos upstream da convenção middleware/runtime Edge não bloquearam a build. |
| ESLint focal nos arquivos alterados | PASS, 0 erros; 8 avisos do editor legado. Nenhum aviso no componente novo ou rotas FOOD02. |
| `pnpm test:authz` | PASS, sequência integral de 27 scripts; inclui BFF52/52, nutrição67/67, autorização de rotas30/30 e regressões por fase |
| CI/scanners da PR #425, HEAD `778b7906` | QUEUED na consulta de 2026-10-18 |

Os screenshots/trace dos RED foram gerados por dados sintéticos locais; testes
verdes não foram tratados como revisão independente. A matriz inteira de
autorização foi executada em sequência até o último script da Fase318, sem
falhas. A revisão R4 não executou SQL, teste PostgreSQL nem CI. Um teste complementar
exercita a invalidação ao perder e recuperar a posse de edição na mesma aba;
passou nos dois projetos. Os oito avisos ESLint vêm de efeitos/dependências e
acesso a refs preexistentes no editor legado `plano-alimentar-profissional.tsx`;
nenhum aviso novo foi introduzido fora desse editor.
