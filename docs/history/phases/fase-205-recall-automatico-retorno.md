# Fase 205 - Recall automatico de retorno

Status: concluida em 2026-08-03. O motor de automacoes (Fase 197) ganhou o
gatilho de inatividade que faltava: "paciente sem consulta concluida ha N
dias, enviar mensagem". Simulacao obrigatoria mostra a lista exata de quem
seria contatado antes de ativar, com o motivo de cada exclusao.

## Entregue

### Dominio (`automacoes/dominio/recall-inatividade.ts`)

Funcao pura `selecionarCandidatosRecall` decide quem recebe recall. Um
paciente entra quando: aceitou receber mensagens, tem contato legivel e
cadastrado, esta dentro do filtro de status de adesao (se houver), passou do
prazo de inatividade, e nao recebeu recall dentro do intervalo minimo.

Ordena do mais inativo para o menos antes de aplicar o limite da rodada — se
nao cabe todo mundo, quem sumiu ha mais tempo passa primeiro. Paciente que
nunca concluiu consulta vai para o fim da fila: pode ser cadastro recem-criado
que ainda nao chegou a ser atendido, nao alguem que abandonou.

Motivos de exclusao expostos: `opt_out`, `contato_ilegivel`, `sem_contato`,
`status_adesao_fora_do_filtro`, `consulta_recente`, `recall_recente`,
`limite_por_execucao`.

### Teto comercial contra spam

O diagnostico pedia teto de frequencia para o recall nao virar spam e queimar
o numero na Meta. Dois limites, ambos presos em faixa no servidor
(`normalizarConfiguracaoRecall`) para que nenhuma configuracao vinda da UI
consiga virar disparo em massa:

- `intervaloMinimoDias` (padrao 30, minimo 1): tempo minimo entre dois recalls
  para o mesmo paciente.
- `limitePorExecucao` (padrao 25, maximo 200): pacientes por rodada.
- `diasSemConsulta` (padrao 60, minimo 7): impede configurar "recall de quem
  sumiu ha 2 dias".

Simulacao nao consome o teto: so contato real conta.

### Servico (`automacoes/aplicacao/servico-recall-inatividade.ts`)

- `simular(tenantId, regraId, usuario)`: criterio de aceite da fase. Devolve a
  lista exata de candidatos (com dias de inatividade) e os excluidos com
  motivo, sem enviar nada. Persiste como `ExecucaoRegraOrm` com
  `simulacao: true`, o que ja satisfaz a trava de "simule antes de ativar" que
  o `alterarAtivacao` existente exige.
- `processarRecalls(tenantId)`: rodada real. Escolhe canal respeitando a
  preferencia do paciente, respeita horario permitido, exige template de
  recall aprovado, e registra uma execucao por paciente contatado.

### Cron (`automacoes/aplicacao/processador-recall-inatividade.ts`)

Uma rodada diaria as 9h. Inatividade se mede em dezenas de dias: rodar de hora
em hora so multiplicaria consulta ao banco sem mudar resultado. O horario
preferido de cada paciente continua sendo respeitado no envio.

### API e painel

- `POST /automacoes/recall/simulacoes` (mesmas guardas e permissao
  `automacoes.gerenciar` das demais rotas do controlador), com auditoria.
- Painel de automacoes: gatilho "Paciente sem consulta ha muito tempo" no
  seletor, campos proprios (dias sem consulta, intervalo minimo, limite por
  rodada) no lugar dos campos de condicao, botao "Simular recall" por regra, e
  o resultado renderizado como lista de nomes com motivo — nao JSON cru.

### Deduplicacao aproveitada

A leitura de preferencias de comunicacao (opt-in, canal preferido, horario
permitido, contatos) estava privada dentro de `servico-lembretes-agenda.ts`.
Virou `comunicacoes/dominio/preferencias-comunicacao.ts`, usada pelos dois
servicos. Sem isso o recall teria duplicado ~100 linhas da logica mais
delicada do sistema — justamente a que decide se pode ou nao falar com o
paciente.

## Bugs corrigidos durante a fase

1. **Opt-out confundido com falta de contato.** `aceitaAlgumCanal` exigia
   destino cadastrado, entao paciente sem telefone aparecia como "pediu para
   nao receber". Para quem opera a automacao isso e ruido perigoso: "ele disse
   nao" e "nao temos o contato dele" pedem acoes opostas. Separado em
   `canalAutorizado` (preferencia) e `canalPermitido` (preferencia + destino).
   Pego pelo proprio teste de servico.

2. **Falha de Redis furava o teto de frequencia** (achado da revisao de falha
   silenciosa, severidade critica). `publicarEventoNotificacao` estava dentro
   do mesmo `try` do `dispararMensagem`. Como o `dispararMensagem` grava
   mensagem e evento de outbox na mesma transacao, a mensagem e entregue pelo
   poller mesmo sem Redis — mas a execucao era marcada `falhou`, e
   `mapearUltimoRecall` so conta `executado`. Resultado: paciente recebia o
   recall e ficava elegivel de novo no dia seguinte. Publicacao agora tem
   try/catch proprio e nao rebaixa um envio ja garantido.

