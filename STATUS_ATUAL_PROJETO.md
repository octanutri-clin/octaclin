# OctaClin - Status atual do projeto

Atualizado em 2026-08-13.

## Snapshot

- Produto: OctaClin.
- Repositorio: `octanutri-clin/octaclin`.
- Branch principal: `main`.
- Fase 229 implementada e aprovada localmente: BFF fail-closed, protecao de
  mutacoes por origem/Fetch Metadata, headers globais, notificacoes por classe,
  Dependabot e auditoria operacional. Falta confirmar CI e deploy antes de
  encerrar a fase. O Mobile Expo 52 permanece fora da oferta e bloqueado pela
  Fase 241 devido a dependencias transitivas vulneraveis.
- Fase 240 concluida: regressao do `main` corrigida, CI ampliado para 122
  suites/829 testes backend, dependencias web corrigidas e cron de backup
  reabilitado. O CI `31713367178` e o backup/restore canario `31713397791`
  passaram sobre o commit `5a87461`.
- Fase 224 - oferta comercial e ativacao assistida concluida. O pacote
  Profissional foi aceito a R$ 99 trimestral/R$ 119 mensal; Clinica a R$ 199
  trimestral/R$ 249 mensal. O inicio usa PIX antecipado, demonstracao
  sintetica, cancelamento com aviso de 30 dias, migracao por escopo, WhatsApp
  fora da oferta e acompanhamento reforcado de 48 horas.
- Fase 223 - verdade operacional do go-live. Os documentos operacionais foram
  reconciliados com as evidencias das Fases 200 a 222: producao isolada,
  anexos, billing manual, backups, observabilidade, Calendar/Gmail e smokes de
  leitura estao entregues. Permanecem gates para clientes reais: dominio e
  identidade de envio, aceite juridico, jornadas mutaveis em staging,
  onboarding/suporte e WhatsApp se contratado na oferta inicial. O gateway de
  pagamento nao bloqueia o primeiro piloto assistido porque ja existe controle
  manual de assinatura e limites.
- Auditoria transversal de acesso do profissional concluida em 2026-08-08.
  IA assistida e metas/adesao, ja implementadas e autorizadas, voltaram a ser
  encontraveis no menu e na paleta de comandos. A agenda passou a exibir o
  resumo de recebimentos do proprio profissional quando permitido, sem expor a
  comparacao da clinica. O artefato do backend tambem foi corrigido para voltar
  a produzir `dist/main.js` em build limpo, com uma verificacao obrigatoria no
  script de build. Backend e web estao `Live` no commit `ed5ae4f`; smoke publico
  de saude, rota protegida e login aprovado. O aceite autenticado confirmou o
  menu, IA, metas/adesao, recebimentos proprios e a ausencia de entradas de
  outros papeis. Ver
  `AUDITORIA_ACESSO_PROFISSIONAL_2026-08-08.md`.
- Fase 218 - API publica, chaves por tenant e webhooks.
  API `/v1` com escopos e rate limit, idempotencia por referencia externa,
  webhooks HMAC com outbox resiliente e gestao pelo portal `Client`. Migration
  `1022` validada em producao (35/35), backend/web publicados no commit
  `9572704` e smoke de chave confirmou `200/403/401`. Ver
  `fase-218-api-publica-chaves-webhooks.md` e `API_PUBLICA_V1.md`.
- Fase 220 - observabilidade e alertas externos. O
  GitHub Actions verifica readiness, dependencias e login a cada 30 minutos,
  abre incidentes deduplicados para saude ou backup e os fecha na recuperacao.
  A execucao real `31346835747` passou na primeira tentativa e o cron foi
  habilitado somente depois do aceite manual.
- Ultima fase concluida: Fase 222 - confiabilidade Google Agenda e Gmail. O
  espelhamento inbound passou a usar carga inicial limitada, `syncToken`, janela
  movel e reconciliacao manual; a Gmail API recebeu OAuth de producao renovado
  e aceitou envio real. O backend opera como `all` enquanto o worker dedicado
  estiver adiado, e o health detalhado ficou integralmente `ok`. Ver
  `fase-222-confiabilidade-google-agenda-gmail.md`.
