# Handoff FOOD02 — Sol médio → Luna alto

## Estado e limite

Branch `feat/pos320-food02-planejamento`, base95e9f33d, worktree isolada
`/workspace/octaclin/.worktrees/pos320-food01-planejamento` reutilizada.
Leia [plano](plan-pos-320-food02.md), [checklist](todo-pos-320-food02.md),
[ledger](execucao-pos-320-food02.md) e
[evidências](../docs/governance/EVIDENCIAS_FOOD02_BACKEND_2026-10-17.md).

T01–T05 backend implementados com dados sintéticos. T06/T07 Web/BFF NÃO
começaram. Uma única PR FOOD02 futura, sem PR só de backend/plano. Não fazer
merge, deploy, migration externa ou nova pesquisa de todos os repositórios.
D01–D03 confirmadas; não perguntar novamente. R047/R064 já lidos/pinados e
R015/R016/R042 triados; não instalar Downshift, ZXing ou provider externo.

A alteração preexistente de `next-env.d.ts` no checkout principal não é nossa.
Node22 em `/workspace/.toolchains/food01/node-v22.21.1-linux-x64/bin/node`.
Dependências existentes por symlink, lockfiles intactos. Com Next dev local,
Webpack foi necessário na FOOD01; não limpar outras worktrees. Aferir espaço
antes de builds. Não modificar AGENTS gerado para contornar o ambiente.

## Rotas reais backend e BFF a construir

Prefixo `planos-alimentares/alimentos-personalizados`:

| Método | Caminho | Permissão |
| --- | --- | --- |
| GET | `/` com pagina/limite/escopo opcionais, sem termo | planos_alimentares.ler |
| POST | `/busca`, body `{busca,pagina?,limite?,escopo?}` | planos_alimentares.ler |
| GET | `/:id` | planos_alimentares.ler |
| POST | `/` criar | planos_alimentares.gerenciar |
| PATCH | `/:id` editar conteúdo inteiro ou desativar | planos_alimentares.gerenciar |
| GET/POST | `/:alimentoId/medidas-caseiras` | ler/gerenciar |
| PATCH | `/:alimentoId/medidas-caseiras/:medidaId` | gerenciar |

Somente Professional com vínculo atual; tenant/identidade resolvidos no servidor.
Todas as rotas têm `private,no-store`; backend usa os três guardas existentes.
No Web, reutilizar proxy/BFF de planos alimentares e sessão; params assíncronos,
UUIDs, limite16KiB na biblioteca e4KiB nas medidas. POST de busca é leitura com
permissão ler, mas conserva proteção de origem de POST do BFF. Sem dado livre
em URL, log, analytics, localStorage ou Cache Storage. Atualizar mapa de rotas.

Biblioteca e catálogo aparecem em recortes separados na mesma área de seleção:
catálogo mantém busca≥2 e totais/fontes existentes; custom tem prefixos por
palavra≥3, máximo32 por palavra, paginação25/máximo100. Termo inválido não é
convertido em listagem sem filtro. Lista sem termo pode mostrar cadastros recentes.
Abortar requisições antigas e descartar ACK de outro contexto/aba sem posse.

## Exemplo sintético de criação e retorno

POST (UUIDs abaixo são fixtures):

```json
{
  "chaveIdempotencia":"00000000-0000-4000-8000-000000000001",
  "escopo":"pessoal",
  "nome":"Arroz de teste",
  "base":{"tipo":"porcao","pesoGramas":30},
  "nutrientes":{"energiaKcal":90,"proteinasG":3,"carboidratosG":12,"gordurasG":3},
  "micronutrientes":{"ferroMg":0.6}
}
```

Retorno conhecido (nome/IDs ilustrativos):

```json
{
  "id":"00000000-0000-4000-8000-000000000002",
  "nome":"Arroz de teste","escopo":"pessoal","revisao":1,"ativo":true,
  "baseOrigem":{"tipo":"porcao","pesoGramas":30},
  "nutrientesPor100g":{"energiaKcal":300,"proteinasG":10,"carboidratosG":40,"gordurasG":10},
  "micronutrientesPor100g":{"ferroMg":2},
  "disponivelParaCalculo":true,"podeEditar":true
}
```

`preparacao` e `referenciaComposicao` são opcionais. GET detalhe acrescenta
`composicaoOrigem:{nutrientes,micronutrientes}` com os números ANTES da
normalização. Preencher a edição com essa composição e `baseOrigem`, jamais com
números normalizados junto da base30g. `normalizacaoVersao` identifica o método
no contexto aplicado, não é enviado no cadastro.

PATCH edição = conteúdo completo (nome/base/nutrientes/micros opcionais etc.)
com `revisaoEsperada`, sem chave de criação nem escopo. PATCH desativar = apenas
`{revisaoEsperada:1,ativo:false}`. Sem DELETE ou reativação. Edição e desativação
só criador; colega usa alimento da clínica com `podeEditar:false`.

