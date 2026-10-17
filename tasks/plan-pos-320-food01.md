# FOOD01 — medidas caseiras personalizadas por alimento

Planejamento consolidado em 2026-10-17. Base `d36b12e7`, merge da PR #423
(PA07), confirmado no GitHub. Branch `feat/pos320-food01-planejamento`,
worktree dedicada. A alteração preexistente do usuário em
`octaclin-web/next-env.d.ts` no checkout principal foi preservada.
Checklist: [T00–T08](todo-pos-320-food01.md).

## Estado, autorização e escopo

RESIDUAL CONFIRMADO. Planejamento aprovado com D01–D03; implementação
autorizada em “Pode seguir” após a consolidação. Backend em execução com
Sol6.1 médio. Migration1075 nova ensaiada apenas em PostgreSQL descartável;
nenhuma migration externa, deploy, dependência nova ou PR nesta rodada.
Uma única PR futura FOOD01 reúne implementação, evidências e documentação.
Não criar uma PR separada só para este planejamento.

Escopo: biblioteca de medidas vinculadas a alimentos existentes do catálogo,
cadastro/edição/desativação e aplicação no item principal e nas substituições
do editor profissional. Não cadastrar alimentos reutilizáveis novos (FOOD02),
nem densidades, recomendações de porção, equivalências nutricionais (FOOD05),
IDR/UL, TBCA ou sincronização automática de itens antigos.
Itens manuais continuam aceitando quantidade/unidade/gramas; biblioteca para
um alimento manual sem identidade persistente depende de FOOD02.
Portal/PDF continuam recebendo quantidade, unidade e peso da versão autorizada,
sem endpoints de biblioteca ou identificadores privados novos.

## Decisões confirmadas pelo proprietário

| ID | Regra | Confirmação |
| --- | --- | --- |
| D01 | Medida pessoal ou da clínica; pessoal por padrão | Resposta explícita em 2026-10-17 |
| D02 | Peso em gramas explícito para cada medida, inclusive líquidos; nunca inferir 1 mL = 1 g | Resposta explícita em 2026-10-17 |
| D03 | Editar/desativar biblioteca preserva itens já inseridos, inclusive rascunhos; mudança só em novas inserções ou reaplicação explícita no rascunho | “Siga a sua recomendação nela também”, após reapresentação da terceira pergunta |

Não confundir autorização de desenvolvimento com autorização operacional de
migration externa, merge ou deploy.

## Gaps comprovados na base

| Gap | Evidência no código atual | Aceite necessário |
| --- | --- | --- |
| G01 — sem biblioteca | `infraestrutura/alimento-composicao.orm.ts` tem composição e fonte, sem medida tenant-aware | Persistência própria vinculada ao alimento existente; não alterar catálogo público |
| G02 — campos independentes | `SubstituicaoPlanoAlimentarDto` e editor recebem quantidade, unidade e porcaoGramas | Backend resolve conversão quando uma medida é aplicada; entrada manual legada continua válida |
| G03 — autoridade nutricional | `ServicoPlanosAlimentares.resolverItem` calcula nutrientes por porcaoGramas e fonte ativa | Reutilizar esse motor; não confiar em peso calculado ou snapshot de biblioteca enviado pelo cliente |
| G04 — versões distintas | Catálogo identifica alimento por UUID/fonte/versão/base; busca paginada tem desempate por ID | Medida vinculada ao UUID exato; não reunir por nome, nem migrar automaticamente TACO v1→v2 |
| G05 — canais de edição | `dominio/edicao-plano.ts`, autosave e cópia mantêm allowlists próprias | Transportar intenção de aplicação sem perder linha parcial; manter CAS e bloqueio PA07 |
| G06 — histórico e projeção | Itens/substituições têm quantidade/unidade/gramas e composição cifrada; portal usa projeção permitida | Biblioteca nunca reescreve filhos ou snapshots já existentes; prova de portal/PDF sem dados privados |
| G07 — autorização | Catálogo usa ExecutorTenant; papel Professional é associado por resolverProfissionalIdDoUsuario | Escopo pessoal e clínica explícitos, resolvidos pelo servidor; testes entre profissionais além de RLS tenant |
| G08 — infraestrutura | Última migration registrada nesta base é 1074 | Schema aditivo novo, numeração reconferida na implementação; 1072–1074 intocadas |

