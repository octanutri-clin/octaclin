# PA06 — autosave de 60 segundos e rascunho do plano alimentar

Planejamento de 2026-10-15. Autorização atual: análise de gaps e documentação;
implementação ainda não iniciada. Uma PR futura reúne plano e implementação.
Checklist: [T00–T10](todo-pos-320-pa06.md).

## Base, continuidade e limites

- Base `eae74b1e`, merge da [PR #419](https://github.com/octanutri-clin/octaclin/pull/419)
  em 2026-10-15. Árvore idêntica ao HEAD aprovado `9e12271b`.
- CI `38656591697` e checks aplicáveis PASS, inclusive Backend, Web,
  PostgreSQL/RLS, Demo e PR Gate. Dependency Review, Semgrep, CodeQL e Trivy
  SUCCESS. Provenance do SBOM SKIPPED; não convertido em PASS.
- Nova worktree `/workspace/octaclin/.worktrees/pos320-pa06-planejamento`, branch
  `docs/pos320-pa06-planejamento`; checkout principal antigo e sua alteração
  preexistente em `octaclin-web/next-env.d.ts` preservados.
- PA05 integrada não prova aplicação externa da migration1072 nem deploy.
  Estado externo NÃO consultado nesta rodada. Antes de rollout, identificar
  ambientes/roles e conferir migrations pelo procedimento autorizado.
- FND02 e PA01–PA05 são baseline. PA07 (coordenação entre abas) permanece
  separada: PA06 precisa detectar conflito entre abas/dispositivos pelo servidor,
  mas não introduz BroadcastChannel, colaboração ou trava distribuída.
- Escopo confirmado: editor profissional, autosave habilitado por padrão, ciclo
  de 60 segundos e persistência de alimentos com porções válidas sem exigir formulário
  clínico completo. Revisão/publicação continuam explícitas. A extensão on/off
  de visibilidade/exclusão de macros aguarda o alvo D06, abaixo. Sem IA, anexos, recuperação
  offline ou ingestão TBCA.

## Decisões de produto — respostas e refinamentos de 2026-10-15

As respostas do usuário substituem as recomendações iniciais conflitantes.

| ID | Decisão ou proposta | Estado |
| --- | --- | --- |
| D01 | Autosave ligado por padrão, a cada 60 segundos em ciclo enquanto o editor do plano estiver aberto | CONFIRMADA; substitui opt-in/default false e debounce de 3 segundos |
| D02 | Todo alimento inserido com porção válida deve ser salvo no ciclo, mesmo se outros campos do plano estiverem incompletos | CONFIRMADA; contrato de rascunho parcial necessário, não bloquear pelo formulário clínico inteiro |
| D03 | Saída antes do primeiro save oferece salvar e sair, continuar editando ou descartar com confirmação | CONFIRMADA; aplicar também a novas alterações ainda não confirmadas após um save anterior, evitando perda posterior |
| D04 | On/off simples: OFF oculta do paciente e retira dos macros do planejamento, sem arquivar/excluir; reativar visualização não exige edição ou nova revisão do plano | CONFIRMADA; o elemento controlado aguarda D06. Não impor a confirmação extra antes proposta para mero liga/desliga |
| D05 | Preservar snapshot de edição inteiro, inclusive linhas incompletas marcadas pendentes, sem usá-las em cálculos dependentes ou publicação | CONFIRMADA pelo usuário “atende por enquanto sim” |
| D06 | Qual elemento recebe o on/off: cada refeição, plano inteiro ou ambos? | PENDENTE; pergunta enviada porque exclusão dos macros e ocultação do plano têm efeitos distintos |

Não gravar só por abrir a tela nem criar plano por timer. O ciclo começa ao
abrir o editor autorizado com um rascunho; aos 60 segundos verifica alterações e salva
se houver conteúdo novo. A checagem continua a cada 60 segundos e NÃO reinicia a contagem
a cada tecla. Sem alteração, nenhum PUT; salvar manualmente não cria loop de
gravações repetidas. Autosave nunca liga a visibilidade ao paciente.

Desabilitar agendamento (se o controle opcional for mantido) cancela pendências
ainda não enviadas, sem desligar o plano para o paciente. A transação iniciada
pode terminar; abortar fetch não comprova rollback. Não foi aprovada preferência
persistente por profissional: não criar essa API/tabela por inferência. O padrão
ligado é regra inicial do editor nesta proposta revisada.

## Gaps confrontados com código real

| Gap | Evidência atual | Consequência e trabalho |
| --- | --- | --- |
| G01 — revisão não cobre todos os writers | `ServicoPlanosAlimentares.atualizarRascunho`: CAS e incremento de `apresentacaoRevisao` somente quando há `preferenciasApresentacao`; teste “PUT legado conserva preferências e revisão já salvas” confirma a compatibilidade | PA06 exige revisão geral monotônica de edição; não tratar contador visual como controle universal nem usar `atualizadoEm` arredondado |
| G02 — recarga apaga edição posterior | `salvar()` usa `executar()`, que termina em `carregar()`; `aplicarPlano()` reidrata formulário inteiro, limpa dirty, foco e refeições abertas | Separar confirmação da escrita da recarga; resposta do snapshot A não pode substituir edição B feita durante o request |
| G03 — gravação exige completude clínica | DTO/serviço exigem avaliação antropométrica, meta e aplicabilidade; itens ORM exigem composição e porção não nulas | Criar contrato de edição parcial cifrada, preservando rigor no cálculo/revisão/publicação; o snapshot editorial é fonte de edição, os clínicos são derivados validados, não um segundo plano |
| G04 — validação tem efeitos manuais | `validarFormulario()` mais `focarRefeicaoComErro()` em salvar; HTML required participa só do submit | Separar validade estrutural da edição de completude clínica; autosave não muda foco nem abre refeições. Falta de objetivo/meta não impede persistir alimentos válidos |
| G05 — não há coordenador de gravação | `operacao`, `alterado`, refs de cópia/preview e `sequenciaCarregamento` são separados | Coordenar manual/automático, cópia, revisão, publicação e saída com uma fila por contexto e teste de Promises fora de ordem |
| G06 — saída tem vários donos | `useProtecaoAlteracoesNaoSalvas`, callback booleano `aoAlterarRascunho` e modal no `prontuario-paciente.tsx` | Registrar capacidade de salvar/estado no pai, preservando pendências de evolução, tarefa, material e anexo; salvar plano não autoriza descartar outro editor |
| G07 — resultado de rede incerto | PUT retorna versão, cliente lança `ErroApiPlanoAlimentar`; cancelar fetch não desfaz commit | Sem retry cego, beacon ou background sync. Distinguir falha de validação, conflito, acesso revogado e envio sem confirmação |
| G08 — custo de cada escrita | `substituirFilhos()` recria estrutura e recalcula snapshots no save | Ciclo de 60 segundos com deduplicação; tick sem mudança não escreve. Não salvar de novo só porque cálculo/ID retornado mudou |
| G09 — on/off não equivale a arquivar | `arquivar()` descarta rascunho e marca plano; portal resolve versão publicada atual e verifica escolhas separadamente | Estado próprio autorizado e transacional conforme alvo D06; leitura/ações do portal e totais devem revalidá-lo sem destruir publicação/histórico |

## Contrato técnico proposto

### Persistência e concorrência — checkpoint obrigatório com Sol

1. Reutilizar domínio, transação, cifragem e locks do rascunho. O PUT clínico
   atual não aceita edição incompleta: adicionar contrato profissional de edição
   parcial na mesma versão, com DTO próprio (rota candidata `PUT .../rascunho/edicao`)
   delegando ao mesmo controle de concorrência; não afrouxar o DTO clínico nem
   suas tabelas. Retornar edição/revisão aceita e estado de cálculo/completude.
   Cálculo continua exclusivamente autoritativo no backend.
2. Introduzir revisão geral explícita do rascunho, separada da revisão de
   apresentação da PA05, e identidade esperada da geração. Incrementar em toda
   escrita de conteúdo, inclusive caminhos legados; incluir revisão/publicação
   nas transições que invalidam uma pré-condição de edição.
3. Comparar revisão/geração sob os locks existentes ANTES de apagar filhos ou
   modificar snapshots. Conflito retorna 409 sem escrita parcial. Verificar
   inteiro seguro/overflow e não confiar em clock ou timestamp do cliente.
4. Não basta adicionar um campo opcional de CAS: documentar e testar a transição
   dos clientes PA05/legados. Preferência técnica: modo protegido monotônico por
   rascunho; após primeira edição pelo contrato PA06, uma escrita sem a
   pré-condição geral é recusada com conflito orientando atualização da tela.
   Antes da adesão, a compatibilidade PA05 continua. Todos os writers legados
   incrementam a revisão geral, invalidando baselines PA06 anteriores.
   A proteção não pode desaparecer ao desligar autosave ou por replay.
5. Fechar nomes de DTO/colunas e mecanismo mínimo dessa adesão no T01/T02 com
   RED/GREEN. Não redefinir `apresentacaoRevisao`, que também identifica
   snapshots ilegíveis e heranças. Campos técnicos novos não entram no hash
   clínico, projeção paciente, logs ou auditoria genérica.
6. Migration nova aditiva; próximo número observado na base é1073, revalidar
   registro/branch antes de criar. Nunca editar1072. Preservar dados antigos e
   snapshots publicados; rollback por código sem apagar colunas/histórico e
   sem reabrir escritas desprotegidas em rascunhos já protegidos.

**Gate técnico:** sem prova do contrato legado↔PA06 e save↔revisão/publicação
em PostgreSQL real, não entregar o motor à implementação de UI nem habilitar
autosave. A política acima é proposta de engenharia, não alteração já aplicada.

### Edição parcial — novo fundamento obrigatório

Proposta técnica com preservação integral D05 aprovada: documento editorial com
schemaVersao, cifrado na própria versão do plano, sem tabela paralela ou cache
persistente no navegador. Reutilizar o envelope de autorização do plano. Campos
explicitamente permitidos, limites de tamanho/quantidade, tipos e validação
estrutural continuam obrigatórios mesmo para edição incompleta. Rejeitar IDs
de catálogo/avaliação fora do escopo, campos extras e valores não representáveis.

Não converter campo vazio em 0 nem perder a entrada ao transformar NaN em null
no JSON. O modelo de edição deve representar números em preenchimento sem
tratá-los como medidas válidas. Reabrir o plano reidrata o que foi confirmado
pelo servidor, incluindo alimentos válidos quando meta/objetivo estão pendentes.
Linhas incompletas seguem a resposta D05, sem exclusão silenciosa de linha já
salva nem sua apresentação como alimento clinicamente válido.

Quando todo o documento satisfizer o contrato clínico, materializar itens e
snapshots validados de forma transacional; se incompleto, guardar a edição sem
publicar ou recalcular usando zeros/substitutos inventados. Vincular cálculo e
completude à revisão editorial: resultados anteriores ficam explicitamente
defasados e não podem liberar revisar/publicar. O resumo PA04 deve informar
rascunho pendente/resultado indisponível, sem usar cálculo antigo como atual.
Campos editoriais crus nunca chegam à projeção paciente/PDF.

Para legado sem documento editorial, derivar estado inicial da versão salva em
memória; não regravar histórico ao ler. Revisão/publicação conferem no backend
que o conteúdo materializado corresponde exatamente à edição mais recente e
que não há pendências. Salvar e sair pode guardar edição incompleta; isso não
equivale a “plano pronto”.

### Botão on/off — comportamento confirmado, alvo pendente D06

Não mapear OFF para `arquivar()`, `descartadaEm`, exclusão, nem remover datas,
hashes ou snapshots de publicação. A versão publicada anterior continua imutável.
Manter conceitos distintos: salvo em rascunho, revisado, publicado e visível.
Rotular o controle pela consequência (“Visível ao paciente”), evitando que o
mesmo switch desative autosave e visibilidade.

Verificar estado no backend em toda leitura
e escolha do portal, inclusive requisições diretas com IDs conhecidos; não basta
esconder a seção no frontend. OFF esconde sem republicar conteúdo antigo ou
selecionar automaticamente outro plano anterior. Reativar visualização é ação
direta: não exigir nova edição, revisão clínica ou confirmação extra somente
para ligar. Isso não publica automaticamente uma edição incompleta nem altera
o fluxo da primeira publicação por inferência. Revalidar carteira, paciente e
concorrência com nova publicação/retirada.
Definir seleção do plano entregue entre múltiplos planos no checkpoint de
contrato, sem apagar histórico e sem criar fallback oculto.

Retirada regula novas leituras/ações; não promete apagar página já carregada ou
PDF anteriormente obtido. Evitar polling clínico novo por inferência. Qualquer
estado novo de visibilidade recebe migration aditiva e testes próprios somente
depois de D06. Arquivo/exclusão continuam ações separadas.

A exclusão dos macros foi expressamente solicitada. Após D06, fechar qual
agregação muda (subtotal/totais da versão ou visão de múltiplos planos), incluindo
itens/substituições e PA04/PA05/portal/print. Não implementar “fora dos macros”
somente escondendo um número nem recalcular histórico publicado retroativamente.
O backend continua autoridade sobre inclusão e totais da projeção vigente.

### Coordenador de edição em memória

- Contexto: sessão/tenant atual + paciente + plano + ID do rascunho + geração
  local de montagem. Não serializar contexto clínico em URL, telemetria ou disco.
- Ciclo fixo de **60 segundos** por abertura/contexto do plano; não é debounce.
  Não despachar durante composição IME, cópia, outra escrita ou transição de
  revisão/publicação. Se um tick precisar esperar, consolidar o estado mais
  recente em uma única pendência; não disparar uma rajada de ciclos atrasados.
  Revalidar contexto/permissão e validade estrutural da edição, sem exigir meta
  ou objetivo completos para guardar alimentos válidos. Navegadores podem
  atrasar timers em segundo plano/suspensão: informar último ACK real, sem
  prometer relógio exato nem introduzir processamento no servidor por paciente.
- Uma escrita em voo. No máximo um estado pendente, substituído pelo mais
  recente; não enfileirar cada tecla. Salvar manualmente usa
  a mesma fila. Duplo clique/StrictMode não duplica envio.
- Capturar snapshot A e sequência de edição. Ao receber A, atualizar somente
  baseline/revisão e cálculos correspondentes; se houver edição B, preservar B,
  dirty, chaves locais, foco, cursor e refeições abertas. Preparar B com revisão
  confirmada de A. Sem B, reidratar de forma deliberada e manter a navegação.
- Comparar payload editorial normalizado, não referências de objetos ou campos
  derivados. Uma recarga ou resposta não agenda nova gravação por si só.
- Usar resposta do PUT, sem GET integral a cada sucesso. Atualizar o resumo do
  rascunho em memória ou invalidar sua leitura de forma protegida, sem duplicar
  o cálculo nutricional do backend ou misturar resumo publicado/rascunho.
- Estado “Salvo” somente quando último conteúdo local foi confirmado pelo
  servidor e não existe escrita pendente/incerta. Indicar que é rascunho, não
  revisão clínica nem publicação; a edição aceita invalida revisão anterior.
- Mudança de contexto/desmontagem/logout elimina timer e pendente, invalida
  respostas obsoletas e aborta transporte quando possível. Não usar cleanup
  para disparar PUT. Cancelar transporte não significa rollback do servidor.
- 400/422: motivo sanitizado, sem loop automático; aguardar correção do usuário.
  409: pausar autosave; preservar texto, sem trocar revisão e reenviar sozinho.
  Oferecer continuar editando localmente ou recarregar com confirmação de perda.
  401/403/404: pausar, manter proteção de saída, retirar ações de gravação; não
  manter dados após descarte explícito/troca real de contexto ou fim da sessão.
  Rede/5xx/timeout após envio: “Envio não confirmado”; bloquear novos PUTs até
  conferência explícita da versão salva. Não afirmar que nada foi gravado.
- Reconexão/foco da janela não reenvia escrita. Recarregar uma versão para
  conferência não substitui conteúdo local nem autoriza sobrescrever conflito.

### UI e saída

Estados acessíveis: alterado, salvando, rascunho salvo com pendências clínicas, salvo,
falha, conflito e envio não confirmado. `role=status`/aria-live polite sem spam;
erros acionáveis com foco deliberado só quando o usuário tenta salvar.
Controle por teclado, mobile e desktop; nenhuma nova dependência de cor.

Botão Salvar rascunho permanece disponível. Prévia/impressão/revisão/publicação
continuam bloqueadas com conteúdo pendente ou operação incompatível. Desligar
autosave preserva dirty e não faz flush escondido. Arquivar/criar nova versão/
criar plano exigem estabilização ou descarte explícito, sem reaproveitar timer.

“Salvar e sair” aguarda ACK do conteúdo mais recente, com
permanência em caso de edição adicional/erro; só navega se demais editores
estiverem sem pendências. Guardar intenção de navegação, nunca PHI em URL.
Fechar/atualizar navegador usa FND02/beforeunload; não prometer save on exit.
Não construir roteador global novo para esta entrega.

## Referências externas — somente R013 e R014

Consultadas por API GitHub em 2026-10-15, leitura de documentação/tipos/licenças;
nenhum script externo executado, nenhum código copiado para o runtime.
Catálogo/matriz/mapa inverso concordam sobre esses dois IDs.

| Referência fixada | Evidência e uso | Decisão desta rodada |
| --- | --- | --- |
| [TanStack/query](https://github.com/TanStack/query), release `release-2026-10-11-1936`, commit `b699b52d60e10220403673a407d95bcebeba3e81`; pacote react-query5.104.2, MIT, não arquivado | [Mutations](https://github.com/TanStack/query/blob/b699b52d60e10220403673a407d95bcebeba3e81/docs/framework/react/guides/mutations.md): promises podem concluir fora de ordem, scope serializa, callbacks dependem da montagem; [licença](https://github.com/TanStack/query/blob/b699b52d60e10220403673a407d95bcebeba3e81/LICENSE) | Orienta fila e descarte de resposta obsoleta. Scope sozinho não faz CAS nem consolida estados antigos. Não adotar persistência offline ou retries. Biblioteca não está instalada; não introduzir provider/cache só para este caso |
| [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form), v7.90.0, commit `8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4`, MIT, não arquivado | [Tipos form](https://github.com/react-hook-form/react-hook-form/blob/8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4/src/types/form.ts): dirtyFields, isDirty, reset/keepDirtyValues e shouldUnregister; [licença](https://github.com/react-hook-form/react-hook-form/blob/8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4/LICENSE) | Orienta baseline/dirty e preservação de campos recolhidos. Não migrar formulário atual nem assumir que keepDirtyValues resolve concorrência. Biblioteca não está instalada |

Os dois projetos permanecem ativos segundo metadados consultados. Licença MIT
não é auditoria de supply chain nem comprovação de adequação ao SaaS clínico.
Se adoção de dependência se tornar necessária, interromper somente essa mudança
para justificar custo, compatibilidade React, scans e política de licença.

## Segurança, operação e validação

Risco da implementação **R4**: persistência clínica, authz/carteira, RLS e
concorrência. Documentação desta rodada não altera runtime. Reutilizar BFF e
`ExecutorTenant`; private/no-store e projeções permitidas, sem cache persistente,
localStorage, sessionStorage, IndexedDB ou service worker para conteúdo clínico.

TDD: primeiro reproduzir perda A→B e baseline obsoleto após writer legado;
depois provar solução com timers/Promises controladas e PostgreSQL real, role
runtime não owner/sem BYPASSRLS. Cobrir tenant A/B, profissionais A/B, carteira,
transferência, arquivamento e acesso revogado. Dados exclusivamente sintéticos.
Fixtures de cada teste devem ser isoladas para não contaminar PA04/PA05.

Gates de implementação: unitários de fila/validação/DTO/serviço; migration e
inventário; banco real/RLS/concorrência; BFF positivo/negativo; Playwright
desktop/mobile, teclado/Axe, PA02–PA05 e FND02; lint/typecheck/build, secrets,
governança, revisão R4 cruzada e CI do HEAD. Comandos exatos no checklist.

## Modelos e próxima ação

- **GPT-6.1 Sol médio:** planejamento, revisão geral/compatibilidade legada,
  migration, serviço, autorização, banco real e contrato do coordenador.
- **GPT-6 Luna alto:** depois de checkpoint backend e motor testado, interface
  de estados/controles e integração visual com tarefas pequenas e DTOs fechados.
- **GPT-6.1 Sol médio:** integração, segurança, regressões e PR única final.

Evitar Luna sozinho na etapa de concorrência e transição de contratos. Pesquisa
restrita a R013/R014 e nenhuma biblioteca nova reduzem custo e retrabalho.
Avisar modelo alvo e pausar antes de toda troca manual.

Próxima ação: incorporar D06 e autorização de implementação.
D01–D05 estão registradas acima; T01–T10 ainda não iniciadas.
