# OctaClin - Decisoes de arquitetura

Este arquivo registra decisoes ja tomadas para evitar que outro agente reprojete o produto sem necessidade.

## ADR-001 - Nome e referencia

- Decisao: o produto se chama OctaClin.
- Contexto: LiveClin foi usado apenas como sistema de referencia/modelagem.
- Consequencia: textos, docs, commits e UI devem usar OctaClin.

## ADR-002 - Multi-tenancy

- Decisao: tenant e resolvido no servidor a partir de credencial ou capability
  verificada, como JWT autenticado, token opaco/capability validado ou API key
  validada.
- Nao usar: tenant livre em header ou body como fonte de verdade.
- Consequencia: servicos autenticados usam o tenant da identidade; fluxos
  publicos legitimos resolvem o escopo minimo a partir da capability verificada;
  persistencia sensivel usa `ExecutorTenant`.

## ADR-003 - Backend

- Decisao: backend principal em NestJS com TypeORM e PostgreSQL.
- Consequencia: novos dominios devem seguir modulo NestJS, service, controller, DTOs e specs focadas.

## ADR-004 - Frontend e BFF

- Decisao: frontend em Next.js App Router com BFF em `app/api`.
- Consequencia: chamadas autenticadas do browser devem passar pelo BFF para usar cookies HttpOnly e renovar sessao.

## ADR-005 - Sessao

- Decisao: access token e refresh token ficam em cookies HttpOnly no BFF.
- Consequencia: evitar expor tokens ao JavaScript do browser.

## ADR-006 - Criptografia e PII

- Decisao: dados sensiveis devem ser criptografados no backend ou retornados apenas por DTO autorizado.
- Consequencia: nao retornar entidades ORM cruas quando elas contem hash, token, senha, PII criptografada ou payload sensivel.

## ADR-007 - Auditoria

- Decisao: leituras sensiveis e mutacoes administrativas devem gerar trilha.
- Consequencia: novas funcoes de suporte, LGPD, usuario, paciente, agenda e comunicacao precisam considerar auditoria.

## ADR-008 - Arquivamento

- Decisao: preferir arquivamento logico a delete fisico em dados clinicos e operacionais.
- Consequencia: deletes de pacientes/profissionais/usuarios devem ser avaliados como `ativo=false`, `arquivadoEm` ou status equivalente.

## ADR-009 - Email

- Decisao: suportar SMTP Gmail e Gmail API.
- Consequencia: novas mensagens transacionais devem usar adaptador existente, outbox quando aplicavel e nao implementar provedor isolado sem necessidade.

## ADR-010 - WhatsApp

- Decisao: usar Meta WhatsApp Cloud API.
- Consequencia: templates precisam ser aprovados na Meta e mapeados no OctaClin antes de automacoes reais.

## ADR-011 - Agenda

- Decisao: agenda interna deve sincronizar com Google Calendar.
- Consequencia: OctaClin deve manter estado proprio da consulta e tratar Google Calendar como integracao externa, nao unica fonte de verdade.

## ADR-012 - Convites administrativos

- Decisao: convites administrativos reutilizam `tokens_redefinicao_senha`.
- Contexto: isso evita criar tabela nova antes de amadurecer o fluxo.
- Consequencia: token recebe `payload.origem = convite_usuario_cliente`, expiracao, criador, reenviador/revogador e link para `/recuperar-senha`.

## ADR-013 - Portal do cliente

- Decisao: `Client` gerencia a conta SaaS, nao rotinas clinicas.
- Consequencia: portal do cliente deve mostrar conta, assinatura, usuarios, convites, configuracoes e billing; nao deve virar console clinico.
- Excecao de produto aprovada no PB-26: o gestor da clinica pode consultar
  indicadores agregados de operacao do proprio tenant (agenda e contagens de
  pacientes), sem prontuario, lista de pacientes, dado clinico individual ou
  poder de alterar atendimento. O endpoint exige `Client` e `cliente.acessar`,
  resolve tenant pelo JWT e consulta dentro de transacao com RLS.

## ADR-014 - Portal do paciente

- Decisao: `Patient` usa portal isolado.
- Consequencia: paciente nao acessa console operacional nem portal do cliente.

