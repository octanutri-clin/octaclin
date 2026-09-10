# Fase 256 - Formularios e check-ins ponta a ponta

Desbloqueada em 2026-09-10 pelo merge do PR GitHub `#222` (PR 54 de
governanca) e pela reconciliacao factual do SQ-4 (PR GitHub `#215`). Fase
essencial, pre-piloto, sem migration ate o momento. Em andamento: este
documento cobre a auditoria inicial e o Incremento 1; os demais incrementos
identificados no plano abaixo permanecem pendentes.

## Auditoria inicial

O fluxo pedido (criacao, biblioteca, versionamento, distribuicao, rascunho do
paciente, retomada, envio, leitura clinica, matriz longitudinal e registro no
prontuario) **ja existe quase por completo** no modulo
`octaclin-backend/src/modulos/questionarios` e nas rotas/paginas
correspondentes em `octaclin-web` (`/questionarios`, `/formularios/[token]`,
`/portal/formularios`, `/portal/checkins`). Isso foi construido de forma
incremental desde as fases iniciais do produto (ver `RESUMO_FASES_CONCLUIDAS.md`,
fases 2, 23, 69-77, 170, 174-176, 182-183, 194) e ja documentado no proprio
`CHECKLIST_FASES_FUTURAS_PRODUCAO.md` como pendente de **validacao**, nao de
implementacao nova.

Confirmado por leitura de codigo e por execucao real de testes nesta fase
(dependencias instaladas e suites executadas nesta sessao, ja que o ambiente
nao tinha `node_modules`):

- Modelo de dados completo (8 tabelas, RLS/FORCE RLS por tenant, indices) para
  categorias, questionarios, perguntas, opcoes, agendamentos, envios,
  respostas e valores.
- CRUD completo, biblioteca de perguntas reutilizaveis, 3 modelos prontos,
  duplicacao e arquivamento.
- Versionamento por contador incremental (`questionarios.versao`) combinado
  com snapshot congelado por envio (`envios_questionario.snapshotEstrutura`):
  cada distribuicao amarra a resposta a estrutura vigente no momento do
  envio, preservando integridade historica sem precisar migrar respostas
  entre versoes.
- Distribuicao manual e por agendamento recorrente (cron + timezone).
- Fluxo publico por token: consulta, salvar rascunho com controle otimista
  (`versaoBase`), retomar rascunho, enviar resposta final, upload de anexo
  com confirmacao, fila offline PWA cifrada.
- Leitura clinica (resumo agregado, distribuicao por pergunta, textos
  recentes) e revisao com auditoria (`revisadoEm`/`revisadoPorUsuarioId`).
- Matriz longitudinal (atual vs. anterior por indicador/paciente/questionario/
  categoria/periodo) e exportacao CSV.
- Slot de timeline/prontuario ja mapeando `formulario`, `resposta_formulario`
  e `checkin_rapido` (`servico-pacientes.ts`, `linha-do-tempo-prontuario.tsx`).
- Rotas BFF autenticadas e publicas corretas (authz/permissao no servidor).
- Cobertura de acessibilidade (`tests/visual/acessibilidade.spec.mjs`) ja
  cobre `/formularios/:token` (padrao, PWA offline-first e upload),
  `/questionarios` (editor) e `/portal/checkins` com axe-core, navegacao por
  teclado, foco visivel e ausencia de overflow.

Lacunas confirmadas (nao presuncoes; verificadas lendo o codigo e a ausencia
de teste correspondente):

1. Nao havia evidencia atual de execucao das suites deste modulo (dependencias
   nao instaladas no ambiente desta sessao) — **resolvido nesta fase**, ver
   Validacao abaixo.
2. O carregamento inicial do formulario publico, ao falhar (backend
   indisponivel), repassava a mensagem crua do backend/proxy ao paciente sem
   sessao e nao oferecia recuperacao sem recarregar a pagina inteira —
   **corrigido no Incremento 1**.
3. Nao existe historico de versoes navegavel do questionario (apenas contador
   + snapshot por envio). E uma lacuna real, mas de escopo maior; nao faz
   parte do Incremento 1 — ver plano de incrementos.
4. Ambiguidade de nomenclatura entre "check-in rapido" (`logs_diario_rapido`,
   registro livre de humor/refeicao/agua) e "check-in via questionario"
   (`respostas_checkin`, resposta estruturada a perguntas): sao dois conceitos
   de dominio distintos com o mesmo rotulo de UI ("Check-in"). Isso e uma
   decisao de produto/nomenclatura, nao um bug — fica registrada aqui para
   decisao humana explicita antes de qualquer fusao ou rename; nao foi
   alterada nesta fase.