- Fase 219 - backup automatizado, retencao e restore recorrente. Role Neon
  dedicada, banco de restore, bucket B2 privado, lifecycle 8/29/93, GitHub
  Environment e cron estao ativos. As execucoes `31346127174` e `31346290507`
  aprovaram dump, checksum, AES256, upload, download, restore, migration, dados
  essenciais e RLS.
- Fase 217 - PWA do portal do paciente. O portal e
  instalavel, mantem somente recursos publicos no cache e oferece fila offline
  cifrada e idempotente para check-in e formulario sem anexo. Nenhum dado
  clinico, HTML autenticado ou API protegida entra no Cache Storage. Ver
  `fase-217-pwa-portal-paciente.md`.
- Fase 216 - plano alimentar e calculo nutricional. Profissional monta, revisa,
  publica e versiona planos no prontuario; o
  paciente recebe somente a versao publicada atual no portal. Calculo
  energetico e composicao rodam no backend, com fonte/versao, snapshots
  criptografados, confirmacao clinica e bloqueio de condicoes especiais neste
  MVP. Catalogo TACO versionado com 583 alimentos. Migration `1021` e catalogo
  validados no banco de integracao, agora com 34/34 migrations. Em 2026-08-08,
  a migration `1021` e o TACO com 583 alimentos tambem foram validados em
  producao, incluindo RLS, policies, triggers e indices. 107
  suites e 770 testes backend, typechecks, lint, authz, Next 15 e builds
  aprovados. Ver `fase-216-plano-alimentar-calculo-nutricional.md`.
- Fase 211 - importacao em massa e exportacoes do
  cliente, em 2026-08-06. Clinica com carteira formada passou a migrar por
  planilha: importacao em duas etapas onde a previa valida e devolve o relatorio
  **sem gravar nada**, e o relatorio traz **uma entrada por linha do arquivo**,
  inclusive as recusadas, com o numero da linha original — linha invalida que
  some sem aviso e o pior resultado possivel de uma importacao. O leitor aguenta
  planilha suja de verdade (BOM do Excel, CRLF, separador `;` do pt-BR, tab,
  campo citado com quebra de linha dentro, cabecalho acentuado). Deduplicacao por
  nome normalizado + data de nascimento **dentro da carteira do profissional
  responsavel**, entao reimportar o mesmo arquivo nao cria nada e paciente de
  outro profissional nunca e revelado como "duplicado". Professional so importa
  para a propria carteira: o `profissionalResponsavelId` do corpo e ignorado.
  Freios de abuso: `pacientes.gerenciar` na rota, 500 linhas por requisicao, 1 MB
  de corpo, e o excedente do plano marcado como `limite_plano` em vez de estourar
  o limite. Exportacao de pacientes, respostas de formulario e agenda saiu
  **reaproveitando a listagem que ja tem o escopo**, e nao uma consulta paralela;
  o CSV da agenda descarta bloqueio do Google, que existe no feed so como
  "Indisponivel" para nao vazar compromisso pessoal. Toda exportacao registra na
  auditoria o volume levado, nao so o clique. O CSV do produto virou fonte unica
  com defesa contra injecao de formula (`=HYPERLINK` num nome de paciente
  executava ao abrir a planilha). Criterio de aceite coberto por teste: 200
  pacientes com 5 linhas invalidas produzem 195 criados e as 5 linhas
  identificadas. 679 testes de backend em 98 suites, typecheck, lint,
  `test:authz`, `test:next15` e build web aprovados. Sem migration. Ver
  `fase-211-importacao-massa-exportacoes-cliente.md`.