## ADR-015 - Deploy

- Decisao atual: GitHub publico, Render, Neon e um Redis gerenciado definido por `REDIS_URL`. O provedor de Redis foi trocado em 2026-08-22 apos estouro de cota; ver `RUNBOOK_PRODUCAO.md`, secao "Redis e filas".
- Consequencia: documentacao de producao deve considerar esses provedores ate decisao explicita de troca.

## ADR-016 - Desenvolvimento por fases

- Decisao: continuar por fases numeradas.
- Consequencia: cada fase deve ter commit, validacao e documentacao propria. O checklist vivo deve ser atualizado.

## ADR-017 - Busca sobre PII cifrada

- Decisao: a busca server-side de pacientes usa indice cego de tokens e
  prefixos normalizados, nunca uma coluna derivada em texto claro.
- Protecao: cada entrada usa HMAC-SHA256 com chave derivada da chave AES,
  separacao de dominio e `tenantId`; SHA-256 sem chave nao e aceito para nome
  ou contato.
- Limite: somente prefixos com 3 a 32 caracteres sao indexados. Busca por trecho
  arbitrario no meio de um token nao faz parte do contrato.
- Operacao: migration cria a coluna e o indice; backfill descriptografa e
  reindexa pela aplicacao somente contra banco explicitamente confirmado.
- Consequencia: rotacao da chave AES exige reindexacao coordenada dos hashes de
  busca junto da recriptografia dos dados.

## ADR-018 - Armazenamento de anexos clinicos

- Decisao arquitetural: usar storage privado S3-compatible, com credencial e
  bucket separados por ambiente. O provedor operacional e configuracao de cada
  ambiente pertencem ao runbook e as variaveis do ambiente, nao a este ADR.
- Estado operacional verificado em 2026-08-22: o backend de producao usa
  Backblaze B2 com `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`. Esse estado deve ser
  revalidado no Render antes de qualquer afirmacao futura sobre o ambiente.
- Fluxo: o navegador envia por URL pre-assinada curta; o backend confirma o
  objeto real, MIME, tamanho, metadados e SHA-256 antes de exibir ou contabilizar.
- Protecao: bucket/chave e credenciais nao fazem parte dos DTOs publicos; acesso
  de leitura tambem usa URL curta depois de autorizacao por tenant e paciente.
- Sobrescrita: por padrao, o PUT assinado exige `If-None-Match: *`. Provedores
  incompativeis podem desativar essa condicao com
  `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`; nesse modo nao existe garantia de
  imutabilidade absoluta no object storage. Depois da inspecao, o backend
  promove `pendentes/` para `confirmados/`, prefixo que nao e exposto para
  escrita do navegador.
- Abuso: a reserva de cota e serializada por tenant, uploads sao limitados e o
  lifecycle do provedor remove temporarios abandonados.
- Consequencia: o backend le arquivos de ate 25 MB na confirmacao. Streaming
  so entra quando volume medido exigir.
- Antivirus (Fase 261): a confirmacao passa por `ServicoAntimalware`, que usa
  ClamAV real via `MecanismoClamAv` quando `CLAMAV_HOST` esta definido, com
  referencia EICAR como fallback documentado (nao antivirus real) quando o
  daemon nao esta provisionado. Contrato fail-closed: erro ou timeout do
  mecanismo sempre rejeita, nunca libera por omissao. Ver
  `VARIAVEIS_AMBIENTE.md` e `infraestrutura/armazenamento/servico-antimalware.ts`.

## ADR-019 - Processadores distribuidos

- Decisao: separar HTTP e processamento assincrono pelo papel
  `OCTACLIN_PROCESSO`; `web` recebe requisicoes e `worker` consome filas e
  cron. `all` e apenas compatibilidade local/transitoria.
- Protecao: comunicacoes/outbox/automacoes usam reivindicacao persistente antes
  de processar; Google Calendar usa exclusao transacional por profissional.
- Consequencia: Redis e obrigatorio para worker em producao. Nao escalar o
  papel `web` enquanto o worker e a validacao de entrega unica nao estiverem
  configurados no ambiente.

