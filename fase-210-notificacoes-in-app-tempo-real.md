# Fase 210 - Notificacoes in-app e tempo real

Status: concluida em 2026-08-06.

## Problema

`console-shell.tsx` tinha um sino que era um link estatico para `/comunicacoes`:
sem badge, sem contador, sem centro de notificacoes. Um sino que nao notifica e
pior que nenhum sino, porque o usuario confia nele. Mensagem de WhatsApp,
solicitacao publica de agendamento e formulario respondido so apareciam para quem
abrisse a tela certa por conta propria, e falha de envio so para quem abrisse a
central de falhas da Fase 112.

## Entregue

### Centro de notificacoes

- Tabela `notificacoes` (migration `1720000001020`) com RLS forcada, **uma linha
  por usuario destinatario** (fan-out na escrita). Estado lido/nao lido e a
  coluna `lido_em`, entao a consulta de nao lidas nao faz join.
- Quatro tipos ligados na origem: mensagem recebida (webhook WhatsApp),
  solicitacao publica de agendamento, formulario respondido e falha de envio.
- Sino do console com contador real, painel com as ultimas 20 e "marcar todas
  como lidas".

### A tabela nao guarda texto

Nao existe coluna de titulo nem de corpo. O texto exibido e derivado de `tipo` na
interface e o nome do paciente e resolvido na leitura, a partir do `paciente_id`,
sob o escopo de quem le. Sem isto o centro de notificacoes seria uma segunda
copia em claro exatamente do que a Fase 208 passou a cifrar — nome de paciente e
conteudo de mensagem. A notificacao carrega ponteiro (`recurso_tipo`,
`recurso_id`), nao conteudo.

### Isolamento

Quem recebe esta em `destinatarios-notificacao.ts`, funcao pura e testada:

- SuperAdmin e Collaborator (escopos `tenant_total` e `operacional_delegado`)
  recebem qualquer evento do tenant.
- Professional (escopo `pacientes_responsaveis`) so recebe quando e o dono
  identificado do evento — derivado de `pacientes.profissional_responsavel_id`,
  ou do link publico no caso da solicitacao.
- Evento **sem** dono identificado nao vai para profissional nenhum, em vez de ir
  para todos. Mandar para todos seria o vazamento entre profissionais que o
  criterio de aceite proibe.
- Patient e Client nunca recebem: o paciente tem o proprio canal (Fase 116) e o
  gestor da conta nao opera a clinica.

Na leitura, toda consulta filtra por `usuarioId` vindo do JWT. O isolamento e a
propria clausula, nao uma verificacao a parte que alguem pode esquecer de chamar
— inclusive em `marcarLidas`, onde o id vem do cliente mas nao alcanca linha de
outra pessoa.

### Idempotencia

Indice unico `(tenant_id, usuario_id, tipo, recurso_id)` e insercao com
`orIgnore`. O webhook da Meta reentrega e o outbox reprocessa; sem isso o
contador inflaria e o usuario abriria a inbox sem encontrar o que o sino diz.

A publicacao entra na **mesma transacao** do fato de origem (`registrarNotificacao`
recebe o `EntityManager` do chamador). Envio que deu rollback nao deixa sino aceso
apontando para nada, e fato gravado sempre tem seu aviso.

## Decisao: polling em vez de SSE

O diagnostico das Fases 199-218 previa SSE com fan-out via Redis. Foi trocado por
polling (5s no sino, 20s nos paineis), com decisao explicita do usuario, por tres
motivos verificados no repositorio:

1. A Fase 201 esta com codigo pronto mas **rollout pendente**, e o proprio
   checklist diz "nao escalar o backend antes deste gate". Hoje roda uma
   instancia: o fan-out via Redis resolveria um problema que ainda nao existe.
2. Web e backend estao no Render (`RUNBOOK_PRODUCAO.md`). Uma conexao SSE aberta
   por aba mantem a instancia acordada 24/7 e queima as horas mensais — o oposto
   do que o ajuste de cold start de 2026-08-06 tentou preservar.
3. O criterio de aceite ja exigia degradacao para recarga periodica. O polling
   precisaria existir de qualquer forma; SSE seria a segunda implementacao do
   mesmo requisito.