- Fase 210 - notificacoes in-app e tempo real, em
  2026-08-06. O sino do console deixou de ser um link estatico e passou a contar
  de verdade: centro de notificacoes por usuario com estado lido/nao lido para
  mensagem recebida, solicitacao publica de agendamento, formulario respondido e
  falha de envio. A tabela `notificacoes` (migration `1720000001020`, RLS
  forcada) grava **uma linha por usuario destinatario** e **nao tem coluna de
  titulo nem de corpo** — o texto vem do tipo na interface e o nome do paciente e
  resolvido na leitura, sob o escopo de quem le, para o centro de notificacoes
  nao virar uma segunda copia em claro do que a Fase 208 passou a cifrar. Quem
  recebe e funcao pura testada: SuperAdmin e Collaborator veem tudo do tenant,
  Professional so o proprio escopo, e evento **sem** dono identificado nao vai
  para profissional nenhum, em vez de ir para todos. Na leitura o filtro e o
  `usuarioId` do JWT, inclusive ao marcar como lida. Indice unico por evento com
  `orIgnore` impede que webhook reentregue da Meta infle o contador, e a
  publicacao entra na mesma transacao do fato de origem. **SSE foi trocado por
  polling** (5s no sino, 20s nos paineis) por decisao explicita: a Fase 201 esta
  com rollout pendente e o backend roda em uma instancia, entao o fan-out via
  Redis nao teria funcao, e SSE aberto por aba manteria a instancia Render
  acordada 24/7. Poll so com aba visivel e falha de poll nao pinta erro na tela.
  620 testes de backend, typecheck, lint, `test:authz` e build web aprovados. O
  rollout de producao aplicou `1015` a `1020` apos backup validado e confirmou
  RLS, policies, indices, `/health` e `/health/detalhado`. Ver
  `fase-210-notificacoes-in-app-tempo-real.md`.
- Fase 209 - financeiro da consulta e pacote de sessoes,
  em 2026-08-05. A consulta passou a ter valor, forma de pagamento e status
  (pendente/pago/isento), com **dinheiro em inteiro de centavos em todo lugar** —
  nenhuma casa decimal atravessa servico, banco ou HTTP, porque `0.1 + 0.2`
  fecharia o mes errado por centavos que ninguem explica. O banco guarda duas
  invariantes que o servico sozinho nao garante: "pago" exige data de pagamento
  (pago sem data nao concilia), e consulta de pacote nao pode ter valor proprio
  (faria o mesmo atendimento entrar duas vezes no total do mes). Consulta
  cancelada nunca entra no faturamento, e consulta isenta conta como atendimento
  sem virar "a receber" que ninguem vai cobrar. O recibo entrou como terceiro
  tipo do gerador da Fase 208, **sem codigo de geracao novo**, com indice unico
  parcial por consulta e emissao so a partir de pagamento registrado. Pacote de
  sessoes chegou como agrupador opcional: `falta` consome sessao, `cancelada`
  devolve a vaga, consulta agendada ja conta como reservada — pacote de 10 nao
  aceita a 11a — e pacote vencido nao recebe consulta nova. Aba Financeiro em
  `/cliente` fecha o periodo com recebido, a receber e quebra por profissional,
  com consultas e pacotes em linhas separadas. Permissao nova
  `agenda.financeiro.ler`: a recepcao registra pagamento mas nao ve o faturamento
  da casa, e Professional so ve o proprio (o escopo sobrescreve o filtro pedido
  pelo cliente). Gateway e NFS-e ficaram fora de proposito. 596 testes de
  backend, typecheck e lint aprovados. Ver
  `fase-209-financeiro-consulta-pacote-sessoes.md`.
- Fase 208 - documentos clinicos gerados, em 2026-08-05.
  O produto passou a emitir declaracao de comparecimento e relatorio de alta com
  a identidade da clinica, auditoria em toda rota (inclusive na leitura) e
  impressao/PDF pelo navegador, **sem nenhuma biblioteca de PDF**. Dois tipos com
  modelo padrao em codigo e override por tenant em `tenant_configuracoes` — sem
  tabela de modelos, entao clinica nova emite no primeiro dia. Tabela
  `documentos_emitidos` append-only com RLS forcada guarda o texto renderizado,
  nao modelo mais variaveis: modelo editado depois nao reescreve documento que ja
  esta com terceiro. Declaracao so sai de consulta concluida, e o banco tambem
  segura isso (CHECK e indice unico parcial por consulta). Atestado ficou de fora
  de proposito: e ato privativo de medico e o produto atende tambem
  nutricionista, psicologo e educador fisico. A revisao clinica pegou tres altos
  — documento saindo sem nome e registro do profissional (com o aviso invisivel na
  folha, por causa da classe `nao-imprimir`), relatorio de alta somando consultas
  e metas de todos os profissionais da clinica, e alta podendo sair sob o
  registro de um profissional escrita por outro. A revisao de seguranca achou um
  defeito compartilhado corrigido na origem: o adaptador SMTP reexpandia
  variaveis sobre texto ja renderizado, e a agenda usava o mesmo caminho — nome de
  paciente contendo `{{linkTeleconsulta}}` vazaria o link da sala. Em seguimento
  imediato, ainda antes da 209, `mensagens_notificacao` ganhou
  `conteudo_criptografado`: texto, assunto, nomes e link de teleconsulta sairam
  do jsonb em claro, com allowlist do que fica legivel para a infra rotear e
  consultar. Isso alcancou tambem a agenda, que gravava nome e texto em claro
  desde a propria fase, e a mensagem recebida do paciente pelo WhatsApp. 568
  testes de backend, 140 de regressao visual/a11y, lint/typecheck/build
  aprovados. Ver `fase-208-documentos-clinicos-gerados.md`.