## ADR-020 - Teleconsulta por link externo

- Decisao: nao construir plataforma de video propria. A consulta ganha
  `modalidade` (`presencial`/`online`) e `link_teleconsulta`, apontando para
  Meet, Zoom, Whereby ou qualquer sala externa que a clinica ja use.
- Motivo: a demanda comercial e ter o campo, nao ter o codec. Video proprio
  significa midia server, TURN, gravacao, banda e conformidade de midia clinica
  a custo desproporcional para o mesmo resultado na comparacao de venda.
- Protecao: apenas `https` e aceito (`linkTeleconsultaValido`); consulta
  presencial nunca guarda link, invariante travada tambem por CHECK no banco.
  O link nao aparece em log nem em auditoria — so em mensagem ao paciente,
  no evento do Google Agenda do proprio profissional e na resposta autenticada.
- Janela: o backend so devolve o link no campo estruturado
  `consultasProximas[].linkTeleconsulta` de 1h antes ate 30min depois do fim, e
  nunca para consulta cancelada ou encerrada. **A janela e reducao de superficie
  e clareza de interface, nao segredo:** o mesmo link foi entregue por email e
  WhatsApp no agendamento, e o texto dessa mensagem continua visivel no
  historico do portal. Quem trata o link como segredo esta enganado — sala
  externa e protegida pelo provedor (codigo de sala, sala de espera), nao pelo
  OctaClin.
- Consequencia: a clinica administra a propria sala. Sala persistente por
  profissional, gravacao e sala de espera ficam de fora ate haver demanda
  medida. **Esta decisao nao deve ser reaberta sem numero de venda perdida por
  falta de video proprio.**

## ADR-021 - PWA, cache clinico e aplicativo mobile

- Decisao: o portal do paciente e instalavel como PWA, mas seu service worker
  guarda somente assets publicos versionados e uma tela offline neutra.
- Privacidade: APIs, HTML autenticado e projecoes clinicas nao entram no Cache
  Storage. Operacoes offline ficam cifradas no IndexedDB com AES-GCM e chave
  nao exportavel apenas em memoria; logout ou HTTP 401 elimina a fila.
- Idempotencia: check-in usa `idLocal` persistido em
  `sincronizacoes_mobile`; formulario e idempotente pelo proprio envio e lock
  transacional.
- Mobile: `octaclin-mobile` existe e continua como cliente nativo separado. O
  PWA usa os endpoints do portal, nao `/mobile`, para preservar autorizacao,
  projecao segura e auditoria; apenas o padrao de idempotencia e compartilhado.
- Excecao aprovada na Fase 310: push web real somente para avisos genéricos de
  novas receitas compartilhadas, com opt-in específico por canal, subscription
  cifrada e abertura autenticada do portal. O push genérico para outros eventos
  continua indisponível enquanto não houver implementação própria. O payload
  clínico permanece fora do push e do Cache Storage.
- Consequencia: fechar ou recarregar a pagina elimina uma fila cuja chave foi
  perdida. Persistencia clinica offline entre reinicios continua exigindo fase
  propria e nao pode reutilizar Web Storage.

## ADR-022 - Telemetria interna e feature flags

- Decisao: iniciar o piloto com telemetria HTTP sanitizada, limitada e local ao
  processo, sem contratar provedor externo antes de haver escala medida.
- Privacidade: nao persistir payload, query string ou PII; normalizar rotas e
  expor somente referencia de requisicao derivada por hash.
- Limite: buffers locais reiniciam com o processo e nao representam varias
  instancias. Escala horizontal exige agregacao externa ou distribuida.
- Flags: usar allowlist conhecida, defaults desabilitados e precedencia
  `padrao -> ambiente -> tenant`, persistindo overrides no modelo existente de
  configuracao do tenant.
- Operacao: o painel sugere promover, observar ou rollback, mas a decisao e a
  execucao continuam humanas e seguem `RUNBOOK_PRODUCAO.md`.

## ADR-023 - Autoridade e efeitos externos da agenda

- Decisao: a agenda interna e a fonte operacional, inclusive sem Google
  conectado. Google Calendar, email e WhatsApp sao efeitos externos
  observaveis e recuperaveis, nunca pre-condicao para persistir a consulta.
