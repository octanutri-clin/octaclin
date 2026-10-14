# PA02 — análise de gaps e handoff de implementação

Data: 2026-10-14. Base auditada: main `2d2edcfed20457cb21a1d27d2cbfcc21499bab13`,
merge da PR #414/PA01; FND02 integrado pela PR #411.

**Autorização atualizada:** em 2026-10-14 o proprietário autorizou a
implementação da PA02 após a troca manual para Luna alto. Uma única PR reunirá
planejamento e implementação. Merge, deploy e alterações externas continuam
fora do escopo autorizado.

## Checkout e continuidade

- Branch de implementação: `feat/roadmap-PA02-copy-meals`.
- Checkout isolado: `/workspace/octaclin/.worktrees/pos320-pa02-planejamento`.
- O checkout principal em `774cf34f` e sua alteração em `next-env.d.ts` foram
  preservados. O fetch ali falhou por objeto ausente em ref remoto legado;
  foi feito clone limpo da main, sem remover refs nem trabalhos preexistentes.
- Implementação retomada neste checkout, branch
  `feat/roadmap-PA02-copy-meals`; base remota revalidada em `2d2edcf`.
  Não abrir PR documental separada nem misturar PA03/PA04.
- Checklist executável: [todo-pos-320-pa02.md](todo-pos-320-pa02.md).

## Referências preparadas pelo proprietário

Em cada ID, consultar somente suas seções e referências nestas quatro fontes,
antes de propor biblioteca. Diretriz explícita do proprietário em2026-10-14:
não auditar todos os repositórios do catálogo a cada fase.

1. [Roadmap por ondas](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md):
   escopo, dependências, classificação JÁ COBERTO/RESIDUAL/CONDICIONAL/NO-GO.
2. [Catálogo e mapa inverso por ID](../docs/pos-320/01_Catalogo_GitHub_OctaClin):
   candidatos, usos, cuidados, licenças e alternativas internas.
3. [Matriz das sugestões](../docs/pos-320/02_Matriz_71_Sugestoes_OctaClin.md):
   sugestão 44 → PA02; rastreabilidade original.
4. [Catálogo estruturado](../docs/pos-320/03_Catalogo_GitHub_OctaClin.json):
   conferir `entries[].prs` para o ID; não assumir que uma ausência é esquecimento.

**Decisão PA02: REUTILIZAR código interno.** O catálogo diz explicitamente
“Sem biblioteca recomendada; usar primitives/código atual”. O JSON contém
78 referências no índice e nenhuma candidata PA02. A contagem não representa
auditoria desses78 repositórios. A sugestão44 confirma a escolha.
Não há código/dataset externo a copiar nem licença de novo pacote a aprovar.
R001/dnd-kit é referência da PA01 já integrada, não uma dependência nova da PA02.
OpenNutriTracker/Tandoor, RHF e TanStack não são candidatos PA02 no mapa;
não incorporá-los por semelhança de tema.

Nos IDs futuros, registrar candidato por URL/tag/commit, licença do código e
dos dados, manutenção, compatibilidade, decisão e alternativa interna. O catálogo
é ponto de partida; licenças e versões ainda exigem revalidação na adoção.
Investigar somente candidatos mapeados para o ID atual; ampliar a pesquisa
apenas se houver lacuna demonstrada, explicando o motivo.

## Gaps observados no código

| Capacidade | Estado observado | Evidência / ação |
|---|---|---|
| Reordenar refeições | JÁ COBERTO | PA01/#414; preservar `RefeicaoOrdenavel`, drag e setas. |
| Duplicar plano de outro paciente | JÁ COBERTO | `components/pacientes/duplicar-plano-de-outro-paciente.tsx`: leitura autorizada e aplicação das refeições ao rascunho. Não reconstruir/substituir o fluxo legado. |
| Aplicar modelos/receitas com novas chaves | JÁ COBERTO | `refeicoesParaModelo`, `refeicoesDoModelo`, `alimentoDoModelo` no editor. |
| Duplicar apenas uma refeição | RESIDUAL CONFIRMADO | Não há comando por refeição; criar cópia independente no rascunho em edição. |
| Copiar uma refeição salva de outro plano | RESIDUAL CONFIRMADO | Seleção granular de origem/versão/refeição e buffer interno ausentes. |
| Colar como nova refeição ou em refeição existente | RESIDUAL CONFIRMADO | Falta selecionar destino sem substituir o restante do plano. |
| Persistência e recálculo | JÁ COBERTO | PUT rascunho valida, recalcula e cria novos filhos; publicação continua separada. |
| Biblioteca independente de refeições | OUTRO ID | PA08/FOOD04; não pertence à PA02. |