- Fase 207 - antropometria e evolucao de medidas, em
  2026-08-05, em duas rodadas. O produto passou a ter peso, altura,
  circunferencias, dobras e composicao corporal por 5 protocolos (Pollock 3 e 7
  dobras, Faulkner, Guedes, com Siri), IMC classificado por faixa etaria
  (Lipschitz para 60+, como o SISVAN), RCQ e circunferencia de cintura. A
  avaliacao e append-only: calcula uma vez na gravacao e guarda protocolo,
  formula, sexo e idade junto, entao o historico nunca recalcula. Aba de
  antropometria no prontuario e curva de peso no portal do paciente. O primeiro
  grafico do repositorio (`components/ui/grafico-evolucao.tsx`) e SVG inline,
  **sem dependencia nova**, serie unica com seletor de metrica — decidido pelo
  validador da skill `dataviz`, que reprovou a paleta categorica da Fase 202 no
  teste de daltonismo. Revisao clinica confirmou todos os coeficientes e sitios
  de dobra, e pegou dois criticos de borda (Pollock invertendo em obesidade
  grave e um limiar de RCQ sem fonte). Corrigido de quebra um vazamento anterior
  a fase: `scoreRisco` ia no payload do portal do paciente, contra a regra da
  Fase 161. 515 testes de backend, 138 de regressao visual/a11y,
  lint/typecheck/build aprovados. Ver
  `fase-207-antropometria-evolucao-medidas.md`.
- Fase 206 - teleconsulta por link na consulta, em
  2026-08-04. A consulta ganhou modalidade (`presencial`/`online`) e link de
  sala externa, sem construir plataforma de video — decisao registrada como
  ADR-020. Dominio puro `agenda/dominio/teleconsulta.ts` aceita apenas `https`
  e libera o link ao paciente somente de 1 hora antes ate 30 minutos depois do
  fim, nunca em consulta cancelada ou encerrada; fora da janela o link nem sai
  do backend. Consulta presencial nunca guarda link, invariante travada por
  CHECK na migration `1720000001015`. O link acompanha a confirmacao, o
  lembrete de 24h e o evento Google do profissional, e fica fora de log,
  auditoria e mensagem de cancelamento. Painel da agenda troca Local por Link
  da sala conforme a modalidade, com copia rapida; portal do paciente mostra
  "Entrar na consulta" apenas dentro da janela. A revisao de seguranca pegou um
  achado alto que a fase tornou caro: a rota de desmarcar do portal devolvia ao
  paciente o DTO completo do console (link cru fora da janela, mais
  `emailContato`, `whatsappContato` e ids do Google no `payload`); agora devolve
  so `{ id, status }`. 475 testes de backend, 136 de regressao visual/a11y,
  lint/typecheck/build aprovados. Ver `fase-206-teleconsulta-por-link.md`.
- Fase 205 - recall automatico de retorno, em
  2026-08-03. Gatilho de inatividade (`paciente.inativo`) somado ao motor de
  automacoes: seleciona pacientes sem consulta concluida ha N dias, restrito
  ao profissional dono da regra e a quem aceita receber mensagens, com
  simulacao obrigatoria que lista nominalmente quem seria contatado e o motivo
  de cada exclusao. Teto comercial contra spam (intervalo minimo entre recalls
  e limite por rodada, presos em faixa no servidor). Cron diario para a rodada
  real; leitura de preferencias de comunicacao virou dominio compartilhado com
  os lembretes de agenda. Revisoes de falha silenciosa (3 achados corrigidos,
  um critico) e de seguranca (sem achados criticos/altos) executadas.
  Rodada extra no mesmo dia fechou o achado de timeout dos crons:
  `infraestrutura/processamento/rodada-por-tenant.ts` passou a concentrar o
  laco por tenant dos 5 processadores agendados, com isolamento de falha e
  timeout. Dois deles (agendamentos de questionario e outbox de comunicacoes)
  nao tinham isolamento nenhum e abortavam a rodada inteira na primeira
  excecao, deixando os tenants seguintes sem processamento.
  457 testes de backend, 84 de regressao visual, a11y 10/10, lint/typecheck/
  build aprovados. Ver `fase-205-recall-automatico-retorno.md`.