## Contratos técnicos propostos para implementação

### Biblioteca e autorização — risco R4

- Estender o módulo `planos-alimentares`, sem segundo domínio de catálogo.
  Separar serviço de biblioteca do serviço central já extenso; reusar helpers
  de autorização, ExecutorTenant e criptografia.
- Registro: UUID, tenant, alimentoComposicaoId, escopo pessoal/clínica,
  proprietário profissional, criador, nome, quantidade de referência,
  peso de referência em gramas, revisão monotônica e estado ativo/inativo.
  Texto livre pode conter informação indevida: cifrar nome; não registrar
  nome/valores em auditoria, logs ou analytics. Nenhum vínculo com paciente
  é necessário na biblioteca.
- Escopo imutável nesta entrega. Para compartilhar uma medida pessoal,
  criar cópia explícita da clínica, sem mudar o acesso retroativamente.
- Recomendação de autorização: profissional autenticado com vínculo ativo e
  permissão de gerenciamento cria; pessoal só ele consulta/edita/desativa;
  clínica pode ser usada pelos profissionais autorizados da mesma clínica e
  alterada/desativada pelo criador. Não acrescentar Client/SuperAdmin como
  escritores em nome de profissional. Preservar caminhos legados desses papéis.
- Tenant, proprietário e criador vêm da sessão/vínculo verificado, nunca do
  body. FKs compostas onde as entidades são tenant-aware, FORCE RLS e
  políticas fail-closed por tenant. A restrição por profissional fica também
  explícita em todas as consultas do serviço; RLS tenant não prova essa parte.
- PATCH/desativação exigem revisão esperada; conflito 409 sem overwrite.
  Criação idempotente com mecanismo existente ou chave limitada ao
  tenant/profissional/operação; reutilização com payload diferente é conflito.
  Não criar serviço genérico paralelo de idempotência.
- Desativar não remove registro nem referência histórica. Listagem paginada,
  ordenação estável, limites explícitos (proposta 25, máximo 100); sem N+1.
  Nomes repetidos não definem identidade nem promovem merge de registros.

### Conversão e aplicação

- Uma medida representa `quantidadeReferencia` unidades com `pesoReferenciaGramas`.
  Peso resultante = quantidade escolhida × peso de referência ÷ quantidade
  de referência. Exemplo sintético: 1 colher = 25 g; 2,5 colheres = 62,5 g.
  Não extrair números do nome da medida.
- Reutilizar aritmética/normalização decimal existente, sem nova dependência.
  Referência, quantidade e resultado positivos/finitos; preservar os limites
  dos DTOs existentes (0,001–10.000 e três casas) e a precisão nutricional.
  Resultado fora do contrato é rejeitado, nunca truncado/clampado silenciosamente.
  Definir e testar arredondamento único para três casas antes do motor de
  nutrientes; não arredondar o fator intermediário.
- Seleção nova envia ID/revisão da medida e quantidade; servidor verifica
  acesso atual, estado, alimento exato e fonte ativa, resolve nome/peso e gera
  snapshot. Divergência de revisão exige atualização explícita, sem aplicar
  silenciosamente a revisão nova. Peso/nome/snapshot do cliente não são prova.
- T02 deve fechar os DTOs exatos e o protocolo de materialização antes da UI:
  separar **aplicar biblioteca** de **preservar valores já materializados**.
  Save subsequente não pode depender da biblioteca ainda estar ativa/acessível.
  Reutilizar snapshot anterior confiável apenas a partir de identidade/contexto
  de item verificados no servidor, jamais de um payload arbitrário. Se o item
  mudar manualmente de unidade/peso/alimento, desvincular a intenção pendente;
  não manter uma alegação falsa de medida validada.
