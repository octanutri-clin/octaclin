# FOOD02 — alimentos reutilizáveis no editor

> **For agentic workers:** usar TDD por tarefa, um escritor ativo e não delegar
> automaticamente. T01–T07 implementadas localmente. A revisão R4 foi feita e
> seus três achados Important corrigidos com testes; T08 aguarda gates finais,
> CI e uma PR única. Operação externa não autorizada.

**Objetivo:** cadastrar, localizar e aplicar alimentos personalizados no editor
profissional, preservando composição, proveniência e histórico.

**Arquitetura:** estender `planos-alimentares` com biblioteca tenant-aware,
separada do catálogo público. Resolver aplicações no backend e preservar seus
snapshots cifrados. Reutilizar motor nutricional, medidas FOOD01, BFF, autosave
PA06 e coordenação PA07; sem novo motor, provider ou dependência.

**Stack:** NestJS/TypeORM/PostgreSQL com FORCE RLS; Next/React; Jest/Playwright.
**Especificação:** [FOOD02 no roadmap](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md#food02-cadastrar-alimento-reutilizável-dentro-do-editor-do-plano),
item24 da [matriz](../docs/pos-320/02_Matriz_71_Sugestoes_OctaClin.md).
**Checklist:** [T00–T08](todo-pos-320-food02.md).

## Base e autorização

Planejamento iniciado em 2026-10-17 após “Merge feito, pode seguir”. Base
`95e9f33d`, merge da PR #424 confirmado pela API. CI39029460553 do HEAD
`faeb603b` SUCCESS, inclusive Backend, Web, Demo e PR Gate; CodeQL, Semgrep,
Trivy e Dependency Review SUCCESS. Isso comprova integração, não migration1075
ou deploy externos. Não foi informada aplicação externa da1075 nesta rodada.

Branch `feat/pos320-food02-planejamento`, worktree isolada existente reutilizada
em `.worktrees/pos320-food01-planejamento`; o nome do diretório não define a
branch. Alteração preexistente de `octaclin-web/next-env.d.ts` no checkout
principal preservada. No planejamento inicial, nenhum runtime/migration/lockfile foi alterado.
A implementação backend foi autorizada posteriormente.
Uma PR futura FOOD02 reunirá plano e implementação; não abrir PR só de plano.

Checkpoint de 2026-10-18: T01–T07 implementadas localmente após as mudanças de
modelo autorizadas. Revisão R4 estática independente executada; os três achados
foram reproduzidos em RED e corrigidos. Typecheck, testes BFF/unit e Playwright
direcionado PASS; `test:authz`, lint e build estão em fechamento. Contagens,
evidências e limites em `../docs/governance/EVIDENCIAS_FOOD02_WEB_2026-10-17.md`
e `../docs/governance/REVISAO_R4_FOOD02_2026-10-18.md`. CI e estado externo da
migration1076 seguem sem comprovação.

## Decisões de produto — confirmadas

Respostas explícitas do proprietário às três perguntas em 2026-10-17. Não são
aceites inferidos da FOOD01.

| ID | Proposta | Estado |
| --- | --- | --- |
| D01 | Pessoal ou clínica; pessoal por padrão. Profissionais autorizados usam os da clínica; só criador edita/desativa. Escopo imutável | CONFIRMADA |
| D02 | Informar por100g ou porção com peso explícito em gramas; normalizar no servidor preservando original. Ausente não vira zero | CONFIRMADA |
| D03 | Edição/desativação não muda aplicações anteriores, inclusive rascunhos; atualização por reaplicação explícita | CONFIRMADA |

Os contratos abaixo incorporam as três respostas. Detalhes de engenharia podem
ser resolvidos pelo executor sem reabrir essas decisões. A pausa de modelo entre
backend e UI/BFF foi realizada antes de T06.

Escopo confirmado: criação/edição/desativação, busca e aplicação no item principal
e nas alternativas. Sem código de barras/câmera, uploads/OCR, novas fontes,
Open Food Facts, TBCA, densidades, equivalência FOOD05, IDR/UL ou recomendações
clínicas. Não impedir o cadastro manual pontual já existente.

## Gaps comprovados

| Gap | Evidência na base | Resolução proposta |
| --- | --- | --- |
| G01 — reutilização ausente | `EditorAlimento` permite campos manuais; busca apenas `alimentos_composicao` | Biblioteca e ação explícita “Criar alimento” |
| G02 — catálogo global | `AlimentoComposicaoOrm` sem tenant; migration1030 revoga DML do runtime no catálogo | Tabela própria com RLS; não inserir `custom` nas tabelas/fontes públicas |
| G03 — FK sem identidade custom | Itens/substituições usam `alimento_composicao_id` do catálogo | Descriptor editorial próprio; fatos custom materializados sem falsificar essa FK |
| G04 — autoridade no save | `resolverItem()` relê catálogo; caminho manual recebe composição do DTO | Resolver custom com acesso/revisão atuais na primeira aplicação e mapa cifrado nas seguintes |
| G05 — macros completos | `validarNutrientesManuais()` exige energia/proteína/carboidrato/gordura; editor admite pendências | Biblioteca pode preservar composição parcial; plano fica editorial pendente enquanto faltar essencial, sem publicar ou completar com zero |
| G06 — FOOD01 só catálogo | FK, `ServicoMedidasCaseiras.alimento()` e `resolverMedidasDocumento()` exigem alimento público | Generalizar identidade do pai e adicionar FK custom com XOR; não duplicar biblioteca |
| G07 — histórico/projeção | `montarVersao()` hoje retorna composição decifrada; copies usam allowlists | Separar contexto privado e projeção factual; teste recursivo de campos proibidos |
| G08 — pesquisa protegida | `gerarHashesBuscaPii/ConsultaPii()` já suportam prefixos de palavras ≥3 letras | Reutilizar HMAC tenant-aware; sem SHA sem chave nem decifrar biblioteca inteira para pesquisar |
| G09 — autosave e abas | FOOD01 corrigiu remount por revisão; PA07 controla posse | Estado por paciente/plano/item; respostas tardias não aplicam em outra linha/aba |

## Referências pertinentes — somente FOOD02

Consulta pública em 2026-10-17, sem instalar/executar terceiros ou fornecer dados
privados. Conteúdo externo tratado como dado, não instrução.

| Ref | Evidência examinada | Uso/decisão |
| --- | --- | --- |
| R047 Downshift | README, `useCombobox/README.md`, LICENSE MIT em `1bb8b75e506fe807a5c5201a103d1bd128e5a5e2` | Orienta foco, teclado, estados e seleção. Não adicionar pacote: manter busca assíncrona e botões acessíveis existentes. Não atribuir conformidade ARIA só à referência |
| R064 ZXing browser | README e LICENSE MIT em `9ad027d88d4533bd6d29f9d8d7e517e23cd361ff` | Leitura de imagem/vídeo/câmera, não composição nutricional. Fora do escopo desta entrega, sem permissão de câmera |
| R015 Open Food Facts JS | Catálogo interno e metadados GitHub: Apache-2.0, branch develop, não arquivado | Fonte externa não necessária ao cadastro informado pelo profissional; dados/licença são distintos do SDK; nenhuma integração aprovada |
| R016 FoodData Central | Catálogo/metadados: MIT, último push2020-03-29 | Referência histórica, não substituir USDA offline nem adotar cliente antigo |
| R042 Open Food Facts server | Catálogo/metadados: AGPL-3.0 | Não incorporar servidor/código nem dados; produto custom não depende dessa fonte |

R015/R016/R042 foram triados por finalidade/metadados, não auditados em código
nem validados juridicamente para integração. Só R047/R064 tiveram documentação
técnica/licença lidas nesta rodada. Links e IDs vêm do
[catálogo](../docs/pos-320/01_Catalogo_GitHub_OctaClin). Não pesquisar os demais
repositórios do catálogo a cada fase.

## Contratos de implementação propostos

### Biblioteca e pesquisa — R4

- `alimentos_personalizados`: UUID, tenant, profissional criador, escopo,
  revisão monotônica, ativo, chave de criação idempotente, datas, conteúdo e
  pedido de criação cifrados. Conteúdo: nome≤240, preparação≤180, referência
  textual da composição≤240, base original, valores originais e normalizados,
  versão de normalização. Não solicitar nome de paciente ou texto clínico.
- Nome/composição ficam cifrados; array de índices HMAC do nome, gerados com
  helpers existentes e tenant, com GIN. Não usar `gerarHashBusca()` (SHA sem
  chave). Não aceitar índice, tenant, criador, revisão gerada ou snapshot do
  cliente. Índice é derivado protegido e não aparece em resposta/auditoria.
- Consulta prefixada por palavra, ≥3 caracteres úteis, com todas as palavras
  da consulta; documentar a diferença da busca pública por substring≥2.
  Listagem sem termo disponível. Não aceitar termo presente que gere zero
  hashes como consulta sem filtro. Limitar cada palavra normalizada da consulta
  a32 caracteres com erro explícito, sem truncar para produzir falsos positivos
  ou contagens inexatas. Paginação25, máximo100, página≤10000,
  ordem `criado_em DESC,id DESC`; total somente do escopo autorizado.
- Endpoints backend `planos-alimentares/alimentos-personalizados`:
  GET lista sem termo; POST cria; POST `/busca` pesquisa em body, evitando
  nome livre na URL; GET `/:id` obtém; PATCH `/:id` edita ou `ativo:false`.
  Busca recebe `{busca,pagina?,limite?,escopo?}`; escrita≤16KiB no BFF.
- Escrita por Professional, vínculo ativo e `planos_alimentares.gerenciar`;
  consulta por Professional com `planos_alimentares.ler`. Revalidar no serviço
  e resolver identidade da sessão. Não ampliar SuperAdmin/Client; preservar
  acessos legados ao catálogo e ao prontuário.
- PATCH exige `revisaoEsperada`; desativação sem DELETE/reativação implícita;
  escopo não muda. POST exige UUID `chaveIdempotencia` por tenant/profissional:
  mesmo pedido retorna identidade original; pedido diferente gera409, inclusive
  após edição. Nunca gravar pedido original em claro para comparar.
- RLS tenant fail-closed, FK composta `(tenant_id,profissional_id)`; serviço
  restringe proprietário além do tenant. Lock e CAS/idempotência transacionais
  conforme FOOD01. DTO mínimo, `podeEditar`, sem criador, índice ou ciphertext.
- POST criar recebe `{chaveIdempotencia,escopo?,nome,preparacao?,
  referenciaComposicao?,base:{tipo:'por100g'|'porcao',pesoGramas?},
  nutrientes,micronutrientes?}`. `nutrientes` usa as seis chaves existentes
  (energia/macros/fibras/sódio), todas opcionais no cadastro; micros usam a
  allowlist atual. Tipo por100g fixa peso100, porcao exige peso; rejeitar
  combinação ambígua. PATCH substitui o conteúdo nutricional inteiro com
  `revisaoEsperada`, ou recebe apenas `{revisaoEsperada,ativo:false}`.
  Nome vazio, propriedade desconhecida e valores parcialmente digitados não
  criam cadastro; campos ausentes válidos continuam ausentes.
- Resposta: `{id,nome,preparacao?,referenciaComposicao?,escopo,revisao,ativo,
  baseOrigem,nutrientesPor100g,micronutrientesPor100g,disponivelParaCalculo,
  podeEditar}`; detalhe para edição acrescenta `composicaoOrigem` com os valores
  originais. Preencher a edição com essa composição/base, não os valores por100g
  junto da base anterior, o que normalizaria duas vezes.
  Listagem/busca `{itens,total,pagina,limite}`. Essas respostas
  são privadas e só para biblioteca profissional. API custom fica separada
  da lista de fontes públicas, sem alterar `fontes` nem totais do catálogo.

### Composição e aplicação

- `normalizarComposicaoPersonalizada(entrada)` no domínio retorna original,
  `nutrientesPor100g`, micronutrientes normalizados, completude e versão.
  Base `por100g` ou `porcao`; na segunda, peso positivo0,001–10.000g e até3
  casas. Valores finitos/não negativos, allowlist de macros e22 micros atuais,
  unidades e qualificadores existentes. Não converter RE/RAE/NE/DFE nem
  inferir energia4/4/9, densidade ou nutrientes faltantes.
- Reutilizar razões decimais/escala8/half-up e limites seguros do domínio
  `micronutrientes.ts`; evitar divisão float e arredondamento intermediário.
  Preservar entrada original para reprodução. Normalização fora da precisão
  aceita é erro422, sem clamp. Mostrar prévia da base utilizada.
- Fixture mínima:30g,90kcal,3g proteína,12g carboidrato,3g gordura e0,6mg
  ferro → por100g:300kcal,10g,40g,10g,2mg. Porção45g →135kcal,4,5g,18g,
  4,5g,0,9mg. Zero explícito difere de ausente; sódio não informado é ausente.
- Novo campo editorial `alimentoPersonalizado:{id,revisao,aplicacaoId}|null`.
  É incompatível com `alimentoComposicaoId` preenchido. `aplicacaoId` novo em
  seleção/reaplicação explícita. Não guardar UUID custom na FK do catálogo.
- Primeira gravação resolve identidade, acesso, ativo e revisão sob lock;
  substitui campos nutricionais do cliente pelos valores do servidor. Mapa
  cifrado/schema1 em `plano_alimentar_versoes` associa chave editorial,
  alimento/revisão/nonce e composição aplicada. Saves seguintes reutilizam só
  contexto do mesmo item/identidade; não reler biblioteca nem aceitar mapa HTTP.
- `null` desvincula explicitamente para edição manual mantendo fatos. Omissão
  legada preserva contexto só se os fatos coincidirem; mudança incompatível
  exige409/conferência, sem apagar proveniência silenciosamente. Remover linha
  limpa contexto; novo nonce/replay em outra linha exige acesso atual.
- Resolver antes da conversão/materialização editorial. Não classificar falhas
  de autorização/cifra/concorrência como incompletude clínica. Composição
  incompleta pode ficar na biblioteca e no documento pendente, não em publicação
  materializada. Revisão/publicação/ativação continuam com gates existentes.
- Tratar também PUT clínico/legado, nova versão, revisão/publicação, modelos,
  receitas e cópias: nenhuma rota pode contornar a autoridade do servidor ou
  eliminar vínculo privado inadvertidamente. Cópia autorizada transporta fatos,
  não capacidade de reutilizar alimento pessoal; biblioteca não é reconsultada
  para recalcular história. Nova versão preserva fatos, sem nonce reaplicável.
- Aplicação custom entra exclusivamente pelo documento editorial. DTO clínico
  legado não aceita o descriptor novo; enquanto houver contexto custom no
  rascunho, rejeitar gravação clínica direta que o descartaria com409. Não
  limpar o mapa para aceitar um escritor antigo. Testar entrada extra400,
  writer antigo409, save editorialGREEN e manual legado sem contextoGREEN.
- Na reabertura, projetar `alimentosPersonalizadosAplicados`, por chave
  editorial, somente com referência/base/composição necessárias à conferência
  do próprio item. Nunca usar esse mapa devolvido como entrada confiável.
  Biblioteca sem acesso atual não pode ser consultada por meio da projeção;
  preservação histórica não concede nova aplicação.
- Snapshot factual pode identificar `origem:'custom'` e referência textual
  informada, nunca fonte pública inventada. Atualizar leitores/allowlists.
  IDs privados, nonce, proprietário e mapa ficam fora de portal/PDF/modelos
  compartilhados. Projetar campos permitidos explicitamente; não devolver o
  objeto inteiro com base apenas em tipo TypeScript.

### Medidas caseiras e operação

- Evoluir a tabela FOOD01: adicionar `alimento_personalizado_id`, FK composta
  com tenant; tornar pai público nullable; CHECK XOR exige exatamente um pai.
  Não editar1075. Novos contextos distinguem pai custom/catalogo; ausência de
  discriminador em contexto FOOD01 significa catálogo, não custom.
- Rotas custom `/:id/medidas-caseiras` reutilizam serviço/DTOs FOOD01. Medida
  da clínica não pode expor alimento pessoal: se pai é pessoal, medida só
  pessoal do mesmo proprietário. Revalidar acesso ao pai em listagem e nova
  aplicação; preservação de medida já aplicada continua factual/histórica.
- Ordem no save: resolver alimento custom e depois medida compatível com esse
  pai; trocar alimento limpa medida antiga. Testar ambos os snapshots juntos.
- Migration candidata1076, reconferir numeração no início: tabela, índices,
  constraints/FORCE RLS, adaptação aditiva de medidas e coluna cifrada da versão.
  Registrar ORM/migration e inventário do harness. Sem backfill clínico, sem
  editar1075, sem privilégios owner permanentes ao runtime.
- Aplicação externa é outra operação: identificar alvo/roles, backup e grants
  mínimos; migration antes do novo backend. Rollback suspende UI/escritas novas
  mantendo schema, dados e leitor compatível; parser anterior rejeita descriptor
  novo. `down` não apaga biblioteca/snapshots para viabilizar rollback.

## Tarefas e checkpoints

Cada tarefa técnica: escrever teste que reproduza contrato/falha, observar RED,
implementar mínimo, observar GREEN e regressões relacionadas, registrar evidência
e commit. Não declarar RED por erro de ambiente ou teste que não chegou à ação.

| ID | Arquivos e entrega | Dependências / aceite objetivo |
| --- | --- | --- |
| T00 | Este plano/checklist, estado e roadmap; referência/baseline | Merge424 e CI conferidos; D01–D03 registradas com estado verdadeiro |
| T01 | Novos `dominio/alimentos-personalizados.ts/.spec.ts`, `aplicacao/dtos-alimentos-personalizados.ts/.spec.ts` em planos-alimentares | Após respostas/autorização. Fechar interfaces `normalizarComposicaoPersonalizada`, criar/atualizar/buscar/projetar; fixtures acima, limites, extras, ausente/zero, micros/unidades, overflow e texto malicioso |
| T02 | Migration1076 candidata + spec; `infraestrutura/alimento-personalizado.orm.ts`, versão, medida, `opcoes-typeorm.ts`, módulo | T01; registro único, XOR/FK/RLS, coluna cifrada, down conservador, schema anterior e FOOD01 preservados |
| T03 | `aplicacao/servico-alimentos-personalizados.ts/.spec.ts`, `apresentacao/controlador-alimentos-personalizados.ts/.spec.ts` | T02; CRUD/pesquisa/idempotência/CAS e projeção; creator/tenant/roles/vínculo; sem chamadas a fornecedor nem DML público |
| T04 | `dominio/edicao-plano.ts`, novo resolver privado, `aplicacao/servico-planos-alimentares.ts`, `dtos-edicao-plano.ts`, DTOs/cópias/modelos/receitas e respectivas specs; serviço/domínio medidas | T03; snapshot autoritativo, reabertura após biblioteca alterada/desativada, corrupção fail-closed, nonce, omissão/null, duas origens de medida, todos os caminhos de save sem bypass |
| T05 | `rls-isolamento-tenant.integracao.spec.ts`, `scripts/test-pa05-postgres-local.cjs` e integração biblioteca | T02–T04; PostgreSQL descartável, role não owner/NOBYPASSRLS; cross-tenant/owner, FK/XOR, criação e CAS concorrentes, aplicar×desativar, transferência/revogação; sem falso PASS por skip |
| T06 | Novos `app/api/planos-alimentares/alimentos-personalizados/**/route.ts`, `lib/alimentos-personalizados-plano.ts`; componente `components/pacientes/alimentos-personalizados.tsx`; editor/API/edicao | Após checkpoint backendGREEN. BFF/contratos fechados; criar sem aplicar automaticamente, selecionar explicitamente, CRUD, busca paginada, campos parciais, idempotência/confirmação incerta; nenhum remount por revisão de autosave |
| T07 | Specs Web BFF/helpers/cópias e extensões de `tests/visual/pa07-coordenacao-abas.spec.mjs` e `console-regression.spec.mjs`; regressões PA02–PA07/FOOD01 | T06; desktop/mobile, teclado/Axe, autosave/abas/troca de paciente/ACK tardio, portal/impressão, combinado/micros sem mudança de fontes |
| T08 | Evidências/revisão R4, rotas, matriz/runbook, checklist e PR única | T01–T07; diff/secrets, gates de backend/Web/PG, CI do HEAD e transparência sobre revisão/limites reais. Não executar merge/rollout |

### Foco de revisão e provas negativas

1. Alimento pessoal de outro profissional: negar busca/detalhe/aplicação mesmo
   com UUID conhecido, fonte ou escopo adulterados e medida da clínica.
2. Transferência/revogação enquanto pedido está em voo: revalidar acesso ao
   paciente no save; UI não aplica resposta em outro contexto ou aba sem posse.
3. Alteração/desativação entre busca e aplicação:409, sem escolher revisão nova;
   em save posterior da mesma aplicação, snapshot anterior continua intacto.
4. Dados parciais e bases diferentes: nada vira zero; energia/macros faltantes
   mantêm pendência; macros/micros usam a mesma base e não dupla normalização.
5. Vários caminhos de cópia/publicação: retirar capacidade privada sem perder
   fatos; testar JSON recursivamente, não só renderização dos campos na UI.

## Verificação e handoff de modelos

No planejamento inicial: revisão documental, leituras de código/contratos, metadados/licenças,
merge/CI, diff e links locais. Sem execução de testes de implementação, installs,
builds, banco, provider, migration ou deploy. Baseline CI não é prova FOOD02.

Na implementação, executar focados Jest de planos-alimentares/migration, PG
descartável (declarar extensões omitidas), backend typecheck/build e integral;
Web `test:authz`, `test:planos-alimentares:bff`, `test:nutricao-plano`,
`test:copia-refeicoes`, typecheck/lint/build, Playwright novo e regressões
FOOD01/PA07/portal/impressão, gates runtime/operacionais e CI completo do HEAD.
Conferir nomes de scripts atuais antes de executá-los. Testes só sintéticos.

**Mix econômico:** GPT-6.1 Sol médio para planejamento e T01–T05 (schema,
RLS, autoridade e snapshots). Após backend/contratos/PG GREEN, avisar e pausar
para troca manual para GPT-6 Luna alto em T06–T07. Handoff deve conter exemplos
de request/response reais e validados, sem campos ainda indefinidos. Retornar a
Sol médio para revisão R4, integração T08 e CI; avisar e pausar também nessa
troca. Revisão própria não é independente. Não há troca necessária agora.

## Checkpoint backend implementado

T01–T05 implementados após “Pode seguir, sol médio”, com migration1076,
biblioteca/DTOs, mapas cifrados, medidas custom e projeções explícitas. Contratos
reais e exemplos no [handoff Luna](handoff-pos-320-food02-luna.md); o
[ledger](execucao-pos-320-food02.md) distingue RED/GREEN e falhas de preparação.
494 focados,34 PG reais/29 filtrados e typecheck/build/artefato PASS. Suíte
integral, verificações finais e limites nas
[evidências](../docs/governance/EVIDENCIAS_FOOD02_BACKEND_2026-10-17.md).
Pausar para troca manual a Luna alto ANTES de T06; T08/CI somente após UI.