- Fase 204 - data fetching e resiliencia (escopo de
  resiliencia), em 2026-08-03 (2 rodadas). Hook `useRequisicaoCancelavel`
  (AbortController + sequencia) extraido, validado com teste de race
  condition, e aplicado em todo loader com risco real de sobreposicao de
  requisicoes: `portal-cliente.tsx` (5 loaders), `agenda-semanal.tsx`
  (feed), `painel-operacoes.tsx` (9 loaders / 7 endpoints) e
  `portal-paciente.tsx` (detalhe de formulario). `error.tsx`/`loading.tsx`
  na raiz; 2 Suspense com fallback nulo corrigidos; 2 estados derivados
  movidos para render. Lint, typecheck, build, test:a11y (10/10) e 90
  testes Playwright aprovados nas duas rodadas. Fora de escopo (sem risco
  de corrida ou exigem refactor maior): next/dynamic no portal do paciente,
  Server Components para cliente/operacoes. Ver
  `fase-204-data-fetching-resiliencia-code-splitting.md`.
- Fase 203 - componentes compartilhados e fim dos
  sistemas paralelos, em 2026-08-03 (2 rodadas). 7 componentes novos
  (Aviso, EtiquetaStatus, Avatar, Dica, Menu, CabecalhoSecao, Metrica),
  zero `window.confirm` no repo, botoes ad hoc unificados via
  `classesBotao`, Aviso/Metrica adotados nos pontos citados no
  diagnostico, tooltips migrados para Dica; lint, typecheck, build,
  test:a11y (10/10) e 88 testes Playwright de regressao aprovados. Debito
  tecnico de baixo risco (nao bloqueia producao): linhas de 1000+
  caracteres de `painel-dashboard.tsx`, adocao ampla de CabecalhoSecao. Ver
  `fase-203-componentes-compartilhados-fim-sistemas-paralelos.md`.
- Fase 202: sistema visual (tokens, tipografia e
  elevacao), em 2026-08-02. Tokens semanticos, escala tipografica/raio/sombra,
  troca para IBM Plex Sans+Mono, cartao/sidebar/botao/agenda atualizados; lint,
  typecheck, build, gate de acessibilidade (10/10) e regressao do portal do
  cliente (8/8) aprovados. Ver `fase-202-sistema-visual-tokens-tipografia-elevacao.md`.
- Fase 200: upload seguro e anexos clinicos, em 2026-08-02. O bucket privado
  Backblaze B2, os fluxos autenticado e publico e a exclusao foram validados
  em producao. A migration `1014` esta aplicada em producao e no banco de
  integracao `octaclin_test_fase150b`, com historico de 27 de 27 migrations
  executadas.
- Fase 201: implementacao local concluida em 2026-08-02. O rollout ainda exige
  separar o backend Render como `web` e criar um `worker` com Redis compartilhado
  antes de permitir escala horizontal; ver
  `fase-201-confiabilidade-processadores-multiplas-instancias.md`.
- Fase 194: formularios, editor e leitura longitudinal (2026-08-01). O editor
  de questionarios (1593 linhas
  monoliticas) foi dividido em 5 areas (Formularios/Editor/Biblioteca/
  Distribuicoes/Respostas) sobre um hook unico de estado
  (`useWorkspaceQuestionarios`); o preview do paciente passou a ser
  simultaneo a edicao; o campo de cron cru virou um seletor de recorrencia
  em linguagem comum; e a guarda de alteracoes nao salvas (que so tinha
  banner de texto) ganhou `beforeunload` + confirmacao real, como na Fase
  193. Cobertura Playwright nova para essa pagina (0 testes antes, 6 agora).