## Plano de incrementos verticais

- **Incremento 1**: validar ponta a ponta com evidencia real (dependencias
  instaladas, suites executadas) e fechar a lacuna de
  indisponibilidade/recuperacao no carregamento do formulario publico.
- **Incremento 2 (este commit)**: cobertura explicita de "indisponibilidade"
  no envio final de respostas e no salvamento de rascunho (distinta da fila
  offline PWA, que ja existe), preservando as mensagens de negocio seguras
  que o backend ja devolve.
- **Incremento 3 (este commit)**: historico de versoes navegavel do
  questionario, sem alterar o contrato de integridade historica existente
  (snapshot congelado por envio) nem exigir migration.
- **Decisao de produto (resolvida pelo dono do produto em 2026-09-10)**:
  "check-in rapido" (registro livre de humor/refeicao/agua/atividade) passa a
  se chamar **"Registro de habitos"**; "check-in via questionario" (resposta
  estruturada/distribuicao recorrente) passa a se chamar **"Retorno de
  avaliacao"**. Aplicado em commit separado apos o Incremento 3 — ver secao
  propria abaixo.

## Incremento 3 - Historico de versoes navegavel

Reaproveita a infraestrutura existente sem nova tabela nem migration: cada
`envio_questionario` ja congela `snapshotEstrutura` (versao, titulo,
descricao, perguntas) no momento do envio. O novo endpoint deduplica esses
snapshots por `versaoQuestionario`, soma quantos envios usaram cada versao e
inclui a versao atual (ao vivo, mesmo que nunca enviada) marcada `atual`.

- Backend: `ServicoQuestionarios.listarVersoesQuestionario` +
  `GET /questionarios/:id/versoes` (permissao `questionarios.ler`, mesma
  guarda de propriedade profissional/tenant que os demais endpoints de
  leitura). TDD: 4 testes escritos cobrindo versao atual sem envio, dedup de
  multiplos envios da mesma versao, envio legado sem snapshot (ignorado sem
  quebrar) e isolamento de tenant.
- Web: `lib/questionarios-api.ts` (`listarVersoesQuestionario`), BFF
  `app/api/questionarios/[id]/versoes/route.ts` (proxy autenticado, mesmo
  padrao de `respostas/route.ts`), estado e carregamento sob demanda em
  `usar-workspace-questionarios.ts`, e painel expansivel em
  `area-formularios.tsx` (botao "Histórico de versões" ao lado da etiqueta de
  versao atual; cada versao expande para mostrar titulo, descricao e lista de
  perguntas daquele momento). TDD: cenario Playwright cobrindo abrir o
  historico, ver a versao atual e uma anterior, e expandir para ver as
  perguntas congeladas daquela versao.

## Rename "check-in" -> "Registro de habitos" / "Retorno de avaliacao"

Decisao de produto explicita: dois conceitos distintos compartilhavam o
rotulo "Check-in" na interface, o que a propria auditoria desta fase
identificou como ambiguidade. Uma auditoria dedicada (Explore agent) mapeou
todo texto visivel com "check-in" em tres grupos: (A) o registro livre do
paciente (humor/refeicao/agua/atividade, tabela `logs_diario_rapido`), (B) a
distribuicao/resposta de questionario estruturado (tabela `respostas_checkin`/
`envios_questionario`), e (C) usos genericos/ambiguos ou de um terceiro
conceito nao coberto pela decisao (categoria de tarefa "Check-in" prescrita
pelo profissional; gatilhos de automacao; templates de comunicacao;
gamificacao; origem de analise de IA).

Apenas os Grupos A e B foram renomeados (texto visivel apenas: headings,
botoes, mensagens, rotulos de menu, aria-labels legiveis, descricao do
manifest PWA e da paleta de comandos, alem de dois literais de string do
backend que alimentam esse mesmo texto: `fonte`/`titulo` de indicadores e
eventos da timeline em `servico-pacientes.ts`/`dtos.ts`, ja que sao a origem
real do rotulo "Check-in rapido" mostrado no prontuario). Nenhum ID, enum de
tipo de evento, nome de tabela/coluna, rota ou contrato de API foi alterado —
so o texto humano que trafega nesses campos. O Grupo C foi deliberadamente
preservado (categoria de tarefa "Check-in" prescrita pelo profissional,
gatilhos de automacao, templates de comunicacao, gamificacao, origem de
analise de IA): nao faz parte da decisao de nomenclatura tomada e misturar
essa mudanca teria ultrapassado o escopo aprovado. Titulos arbitrarios de
questionario usados como dado sintetico em fixtures de teste (ex.:
`titulo: 'Check-in semanal'`) tambem foram preservados: sao conteudo que um
profissional poderia digitar livremente, nao copy do produto.

