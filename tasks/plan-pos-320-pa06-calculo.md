# PA06 — plano de implementação da terceira entrega

**Objetivo:** somar energia, macros e micronutrientes dos planos e refeições
selecionados de um paciente, usando somente as publicações atuais e os estados
ON/OFF confirmados, com cobertura nutricional explícita.

**Arquitetura:** leitura autorizada e transacional no módulo existente de planos;
motor puro sobre snapshots cifrados já materializados; seleção efêmera no console.
Micros são um bloco aditivo versionado, separado dos seis campos atuais. Nenhum
cálculo consulta catálogo para enriquecer uma publicação antiga.

**Stack:** NestJS/TypeORM/PostgreSQL FORCE RLS, cifragem existente, Next/BFF,
React/TypeScript, Jest, PostgreSQL descartável e Playwright. Sem nova dependência.

**Especificação:** [plano principal/D01–D10](plan-pos-320-pa06.md), D11–D13 abaixo,
[fontes e whitelist](../docs/product/FONTES_MICRONUTRIENTES_PA06.md) e
[checklist T08c/T08d](todo-pos-320-pa06.md).

## Base e autorização desta rodada

- PR #421 MERGED em 2026-10-16; merge `011ea87d`, base desta worktree.
  Estado da PR e main remota conferidos por `gh pr view`/`git fetch`.
- Branch `feat/pos320-pa06-calculo`, worktree
  `/workspace/octaclin/.worktrees/pos320-pa06-calculo`. Checkout principal e sua
  alteração preexistente em `octaclin-web/next-env.d.ts` preservados.
- PR #420 integrou autosave/1073; #421 integrou ativação/1074. Os arquivos das
  migrations 1072–1074 estão registrados no TypeORM. Nenhum banco externo foi
  consultado: aplicação efetiva da1074 e deploy continuam não verificados.
- Planejamento preservado em `10ebf9aa`; em 2026-10-16 o proprietário autorizou
  desenvolvimento com “Pode seguir com sol médio”. T08c em execução nesta mesma
  branch. Cargas externas, migrations externas, merge/deploy e ativação continuam
  fora desta autorização. Uma PR para a terceira entrega, sem PR documental separada.

## Decisões confirmadas nesta rodada

| ID | Regra |
| --- | --- |
| D11 | Seleção inicialmente vazia; selecionar plano inclui as refeições ativas naquele momento. Profissional pode desmarcar cada refeição. Estado só em memória do prontuário do paciente, atravessando páginas da lista e alternância entre planos |
| D12 | OFF preserva seleção, exclui contribuição e mostra o motivo. ON reinclui o que continuava selecionado. Refeição que já estava OFF e não selecionada não é selecionada só porque foi ligada |
| D13 | Preparar nova versão TACO com micros verificáveis nesta entrega. Publicações/fontes antigas ficam intactas. Carga externa exige autorização e alvo próprios |

D01–D10 continuam válidas. Soma não representa consumo, média diária nem soma
de metas. Rascunhos, versões antigas, substituições e escolhas do paciente não
alimentam esta projeção. Portal e PDF conservam os contratos já integrados.

## Gaps demonstrados na main