O intervalo de 5s atende o criterio ("aparece em ate 5s sem recarga") ao pe da
letra. SSE fica para quando a Fase 201 estiver de fato em producao com mais de
uma instancia — ai o Redis pub/sub passa a ter funcao real.

## Degradacao

- O poll roda so com a aba visivel. Nao e economia de request: e o que impede
  vinte abas esquecidas de manter a instancia Render acordada.
- Ao voltar para a aba, recarrega na hora, senao o usuario olharia dado velho ate
  o proximo tick.
- Falha de poll **nao pinta erro na tela**: o sino mantem o ultimo estado e tenta
  de novo. Vale tambem durante o cold start do backend.
- Os paineis ganharam modo `silencioso`: recarregam sem spinner, sem esvaziar a
  tela e sem apagar o que esta sendo digitado no formulario.

## Fora de escopo

- SSE e Redis pub/sub (acima).
- Notificacao por push/desktop: o produto ja envia por e-mail e WhatsApp; um
  terceiro canal sem pedido seria ruido.
- Preferencias por tipo de notificacao. Quatro tipos, todos operacionais; a tela
  de preferencia chega quando a lista crescer.
- Retencao/expurgo automatico. A tabela cresce sem limite, mas a consulta quente
  usa indice parcial sobre nao lidas e a listagem usa `limit`, entao o custo e de
  disco e nao de latencia. Vira fase propria quando o disco pedir.

## Permissao e auditoria

Nenhuma permissao nova: quem tem `console.acessar` le a propria caixa e ninguem
le a de outro. Sem auditoria de leitura — diferente do financeiro da Fase 209, a
notificacao nao carrega dado clinico, so o ponteiro, e a leitura do recurso
apontado ja e auditada onde precisa ser.

## Validacao local

- Backend: 96 suites e 620 testes aprovados (596 antes da fase).
- Typecheck do backend aprovado.
- Web: typecheck, lint, `test:authz`, `test:next15` (66 arquivos) e
  `test:base-visual` aprovados.
- `pnpm --dir octaclin-web build` aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10 testes aprovados em desktop e mobile.
- Testes novos cobrem: destinatarios por papel (incluindo a nao entrega a
  profissional fora do escopo), fan-out e `orIgnore`, derivacao do responsavel
  pelo paciente, isolamento por `usuarioId` na leitura e na marcacao, e a
  notificacao criada pelo webhook sem copiar o texto do paciente.

### Dois gates que estavam passando sem olhar

Fechando as pendencias da fase, dois gates existentes mostraram-se cegos:

- **`acessibilidade.spec.mjs`**: a sessao mockada do papel Professional nao tinha
  `console.acessar`, entao o sino nao renderizava e o gate aprovava sem nunca
  avaliar o botao novo. A permissao foi adicionada ao mock (o papel a tem de
  verdade em `auth/dominio/permissoes.ts`), `/api/notificacoes` foi mockado, e o
  teste do dashboard agora **afirma** que o sino esta em tela com o nome
  acessivel e a contagem. Sem essa afirmacao, uma permissao faltando no mock
  voltaria a esvaziar o gate em silencio.
- **`opcoes-typeorm.spec.ts`**: a lista de migrations registradas parava na
  `1013`. As migrations `1014` a `1019` — anexos, teleconsulta, antropometria,
  documentos emitidos, cifra de conteudo e financeiro — nunca estiveram
  cobertas pelo gate que a `MATRIZ_CONFIABILIDADE_TESTES.md` aponta como
  protecao de "Registro de migrations". Todas foram incluidas junto com a `1020`.

## Rollout de producao

Em 2026-08-06, o banco `Octaclin-db-producao` recebeu as migrations pendentes
`1720000001015` a `1720000001020` com a role `neondb_owner`, apos backup logico
validado. O pos-check confirmou todas como executadas, RLS forcada e policy de
tenant nas novas tabelas, indices esperados e campos/constraints de agenda.

O backend respondeu `200` em `/health` e `/health/detalhado` apos o rollout.
O CI nao executa migrations; proximas migrations de producao continuam seguindo
o procedimento do `RUNBOOK_PRODUCAO.md`.

`console-regression.spec.mjs` e `jornadas-criticas.spec.mjs` nao foram
executados: exigem backend e banco reais (`E2E_API_URL`, credenciais de tenant),
indisponiveis na maquina de desenvolvimento. Rodar antes do go-live.