Campos numéricos preenchidos mas inválidos/incompletos devem gerar erro local;
não descartá-los na serialização para criar um alimento parcial por engano.
Valores ausentes continuam ausentes; zero explícito é preservado. Biblioteca
aceita parcial, inclusive sem todos os macros; `disponivelParaCalculo:false`
explica pendência, não inventa nutrientes. Exibir unidades dos micros existentes,
sem converter RE/RAE/NE/DFE. Gramas explícitas também para líquidos. Não usar a
base do rótulo como prescrição automática da porção do paciente.

## Aplicação no editor — contrato fechado

- Cadastrar não aplica automaticamente. Seleção explícita preenche composição
  e `alimentoPersonalizado:{id,revisao,aplicacaoId:crypto.randomUUID()}`.
  `alimentoComposicaoId` fica ausente/null. Usar UUID novo em cada reaplicação.
- Criar componente próprio, mantendo mudanças no editor principal restritas à
  integração. Aplicar também em substituições. Não refatorar todo o monólito.
- Atualizar `lib/edicao-plano.ts`, API, tipo/formulário, reconstrução de rascunho,
  serializer de autosave e trocas manual/catálogo. Omissão involuntária perde
  intenção ou causa409; não omitir o campo no save de um cliente atualizado.
- Com vínculo custom ativo, composição é a aplicada; edição nutricional manual
  exige desvincular explicitamente (`alimentoPersonalizado:null` e, se houver,
  `medidaCaseira:null`). Manter fatos e não trocar para catálogo implicitamente.
- ACK do servidor é autoritativo: backend substitui composição alegada e retorna
  `documentoEdicao`; saves seguintes preservam snapshot, não consultam biblioteca.
- Rascunho também retorna `alimentosPersonalizadosAplicados`, por chave editorial:
  nome/preparação/referência, baseOrigem/composicaoOrigem, valores por100g e versão
  de normalização. Somente exibição/reabertura; NÃO enviar mapa em request.
- `ComposicaoSnapshotApi.origem` precisa aceitar `'custom'`. Snapshot factual
  traz `composicaoInformada:{baseGramas,nutrientes,micronutrientes,
  normalizacaoVersao,referencia?}`. Sem IDs/proprietário/nonce de biblioteca.
- Cópias/modelos/receitas/nova versão transportam fatos e não o descriptor ou mapa
  privado. Não procurar novamente a biblioteca para reconstruir fato histórico.
- Deixar linhas incompletas no autosave PA06. Resultado clínico permanece pendente
  se faltarem energia/proteína/carboidrato/gordura ou outros dados do plano.

## Medidas e estados concorrentes

Reutilizar `MedidasCaseirasAlimento`/helpers com origem explícita para escolher
namespace backend. No retorno custom, `alimentoPersonalizadoId` substitui
`alimentoComposicaoId`. DTOs e equivalência numérica FOOD01 são os mesmos.
Pai pessoal só aceita medida pessoal; o servidor aplica essa restrição. Trocar
alimento limpa medida anterior; preservar referências antigas no save/reload.
Não converter 1mL em1g. Biblioteca inacessível não elimina a referência factual
já aplicada, disponível no mapa do rascunho.

Chave de componente: paciente/plano/rascunho/item estáveis, nunca revisão de
60s. Respeitar posse PA07 antes/depois de async; aba em consulta não aplica
resposta. Formulário da biblioteca deve sobreviver ao ACK de autosave do plano.
Reutilizar FND02 quando houver saída com formulário não salvo, sem storage.

POST idempotente: conservar chave/pedido durante request e resultado incerto;
sem retry automático com chave nova. PATCH409 exige recarregar e conferir,
sem overwrite ou retry silencioso. Desativação deve confirmar que não altera
itens já aplicados. Mostrar carregamento/vazio/erro acessíveis; texto livre
somente como texto, sem HTML ou hyperlinks inferidos.

## Testes T06/T07 e retorno ao Sol

- BFF: sessão, permissões, CSRF/origem, UUID, corpo/allowlist, no-store,
  sanitização503, cancelamento e códigos400/403/404/409/422.
- Helpers: descriptor preservado no autosave/reload; null/omissão distintos;
  cópias sem capacidade privada; base original não normalizada duas vezes.
- Playwright desktop/mobile: CRUD pessoal/clínica, colega readonly, seleção
  explícita em item/alternativa, composição parcial/ausente/zero, medidas,
  paginação, conflito, autosave60s preservando formulário, ACK tardio após troca
  de paciente e perda de posse. Teclado/foco/Axe; portal/impressão sem biblioteca.
- Executar `test:authz`, BFF de planos, nutrição, cópias, typecheck/lint/build e
  regressões PA02–PA07/FOOD01 proporcionais. Atualizar evidências reais.
- Após T06/T07, avisar e PAUSAR para Sol médio revisar R4/integração T08 e abrir
  a única PR. Não declarar revisão própria independente nem CI aprovado sem run.