| Gap | Evidência no código | Resolução planejada |
| --- | --- | --- |
| C01 — não existe cálculo combinado | `controlador-planos-alimentares.ts` só tem ações/leitura de um plano | POST profissional dedicado, DTO limitado e motor sobre snapshots |
| C02 — listagem não fornece seleção de refeições | resumo PA04 e estados PA06 não trazem uma projeção mínima própria | GET sob demanda da publicação atual do plano, sem itens/notas clínicas |
| C03 — seis campos nos snapshots | `NutrientesPor100g`, `calcularNutrientesPorcao`, `SnapshotComposicao` no serviço | bloco opcional de micros com schema, valores e proveniência |
| C04 — TACO perdeu os micros | `importador-taco.ts` só produz seis campos; loader salva categoria em JSONB | modo explícito v2; novo artefato/fonte, sem alterar v1 |
| C05 — raw não é contrato | USDA preserva `nutrientsOriginal`; IBGE preserva nutrientes originais/normalizados em metadados | adapters puros com IDs/cabeçalhos/unidades conhecidos, sem enviar o Record bruto |
| C06 — totais existentes não expressam cobertura | `resumo-nutricional-plano.ts` omite nutriente incompleto; lista PA04 só macros | resultado próprio por nutriente, sem mudar retroativamente o resumo PA04 |
| C07 — campos podem sumir em cópias | DTOs/editor/cópia/modelo/receita enumeram seis nutrientes | matriz de roundtrip e campo aditivo comum para micros manuais |
| C08 — consulta atual carrega dados desnecessários | `montarVersao()` também lê substituições/cálculo/editorial | leitura combinada consulta somente publicação, vínculos, itens e snapshots necessários |
| C09 — concorrência operacional/editorial | revisão de ativação separada, ponteiro de publicação, locks paciente→plano | conferir ambos sob locks em ordem estável; conflito409 sem fallback |
| C10 — UI pode exibir resposta antiga | guardas PA06 de geração/revisão para prévia/print | coordenador de seleção próprio, abort e descarte por sequência/contexto |

## Contratos fechados para a implementação

### API e leitura

1. `GET /pacientes/:pacienteId/planos-alimentares/:planoId/selecao-calculo`:
   `{ planoId, ativoParaPaciente, ativacaoRevisao, versao: { id, numero,
   publicadaEm } | null, refeicoes: [{ identidadeId, nome, ordem, ativa }] }`.
   Só a publicação apontada por `versaoPublicadaAtualId`; nunca buscar uma
   publicação anterior por data. Sem publicação: seleção indisponível. A lista
   PA04 existente continua paginada; este GET só ocorre ao selecionar/expandir
   um plano, sem carregar todas as páginas nem o prontuário completo.
2. `POST /pacientes/:pacienteId/planos-alimentares/calculo-combinado`:
   `{ selecoes: [{ planoId, versaoIdEsperada, ativacaoRevisaoEsperada,
   identidadesRefeicoes: string[] }] }`. Nenhum total/nutriente do navegador.
   Registrar a rota estática antes de `:planoId`. Repetir a leitura é seguro e
   não escreve evento, versão, seleção ou resultado no banco.
3. Limites técnicos:25 planos,50 refeições por plano,500 identidades selecionadas
   no total,10000 itens efetivos,64KiB de corpo. Validar UUID, duplicatas,
   chaves extras, inteiros de revisão e limites acumulados. Exceder limite
   retorna erro explícito; nunca cortar o cálculo silenciosamente. Seleção
   vazia retorna `sem_selecao`, sem total zero inventado.
4. Manter papéis/permissões de leitura do módulo (`SuperAdmin`/`Professional`,
   `planos_alimentares.ler`); profissional limitado à carteira atual. Usar
   `ExecutorTenant` e os helpers existentes de escopo, sem política paralela.
   Uma seleção com recurso não autorizado falha inteira sem identificar o
   recurso proibido. Não devolver os demais totais como se a seleção estivesse
   completa. Arquivado/excluído é negado; OFF autorizado é estado de exclusão.
5. Uma transação: paciente com lock compartilhado de escopo; planos ordenados
   por UUID com lock compartilhado; publicações e vínculos verificados na mesma
   transação. Respeitar a ordem dos writers PA06. Conferir publicação/revisão
   esperadas mesmo em planos OFF. Seleção obsoleta retorna409; não trocar a
   versão e calcular sem o profissional atualizar a seleção.
6. Validar todas as identidades na publicação atual e no mesmo tenant/plano.
   Estado ausente/contraditório falha fechado; nunca presumir ON. Se plano
   ativo e refeição selecionada estiver OFF, retornar exclusão informativa.
   Não consultar rascunho para completar identidades de uma publicação.