- Fase 193: pacientes e prontuario orientados a conduta (2026-07-31).
  Filtros da lista de pacientes agora persistem na URL; cadastro/edicao de
  paciente virou modal; evolucao clinica em edicao ganhou protecao contra
  perda (beforeunload + confirmacao ao trocar de aba/sair). Corrigidos os
  atalhos `#novo-paciente`/`#novo-agendamento` do dashboard.
- Fase 192: centro clinico diario e agenda profissional (2026-07-31).
  Dashboard reagrupado em Agora/Proximos/Pendentes; agenda com criacao em
  modal, edicao consolidada num unico botao "Gerenciar consulta" e
  confirmacao ao liberar horario reservado. Corrigido tambem um bug de mobile
  no componente `Modal` compartilhado (sem scroll/max-height).
- Fase 191: acesso e ativacao do usuario (2026-07-31). Login, recuperacao de
  senha e primeiro acesso do paciente compartilham um shell de autenticacao
  unico, com mostrar/ocultar senha, aviso de Caps Lock, tratamento unificado
  de link expirado/invalido e ativacao do paciente em 2 etapas (senha, aceites
  legais).
- Fase 190: arquitetura de navegacao e sistema visual definitivo (2026-07-31).
  O console separa Clinica, Relacionamento, Gestao e SuperAdmin, com contexto
  da sessao e atalhos por permissao.
