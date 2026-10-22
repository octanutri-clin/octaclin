# FOOD03 — favoritos de substituições por profissional

**Estado:** implementação em curso na PR Draft #438; não mergeada nem implantada.
**Base auditada:** `main` em `a853685e8becc2d38248f0608f749c6643a692c2` (PR #437).
**Escopo:** permitir ao profissional favoritar/desfavoritar alimentos elegíveis
na seleção de substituições e ordenar favoritos antes dos demais resultados.
O favorito é uma preferência de seleção privada do profissional; não altera
plano, cálculo, versão publicada, preferências de apresentação ou escolhas do
paciente.

## Decisões de produto já registradas no roadmap

- Favorito pertence ao profissional e é isolado por profissional.
- Usar identidade estável do alimento/substituto canônico quando disponível.
- Resultados favoritos aparecem antes dos demais; manter ordenação estável
  dentro de cada grupo.
- Favoritar/desfavoritar não altera planos publicados.

## Leitura do código atual e contrato de domínio

O editor já persiste substituições em `PlanoAlimentarSubstituicaoOrm`, com
descrição/composição snapshot, liberação ao paciente e campo `preferida`.
`preferida` faz parte do snapshot editável/publicado e da projeção do plano;
ela ordena/exibe uma alternativa ao paciente. FOOD03 não deve reutilizar esse
campo como favorito da biblioteca, nem atualizar substituições existentes ao
favoritar um alimento.

FOOD02 adicionou alimentos personalizados persistentes com autoria, revisão e
projeção autoritativa. A preferência deve referenciar a identidade durável do
alimento de catálogo ou alimento personalizado, e não texto livre nem o snapshot
de uma ocorrência em um plano. Substituições legadas exclusivamente textuais
continuam funcionando, mas não são favorizadas até terem identidade estável.
Uma preferência para alimento personalizado só pode ser mostrada enquanto o
registro está ativo e autorizado ao profissional; desativação não reativa nem
recria o alimento. Favoritar não publica nem libera uma alternativa ao paciente.

O repositório mantém contratos multi-tenant, role PostgreSQL de aplicação e
RLS/FORCE RLS. Se a inspeção final confirmar que não existe armazenamento
adequado para esta preferência, planejar uma tabela aditiva com chave de tenant,
profissional e identidade do alimento, unicidade por escopo, foreign keys quando
compatíveis e política RLS própria. Não alterar migrations integradas; preparar
migration nova e rollback conservador. Nenhum dado clínico do paciente é
necessário para favoritos.

## Fluxo proposto

1. A busca de substituições consulta favoritos autorizados do profissional atual.
2. O backend valida tenant, profissional autenticado e estado/visibilidade atual
   do alimento ao listar, favoritar ou desfavoritar. Não confiar no ID enviado
   pelo cliente sem resolver a identidade no escopo autorizado.
3. A resposta identifica os favoritos em cada resultado e ordena primeiro os
   favoritos elegíveis. Desempate preserva a ordenação já usada pela busca.
4. A ação é idempotente: repetir favoritar mantém um registro; desfavoritar um
   item ausente termina sem erro de estado. A operação não altera plano,
   snapshots, macros, escolha atual, `preferida` ou auditoria clínica.
5. A UI oferece controle acessível por teclado, com estado anunciado, sem exigir
   abertura/edição de um plano e sem aplicar o alimento automaticamente.
6. Mudança de tenant/profissional, paciente ou escopo invalida os resultados
   locais; não persistir favoritos em cache compartilhado nem expor identificadores
   entre tenants.

**Visibilidade inicial recomendada:** favoritos em todos os fluxos profissionais
que selecionam substitutos, mas nunca no portal, impressão/PDF ou resumo entregue
ao paciente. Estado de favorito não é informação da prescrição.

## Referências, somente para FOOD03

| Referência | Uso permitido/relevância | Decisão |
| --- | --- | --- |
| `R047` Downshift (`downshift-js/downshift`, MIT), já catalogado e avaliado em FOOD02 | Padrões de combobox, teclado e anúncio de seleção; a interface existente pode já cobrir o necessário | Reutilizar a implementação acessível do OctaClin; não adicionar dependência sem lacuna provada |
| `R017` OpenNutriTracker (GPL-3.0), já catalogado como inspiração | Contexto de produto para favoritos | Não copiar código ou estrutura ao runtime; nenhuma dependência ou necessidade de nova consulta externa |

Não há motivo demonstrado para clonar outro repositório nesta fase. A referência
MIT é orientação, não exigência de integração; a GPL permanece fora do runtime.

## Segurança, privacidade e compatibilidade

- Todas as leituras/escritas escopadas pelo tenant do contexto autenticado e pelo
  ID do profissional derivado no servidor; nunca aceitar `tenantId` ou
  `professionalId` do body como autoridade.
- Aplicar permissões existentes de profissional, verificar a clínica e a
  propriedade/acesso ao alimento. Cobrir acesso cruzado por outro profissional,
  tenant, role administrativa, vínculo removido e alimento desativado.
- Usar FORCE RLS e role não-owner/NOBYPASSRLS nos testes PostgreSQL. Não usar
  owner para declarar isolamento validado.
- Favoritos não incluem paciente/PHI; logs e auditoria não devem incluir texto
  clínico ou composição nutricional. Projetar somente os campos necessários.
- Não alterar snapshots, planos publicados, substituições aplicadas, escolhas
  append-only, totais ou apresentação portal/print. Compatibilidade legada deve
  ser testada com itens canônicos, personalizados e texto livre.
- Operação de remoção limpa somente a preferência daquele profissional. Excluir
  ou desativar um alimento não deve apagar dados de plano nem provocar
  reatribuição de favorito a outro alimento.

## Tarefas e ordem de execução

| ID | Atividade | Dependências | Critério objetivo de aceite |
| --- | --- | --- | --- |
| T00 | Conferir base/árvore, contratos food/substituições, migrations, RLS, busca do editor e acessibilidade atual | Base atualizada | **Concluída:** base #437; confirmado não reutilizar `preferida`; migração aditiva 1077 |
| T01 | Escrever testes RED do domínio e contrato de identidade/sort | T00 | **Concluída:** RED/GREEN de ordenação estável e origem discriminada; BFF e UI cobertos |
| T02 | Fechar armazenamento idempotente por profissional e resolver de identidade | T01 | **Concluída:** unicidade tenant+profissional+alimento; resolução no servidor; catálogo e FOOD02 |
| T03 | Implementar persistência e migration aditiva, se realmente necessária | T02 | **Concluída:** migration 1077 aditiva, FK, XOR, unicidade `NULLS NOT DISTINCT`, ENABLE/FORCE RLS; migrations antigas intactas |
| T04 | Serviços/endpoints de lista, favoritar e desfavoritar | T03 | **Concluída:** guardas de papel/permissão, tenant e vínculo profissional; validação do estado atual; mutações idempotentes |
| T05 | PostgreSQL descartável: RLS, tenant, profissional e concorrência | T04 | **PASS local:** PostgreSQL 15 descartável, role `NOBYPASSRLS`, FORCE RLS, tenant adulterado negado e inserts concorrentes convergem; escopo profissional verificado no serviço. O suite RLS geral falhou antes de executar por falta da imagem `timescale/timescaledb-ha:pg15` |
| T06 | BFF e UI de busca/seletor de substituição | T04–T05 | **Implementado; BFF e Playwright desktop/mobile + axe passaram.** Catálogo e custom, `aria-pressed`, ordenação local após favoritar, sem autoaplicar |
| T07 | Regressões de planos, publicação, macros, escolhas e portal/print | T06 | **Parcial:** serviços de plano regressivos e fluxo Playwright confirmam que favorito não grava nem seleciona; gates adicionais da PR pendentes |
| T08 | Revisão R4, documentação, gates e PR única | T01–T07 | **Pendente:** gates do HEAD corrigido e revisão; PR segue Draft; sem merge/deploy |

## Plano de testes da implementação

- Unitários: criação/remover/repetir; escopo por profissional; ordenação estável;
  canônico vs personalizado vs texto livre; alimento inativo; payload inválido;
  concorrência lógica; idempotência.
- Serviço/API: usuário atual controla somente seus favoritos; nenhum acesso por
  ID forjado a profissional, tenant ou alimento; desativar/reativar não muda
  snapshots nem cria preferência nova automaticamente.
- PostgreSQL real descartável: FORCE RLS e role da aplicação; isolamento entre
  dois tenants e profissionais; constraints, concorrência favoritar/desfavoritar
  e comportamento durante desativação.
- Web/BFF: favoritos primeiro, desempate estável, mutação incerta/retry, paciente
  ou profissional trocado, erros acessíveis, viewport desktop/mobile e teclado.
- Regressões: edição/autosave/abas PA07, FOOD01/02, publicação, portal, impressão,
  cálculo combinado e históricos de escolhas. Nenhum teste deve recalcular plano
  publicado para representar favoritos atuais.
- Gates aplicáveis do PR: Backend NestJS, Web Next.js, PostgreSQL/RLS, Demo local
  smoke, PR Gate, scanners e segurança; revisão independente focada na diff.

### Evidência local registrada

- RED inicial: o teste de domínio falhou porque o módulo não existia; após a
  implementação, ordenação estável e origem discriminada passaram.
- Backend: typecheck e 127 testes focados passaram, incluindo domínio, serviço,
  controller, migration, FOOD02 e busca de catálogo.
- A primeira execução do Backend NestJS no CI encontrou uma regressão na busca
  FOOD02 de alimentos personalizados: o TypeORM não resolveu o critério `CASE`
  como alias durante paginação com join. Corrigido selecionando a expressão
  calculada com alias explícito e ordenando por esse alias nas buscas de
  alimentos personalizados e canônicos.
- Após a correção: suíte completa local do backend — 354 suítes e 3.183 testes
  passaram; typecheck e build de produção — PASS. A CI ainda precisa repetir a
  integração do serviço com PostgreSQL/RLS.
- PostgreSQL descartável: `pnpm test:food03:postgres` passou em PostgreSQL 15
  com duas conexões concorrentes e role sem `BYPASSRLS`.
- BFF: `pnpm test:planos-alimentares:bff` passou (54 testes).
- Playwright desktop e mobile FOOD03 passaram com axe no seletor.
- O primeiro Demo local smoke da CI passou em 930/940 testes visuais, mas
  encontrou 8 falhas em quatro testes legados FOOD01 (desktop/mobile): os
  seletores acessíveis `getByRole('button', { name: /Aveia sintética/ })`
  passaram a corresponder tanto à opção de alimento quanto ao botão independente
  de favorito. A regressão era somente no seletor dos testes, sem falha de
  comportamento do produto.
- RED reproduzido pela execução completa da CI. O seletor foi restringido ao
  nome acessível iniciado por `Aveia sintética`, mantendo o botão de favorito
  fora da correspondência. GREEN: os quatro cenários FOOD01 afetados passaram em
  Chromium desktop e mobile localmente (8/8, incluindo aplicação de medida,
  autosave, paginação/conflito e resposta tardia). O Demo local smoke completo
  precisa ser repetido no novo HEAD.
- `pnpm test:rls:testcontainers` não iniciou o suite geral porque a imagem
  configurada `timescale/timescaledb-ha:pg15` não estava disponível localmente;
  a prova isolada de FOOD03 usou Postgres 15 descartável.

## Critérios de conclusão

1. Preferência por profissional implementada sem sobrepor a `preferida` do
   snapshot do plano.
2. Autorização e RLS demonstradas com banco PostgreSQL descartável e role
   adequada, incluindo tentativas cruzadas negativas.
3. Compatibilidade FOOD01/02, planos publicados, escolhas do paciente, portal,
   impressão e cálculo preservada.
4. Acessibilidade e comportamento em desktop/mobile verificados.
5. Uma PR revisável com status dos gates real; aplicação de migration/deploy
   permanece operação posterior, separada e não presumida pelo merge.

## Fora de escopo

FOOD04 grupos reutilizáveis, FOOD05 equivalência nutricional, recomendação
automática, favorito compartilhado pela clínica, transferência entre pacientes,
ranking, envio ao portal, alteração retroativa de planos, nova base alimentar,
TBCA, novo serviço externo ou dependência de UI. Não iniciar FOOD04 junto desta
PR.