7. `Cache-Control: private, no-store` no backend e BFF; POST body fora de logs,
   auditoria, analytics, URL e cache persistente. DTOs mínimos explícitos;
   sem ORM cru, cipher, dados cadastrais ou documento editorial.

### Motor e precisão

`calcularNutrientesCombinados(entrada: ContribuicoesCombinadas): ResultadoCalculoCombinado`
vive em `dominio/calculo-combinado.ts`, sem ORM/HTTP/catálogo. Entrada já
autorizada contém snapshots dos itens e os quatro booleanos de inclusão:
plano ativo E selecionado E refeição ativa E selecionada. Testar as16
combinações. Repetição da mesma contribuição é erro, não soma; o mesmo alimento
em refeições distintas conta normalmente. Não incluir alternativas.

Por nutriente: `{ codigo, unidade, estado: completo|parcial|indisponivel,
total?, quantidadeConhecida?, itensComValor, itensIncluidos }`. `total` só quando
todos os itens incluídos têm valor conhecido. Parcial mostra quantidade
conhecida separada e cobertura; nenhum conhecido mostra `—`. Zero conhecido
continua zero. Nenhum item incluído gera `sem_contribuicoes`, sem falsa dieta
de0kcal. A tabela expõe fontes/versões agregadas e motivos de exclusão limitados.
Cada resultado identifica versões, revisões e instante da leitura.
Snapshot ilegível de item incluído conta como item sem valores, com motivo
sanitizado; não remover o item do denominador para fabricar cobertura completa.
Itens excluídos por seleção/OFF não precisam de decifragem nutricional.

Macros/fibras/sódio usam valores **por porção já congelados**, sem recomputar
4–4–9 ou consultar catálogo. Legado arredondado a4 casas permanece assim.
Novos micros são congelados a8 casas na unidade canônica, após normalizar a
base e aplicar a porção uma vez. Soma em ponto fixo8 com inteiros/`bigint`
somente no motor; serialização JSON retorna números finitos dentro dos limites
de entrada, sem serializar `bigint`. Arredondamento decimal half-up para valores
não negativos, somente após calcular a porção e na apresentação final; testes
de borda independentes fixam a conversão decimal sem usar o helper como oráculo.
Não adicionar decimal.js sem necessidade comprovada. Overflow/NaN/Infinity
geram indisponibilidade/erro sanitizado, nunca clamp ou total aparentemente válido.

Exibição: energia0 casas, macros/fibras1, sódio/minerais mg2, vitaminas mg3,
valores mcg2; valores positivos menores que a menor casa mostram `<limiar`
em vez de0. Decisões e somas usam precisão congelada, não texto formatado.
O inteiro acumulado em escala8 deve ser menor ou igual a
`BigInt(Number.MAX_SAFE_INTEGER)`; exceder essa proteção técnica retorna422,
sem classificar o dado como clinicamente inadequado. Validar o limite antes da
conversão de volta a Number; não elevar o limite só para fazer um teste passar.

### Micros, manual e histórico

Whitelist e22 códigos na [ficha de fontes](../docs/product/FONTES_MICRONUTRIENTES_PA06.md).
`MicronutrientesPor100gEntrada = Partial<Record<CodigoMicronutriente, number>>`
é campo **irmão** de `nutrientesPor100g`, chamado `micronutrientesPor100g` nos
itens manuais. Não inserir objeto aninhado nos seis nutrientes cujo cálculo
existente percorre `Object.values`. Unidade vem do registro, nunca do cliente.