- Concorrencia: toda mutacao que ocupa ou libera horario adquire trava
  transacional por `tenantId` e `profissionalId`, cobrindo a corrida entre as
  tabelas de consulta e bloqueio manual.
- Idempotencia: evento Google usa ID deterministico por consulta; `409` so e
  recuperado se o evento apontar para a mesma consulta. Mensagem persistida e
  republicada pelo mesmo ID e solicitacao publica usa referencia deterministica.
- Entrada Google: remarcacao/cancelamento exige o `googleEventId` persistido e
  o sync token so avanca quando todos os eventos forem aplicados.
- Link publico: antes de existir contexto de tenant, uma funcao
  `SECURITY DEFINER` com `search_path` fixo resolve somente hash de token ativo,
  tenant, profissional e duracao. RLS e FORCE RLS da tabela permanecem ativos.
- Consequencia: a migration `1720000001034` precisa ser aplicada fora de banda
  com role owner antes do deploy do codigo da Fase 253.

## ADR-024 - Leitura minima da auditoria pela clinica

- O portal administrativo oferece consulta da trilha somente ao papel exato
  `Client` com `cliente.acessar`. Operacoes continua com sua fronteira propria
  de SuperAdmin; o portal nao reutiliza a resposta ORM daquele modulo.
- Tenant vem da credencial verificada. A leitura usa `ExecutorTenant`, RLS e
  filtro SQL explicito; o usuario responsavel so e identificado quando pertence
  ao mesmo tenant. Ator externo, removido ou ausente resulta em identificador nulo.
- O DTO expoe apenas data, identificador opaco do usuario, codigo de acao e
  tipo de recurso. IP, navegador, metadados, identificador do evento e alvo do
  recurso nao sao selecionados ou enviados ao navegador.
- Filtros exatos, datas UTC e paginacao limitada sao validados. A leitura e
  auditada sem copiar filtros ou resultados; respostas usam `private, no-store`.
- Esta superficie nao altera a politica de retencao nem fornece exclusao ou
  exportacao. A decisao de produto e os gates da entrega estao no plano PB-27.

## ADR-025 - Conversa segura entre paciente e clinica

- O canal bidirecional desta entrega existe somente no portal autenticado do
  paciente; mensagens e respostas nao acionam email, WhatsApp, outbox ou outro
  transporte externo.
- O backend resolve o titular pelo usuario e tenant autenticados. A equipe
  precisa das permissoes de leitura/envio; profissionais ficam limitados ao
  proprio escopo, enquanto colaboradores autorizados seguem o escopo permitido
  da clinica.
- Conversas e mensagens ficam em tabelas proprias, cifradas, com tenant em cada
  linha, FKs compostas e RLS/ FORCE RLS. O texto so sai por DTO autorizado.
- O SLA e contado em horas corridas: 24h por padrao, configuravel por tenant de
  1 a 168 horas. O prazo ja iniciado nao muda com uma nova configuracao; ao
  vencer, a resposta e destacada apenas na fila interna de Comunicacoes.
- A fila interna permite consultar conversas aguardando a clinica, aguardando
  o paciente, encerradas ou todas; filtro de atraso so vale para respostas
  aguardando a clinica. Resultados sao paginados.
- O paciente pode enviar cinco mensagens por janela movel de dez minutos. A
  contagem acontece sob trava transacional por paciente para ser consistente
  entre instancias; o excedente recebe HTTP 429 e nao e persistido.
- Mensagens integram exportacao LGPD, retencao clinica vigente e fluxo de
  eliminacao de paciente; migration `down` bloqueia perda se existirem mensagens
  ou se RLS impedir uma contagem completa.
- Contrato, gates, rollback e evidencia da Fase 295 ficam em
  `docs/history/phases/PLANO_FASE_295.md`.

## ADR-026 - Triagem LGPD pelo gestor da clínica

- O papel exato `Client` com `cliente.acessar` consulta os pedidos LGPD do
  próprio tenant, inicia a tratativa e prepara rascunho não enviado. O tenant
  vem da credencial; a leitura usa `ExecutorTenant`, filtro SQL por tenant,
  paginação e DTO mínimo. O BFF e o backend respondem `private, no-store`.