Arquivos auditados: editor, wrapper ordenável, duplicação 269, cliente API,
BFF de detalhe/versão/rascunho, serviço/DTOs/domínio de planos, specs de serviço,
spec BFF e regressão visual 269. ADR-002/004/006, regras de dados e código externo
e matriz de confiabilidade foram confrontados com esses caminhos.

## Decisões de produto confirmadas

Confirmadas pelo proprietário em2026-10-14 nas três respostas da sessão.
Essas decisões fecham o escopo. Em seguida, o proprietário autorizou a
implementação; o handoff está em execução nesta branch.

| ID | Regra confirmada | Resposta do proprietário |
|---|---|---|
| D01 | Mesmo paciente e outros pacientes autorizados, reconsultando origem a cada colagem. | Ambos, com verificação de acesso. |
| D02 | Colar como nova refeição ou acrescentar itens à existente, preservando seu conteúdo. | Acrescentar itens ou criar nova refeição. |
| D03 | Entre planos, usar versão salva: publicada por padrão, rascunho salvo por seleção explícita. Duplicação local inclui alterações não salvas. | Sim, salvar antes de copiar entre planos. |

O fluxo abaixo corresponde às decisões confirmadas. Não reabrir essas escolhas
por preferência durante a implementação.

## Fluxo definido pelas decisões D01–D03

1. Abrir o rascunho de destino; todas as ações PA02 acontecem nesse editor.
2. **Duplicar refeição:** copiar os valores atuais, inclusive não salvos,
   inserir logo após a origem, gerar chaves novas para a árvore inteira e
   marcar dirty. Manter o nome sem impor unicidade ou sufixo que estoure 180 chars.
3. **Copiar refeição salva:** registrar referência efêmera de uma refeição
   salva. Se a origem atual estiver dirty ou ainda sem ID persistido, orientar
   salvar primeiro para cópia entre planos; a duplicação local continua disponível.
   Na linha do editor, o comando indica explicitamente “do rascunho salvo” e
   referencia essa versão, não uma publicada diferente com nome semelhante.
4. **Copiar de outro plano:** escolher paciente autorizado, plano, publicada
   ou rascunho salvo, e refeição. No mesmo paciente não exigir busca de pacientes;
   pacientes externos usam busca existente e suas permissões. Incluir paginação
   de planos; não esconder históricos além dos primeiros 25/100 resultados.
5. **Colar em...:** nova refeição no final ou itens no final de uma refeição
   atual. No segundo caso, conservar nome, horário, orientações e itens do destino.
   A leitura da origem é refeita no momento de colar.
6. Conferir nomes, orientações, quantidades e alternativas liberadas; salvar
   explicitamente. Nenhum PUT remoto direto em plano que não esteja aberto como
   destino, nenhum autosave, revisão/publicação ou aviso ao paciente automáticos.

Para copiar de outro paciente, abrir primeiro o destino e selecionar a origem
dentro dele. Não manter conteúdo em clipboard do SO, localStorage, sessionStorage,
IndexedDB, URL, service worker, analytics ou singleton de módulo.

## Contrato técnico fechado para o implementador

### Estrutura, chaves e nutrientes

- Projetar explicitamente nome, horário, orientações, itens, porções/unidades,
  nutrientes por 100 g, referência ao alimento de catálogo e substituições.
- Preservar configurações de alternativas `liberadaParaPaciente`, `preferida`
  e `substituicoesVisiveisInicialmente` na cópia para rascunho; elas continuam
  sujeitas à conferência/publicação do destino. Não copiar consentimentos ou
  histórico de escolhas do paciente.
- Gerar nova `chaveCliente` para refeição, item e cada alternativa, inclusive
  em colagens repetidas. Clonar arrays e objetos de nutrientes, sem alias mutável.
- Nunca repassar IDs de refeição/item/alternativa da origem ao PUT; a referência
  `alimentoComposicaoId` é intencional e pode ser preservada.
- Não copiar avaliação, cálculo energético, fórmula, metas, objetivos/observações
  do plano, autor, revisão, hash, estado de publicação ou total derivado.
- Campos de nutrientes opcionais ausentes continuam ausentes. Não fabricar
  zeros para completar um snapshot legado inválido; impedir a cópia com erro
  recuperável se os essenciais não existirem.
- A UI preserva o snapshot recebido para prévia. No save, `resolverItem`
  consulta a composição atual do catálogo; alimentos manuais usam seus nutrientes.
  Aviso: “Revise a cópia e salve para recalcular com o catálogo disponível”.
  Fonte inativa/indisponível falha pelo contrato atual; não transformar em item
  manual silenciosamente para contornar direitos.