Validacao: `pnpm test:linguagem` aprovado; typecheck, lint e build de backend
e web aprovados; `pnpm test:authz` aprovado; suites backend afetadas
(`servico-pacientes.spec.ts` 36/36, `servico-questionarios.spec.ts` e
`controlador-questionarios.spec.ts`) sem regressao; Playwright das superficies
tocadas (portal do paciente, editor de questionarios, PWA offline, prontuario/
console-regression, subconjuntos relevantes de acessibilidade) sem regressao,
desktop e mobile. `tests/visual/producao-readonly.spec.mjs` foi atualizado
para o novo rotulo do menu, mas nao pode ser executado nesta sessao — exige
autenticacao real de producao, fora do alcance deste ambiente; a mudanca e o
mesmo padrao de texto ja validado nos demais testes.

## Incremento 1 - Recuperacao no carregamento do formulario publico

- `components/formularios/formulario-paciente-publico.tsx`: o carregamento
  inicial passa a mostrar sempre uma mensagem segura e em portugues
  ("Nao foi possivel carregar o formulario agora...") em vez de repassar o
  corpo/mensagem cru de uma falha de backend/proxy a um paciente sem sessao;
  um botao "Tentar novamente" reexecuta o carregamento sem exigir reload da
  pagina. As demais mensagens de erro (validacao de campo obrigatorio, falha
  ao enviar/anexar) continuam mostrando a mensagem especifica, que e de
  negocio e ja esta em portugues.