- Conclusão, indeferimento, eliminação, CSV operacional e programação de
  retenção permanecem na superfície `SuperAdmin`. A triagem da clínica não
  amplia o alcance da rota de Operações nem equivale a deferimento jurídico.
- A descrição livre do pedido e das tratativas passa a ser cifrada em coluna
  própria, mantendo metadados de estado sem conteúdo. Registros anteriores
  exigem backfill fora de banda depois da migration 1062 e do deploy
  compatível; cifra e remoção do JSON ocorrem na mesma transação por lote.
- A solicitação original é travada na transação para serializar a triagem com
  decisões operacionais. Cada tratativa recebe instante posterior ao último
  evento de estado, inclusive quando ambas ocorrem no mesmo milissegundo.
  O rascunho não cria mensagem nem outbox. Auditoria
  registra apenas a ação, sem texto, paciente ou protocolo.
- O portal do paciente projeta o estado do pedido e a descrição enviada por
  ele. Nota de tratativa interna e resposta apenas preparada não são
  comunicação entregue e não aparecem nessa projeção, nem alteram a data
  de atualização exibida ao paciente.
- O `down` da 1062 recusa perda de dados. Depois do backfill, o runtime
  anterior não lê descrições cifradas; o rollback operacional é desativar a
  nova superfície ou corrigir para frente, preservando os dados.
- Plano, gates e procedimento em `docs/history/phases/PLANO_FASE_302.md` e
  `docs/governance/ROLLOUT_LGPD_FASE_302.md`.

## ADR-027 - Concessões de integração para profissionais

- O gestor `Client` concede diretamente a profissionais ativos do próprio
  tenant listas independentes de escopos API e eventos webhook. O profissional
  mantém o papel `Professional`; não recebe permissões de conta `Client`.
- Concessões versionadas ficam em tabela tenant-scoped com RLS forçada e
  histórico. A identidade e o tenant vêm da sessão validada; o backend lê a
  concessão ativa a cada operação, para que a revogação não dependa de novo
  login ou expiração do JWT.
- Chaves e assinaturas profissionais guardam o titular de forma imutável. O
  profissional só administra as próprias credenciais quando o conjunto está
  integralmente contido na concessão corrente. A chave executa a API pública
  com o papel Professional e escopo da carteira; webhooks profissionais
  verificam responsabilidade atual pelo paciente ao criar a entrega e antes
  do envio. Entregas são projetadas sem payload interno nem erro bruto.
- Reduzir uma concessão impede o uso das credenciais profissionais que excedem
  o novo conjunto; remover a concessão impede todas as daquele domínio.
  Credenciais permanecem cadastradas para possível restauração da concessão;
  o gestor pode revogar chave ou desativar assinatura definitivamente. As
  credenciais criadas pelo gestor permanecem no escopo da clínica.
- Concessões e linhas de auditoria de concessão/revogação são gravadas na mesma
  transação. Mudança do profissional para outro papel ou sua desativação encerra
  concessões e credenciais profissionais ativas na mesma transação que revoga
  sessões; uma aprovação posterior exige novas credenciais.
- A migration 1063 é aplicada fora de banda antes de ativar o runtime que lê
  as novas colunas. Se houver rollback para o runtime anterior após emissão de
  credenciais profissionais, revogar essas chaves e desativar assinaturas
  profissionais antes da troca; o código antigo trataria as chaves como
  credenciais de clínica. Prova PostgreSQL/RLS é requisito para concluir a
  fase; testes unitários e status `SKIPPED` não provam isolamento.
- Plano, gaps, decisões e testes em
  `docs/history/phases/PLANO_FASE_303.md`.

## Fase 314 — snapshots pediátricos e validação computacional pendente

REV11/REV9 (2026-10-11): G02 foi ratificado integralmente pelo proprietário,
com registro e hash em `docs/product/FASE_314_ACEITE_CLINICO_G02_REV9_2026-10-11.md`.
Isso substitui propostas clínicas conflitantes, sem comprovar direitos, G01 ou
formalização institucional. As seis fórmulas adultas e interpretações próprias
passam a ser elegíveis desde18 anos completos, mantendo domínios individuais e
proteções gestacionais; classificação adulta de IMC continua desde20.

