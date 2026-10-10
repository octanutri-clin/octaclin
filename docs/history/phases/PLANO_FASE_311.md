# Fase 311 — ativação de conteúdo em clínicas existentes

Planejamento, análise de gaps e implementação em 2026-10-10. Branch
`feature/fase-311-ativacao-conteudo`, base `eb7f2aad` de `origin/main`
(Fase 310, PR #388 MERGED). Implementação autorizada pelo proprietário; cinco
decisões de produto abaixo foram confirmadas antes do início do código.

## Objetivo e decisões de produto

Oferecer instalação explícita e idempotente do kit genérico da Fase 297 às
clínicas existentes. Conferir disponibilidade das cargas globais TACO, USDA e
IBGE no onboarding de ambiente, com pendências visíveis e procedimentos de
carga separados por fonte.

| Decisão | Escolha do proprietário | Estado |
| --- | --- | --- |
| Quem instala nas clínicas existentes? | Gestor `Client` da própria clínica e `SuperAdmin` para uma clínica escolhida | Confirmado |
| Conjunto completo ou seleção de itens? | Seleção explícita dos materiais e estruturas | Confirmado |
| Complementação posterior? | Instalar alguns agora e adicionar restantes depois; seleção não remove, recria ou reativa itens anteriores | Confirmado |
| Opt-in pelo SuperAdmin? | Sua confirmação basta, sem aprovação prévia do gestor; auditoria registra o próprio SuperAdmin | Confirmado |
| Catálogo ausente bloqueia o kit? | Mostrar pendências por fonte ao SuperAdmin; manter o kit disponível | Confirmado |

Já definido pelo roadmap: opt-in por clínica; preservação dos materiais e
planos existentes; estruturas de refeições sem alimentos até revisão
profissional; carga global versionada fora do provisionamento por tenant;
erros de catálogo visíveis; nenhuma carga TBCA. Instalar o kit não cria envio
ao paciente nem representa revisão ou conclusão de um modelo clínico.

## Estado observado e evidências

- PR #386 MERGED em 2026-10-09, commit `34d186ec`; CI principal pós-merge
  `38000687212` concluído com sucesso, consultado neste ciclo.
- PR #388 MERGED em 2026-10-10, commit `eb7f2aad`; CI da PR `38014957842`
  passou, inclusive Backend NestJS, Governança, Web, Demo local smoke e PR Gate.
  O step PostgreSQL/Testcontainers do Backend passou. `Provenance do SBOM`
  ficou `SKIPPED`; não é aprovação. CI principal pós-merge `38016413569`
  confirmado SUCCESS em 2026-10-10.
- Migrations 1065/1066 integradas no código; aplicação operacional, configuração
  de push/WhatsApp, envios reais e produção não foram consultados. As listas
  de reviews GitHub das PRs 386/388 estavam vazias; isso não prova ausência
  de revisão externa, nem comprova revisão R4 independente.
- `operacoes/aplicacao/kit-inicial-clinica.ts` contém três materiais factuais
  e `instalarKitInicialClinica(EntityManager, tenantId, usuarioProprietarioId)`.
  O helper faz `save` dos materiais e da configuração sem consultar marcador
  nem adquirir lock. Hoje só é chamado no ramo de criação do provisionamento.
- O marcador existente é `tenant_configuracoes.chave = kit_inicial_clinica`,
  `valor = { versao: 1 }`; há unicidade de `(tenant_id, chave)` na fundação.
  Não interpretar ausência de propriedades novas como instalação incompleta.
- `ServicoModelosPlanoAlimentar.listar` libera duas estruturas de código quando
  o marcador do próprio tenant tem versão 1. Elas não são modelos persistidos
  e não entram no total de modelos pessoais.
- `GuiaConfiguracaoClinica` aparece apenas no dashboard de `Professional`.
  `Client` usa `/cliente`, cuja aba `ativacao` já tem conteúdo de preparação
  da clínica em `areas-visao-assinatura.tsx`. Instalação pelo gestor cabe nessa
  superfície; não conceder acesso ao prontuário para torná-la possível.
- Biblioteca de materiais e marcadores têm RLS. A FK original de autoria de
  material referencia apenas `usuarios(id)`: o serviço deve confirmar que o
  autor é Client ativo da própria clínica ou SuperAdmin ativo autorizado para
  o alvo. Não atribuir uma instalação administrativa a um gestor substituto.
- Catálogos são globais, com runtime somente leitura. A busca de alimentos
  lista apenas fontes ativas; omite ausentes/suspensas e exige termo de busca.
  Não é uma prova de disponibilidade de cada carga do ambiente.
- Tabelas existentes: `catalogos_composicao_alimentos`,
  `fontes_composicao_alimentos`, `alimentos_composicao`,
  `importacoes_catalogo_composicao`, `tentativas_importacao_catalogo`.
  O diagnóstico pode consultar agregados sem divulgar manifesto, executor,
  referência privada de direito, URL, hash, erro de banco ou conteúdo alimentar.
- Cargas USDA/IBGE usam `scripts/persistir-catalogo-fonte.ts` e validam banco
  e role esperados. O carregador TACO atual valida banco e confirmação literal,
  mas não compara `current_user` com role esperada. Registrar esse limite no
  procedimento; esta fase não executa nem redesenha carregadores.

## Contrato de instalação

### Autorização e rotas

- Backend: `GET /cliente/kit-inicial` para estado/prévia;
  `POST /cliente/kit-inicial` para instalação explícita.
- `ControladorPortalCliente`: manter guardas Jwt/Papeis/Permissoes, papel
  `Client` e exigir `cliente.configuracoes.gerenciar` nos dois métodos.
- SuperAdmin: `GET/POST /operacoes/tenants/:id/kit-inicial`, `ParseUUIDPipe`,
  guardas existentes e `operacoes.tenants.gerenciar`. Uma clínica por ação,
  com confirmação de seu nome e itens. Esse ID é alvo de operação privilegiada
  validada; não substitui o tenant da identidade autenticada.
- Serviço compartilhado `tenancy/aplicacao/servico-kit-inicial-clinica.ts`,
  exportado por ModuloTenancy, com `obter(tenantAlvoId, usuario)` e
  `instalar(tenantAlvoId, usuario, dto)`. Clientes e Operações já importam esse
  módulo. O serviço revalida papel/permissão e usuário ativo com mesmo papel
  no tenant da identidade; Client só pode escolher o próprio tenant.
- Body do POST: `{ confirmacao: true, versao: 2, itens: [chaves...] }`.
  DTO: `@Equals(true)`, `@Equals(VERSAO_KIT_INICIAL_CLINICA)` (novo valor 2),
  array de 1–5 entradas únicas e enum fechado das cinco chaves abaixo. Whitelist
  e rejeição de campos extras. Nunca receber texto, conteúdo, autor ou tenant
  pelo body. Mesma validação no serviço para chamadas internas/testes.
- GET/POST usam `Cache-Control: private, no-store`. BFF
  `/api/cliente/kit-inicial` reutiliza `exigirPermissaoBff` e
  `requisitarBackendAutenticado`; mantém tratamento sanitizado de 401/403,
  falhas de transporte e status do backend. Testar proteção de origem do
  middleware existente, sem criar mecanismo paralelo de sessão/CSRF.
- BFF administrativo em `/api/operacoes/tenants/[id]/kit-inicial`, separado do
  Client, com UUID validado, `operacoes.tenants.gerenciar` e papel SuperAdmin
  confirmado no backend. Guardas BFF não tornam Client autorizado ao alvo.
- Novo registro só em clínica com `status = ativo`, ciclo de vida em
  `ativo_assistido`, `primeiro_uso_validado`, `acompanhamento_48h` ou `ativo`,
  e assinatura não suspensa/cancelada. Reutilizar os estados/checagem de bloqueio
  da conta; não usar limite de um recurso SaaS não relacionado. Revalidar na
  transação. GET pode informar bloqueio se a sessão ainda permitir leitura.

### Estado e transação

- DTO de prévia: `versaoDisponivel = 2`, `versaoInstalada` opcional, `estado`
  (`nao_instalado`, `parcial`, `completo`,
  `incompativel`, `inconsistente`), `podeInstalar`, `motivoBloqueio` opcional
  em enum, datas opcionais e cinco itens de código com `chave`, `tipo`,
  `instalado`, título/nome, resumo/conteúdo ou refeições vazias. Não listar
  materiais personalizados nem expor autoria de outro tenant na prévia.
- Chaves estáveis de versão 2: `material:plano-no-portal`,
  `material:registro-habitos`, `material:duvidas-consulta`,
  `estrutura:tres-refeicoes`, `estrutura:cinco-refeicoes`. Ordem canônica fixa;
  textos/títulos atuais preservados. Identidade não depende de tradução/título.
- Marcador ausente permite instalação. `{ versao: 1 }` legado significa
  **cinco itens instalados**, mesmo sem data/origem. Não migrar/reinstalar esse
  marcador ao consultar ou repetir o POST. Versão 2 requer `itens` válidos,
  únicos, não vazios e conhecidos; datas/origem opcionais só quando válidas.
- Versão inteira desconhecida (diferente de 1/2) é incompatível; formato inválido
  é inconsistente. Ambos bloqueiam instalação com 409, preservando o valor.
  Parser puro compartilhado decide estado e estruturas habilitadas; não
  espalhar comparações `versao === 2` ou tratar erro como marcador ausente.
- Mover o helper atual, preservando os textos, para
  `tenancy/aplicacao/kit-inicial-clinica.ts`. Atualizar import do provisionamento
  e usar o mesmo helper no serviço compartilhado. Versão 2 identifica o contrato
  selecionável; manter parser explícito de versão 1 como kit completo.
  Não importar ModuloOperacoes
  em ModuloClientes nem criar dois instaladores divergentes.
- O helper usa o `EntityManager` da transação já aberta e adquire
  `pg_advisory_xact_lock(hashtextextended($1, 0))` com chave
  `kit-inicial-clinica:${tenantId}` **antes** de ler o marcador. O provisionamento
  e o opt-in usam a mesma chave. A restrição única do marcador é a defesa final;
  lock apenas no marcador inexistente não protege duas primeiras instalações.
- Rodar em `ExecutorTenant.executar(usuario.tenantId, ...)`: confirmar o autor
  ativo no contexto de sua identidade antes de qualquer mudança de contexto.
  Para SuperAdmin autorizado, resolver tenant-alvo existente e aplicar
  `set_config('app.tenant_id', tenantAlvoId, true)` no mesmo manager. Para Client,
  alvo deve ser a identidade já validada. Toda consulta/mutação do kit e trilha
  após a troca restringe explicitamente o alvo; nunca relaxar RLS/runtime.
- Materiais, marcador e auditoria de sucesso pertencem à mesma transação;
  qualquer falha aborta tudo. Auditoria registra o tenant-alvo e o usuário
  executor real; as FKs existentes permitem autoria do SuperAdmin de outro
  tenant. Essa exceção só existe no fluxo privilegiado verificado; Client
  jamais pode fornecer autor ou gravar noutra clínica. Testar ambos os casos.
- O helper recebe seleção já validada (internamente também recusa chaves
  desconhecidas), calcula `novos = solicitados - instalados` sob o lock e
  devolve `{ reutilizado, versaoMarcador, materiaisCriados,
  estruturasHabilitadas, itensAdicionados }`. POST sempre retorna 200 com
  resultado mínimo e estado recalculado da seleção acumulada.
- Se seleção já está instalada (inclusive versão 1 legado): reutilizado/zero;
  nenhuma alteração da configuração, materiais, autoria, datas ou auditoria.
- Caso contrário, criar apenas os materiais novos e acumular a união dos
  itens no marcador `{ versao: 2, itens: [chaves...] }` em ordem canônica.
  Estruturas só ganham habilitação no marcador; não criar modelo incompleto.
  Preservar id/criadoEm do marcador parcial ao complementar. Metadados
  opcionais: `instaladoEm` da primeira execução, `atualizadoEm` da última
  adição, `origem` (`opt_in_cliente`, `opt_in_superadmin`,
  `provisionamento_assistido`). Retry não muda datas/origem.
- Registrar `cliente.kit_inicial.instalar` ou `operacoes.tenant.kit_inicial.instalar`
  com `registrarAuditoriaNaTransacao` somente se houve adição, com metadados
  de versão/contagens/origem e chaves de catálogo de código. Sem conteúdo, títulos,
  nomes, e-mails ou JSON livre; validar a redação existente.
- Identidade de instalação é chave estável no marcador, não igualdade de título. Material manual
  com título igual não é sobrescrito nem tomado como item instalado. Pode
  coexistir com o novo registro. Item instalado não é reparado silenciosamente
  após desativação ou edição de material; copiar/adaptar segue a UI atual.
- Clínica nova continua recebendo kit completo automaticamente **somente**
  no ramo de criação, pelo mesmo helper com as cinco chaves/versão 2 e autor
  Client recém-criado. A transação de provisionamento continua única e falha
  integralmente se o kit falhar. Reuso nunca complementa o kit de clínica
  existente; somente confirmação explícita Client/SuperAdmin faz isso.
- `ServicoModelosPlanoAlimentar.listar` usa o parser e filtra estruturas pelos
  itens habilitados. Versão 1 libera ambas; versão 2 libera apenas a seleção.
  Marcador inválido/incompatível não libera estruturas. Não alterar validação
  de alimento obrigatório nem contagem de modelos salvos.
- Usar as tabelas e RLS atuais; nenhuma migration nova prevista. Se aparecer
  necessidade verificável de schema, registrar o fato antes de ampliar o escopo.

### Interface

Adicionar componente próprio em `/cliente`, aba Ativação, visível apenas com
permissão de configuração. Mostrar prévia, quantidades e explicação de que
o profissional completa/revisa as estruturas e escolhe futuros envios.
Selecionar itens pendentes, mostrar instalados separados, permitir selecionar
tudo que falta; conjunto vazio não confirma. Confirmação lista os itens novos
e informa preservação dos anteriores. SuperAdmin tem a mesma seleção em
Operações > Onboarding para uma clínica escolhida; prévia/confirmação exibem
o alvo resolvido, e mudança de alvo limpa a seleção (evitar resposta atrasada
da clínica anterior). Sua confirmação constitui opt-in conforme decisão.
Após sucesso/reutilização, recarregar
estado do servidor; não usar localStorage como prova de instalação. Cancelar
a confirmação não produz efeito. Erro deixa retry disponível e instalação
concorrente concluída por outra sessão aparece como reutilizada.

O gestor não ganha listagem clínica nem links que exigem papel Professional.
A equipe encontra os materiais no prontuário e as estruturas no editor já
existentes. Preservar o total real de modelos e o progresso do guia profissional.
Estados carregando/erro/bloqueado/parcial/completo devem ter foco, nomes acessíveis,
feedback `aria-live`, desktop/mobile e recuperação.

## Contrato de conferência dos catálogos

- `GET /operacoes/catalogos-alimentares/disponibilidade` em ControladorOperacoes,
  papel `SuperAdmin` e `operacoes.tenants.gerenciar`. Novo
  `ServicoDisponibilidadeCatalogos` registrado em ModuloOperacoes. Revalidar
  papel/permissão no serviço. Não aceitar tenant-alvo para catálogo global.
- BFF no mesmo caminho sob `/api/operacoes`, com sessão e permissão atuais,
  `private, no-store`. Interface no onboarding de Operações, seção do ambiente,
  consultada ao abrir a aba e ao atualizar; não uma consulta repetida por tenant.
- Quatro bases esperadas, com identidade exata:

| Rótulo | Código da fonte | Base |
| --- | --- | --- |
| TACO | `taco_nepa_unicamp` | `cmvcol_taco3` |
| USDA Foundation Foods | `usda_fdc_foundation` | `foundation-foods` |
| USDA SR Legacy | `usda_fdc_sr_legacy` | `sr-legacy` |
| IBGE POF 2008–2009 | `ibge_pof_2008_2009` | `pof-2008-2009-composicao` |

- Retornar as quatro bases mesmo sem registros; não usar busca prefixada ou
  inferir USDA completo pela presença de uma só base. Versões são identidades
  opacas, sem comparação numérica ou lexicográfica para escolher a vigente.
- Disponível significa que existe edição ativa, direito aprovado, importação
  `concluida` correspondente à mesma fonte/hash/checksum, total declarado > 0
  consistente com os alimentos vinculados, e ao menos um alimento com base
  positiva e energia/proteína/carboidrato/lipídio não nulos, finitos e >= 0.
  Fibra/sódio ausentes não invalidam a composição essencial atual.
- Preferir uma consulta agregada/CTEs com projeção explícita, executada pelo
  DataSource atual somente para leitura. Contar por fonte/importação antes de
  juntar tentativas, evitando multiplicar alimentos. Uma consulta fornece
  snapshot consistente; não carregar todas as entidades/alimentos em memória.
- Estado da base: `disponivel` se alguma edição satisfaz o critério, `ausente`
  se não há fonte da identidade esperada, `indisponivel` nos demais casos.
  Cada edição traz motivos enumerados como `fonte_inativa`, `direito_nao_aprovado`,
  `importacao_nao_concluida`, `carga_inconsistente`, `sem_alimentos` e
  `sem_composicao_utilizavel`; nunca texto de exceção/erro armazenado.
- DTO: `verificadoEm`, `completo` (quatro bases disponíveis), itens de base
  (`codigo`, `baseCodigo`, `rotulo`, `estado`, `totalEdicoes`, `edicoesLimitadas`),
  até dez edições por base ordenadas por `importada_em DESC, id DESC` com versão,
  situação/direito em enum, contagens, data e motivos. Resumo de disponibilidade
  considera **todas** as edições; paginação da projeção não cria falso vermelho.
- Pode apresentar estado/data da tentativa mais recente por base, sem executor,
  manifesto, hash, URL ou `erro_sanitizado`. Tentativa de atualização falhou
  não invalida uma edição anterior ainda disponível; mostrar aviso separado.
- Erro SQL/timeout/schema ausente resulta em erro de consulta sanitizado e
  retry; nunca retornar lista vazia/sucesso. Na UI usar “Não foi possível
  verificar”, distinto de “Fonte ausente”. Não alterar fontes para verde.
- Mostrar “Verificado neste ambiente em …”; a leitura prova disponibilidade
  registrada no backend atendendo a sessão, não deploy, produção integral,
  precisão clínica ou recomputação dos hashes do catálogo.
- Orientar operação para os carregadores existentes e procedimento versionado
  por fonte. A tela não carrega nem ativa catálogo. Runtime continua SELECT;
  nenhuma permissão de owner, seed por tenant ou chamada USDA online.
- Pendências de catálogo não bloqueiam o kit, nem mudam
  os estados do ciclo de vida do tenant. Não há novo gate obrigatório de
  provisionamento sem decisão explícita do proprietário.

## Análise de gaps e controles

| Gap observado | Risco | Controle e cenário de aceite |
| --- | --- | --- |
| Kit só existe em provisionamento novo | Clínicas antigas não recebem conteúdo | Opt-in Client/SuperAdmin por clínica, seleção/prévia/confirmação |
| Helper não verifica marcador | Retry/duas abas duplicam materiais | Lock compartilhado + marcador + teste PostgreSQL concorrente |
| Escritas sem trilha transacional no novo fluxo | Instalação sem auditoria ou marcador parcial | Mesma transação; falha em cada escrita/auditoria faz rollback |
| Marcador legado minimalista | Atualização reinstala clínicas novas | Versão 1 sempre completa; versão 2 registra itens, sem backfill |
| Seleção parcial e pedidos sobrepostos | Completar apaga item ou duplica material | União sob lock; teste paralelo Client/SuperAdmin com sobreposição |
| Material pode ser desativado/adaptado | Instalação “repara” ação deliberada | Marcador instalado impede recriação/reativação |
| Autoria tem FK simples | Confusão entre SuperAdmin autorizado e escrita cruzada indevida | Autor real verificado no tenant da identidade; alvo só pode diferir para SuperAdmin com permissão; prova positiva e negativa |
| Guia só aparece para Professional | Gestor não encontra o opt-in | Aba Ativação já existente, sem concessão de acesso clínico |
| Busca omite fontes ausentes | Ambiente sem carga parece saudável | Quatro bases explícitas, status/contagens/pendências |
| Há duas bases USDA | Uma única fonte esconde instalação parcial | Foundation e SR Legacy verificadas separadamente |
| Fonte ativa não basta | Importação incompleta/sem alimento utilizável fica verde | Agregados por identidade/importação/composição; casos negativos |
| Histórico de tentativa inclui falha posterior | Atualização falha desabilita carga anterior válida no painel | Aviso separado de disponibilidade da edição ativa |
| Erro de consulta confundido com ausência | Falso estado ausente ou verde | Erro sanitizado, HTTP de falha e retry, sem fallback de sucesso |
| Catálogos são globais e somente leitura | Seed por tenant ou privilégio de owner no runtime | Consulta global autorizada, carregadores fora do fluxo |
| Documentos 309/310 e `tasks/plan.md` estão antigos | Sucessor usa branch/validações erradas | Reconciliação factual e arquivo histórico do handoff 309 |
| Gates 310 tiveram falhas repetidas de smoke/governança | Teste de demo não representa nova UI | Atualizar mock/demo e cobertura BFF/Playwright antes do CI |

## Validação planejada e rollback

R4 pela nova mutação tenant-aware e autorização; edição deste planejamento é
documental. Os cenários e passos estão em `tasks/todo-fase-311.md`. Não marcar
provas locais, database/provider ou produção como aprovadas por existir teste.

Provar com PostgreSQL descartável/role não owner sem BYPASSRLS: duas primeiras
instalações no mesmo tenant, independência entre tenants, ausência de acesso
cruzado, atomicidade de materiais/marcador/auditoria e contexto de conexão após
erro. Utilizar o harness existente de Testcontainers/RLS; não apontar o Jest
ao banco operacional. Testar também serviço de catálogos contra dados sintéticos
em PostgreSQL com SELECT e DML de catálogos negado ao runtime.

Rollback de código interrompe novos opt-ins/conferência. Preservar os materiais,
marcadores e histórico já criados; não remover automaticamente nem desfazer
adaptações/envios. Instalação parcialmente falha não deixa registro e pode ser
repetida. Não remover marcador de kit instalado para “tentar de novo”.
Ao voltar ao código anterior da Fase 297, marcadores versão 2 deixam de habilitar
estruturas (o consumidor antigo só aceita versão 1). Essa indisponibilidade
temporária é o limite conservador do rollback; ele nunca libera estruturas
não selecionadas. Marcadores legado versão 1 continuam funcionando. Não
converter 2 para 1 durante rollback, pois isso liberaria itens não escolhidos.
Revisão independente R4 quando viável, com evidência e limitações registradas.

## Arquivos, ordem e handoff

Plano autoritativo: este documento. Handoff corrente: `tasks/plan.md`.
Checklist executável: `tasks/todo-fase-311.md`; `tasks/todo.md` aponta para ele.
Handoff anterior 309 preservado em `tasks/plan-fase-309.md` e
`tasks/todo-fase-309.md`; 310 mantém seus arquivos próprios como histórico.

Ordem: helper/parser compartilhados + domínio/concorrência;
APIs Client/SuperAdmin + transação/autorização; consulta global + API SuperAdmin; BFFs e
harnesses; interfaces e mock de demo; PostgreSQL e Playwright; revisão/checks;
documentação e PR da implementação na mesma branch. Não abrir PR isolada só
para reconciliação de estado. Sem DDL, catálogo remoto, envio externo ou deploy
como efeito do planejamento/implementação.

Implementação executada com GPT-6 Luna alto, suficiente para o escopo fechado
e priorizando custo de tokens. As tarefas abaixo foram concluídas localmente;
CI da PR e revisão R4 independente ainda não foram comprovados.

## Evidência da implementação

- PASS: helper/parser compartilhados, instalação incremental e compatibilidade
  legado, rotas Client/SuperAdmin, auditoria transacional, política de modelos,
  consulta somente leitura de catálogos, três BFFs, interfaces, mock demo e
  runbook. Nenhuma migration nova.
- PASS: backend Jest integral (2464 passed, 44 skipped), build/typecheck e
  testes focados; PostgreSQL/Testcontainers/RLS 25/25; BFF Fase 311 5/5;
  Playwright da Fase 311 em desktop/mobile 4/4 com axe/foco; Web typecheck e
  build de produção passaram.
- PASS: guardas de controladores 11/11; matriz de confiabilidade 40 referências;
  matriz de acessibilidade 20/20; cobertura de redação (24/24 e inventário);
  scanner local de secrets sem secret real identificado.
- PASS: Fase 310 CI principal pós-merge `38016413569` confirmou SUCCESS.
- PASS: demo local smoke pós-build `smoke-e2e-bff-ok`, usando API demo sintética.
- PASS: suíte Web ampla `test:authz`, incluindo harness dedicado Fase 311 5/5;
  `git diff --check` final.
- PASS: branch publicada e PR #389 aberta; CI remoto em execução.
- PENDENTE: CI completo e revisão R4 independente.
- SKIPPED: instalação/carga de catálogos, migrations operacionais, envio externo,
  deploy/produção; nenhum acesso ou mudança a ambiente operacional foi feito.
- R4 formal independente não concluída nesta execução. A evidência local não
  substitui revisão GitHub nem CI da PR; registrar essa limitação na PR.
- Ambiente disponível Node 24.19.0/pnpm 11.19.0, fora do range do manifest
  (Node 22/pnpm 11.25.0); comandos locais exibiram aviso de engine.