No documento editorial, mesmo campo aceita o `NumeroEdicao` existente para
conservar vazio/digitação intermediária cifrados. Micros opcionais não impedem
salvar o rascunho; vazio vira ausência no cálculo. Valor não vazio inválido não
ganha validade clínica; seguir materialização/publicação já existentes.
Catálogo não aceita override manual de micros: UI só lê a projeção autorizada,
e servidor recusa esse override. Cópia/modelo/receita de item de catálogo retém
ID da fonte e omite override; item manual preserva micros permitidos.

`SnapshotMicronutrientesV1` conserva schema/mapeamento, código/unidade,
valor por100g/porção ou estado de ausência, referência de origem e base.
Guardar no snapshot cifrado de composição existente; não criar coluna/tabela
para seleção. Publicação inclui o novo bloco no hash; leitura/hash legado não
adiciona campos ausentes nem altera bytes históricos. Criar rascunho/cópia é
nova operação autorizada; leitura de publicação antiga não enriquece snapshot.

TACO novo modo explícito preserva parser/resultado v1 e suas provas de hash.
USDA/IBGE v1 podem produzir **novos** snapshots via adapters estritos dos dados
originais preservados. Não usar fonte inativa/sem aprovação nem recarregar
catálogo em runtime. A nova TACO usa versão/base/hashes próprios, idempotente;
nenhuma troca automática dos IDs dos alimentos de planos antigos.

### UI e respostas assíncronas

- Componente novo `calculo-combinado-planos.tsx`; o editor existente só hospeda
  o componente e comunica mudanças confirmadas de ativação/publicação/contexto.
  O motor combinado não é reimplementado no navegador.
- Seleção usa Map em memória por sessão/paciente, independente da paginação e
  do plano aberto. Trocar paciente/logout/desmontar prontuário limpa o estado;
  mudar página/plano dentro dele preserva. Sem localStorage/URL/IndexedDB.
  Estado pertence ao contexto do prontuário, não a um filho que desmonta ao
  trocar aba interna. Selecionar não torna o editor dirty, não agenda autosave,
  não grava plano e não cria aviso de saída por alterações não salvas.
- Checkbox de plano inicialmente desmarcado. Ao selecionar, buscar a projeção
  mínima e selecionar refeições ativas. OFF não selecionado não pode ser
  incluído. OFF já selecionado continua marcado e removível, com exclusão
  visível; ON reinclui conforme D12. Novas refeições não são selecionadas por
  inferência ao surgir outra publicação.
- Alterar seleção/toggle/publicação limpa o total antigo **antes** de enviar a
  nova leitura. Abortar transporte e verificar geração de contexto + sequência
  + seleção + versões/revisões antes de renderizar qualquer resposta tardia.
  No409, manter seleção marcada como desatualizada e oferecer “Atualizar seleção”;
  essa ação busca publicação atual, conserva apenas identidades ainda presentes
  e informa removidas/novas. Não manter total antigo ao atualizar.
  ACK local de ON/OFF atualiza a revisão operacional conhecida e solicita nova
  leitura protegida, sem confirmação extra do profissional.409 de outro writer
  ou publicação diferente exige a reconciliação explícita descrita acima.
- Coalescer alterações de seleção por300ms, mantendo só a última leitura
  pendente; botão “Recalcular” é imediato. Cancelar esse timer ao mudar contexto.
  Não confundir esse atraso de leitura com o ciclo de autosave de60s.
- Revalidar ao retornar foco ou reconectar, sem reenviar escritas ou criar polling
  clínico. Resultado é snapshot “Calculado em...”, consistente na transação;
  não prometer detecção instantânea de mudança em outro dispositivo. PA07
  continua responsável pela coordenação adicional entre abas.
- Tabela acessível com quantidade/unidade/cobertura; resumo de seleção e estados
  carregando/vazio/excluído/parcial/erro. Teclado, foco, mobile, desktop e Axe.
  Sem diagnóstico, adequação DRI/UL, exportação nova ou exposição no portal/PDF.

## Tarefas executáveis e dependências

Executar cada linha com teste RED correspondente, implementação mínima, GREEN
e revisão do diff; agrupar3–5 arquivos por fatia. Não marcar teste não rodado.