Escrita pediátrica exige Professional, carteira ativa e `pacientes.gerenciar`,
antes de idempotência/replay; Collaborator com leitura autorizada não escreve,
nem SuperAdmin. Snapshot novo `pediatrico-medidas-v2` identifica o protocolo
`g02-rev9-3dd197df` e G01/direitos pendentes. Leitor aceita v1/v2 sem recálculo;
rollback conserva ambos. Elegibilidade neonatal é explícita e cifrada, com origem,
sem deduzir ausência de contraindicações. Não há alteração de grants ou schema.

Contexto pediátrico confirmado e resultados usados ficam no JSON cifrado das
avaliações antropométricas existentes, com versão explícita e chave de criação.
Reutilizar transação tenant, carteira, lock do paciente e idempotência da Fase313;
revalidar acesso antes de replay e não recalcular avaliações anteriores.

O acompanhamento usa projeção permitida executável e paginação SQL por
`avaliada_em/criado_em/id`; primeiro limita registros examinados, depois filtra
snapshots cifrados. O cursor avança pelo último examinado, incluindo páginas
sem pediatria; não filtrar PHI no SQL nem usar timestamp JavaScript como âncora.
Sem notas internas/fingerprint e sem novo portal para menores.

Enquanto G01/direitos estiverem bloqueados, nenhum serviço retorna escores, percentis
ou rótulos pediátricos. Não há client flag nem env para liberação. Candidatos
matemáticos isolados aceitam referências sintéticas, sem datasets de direitos
pendentes; os coeficientes INTERGROWTH estão apenas no teste de investigação,
excluído e verificado no build. Ativação futura requer artefatos/métodos/direitos,
ratificação humana e revisão de código, não mudança de configuração.

A migration1069 acrescenta proteção de retenção a avaliações confirmadas, sem
alterar1068 ou criar dados clínicos em claro. Exclusão lógica mantém snapshots.
Rollback de aplicação preserva dados; down1069 recusa enfraquecer proteção com
snapshots confirmados. Procedimentos de retenção/retificação autorizados e
aplicação por ambiente permanecem sujeitos aos gates de governança/operador.

## Fase314 REV14 — separar dependências factuais e de referências

Registro factual e CL08 dos seis métodos adultos desde18 não dependem de novos
artefatos OMS/SISVAN/INTERGROWTH. Classificadores experimentais continuam sem
consumidores assistenciais ou flag de ativação. G01/direitos bloqueiam esses
classificadores; revisão R4 independente, CI, provas de banco/ambiente e aceite
operacional bloqueiam a liberação factual. Fases seguintes independentes mantêm
seus próprios gates. Rollback preserva projeção v1/v2 e dados, sem remover1069.


## ADR-028 — Apresentação versionada de planos alimentares

As preferências de apresentação profissional/paciente são dados do snapshot da
versão, cifrados separadamente do cálculo e preservados na publicação. São
preferências visuais: não modificam conteúdo, porções, liberação de alternativas
ou autorização. Entrega e impressão paciente usam projeção explícita comum ao
portal; nunca a árvore interna do profissional ou ocultação apenas por CSS.

Gravação explícita confere identidade do rascunho e revisão monotônica sob as
travas transacionais existentes. Omissão legada preserva o snapshot. Revisão
zero identifica ausência legada; snapshot herdado começa revisão positiva para
que perda do cipher seja indisponibilidade, não fallback. Publicação inclui
preferências explícitas no hash conferido; versões antigas não são recalculadas.
Rollback de código conserva schema aditivo e snapshots; não remover histórico.

## Estado operacional de entrega dos planos e refeições

ON/OFF é estado do plano e da identidade lógica da refeição, separado das
versões clínicas. Desativar não arquiva, não apaga e não reescreve o snapshot ou
hash publicado. Plano OFF prevalece sobre refeições sem alterar seus estados.
Múltiplas publicações atuais de planos diferentes podem permanecer ativas.