- Registro editorial parcial pode conter intenção ainda não materializável:
  autosave conserva a linha, mas não a declara calculável/revisável/publicável.
  Não deixar rascunho parcial contornar autorização de uso da biblioteca.
- Cópia/nova versão/modelo conservam os valores factuais já resolvidos, sem
  reconsultar/reaplicar a biblioteca ou transportar acesso pessoal ao destino.
  Metadados de proveniência, se necessários, ficam em snapshot cifrado existente,
  com schema versionado e projeção mínima; não aceitar snapshot cru do cliente.
- Fonte desativada mantém as regras atuais de uso do catálogo. D03 não libera
  reutilização de fonte suspensa nem altera gates de direitos.

### API, BFF e interface

- Rotas propostas sob `planos-alimentares/alimentos/:alimentoId/medidas-caseiras`:
  GET paginado, POST e PATCH por medida com revisão; desativação explícita.
  Detalhar nomes/status em T02, preservar 400/403/404/409/422 e erros sanitizados.
  DTOs permitem somente campos autorizados; não retornar ORM cru.
- BFF reutiliza sessão, permissões e proxy atuais; `private, no-store` também
  nos erros, limites de body e ausência de cache persistente.
- Seletor após escolher alimento; nome, equivalência em g, escopo e estado
  visíveis. Ações criar/editar/desativar, confirmação para desativação e foco
  restaurado. Manter caminho manual legível.
- Editar quantidade com medida ativa recalcula o peso; trocar alimento limpa
  seleção pendente e respostas antigas. Resposta tardia não aplica a outro item,
  paciente, alimento, versão, geração de aba ou formulário.
- Sucesso de salvar biblioteca não significa salvar plano. Aplicar medida é
  edição do rascunho, sujeita à posse PA07, CAS/autosave PA06 e proteção de saída.
  Nenhuma alteração de ON/OFF, seleção de cálculo combinado ou publicação automática.

## Referência externa examinada — somente R017

OpenNutriTracker, commit `8d2420f0305c96a4f798f3a111509827260f6df7`,
consultado em 2026-10-17 via GitHub. Licença GPL-3.0 confirmada nos metadados
e cabeçalho de LICENSE, blob `f288702d2fa16d3cdf0035b15a9fcbc552cd88e7`.
Não arquivado na consulta. Referência do catálogo/matriz: R017, sugestão14.