- Fase 148: Foco visivel proprio nos componentes compartilhados `Campo`/`AreaTexto`/`Selecao`/`Botao` (entregue em 2026-07-27, PR #5 aberto para `main`).
- Fase 147: Foco visivel explicito nos inputs crus da agenda (entregue em 2026-07-27). Antes dela, esta branch recebeu por merge a Fase 146 (gate de acessibilidade, feita pelo Codex na `main`).
- Fase 145: Painel clinico do profissional e desmarcamento/cancelamento distintos (entregue em 2026-07-27, commit `22e161b` da Task 5).
- Fase 131 aceita: producao isolada de staging confirmada em 2026-07-26, com Neon, Upstash e Render independentes, credenciais rotacionadas e ambiente/banco auditados sem staging. A integracao Google Calendar de producao foi posteriormente configurada, conectada e validada.
- Melhoria continua: Fases 138, 141 e 142 concluidas. NestJS 11.1.28, TypeORM 1.1.0 e Next.js 15.5.22 foram validados; as auditorias de producao de backend e web estao zeradas. A proxima migracao de framework sera Next.js 16/React 19, em fase dedicada por exigir refatoracao assincrona do BFF.
- Fase 139 concluida: contratos de agenda e convite administrativo passaram a ser tipados sem `any` em codigo de producao; o BFF preserva uma fronteira central para sessao, renovacao e falhas de backend.
- Fase 140 concluida: matriz rastreavel de riscos, testes e gates para tenant, autorizacao, BFF, integracoes, portal e operacoes.
- Fase 143 concluida: convites `Professional` agora criam o perfil clinico vinculado ao login, deixando agenda, escopo de dados e Google Calendar prontos apos o primeiro acesso.
- Fase 144 concluida: agenda publica por solicitacao entrou no fluxo critico com aprovacao manual segura. A solicitacao publica nao reserva horario, a aprovacao exige paciente explicito do tenant e consulta/notificacoes continuam sendo geradas apenas pela criacao normal da agenda. O token bruto do link nao e persistido e a URL copiavel requer rotacao confirmada em sessao nova.
- Fase 142 concluida: APIs dinamicas do App Router foram migradas para `Promise`/`await`, com gate de regressao, build de producao validado e auditoria web sem vulnerabilidades.
- Fase 145 concluida: painel clinico diario por profissional (filas de retorno,
  risco, tarefas, formularios, solicitacoes publicas e comunicacoes) e a agenda
  passou a distinguir cancelamento pelo profissional (notifica o paciente),
  desmarcamento pelo paciente (alerta nao-PHI ao profissional, sem notificar o
  proprio paciente) e cancelamento originado no Google (sem novo envio).
- A antiga Fase 132 foi substituida pela Fase 225. A Fase 229 esta em aceite de
  deploy; depois dela, a proxima fase executavel sem dominio e a Fase 231,
  seguida da Fase 228 ampliada.
- Estado: producao tecnica acessivel, mas ainda nao liberada para clientes reais.

## O que esta funcional

- Login unificado por perfil.
- Permissoes finas para Client, Professional e Collaborator.
- Ajuste auditado entre acesso profissional e equipe administrativa.
- BFF com cookies HttpOnly.
- Roteamento por papel.
- Console operacional.
- Dashboard inicial do profissional.
- Cadastros de pacientes e profissionais.
- Prontuario/linha do tempo do paciente para profissional.
- Evolucoes/anotacoes clinicas privadas no prontuario.
- Planos de acompanhamento com tarefas/metas/check-ins prescritos no prontuario.
- Biblioteca de materiais educativos e envio de materiais ao paciente pelo prontuario.
- Questionarios, modelos, preview, respostas e leitura clinica.
- Portal autenticado do paciente.
- Historico, perfil, LGPD e protocolos no portal do paciente.
- Portal do cliente.
- Resumo real da conta do cliente.
- Configuracoes da conta do cliente.
- Perfil fiscal da empresa/consultoria do cliente.
- Gestao de usuarios administrativos do cliente.
- Convites administrativos por email.
- Reenvio e revogacao de convites administrativos.
- Historico e exportacao CSV de convites administrativos.
- Modelo de planos SaaS por tenant.
- Calculo de uso, limites e alertas de assinatura no portal do cliente.
- Solicitacao comercial manual de upgrade/revisao de limite no portal do cliente.
- Controle manual administrativo de assinatura no painel operacional.
- Bloqueios suaves de assinatura/limite para novas criacoes de usuarios administrativos e pacientes.
- Agenda interna com integracao Google Calendar.
- Agenda com conflito local por profissional, remarcacao e cancelamento sincronizados com Google Calendar quando configurado.
- Agenda publica por solicitacao, com link compartilhavel, fila interna de aprovacao manual e criacao de consulta so apos selecao explicita de paciente.
- Comunicacoes por email.
- WhatsApp Meta com envio, webhook, status, inbox, associacao e notas.
- Portal do paciente instalavel como PWA, com operacoes offline transitorias e
  cifradas para check-in e formulario sem anexo, sem cache clinico persistente.
- Painel operacional LGPD.
- Auditoria e outbox operacional.
- Sugestoes assistidas de IA com fonte, limitacoes e revisao humana obrigatoria.
- Automacoes em rascunho com simulacao persistida antes da ativacao.
- Gamificacao opcional por tenant, com comunidade e ranking desligados por padrao.
- Operacoes SuperAdmin separadas em Saude, Incidentes, Comunicacoes, LGPD,
  Auditoria e Filas; sincronizacao mobile fica nessa area administrativa.
- Runbooks de producao, backup/restore, rotacao de secrets e suporte.
- Suite Playwright de jornadas criticas com contratos BFF mockados.
- Massa ficticia de staging aplicada e validada no Neon staging (tenant `octaclin-staging`).
- Piloto interno controlado: runbook, controle de acompanhamento, validador documental e rodada 1 aprovada em 2026-07-23.
- Escopo de dados por profissional responsavel (`pacientes_responsaveis`) aplicado e testado em pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes.
- Producao isolada de staging: banco Neon, Redis Upstash e servicos Render de producao aceitos; runtime, secrets exclusivos e ausencia de staging foram revalidados na Fase 131.
- Sincronizacao em tempo real com a Google Agenda pessoal do profissional (Fase 136, 2026-07-25): conexao OAuth individual por profissional, notificacao push do Google, eventos externos viram bloqueio de horario, mudancas feitas direto no Google aplicam automaticamente na consulta correspondente.
- CI do GitHub verde em `701ed6b` (2026-07-26): backend, web, mobile, IA e demo local smoke, incluindo UI, BFF e Playwright.
- Gate de qualidade web: lint nao interativo com as regras estritas recomendadas pelo Next.js, typecheck, build e teste de autorizacao de rotas; o lint agora tambem e exigido no CI.
- Regressao critica de agenda em 2026-07-27: 8 testes Playwright aprovados em desktop/mobile, incluindo a nova jornada publica -> aprovacao interna -> portal do paciente.

## O que ainda falta antes de producao real

- Gateway de pagamento definitivo, se a operacao manual deixar de ser suficiente.
- Recorrencia avancada e importacao inbound do Google Calendar por `syncToken`.
- Recorrencia operacional de backup e restore semanal conforme o runbook.
- Producao isolada de staging.
- Dominio, SSL e identidade de envio.
- Aceite juridico formal, identidade empresarial, canal de privacidade e publicacao das versoes legais.
- Go-live assistido.
- Migracao futura para Next.js 16/React 19, incluindo a remocao do shim temporario de cookies usado no BFF.

## Ambientes e provedores

- GitHub privado como fonte de verdade.
- Render para hospedagem.
- Neon PostgreSQL para banco.
- Upstash Redis para Redis/fila/cache.
- Gmail SMTP/Gmail API para email.
- Meta WhatsApp Cloud API para WhatsApp.
- Google Calendar para agenda.

## Arquivos essenciais

- `AGENTS.md`: guia para agentes de IA.
- `RESUMO_FASES_CONCLUIDAS.md`: retrospectiva.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: roadmap vivo.
- `DIAGNOSTICO_MELHORIAS_FASES_199_218.md`: diagnostico de design, frontend e
  produto feito em 2026-08-01 sobre o codigo real, com as Fases 199 a 218 em
  ordem de prioridade, skill/agente por fase e decisoes de "nao fazer".
- `PREFLIGHT_PRODUCAO.md`: prontidao por area e gates de fase.
- `HANDOFF-TECNICO-OCTACLIN.md`: handoff tecnico.
- `DECISOES_ARQUITETURA.md`: decisoes.
- `MAPA_ROTAS_PERMISSOES.md`: rotas e permissoes.
- `TESTES_E_VALIDACOES.md`: comandos de validacao.
- `RUNBOOK_PRODUCAO.md`: operacao.
- `RUNBOOK_BACKUP_RESTORE.md`: backup PostgreSQL/Neon e restore de teste.
- `RUNBOOK_SUPORTE.md`: suporte para login, convites, senha, WhatsApp, email e agenda.
- `RUNBOOK_STAGING_DADOS.md`: massa ficticia de staging para demonstracao e QA.
- `RUNBOOK_PILOTO_INTERNO.md`: processo do piloto interno controlado antes da producao real.
- `PILOTO_INTERNO_CONTROLE.md`: acompanhamento vivo da rodada atual do piloto interno.
- `RUNBOOK_PRODUCAO_ISOLADA.md`: como criar banco, Redis e servicos Render de producao separados de staging.
- `PRODUCAO_ISOLADA_CONTROLE.md`: acompanhamento vivo do provisionamento de producao isolada.
- `VARIAVEIS_AMBIENTE.md`: env vars sem secrets.
- `CHECKLIST_GO_LIVE.md`: liberacao para clientes reais.
- `ONBOARDING_DESENVOLVEDOR.md`: entrada de novos desenvolvedores/agentes.
- `COORDENACAO_DESENVOLVIMENTO_IA.md`: regras para trabalho alternado entre pessoas e IAs.
- `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md`: pacote multifase para o desenvolvedor seguir enquanto outros agentes ficam pausados.
- `MENSAGEM_HANDOFF_DESENVOLVEDOR.md`: texto pronto para repassar o contexto do projeto.
- `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md`: ferramentas, plugins e acessos recomendados.
- `DEVELOPMENT_LOG.md`: diario curto de fases concluidas por desenvolvedores/agentes.
- `RETORNO_APOS_DESENVOLVEDOR.md`: checklist para retomada apos trabalho externo.

## Risco principal atual

O sistema ja tem muita capacidade funcional, piloto interno aprovado, producao
isolada aceita e pacote juridico ampliado. O backup automatico foi reabilitado
e validado com restore canario na Fase 240. Antes de clientes reais, ainda
faltam o aceite remoto do fechamento de seguranca, staging mutavel confiavel,
onboarding/suporte, dominio/identidade de envio, aceite juridico formal e
go-live assistido.

Proximo passo recomendado: encerrar o deploy da Fase 229 e executar as Fases
231 e 228 antes de preparar
dominio, identidade de envio e go-live assistido.
Permanece como melhoria operacional futura o rollout da Fase 201 no Render (separar
os papeis `web` e `worker` e registrar a entrega sintetica unica exigida pelo
aceite).