| Tarefa | Arquivos/responsabilidade e resultado verificável | Dependência/modelo |
| --- | --- | --- |
| T08c.1a | Criar `dominio/micronutrientes.ts` e `.spec.ts`;22 códigos/unidades, estados, ponto fixo e arredondamento. Atualizar ficha de fontes com mapeamento literal; resolver somente a equivalência IBGE D ou manter esse mapping ausente | Base; Sol médio |
| T08c.1b | Criar `dados/micronutrientes-fonte.ts`/`.spec.ts`; adapters USDA IDs/unidades/LOQ/duplicatas, IBGE campos/marcadores, TACO novo bloco. Fixtures exclusivamente sintéticas; nenhum Record desconhecido vira nutriente | .1a; Sol médio |
| T08c.1c | Modo novo em `dados/importador-taco.ts`, `scripts/importar-catalogo-taco.ts`, `scripts/carregar-catalogo-taco.ts` e provas em `dados/catalogo-taco.spec.ts`; artefato v2 separado e esquema de fonte declarado. V1 permanece reproduzível; simular carga idempotente somente em banco descartável | .1a/.1b e D13; Sol médio |
| T08c.2a | `aplicacao/dtos.ts`, `dominio/edicao-plano.ts`, `aplicacao/dtos-edicao-plano.ts`, `servico-planos-alimentares.ts` e specs em fatias; validar micros manuais, criar snapshot cifrado e projetar somente campos aprovados; catálogos ignoram o navegador como fonte nutricional | .1b; Sol médio |
| T08c.2b | `dominio/modelos-plano-alimentar.ts`, DTO/serviços de modelo/receita e respectivos specs; roundtrip manual, clone e publicação não perdem micros; publicação antiga/hash legado inalterados. Não ampliar projeção paciente por espalhamento de objeto | .2a; Sol médio |
| T08c.3 | Criar `dominio/calculo-combinado.ts`/`.spec.ts`;16 combinações, cobertura independente, zero/ausente, duplicatas, ordem, extremos e soma multipágina. Oráculos decimais sintéticos escritos antes do motor | .1a/.2a; Sol médio |
| T08c.4 | Criar `aplicacao/dtos-calculo-combinado.ts`/`.spec.ts`; adaptar controlador/serviço/specs em fatias. GET seleção + POST cálculo usam helpers/locks existentes, projeção mínima e nenhuma escrita. Extrair leitura de dados para helper dedicado apenas se necessário para manter o serviço revisável | .3; Sol médio |
| T08c.5 | Estender `rls-isolamento-tenant.integracao.spec.ts` e fixture descartável: tenant/carteira/transferência, publicação↔cálculo, OFF↔cálculo, seleção obsoleta, estado sem vínculo, zero escritas; mesma ordem de locks sem deadlock | .4; Sol médio |
| Checkpoint backend | DTOs/exemplos sintéticos e tabela de nutrientes congelados, domínio/serviço/PG/RLS GREEN; typecheck/build/regressões focadas. Somente então handoff para interface e pausa de troca manual | .1–.5; Sol médio |
| T08d.1 | Novos BFFs `app/api/pacientes/[id]/planos-alimentares/calculo-combinado/route.ts` e `[planoId]/selecao-calculo/route.ts`; cliente `lib/calculo-combinado-planos-api.ts`, harness BFF existente e catálogo de autorização. Reusar sessão/proxy/no-store, preservar status400/401/403/404/409/413/422 | Checkpoint; Luna alto com contrato fechado |
| T08d.2 | `lib/edicao-plano.ts`, `lib/copia-refeicoes-plano.ts`, tipos API/editor e novo editor de micros manuais; fatias separadas para tipos/cópia e UI. Conservar texto incompleto e não criar overrides em itens de catálogo. Harnesses de cópia/editor e Playwright antes/depois do autosave | T08c.2; Luna alto |
| T08d.3 | Criar `components/pacientes/calculo-combinado-planos.tsx`, helper de seleção em memória e testes; integrar minimamente no editor/prontuário para sobreviver à troca interna de plano/página e invalidar por toggle/publicação. Provar pacienteA→B e respostaA tardia | T08d.1/.2; Luna alto |
| T08d.4 | Criar `tests/visual/pa06-calculo-combinado.spec.mjs`;2+ planos,2+ páginas, seleção vazia, ON/OFF, parcial,409, teclado/mobile/Axe e fontes distintas sem misturar RE/RAE/NE. Nenhum teste afrouxado para aceitar total incorreto | T08d.3; Luna alto |
| T09.3 | Integração Sol: testes completos proporcionais, PG/Redis conforme gates da PR, BFF/authz, PA02–PA06, portal/print, lint/typecheck/build/secrets/governança. Revisão R4 cruzada quando viável, autoria/limites declarados. Atualizar matriz/ADR/runbook somente pelo contrato efetivamente implementado | Todas; Sol médio |
| T10.3 | Uma PR de cálculo combinado/micros, inicialmente Draft; fonte nova/carga externa separadas. CI e smoke do HEAD final PASS; SKIPPED com motivo. Sem merge/deploy/carga/ativação por inferência | T09.3; Sol médio |