- [Entidade de porção](https://github.com/simonoppowa/OpenNutriTracker/blob/8d2420f0305c96a4f798f3a111509827260f6df7/lib/features/add_meal/domain/entity/meal_portion_entity.dart): separa rótulo/peso e exige peso utilizável.
- [Opções rápidas](https://github.com/simonoppowa/OpenNutriTracker/blob/8d2420f0305c96a4f798f3a111509827260f6df7/lib/features/meal_detail/util/quick_serving_option.dart)
  e testes correspondentes: multiplicadores e ausência explícita de opções
  quando faltam dados. Ideias de interação, sem copiar regras para líquidos.
- Divergência útil: a entidade consultada declara não persistir a lista de
  porções. Isso não atende nossa biblioteca compartilhada nem sua rastreabilidade.
  Portanto não reutilizar arquitetura, código, assets ou dependências GPL.
  Implementação independente na stack atual; nenhuma outra referência externa
  precisa ser pesquisada para esta fase sem necessidade nova comprovada.

## Sequência e checkpoints

| Tarefa | Entrega | Depende | Aceite objetivo |
| --- | --- | --- | --- |
| T00 | Base, gaps e decisões | — | Merge conferido, worktree isolada, D01–D03 registradas |
| T01 | Escopo e referência R017 | T00 | Limites e licença registrados; sem cópia/importação |
| T02 | Contratos de biblioteca/materialização e testes RED | T01 + autorização de implementação | DTOs fechados; reprodução de limites, replay, revogação e preservação sem consulta viva |
| T03 | Migration aditiva, ORM e serviço da biblioteca | T02 | CRUD autorizado/CAS/idempotência; inventário TypeORM; RLS real e rollback conservador |
| T04 | Conversão/snapshots/save/cópias | T03 | GREEN de conversão e D03; editorial parcial, revisão/publicação e legado intactos |
| T05 | PostgreSQL e segurança backend | T03/T04 | Tenant/profissional, role runtime, corridas e acesso revogado comprovados em banco descartável |
| T06 | BFF/API cliente e interface | T05 + handoff | Seletor/CRUD desktop/mobile, sem respostas obsoletas, acessibilidade e trava PA07 |
| T07 | Regressões e revisão | T06 | Backend/Web/BFF/portal/PDF e duas abas; gates proporcionais e achados tratados |
| T08 | Evidências e PR única | T07 | Diff/secrets limpos, CI do HEAD, relatório e limites operacionais explícitos |

T02–T07 implementados/revisados localmente. Luna alto concluiu o BFF e a
interface; Sol médio integrou a revisão e as regressões. T08 acompanha a PR
única e CI do HEAD; não há troca de modelo pendente. Merge, deploy e migration
externa continuam operações posteriores. Ver relatório final e runbook.

## Matriz de testes a executar na implementação

- Unitários RED/GREEN: 1/0,5/2,5 medidas; referência diferente de1; decimais,
  arredondamento, resultado pequeno/grande, zero/negativo/NaN/Infinity, entrada
  vazia/parcial, nome limite/unicode; nunca converter mL implicitamente.
- Banco descartável real: tenant ausente/errado, FORCE RLS, runtime sem
  BYPASSRLS/ownership; pessoal A versus B, clínica visível sem permitir alteração
  indevida; vínculo profissional revogado; FK alimento inválido; CAS A/B,
  criação duplicada/replay divergente, desativação concorrente com aplicação.
- Aplicação serializada com alteração/desativação da medida e resolução da
  revisão; nunca aceitar acesso validado antes da transação como prova atual.
- D03: editar/desativar biblioteca não muda rascunho/publicação/histórico;
  save de campo não relacionado não reconsulta biblioteca; nova versão/cópia
  conserva fatos; outro profissional com paciente transferido não ganha acesso
  à biblioteca pessoal antiga nem perde os fatos do plano autorizado.
- Fonte/preparação/versão trocadas não reutilizam medida; perda de fonte ativa
  segue governança existente; ausência de micros não vira zero.
- BFF e projeções: permissões, body/status/cache; nenhum ID de proprietário,
  tenant ou snapshot privado no portal/PDF; legado sem medida funciona.
- UI/Playwright desktop/mobile: CRUD/seleção, teclado/foco/Axe, pendências e
  erros, troca rápida de contexto, cópia em voo, autosave60s, conflito/releitura
  e segunda aba somente consulta. Sem localStorage/telemetria clínica.
- Regressões PA02–PA07, portal e impressão, cálculos e composição/micros;
  lint/typecheck/build backend/Web, authz, inventário de migrations, secrets,
  confiabilidade e CI do HEAD final. Só dados sintéticos.

## Rollout, rollback e evidência do planejamento (histórico)

Migration nova deve ser ensaiada no banco descartável e aplicada fora de banda
somente após autorização de alvo/branch/role. Rollback preferencial de código
conserva schema e snapshots; não executar down destrutivo após uso. Cliente
antigo continua com porção manual; writer antigo não pode destruir proveniência
persistida por omissão. Nunca editar migrations integradas.

PASS: inspeção read-only do Git/código e confirmação do merge/CI PA07.
PASS: `git diff --check`, links locais e D01–D03/T00–T08 conferidos;
`node scripts/scan-secrets.mjs` sem achados. Script documental no Node24
disponível; não equivale a validar runtime/build na versão Node22 do projeto.
SKIPPED: testes de implementação FOOD01, banco/ambientes externos e deploy,
pois não há alteração de runtime e a execução atual é planejamento.
Revisão independente não executada, não herdada de PA07.
A skill de planejamento foi consultada; não instalar/executar ai-devkit@latest
nesta worktree sem configuração `.ai-devkit.json`: usar os documentos canônicos
existentes, sem introduzir ferramenta remota por uma revisão documental.


## Contrato fechado no checkpoint backend — T02–T05

- Migration1075: tabela `medidas_caseiras_alimentos` com FORCE RLS, proprietário
  composto ao tenant, criação idempotente e conteúdo/criação cifrados. Coluna
  aditiva `medidas_caseiras_snapshot_criptografado` na versão: mapa de contextos
  confiáveis por chave editorial; evita depender de acesso vivo à biblioteca.
  Não existe coluna ou retorno de paciente na biblioteca.
- GET/POST `planos-alimentares/alimentos/:alimentoId/medidas-caseiras` e
  PATCH `.../:medidaId`. PATCH aceita revisão e apenas campos de conteúdo ou
  `ativa:false`; escopo imutável, sem reativação implícita. GET lista ativas,
  pessoal própria + clínica, com paginação estável. Corpo/retorno no handoff UI.
- No documento editorial, `medidaCaseira:{id,revisao,aplicacaoId}` expressa
  seleção; UUID de aplicação novo na seleção/reaplicação explícita. Snapshot
  numérico da biblioteca nunca entra no DTO. `medidaCaseira:null` desvincula
  explicitamente sem alterar fatos; `undefined` é omissão de cliente legado.
- Primeiro save resolve autorização e revisão dentro da transação protegida.
  Saves seguintes usam o mapa cifrado anterior apenas com a mesma chave de item,
  alimento e identidade de aplicação. Alterar quantidade mantém a equivalência
  já aplicada; reaplicar com nonce novo exige acesso atual. Remover item limpa
  contexto. Omissão legada só preserva vínculo se todos os fatos forem iguais.
- Normalização editorial resolve unidade/peso antes dos DTOs clínicos; entrada
  incompleta continua pendente sem peso inventado. Falhas de acesso/infra não
  são convertidas em sucesso parcial. Preservados CAS/identidades e PA07.
- Origem permanece UUID exato de catálogo. Cópias/nova versão usam valores
  factuais, sem transferir a seleção/aplicação privada ao novo item.
- A interface deve produzir o mesmo peso de três casas e indicar pendência
  enquanto não há quantidade válida, sem trocar todo o formulário pelo ACK.
  Servidor recalcula; backend GREEN não prova que a UI existente já trata os
  novos campos. T06 é necessário antes de disponibilizar a funcionalidade.


### Resultado do checkpoint backend

407 focados e343 suítes/3086 testes integrais PASS (6 suítes/127 SKIPPED por
condições próprias); PostgreSQL15 descartável28 PASS/29 filtrados após o código
final. Typecheck/build/artefato, governança24, secrets/diff e matriz40 referências
PASS. Sem extensões Timescale/pgvector nesta prova local; CI integral e revisão
independente separados. T06/T07 locais concluídos; CI de T08 permanece pendente.
[Relatório](../docs/governance/EVIDENCIAS_FOOD01_BACKEND_2026-10-17.md),
[evidências Web](../docs/governance/EVIDENCIAS_FOOD01_WEB_2026-10-17.md) e
[relatório final](../docs/governance/RELATORIO_FOOD01_2026-10-17.md) (com os
handoffs [Sol](handoff-pos-320-food01-sol.md) e [Luna](handoff-pos-320-food01-luna.md)
preservados como checkpoints históricos);
nenhum teste local comprova implantação externa ou feature disponível.