3. **Falha pontual derrubava a rodada inteira do dia** (achado da mesma
   revisao). Sem try/catch por paciente, um erro ao registrar a execucao
   propagava e cancelava todos os pacientes e regras seguintes daquele tenant
   — e, como o cron roda uma vez ao dia, so haveria nova tentativa 24h depois.
   Cada regra e cada paciente agora sao isolados, com contadores
   `regrasComErro` e `contatosIlegiveis` no resultado.

4. **Contato ilegivel escondido como "sem contato"** (achado da mesma
   revisao). Falha de descriptografia caia no mesmo motivo de cadastro
   incompleto. Uma chave rotacionada errado desligaria o recall inteiro
   parecendo uma onda de pacientes mal cadastrados. Virou motivo proprio
   (`contato_ilegivel`), contado a parte e logado como `error`, com texto
   dedicado no painel.

## Revisoes executadas

- `ecc:silent-failure-hunter`: 5 achados. Os 3 primeiros (critico e 2 altos)
  corrigidos e cobertos por teste — ver secao acima. Os 2 restantes ficaram de
  fora, ver "Nao feito".
- `ecc:security-reviewer`: nenhum achado critico ou alto. Confirmou as duas
  fronteiras da fase: escopo por profissional responsavel integro em todos os
  caminhos (regra, selecao de pacientes, consultas auxiliares, tudo via
  `ExecutorTenant` e `resolverProfissionalIdDoUsuario`), e opt-out checado
  antes de qualquer outro filtro, nos dois caminhos (simulacao e envio real).
  Sem PII em log, auditoria ou resposta da API — so UUIDs e codigos de motivo.

## Rodada extra: isolamento e timeout nos crons (2026-08-03)

O achado de timeout tinha sido adiado com a justificativa "e a forma de todos
os crons do repo". Ao medir o tamanho da correcao, a justificativa se mostrou
errada e o problema, maior:

- `questionarios/processador-agendamentos.ts` (a cada 1 min) e
  `comunicacoes/processador-outbox-comunicacoes.ts` (a cada 30s) **nao tinham
  isolamento nenhum** por tenant — nem `try/catch`. Uma excecao em qualquer
  tenant abortava a rodada e deixava todos os tenants seguintes sem
  processamento, sem nada no log. O do outbox e justamente o caminho de
  entrega das mensagens, a rede de seguranca usada na correcao do recall.
- Os outros tres (`lembretes-agenda`, `recall-inatividade`,
  `renovacao-google-calendar`) tinham `try/catch`, mas nenhum tinha timeout: o
  `catch` pega rejeicao, nao travamento.

`infraestrutura/processamento/rodada-por-tenant.ts` (novo) concentra o laco
"busca tenants ativos, itera, isola falha, aplica timeout", que estava copiado
cinco vezes. Os cinco processadores passaram a usa-lo. O timeout nao cancela a
operacao travada (JavaScript nao permite) — impede que ela prenda a fila, e a
rodada segue para o proximo tenant registrando o estouro. Padrao de 120s;
outbox usa 25s por rodar a cada 30s.

4 testes novos, incluindo verificacao de que o temporizador nao fica pendente
quando o tenant termina antes do timeout.

## Nao feito

- **Log no fallback de timezone invalido** (`preferencias-comunicacao.ts`).
  Exigiria injetar logger em funcao de dominio pura, ou devolver sinal de
  fallback so para logar. Custo maior que o beneficio para um caso que so
  ocorre com dado de timezone corrompido.
- **Observacao repassada pela revisao de seguranca, nao e regressao**: papel
  `Collaborator` enxerga regras de qualquer profissional do tenant, porque
  `resolverProfissionalIdDoUsuario` devolve `undefined` para esse papel. E
  comportamento pre-existente e uniforme em todo o controlador de automacoes
  (`listarRegras`, `simularRegra`, `alterarAtivacao`), nao algo introduzido
  aqui. Fica registrado caso a decisao de produto seja restringir.
- **Cadastros antigos entram como opt-in.** Contato em texto puro (formato
  anterior ao JSON) e JSON sem bloco `preferencias` assumem
  `email: true, whatsapp: true`. E o mesmo padrao que os lembretes de consulta
  ja usam em producao desde a Fase 110; o recall passa a ser um segundo
  consumidor dele. Nao foi alterado aqui para nao mudar, de lado, o
  comportamento de um fluxo ja aceito.
- Nenhum teste visual novo: o painel de automacoes nao tem spec de regressao
  dedicada no repo. A cobertura da fase e de backend (dominio e servico).

## Validacao local

- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-backend test --runInBand`: 457/457 aprovados
  (31 novos: 14 de dominio de recall, 13 de servico de recall, 4 de rodada por
  tenant).
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado, rota
  `/api/automacoes/recall/simulacoes` registrada.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test` em `jornadas-criticas`, `console-regression`,
  `fase-197-modulos-avancados`, `portal-cliente`, `portal-paciente`,
  `race-condition-agenda`: 84/84 aprovados.