## Foco da revisão e testes que devem bloquear a entrega

1. Soma silenciosa de versões/riscos distintos: versão histórica/rascunho,
   seleção antiga após publicação e16 combinações ON/seleção em T08c.3/.5.
2. Vazamento por seleção em lote: um ID de outro paciente/tenant no meio da
   lista deve negar o conjunto, sem resposta parcial, em T08c.4/.5 e T08d.1.
3. Qualidade nutricional artificial: ausência/traço/LOQ, zero conhecido, RE/RAE,
   NE/niacina e vitamina D sem equivalência em T08c.1a/.1b/.3.
4. Perda ou alteração de histórico: snapshot antigo/hash, clone/cópia/manual,
   edição durante autosave e publicação com micros em T08c.2 e T08d.2.
5. Resultado ressuscitado: seleção/paciente/toggle/publicação mudam antes da
   resposta; total anterior não reaparece, incluindo no409/foco, em T08d.3/.4.

Regressão adicional de integração em T08d.3/.4: seleção entre páginas/abas do
mesmo prontuário não envia PUT, não publica, não altera ON/OFF e não dispara
aviso de saída. Outro paciente limpa a seleção antes de renderizar o novo contexto.

Oráculo sintético mínimo: publicação A contém item com100kcal/P10g/C20g/G5g,
ferro1mg e cálcio0mg; publicação B contém200kcal/P20g/C40g/G10g, ferro ausente e
cálcio20mg. Ambos incluídos:300kcal/P30g/C60g/G15g; cálcio20mg completo (2/2),
ferro com1mg conhecido parcial (1/2). B OFF:100kcal, ferro1mg completo e cálcio0mg
completo; B ON restitui exatamente o estado parcial anterior. Catálogo alterado
não altera nenhum desses resultados. Repetir com A/B em páginas diferentes,
ordem invertida e respostas controladas em voo. Snapshot de ferro1mg de porção
50g não é multiplicado por50/100 novamente.

Comandos de implementação: Jest específico de cada arquivo; depois
`pnpm --dir octaclin-backend test --runInBand`, `typecheck`, `build` e
`test:rls:testcontainers` somente em instância descartável autorizada;
`pnpm --dir octaclin-web test:planos-alimentares:bff`, `test:authz`, `lint`,
`typecheck`, `build` e `pnpm exec playwright test` nos recortes citados; gates
de governança, `pnpm security:secrets`, `git diff --check` e CI do HEAD final.
Toolchain declarada: Node22/pnpm11.25. O checkpoint de implementação e os
comandos realmente executados constam nas evidências desta entrega; a tabela
abaixo conserva as verificações da rodada inicial de planejamento.