### Buffer e controle de respostas tardias

- Buffer local de referências, não da entidade de plano:
  `{ pacienteOrigemId, planoOrigemId, numeroVersao, refeicaoId, atualizadoEm }`.
  IDs são protegidos e efêmeros; nunca registrar em telemetria.
- Usar `obterVersaoPlanoAlimentar(..., signal)` por versão exata na colagem.
  Aceitar apenas publicada ou rascunho salvo; rejeitar descartada.
- Rascunho salvo pode mudar: se `atualizadoEm` divergir ou a refeição desaparecer,
  pedir nova cópia. Não escolher outra refeição por nome/posição.
- Capturar paciente, plano, ID do rascunho, geração local da operação e chave
  de destino antes do GET; confirmar todos antes de aplicar. Cancelar/incrementar
  geração ao fechar, desmontar, trocar origem/plano/paciente e iniciar nova leitura.
- Trocar paciente/identidade, perder permissões ou desmontar limpa o buffer.
  Trocar plano do mesmo paciente pode conservar só a referência; invalidar
  toda operação em andamento. Não confiar apenas no AbortController.
- Guardar apenas a refeição necessária após a leitura; descartar restante da
  versão. Falha 401/403/404, origem arquivada ou acesso revogado não muda o
  rascunho; exibir mensagem acessível e permitir selecionar novamente.
- Travar os comandos durante leitura/save, sem repetir colagem por callback
  atrasado ou duplo clique. Colagens posteriores por novo gesto são permitidas.
- Revalidar capacidade/estado do destino antes de aplicar e usar `atualizar`
  para dirty, avisos e proteção FND02. Não publicar versões imutáveis.

### Autoridade e limite da operação

- Risco de implementação: **R4**, pela cópia de conteúdo clínico entre contextos.
  O documento em si é planejamento; não houve acesso a dados reais.
- Reusar APIs existentes. Backend exige papel/permissão, tenant da sessão,
  paciente não arquivado e carteira atual. Professional precisa estar no escopo
  da origem e do destino; preservar o contrato SuperAdmin existente.
- BFF usa `executarProxyPlanoAlimentar`, cookies HttpOnly e no-store.
- GET de origem autoriza a leitura no momento da cópia para o rascunho;
  PUT de destino revalida e trava paciente/plano/rascunho na persistência.
  **São duas operações independentes**. O fluxo não promete prova atômica de
  proveniência/origem no save posterior, CAS entre abas ou idempotência remota
  nova; esses contratos não existem na PA02. Não afirmar garantias adicionais.
- Depois de inserida no rascunho autorizado, a cópia é conteúdo em edição do
  destino, revisado pelo profissional. Revogação antes de novo GET impede nova
  colagem; proteção de dado já entregue segue descarte local/saída.
- Nenhuma rota/tabela/role, migration, cálculo clínico ou política de portal nova
  é necessária para esse desenho. Se evidência nova exigir alteração autoritativa,
  voltar a Sol médio para fechar contrato/testes antes de ampliar runtime.

### Limites reais e divergência documental

DTO + domínio permitem **50 refeições, 100 itens/refeição, 20 substituições/item**.
O catálogo/roadmap gerais citam 50 substitutos como baseline, divergente do código.
PA02 respeita 20 e registra a divergência; não ampliar limites por interpretação.
Testar 49→50 permitido, 50→51 negado; 99→100 itens permitido, 100→101 negado.
Operação que exceda limite não aplica árvore parcial nem trunca silenciosamente.

### Organização sugerida de arquivos

- `lib/copia-refeicoes-plano.ts`: projeção/cópia profunda, chaves e limites puros,
  com tipos mínimos; sem React, rede, storage ou imports de componente.
- `components/pacientes/copiar-refeicao-de-plano.tsx`: seleção paginada de
  origem/versão/refeição, com cancelamento e status acessível.
- `plano-alimentar-profissional.tsx`: comandos e integração ao estado existente;
  não fazer refactor abrangente do editor. Extrair só conversões necessárias,
  preservando aplicações de modelos/receitas e duplicação 269.
- Specs puras em `scripts/copia-refeicoes-plano.spec.ts`; runner pequeno conforme
  `test-nutricao-plano.mjs`, com cleanup, script npm e integração no check web.
- Playwright dedicado `tests/visual/pa02-copia-refeicoes.spec.mjs`, fixtures
  sintéticas no formato API vigente. Reutilizar padrões 269/console-regression;
  o fixture antigo269 tem composição sem `nutrientesPor100g`, não replicar essa
  forma legada como contrato válido de uma fixture nova.