Identidades de refeições sobrevivem ao autosave que recria linhas físicas e ao
clone dentro do mesmo plano. Vínculos explícitos por tenant/plano/versão e mapa
editorial cifrado evitam inferência entre versões por nome ou posição. Chaves
removidas permanecem internas para impedir reativação por reinserção; não são
projetadas fora da edição atual. Cópia entre planos cria identidades próprias.
O limite de aliases é verificado em entradas e bytes antes da persistência.

Decisões operacionais usam revisão própria e evento append-only na mesma
transação, inclusive ativação inicial ao publicar. No-op não avança revisão;
primeiro OFF anterior à publicação é decisão explícita. Escritores antigos sem
identidade não podem recriar refeições depois de uma decisão operacional.
Locks de paciente/plano serializam entrega, edição, publicação e escolhas;
leituras do portal revalidam usuário, tenant, paciente e publicação atual.

Totais históricos permanecem identificados como snapshots. Resumos vigentes
somam somente os snapshots dos alimentos efetivos, sem substituições/consumo e
sem consultar novamente o catálogo. Lacunas não viram zero. A prévia/impresso
para entrega ao paciente respeita ON/OFF; consulta histórica profissional é
separada. Documento já obtido fora do sistema não pode ser recolhido por ON/OFF.
Procedimento operacional e limite de rollback: RUNBOOK_PRODUCAO.md.

## FOOD01 — equivalência aplicada separada da biblioteca (em desenvolvimento)

A biblioteca de medidas é vinculada ao UUID exato de alimento do catálogo,
com tenant e proprietário profissional; escopo pessoal é o padrão e escopo de
clínica permite uso por colegas autorizados. Não agrupar alimentos por nome ou
reaplicar equivalências entre versões de fontes. Conteúdo livre e pedido
original são cifrados; endpoints projetam somente campos permitidos.

A seleção editorial envia identidade/revisão/nonce de aplicação, sem snapshot
numérico autoritativo. A primeira aplicação resolve autorização/fonte/revisão
na transação do rascunho; contexto cifrado/schema1 por chave do item preserva
as aplicações seguintes, mesmo se a biblioteca mudar. Reaplicação com nonce
novo revalida; exclusão de item elimina contexto reutilizável. Null explícito
desvincula; omissão legada preserva apenas quando identidade e fatos coincidem.

O profissional recebe a base mínima da referência aplicada para reabrir o
rascunho; publicações/portal/PDF recebem apenas suas projeções existentes.
Quantidade/peso em gramas têm limite e precisão explícitos; não há inferência
de densidade. Motor nutricional, CAS, criptografia e isolamento existentes
continuam autoritativos. Migration1075 só ensaiada em banco descartável neste
checkpoint; integração/CI/implantação são etapas separadas. Plano e limites em
`tasks/plan-pos-320-food01.md`.

## FOOD02 — alimento personalizado separado das fontes públicas

Biblioteca tenant-aware no módulo de planos, com escopo pessoal/clínica,
criador, revisão, idempotência e conteúdo cifrado; índices HMAC reutilizam o
mecanismo existente de busca. Custom não é fonte pública e não usa a FK de
`alimentos_composicao`. Não há dependência de TBCA, provider ou câmera.

Primeira aplicação editorial resolve acesso/revisão sob lock e normaliza a base
informada. Mapa cifrado por item/identidade/revisão/nonce preserva a composição
usada; biblioteca alterada não recalcula rascunhos nem publicações. Reaplicação
exige acesso atual. Omissão legada só preserva fatos iguais, null desvincula e
escritor clínico que descartaria contexto recebe409. Cópias preservam fatos sem
capacidade privada. Publicações usam projeção factual explícita para custom,
sem alterar a projeção/hash legado; não confundir tipos com ocultação runtime.

Medidas FOOD01 admitem pai público OU personalizado, com FK composta e XOR.
Pai pessoal não pode ser exposto por medida da clínica. Composição é resolvida
antes de conversão de medida. Normalização guarda originais/base/versão; ausência
não vira zero e completude editorial não equivale a completude clínica. Escopo,
contratos e limites em `tasks/plan-pos-320-food02.md`; operação no runbook.