- TDD: teste Playwright escrito primeiro
  (`tests/visual/formulario-publico.spec.mjs`, describe "indisponibilidade e
  recuperacao"), confirmado RED contra o codigo anterior (sem botao "Tentar
  novamente" e sem a mensagem fixa), depois GREEN apos a implementacao. O
  mock usa uma flag (nao uma contagem de tentativas) porque o React 19/Next
  em modo de desenvolvimento invoca o efeito de carregamento duas vezes por
  montagem; uma contagem fixa correria contra essa segunda chamada automatica
  e nao contra o clique real do usuario.

## Incremento 2 - Indisponibilidade no envio de respostas e no rascunho

Ao revisar o Incremento 1 mais a fundo, ficou claro que a mesma logica
precisava distinguir dois tipos de falha, e que uma implementacao ingenua
"sempre generico" quebraria mensagens de negocio legitimas que o backend ja
devolve em portugues (ex.: `GoneException('Formulario expirado.')`,
`ConflictException('Rascunho atualizado em outro dispositivo.')`). A correcao:

- `lib/formularios-publicos-api.ts`: `requisitar` agora lanca
  `ErroFormularioPublico`, que carrega o status HTTP junto da mensagem. A
  nova funcao `mensagemSeguraOuGenerica(erro, mensagemGenerica)` devolve a
  mensagem do backend quando o status e 4xx (resposta de negocio, segura e
  ja em portugues) e a mensagem generica do chamador quando e 5xx (falha
  opaca de servidor) ou quando o erro nao carrega status (rede/parsing).
- `components/formularios/formulario-paciente-publico.tsx`: os tres pontos
  que repassavam `erro.message` cru (envio final de respostas, salvamento de
  rascunho e envio de anexo) passam a usar `mensagemSeguraOuGenerica` com uma
  mensagem generica especifica do contexto. O carregamento inicial (que no
  Incremento 1 tinha ficado generico demais, escondendo respostas legitimas
  como "Formulario expirado.") tambem foi corrigido para usar a mesma regra.
- O caso de rede sem fila offline (`Reconecte-se antes de enviar um
  formulario com anexos.`) passou a ser lancado como `ErroFormularioPublico`
  com status 400 para continuar aparecendo como esta.

TDD: quatro cenarios Playwright escritos primeiro e confirmados RED (formulario
expirado no carregamento; erro de servidor ao enviar preservando as respostas
ja preenchidas; conflito de rascunho preservado; erro de servidor ao salvar
rascunho), depois GREEN apos a implementacao.

## Validacao

Ambiente desta sessao nao tinha `node_modules` em nenhum workspace; as
dependencias foram instaladas (`pnpm --dir octaclin-backend install
--frozen-lockfile`, `pnpm --dir octaclin-web install --frozen-lockfile`,
lockfile verificado contra a politica de supply chain) antes de qualquer
execucao abaixo.

- Backend Jest (`servico-questionarios`, `controlador-questionarios`,
  `controlador-formularios-publicos`, `tipos-pergunta`,
  `configuracao-pergunta`, `reordenacao-perguntas`,
  `segredo-formulario-publico`, `servico-pacientes`): **83/83 PASS**.
- Backend typecheck: PASS. Backend build (`nest build` +
  `verificar-artefato-producao.mjs`): PASS.
- Web typecheck: PASS. Web build (`next build`): PASS. Web lint: PASS (0
  erros; avisos pre-existentes de `react-hooks/set-state-in-effect`, mesmo
  padrao ja presente em outros componentes do repositorio, incluindo um novo
  aviso no arquivo alterado — nao e erro e segue a convencao ja adotada em
  `painel-dashboard.tsx` e outros).
- `pnpm --dir octaclin-web test:authz` (inclui
  `test-questionarios-revisao-bff.mjs` e `test-prontuario-timeline-bff.mjs`):
  **PASS** (cadeia completa, ultimo script com 13/13).
- Scripts BFF/preview dedicados: `test-questionarios-revisao-bff.mjs` 3/3 PASS,
  `test-questionarios-preview.mjs` 3/3 PASS.
- Playwright `tests/visual/formulario-publico.spec.mjs`: **12/12 PASS** (6
  cenarios x desktop-chromium e mobile-chromium), incluindo os cenarios de
  indisponibilidade/recuperacao dos Incrementos 1 e 2.
- Playwright `tests/visual/questionarios-editor.spec.mjs`: **8/8 PASS**
  (desktop e mobile).
- Playwright `tests/visual/acessibilidade.spec.mjs` (subconjunto formularios/
  questionarios/checkins: publico padrao, PWA offline-first, upload, editor
  x2, checkins x2): **16/16 PASS** (desktop+mobile), sem regressao apos as
  mudancas dos dois incrementos.
- `pnpm security:secrets`: PASS, nenhum segredo real identificado.
- `git diff --check`: PASS, sem problema de espaco em branco.
- `pnpm validate:docs` / `validar-preflight.ps1 -DocsOnly`: **SKIPPED**. O
  script e PowerShell-only (inclusive com caminho absoluto Windows hardcoded)
  e este ambiente Linux nao tem `pwsh`/`powershell` instalado. As duas
  verificacoes que esse script tambem executa (`git diff --check` e o
  scanner de secrets) foram confirmadas manualmente acima; a verificacao de
  documentacao canonica especifica do script continua pendente de um ambiente
  com PowerShell.
- Recaptura de Code Scanning/Dependabot/Secret Scanning: **SKIPPED nesta
  sessao**. As ferramentas de GitHub disponiveis nao expoem
  `code-scanning/alerts`, `dependabot/alerts` ou `secret-scanning/alerts`; ver
  `STATUS_ATUAL_PROJETO.md` para o registro completo dessa limitacao. Uma
  evidencia parcial real foi obtida via `git push` (2 alertas Dependabot high
  no `main` atual) e via registro npm (`image-size` ainda em `2.0.2`, sem
  versao corrigida), consistente com o NO-GO de Mobile ja registrado.

## Revisao de seguranca

Nao foi alterado nenhum contrato de autorizacao, tenant, RLS ou auditoria.
As mudancas dos dois incrementos sao estritamente de apresentacao/tratamento
de erro no componente publico por token; nenhum dado adicional passou a ser
exposto e a distincao 4xx/5xx reduz, em vez de aumentar, a superficie de
informacao de servidor repassada a um visitante sem sessao — preservando ao
mesmo tempo as mensagens de negocio seguras que o backend ja devolvia.
Nenhum dado sintetico usado nos testes contem PHI/PII real.

## Rollback

Sem migration e sem mudanca de contrato de API. Rollback e reverter os
commits dos Incrementos 1 e 2 (`lib/formularios-publicos-api.ts`,
`components/formularios/formulario-paciente-publico.tsx` e o spec Playwright
correspondente); nenhuma outra parte do sistema depende dessas mudancas.