## Operação, rollback e modelos

Risco de implementação R4: leitura clínica, authz/RLS, snapshots, concorrência e
importação governada. Nenhuma migration nova prevista;1072–1074 intocadas.
Antes de rollout, verificar registro real da1074, role runtime sem privilégio
administrativo e backend com enforcement ON/OFF. Merge/CI não provam ambiente.
Reversão só para backend que preserve os controles de ativação; manter schema,
snapshots e fontes novas. Recusar rollback que possa zerar/drop micros ou voltar
a expor refeições OFF; se necessário retirar apenas o acesso à nova projeção.

**Sequência econômica:** GPT-6.1 Sol médio fecha e implementa T08c e o checkpoint;
GPT-6 Luna alto implementa T08d com DTO/motor já testados; GPT-6.1 Sol médio faz
T09.3/T10.3 e revisão R4. Avisar e pausar antes de cada troca manual. Luna sozinho
não assume mapeamento de fontes, precisão, cifragem, contratos ou concorrência.
O modo de execução desta sessão é sequencial na mesma worktree/PR.

R013 TanStack/query e R014 react-hook-form são as únicas referências de
repositórios desta PA06; versões/licenças fixadas no plano principal. Consulta
restrita nesta rodada ao guia `query-cancellation.md` de R013 (AbortSignal e
cache após unmount) e tipos de R014 (`keepDirtyValues`/`keepValues`). Orientam
cancelamento/preservação de formulário; não serão dependências novas. Fontes
oficiais de alimentos orientam a whitelist; não consultar repositórios de PA07
ou FOOD06 por antecipação.

## Verificações documentais desta rodada

- PASS: `git fetch origin main`, `git worktree list`, `git status`, diff e
  `gh pr view 421 --json state,mergeCommit,statusCheckRollup`; merge `011ea87d`
  e checks da PR integrados conferidos, provenance SBOM SKIPPED pelo workflow.
- PASS: fontes oficiais públicas lidas com Python (`urllib.request`, ZIP/XML,
  `xlrd` e CSV); hashes,22 códigos e unidades registrados na ficha. Consulta
  aos dois arquivos relevantes de R013/R014 via API GitHub, sem execução.
- PASS: conferência de referências locais dos seis documentos com links,
  contagem da whitelist22, `git diff --check` e `node scripts/scan-secrets.mjs`.
  O scanner não encontrou secrets pelos padrões locais; isso não é auditoria
  de runtime ou comprovação de direitos operacionais.
- SKIPPED: testes unitários/integração/PG/RLS/Playwright, lint/typecheck/build e
  CI desta terceira entrega; código não alterado nesta rodada. Nenhuma
  dependência instalada, carga, migration externa, merge ou deploy executado.
- Decisões de produto D11–D13 respondidas; nenhum esclarecimento de produto
  restante na data do planejamento, antes da autorização posterior de T08c. A equivalência
  IBGE D tem tratamento técnico conservador definido e não bloqueia outros campos.

## Checkpoint posterior — desenvolvimento autorizado e backend entregue localmente

Em 2026-10-16, o proprietário autorizou “Pode seguir com sol médio”. T08c.1a–.5
implementados e validados; [evidências](../docs/governance/EVIDENCIAS_PA06_CALCULO_2026-10-16.md)
e [handoff corrente](plan.md) registram arquivos, contratos, RED/GREEN e limites.
Não alterar as verificações históricas do planejamento acima como se fossem
provas executadas naquela data. Gate local de planos/RLS PASS; gate integral
Timescale/pgvector/CI e revisão R4 final continuam pendentes. Nenhuma carga externa.
Próxima ação: troca manual para Luna alto e T08d.1–T08d.4, depois Sol para T09.3/T10.3.