## Verificações e entrega

TDD: primeiro unitário RED para alias/IDs/limites e interação RED para ação
ausente; implementar mínimo, repetir GREEN após correções. Não chamar testes
puramente estáticos de prova de autorização ou PostgreSQL.

Comandos existentes a executar durante implementação:

- `pnpm --dir octaclin-web test:planos-alimentares:bff`
- `pnpm --dir octaclin-web test:proteger-alteracoes-nao-salvas`
- `pnpm --dir octaclin-web exec playwright test tests/visual/pa02-copia-refeicoes.spec.mjs tests/visual/fase-269-duplicar-plano.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list`
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --grep "reordena refeições pela alça|edita o modelo em cópia isolada" --project=desktop-chromium --project=mobile-chromium --reporter=list`
- `pnpm --dir octaclin-backend test -- --runInBand src/modulos/planos-alimentares/aplicacao/servico-planos-alimentares.spec.ts src/modulos/planos-alimentares/apresentacao/controlador-planos-alimentares.spec.ts`
- `pnpm --dir octaclin-web typecheck`, `lint`, `build`; axe no painel/modal
  PA02 em desktop/mobile; diff/secrets; checks da PR no HEAD corrigido.

Executar ambos projetos numa única chamada Playwright (workers=1), não dois
processos que disputem porta3000/.next. Usar Node22 e pnpm11.25 conforme manifests.
Não baixar nova dependência de produto para executar a PA02.

PostgreSQL/RLS: CI aplicável deve continuar verde. Nenhuma prova de banco foi
executada nesta análise. O spec genérico de isolamento existente não é prova
nova de todas as operações PA02; não declarar cobertura específica sem verificar
o que de fato foi exercitado. Nova prova mutável só em banco descartável.
Revisão de segurança R4 quando viável, com autoria/independência declaradas.
Rollback: reverter UI/helpers da PA02; versões salvas/publicadas permanecem
no schema existente. Não fazer rollback destrutivo de histórico.

## Estado atual da implementação

- T01–T03 implementadas: duplicação local profunda, origem salva paginada,
  revalidação na colagem, respostas tardias descartadas e aplicação não destrutiva.
- A revisão cruzada por `/root/review_pa02_r4`, sem autoria nas mudanças,
  encontrou dois P2: falso sucesso em aplicação recusada e corrida colar/salvar.
  Ambos foram corrigidos com RED/GREEN. Callback propaga erros; a trava síncrona
  de colagem bloqueia persistência e usa liberação tokenizada idempotente.
- Navegação SPA entre pacientes, destino removido, limite de 50 e submissão
  programática com formulário válido têm testes sintéticos específicos.
- A alça DnD volta a ser exercitada por teclado, além das setas. O teste espera
  anúncio do destino e conclusão do save antes de reload. Não há prova nova do
  gesto de ponteiro.
- Sem mudanças de backend, banco, migrations, contratos públicos ou dependências.
- Sol médio fez o planejamento; a implementação inicial teve handoff para Luna
  alto. A revisão cruzada e as correções desta retomada estão registradas com
  autoria efetiva, sem confundir troca de modelo com revisão humana.
- Relatório e evidências:
  [REVISAO_R4_PA02_PR415_2026-10-14.md](../docs/governance/REVISAO_R4_PA02_PR415_2026-10-14.md).
  Checklist: [todo-pos-320-pa02.md](todo-pos-320-pa02.md).

## PR e gates

- Uma PR #415 Draft: https://github.com/octanutri-clin/octaclin/pull/415.
- PASS: revisão cruzada das correções de runtime, com digest e limitações no
  relatório; verificações locais ali registradas.
- PASS histórico conferido nesta retomada: todos os workflows do HEAD
  `f94ea94`, inclusive Backend, Web, Governança, Demo local smoke e PR Gate.
  O CI também executou migrations e RLS em bancos descartáveis.
- PENDENTE: checks do HEAD que contém as correções. A aprovação do commit
  anterior não é aprovação desse HEAD; o estado atual é consultado na PR.
- SKIPPED local: nova prova PostgreSQL/RLS específica PA02. GET e PUT seguem
  autorizados separadamente, com filtros e locks existentes; não afirmar nova
  transação única ou proveniência persistida.
- SKIPPED: scan automatizado da skill de segurança (preflight/auxiliares não
  disponíveis); revisão cruzada de outro agente foi realizada e documentada.
- Sem merge, deploy, migration externa ou ativação nesta execução.
