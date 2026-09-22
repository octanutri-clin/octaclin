# Plano da Fase 274 - preparacao pre-consulta deterministica (PB-25)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-22, depois do push da Fase 273 (PB-16) nesta mesma
branch (`claude/jolly-turing-1eup7k`). Sexto e ultimo item da **Onda 3 -
devolver tempo ao profissional**, na ordem definida pelo proprietario:
PB-13, PB-14, PB-15, PB-23, PB-16, **PB-25** -- este ultimo depende do
PB-16, que acabou de ser entregue.

## 2. O que o audit pede

Seção 6.C ("Diferenciais de produto"): "**Preparação automática de
consulta**: 30 minutos antes, o sistema monta o que mudou desde o último
encontro (peso, adesão, check-ins, formulários respondidos, escolhas de
substituição, mensagens) -- todo o dado já existe e hoje exige abrir cinco
abas." A mesma ideia aparece na seção 12 (Oportunidades de IA), item 1,
com uma recomendação explícita de sequenciamento: "**construir primeiro a
versão determinística; IA só se ela se mostrar insuficiente**" -- o "resumo
determinístico da seção 5.3" (que a Fase 273/PB-16 acabou de entregar) é
citado como o *fallback*, não como o entregável completo do PB-25. PB-25 é
essa versão determinística em si: uma leitura de "o que mudou desde o
último atendimento", não um novo campo estatico do resumo.

## 3. Leitura do codigo antes de projetar

- **"Próxima"/"última" consulta** hoje são calculadas em memória, não por
  query dedicada: `ServicoPacientes.obterProntuario` já carrega todas as
  `consultas` do paciente (Promise.all) e resolve
  `ultimoAtendimento = consultas.find(c => c.status === 'concluida')`
  (primeiro item, porque a lista já vem ordenada `inicioEm: 'DESC'`). O
  campo `resumo.ultimoAtendimento.concluidaEm` já existe e é preenchido a
  partir de `ultimoAtendimento.inicioEm` -- vou reaproveitar esse mesmo
  valor como o marco temporal ("desde quando mudou").
  `proximaConsulta` (agendada/reagendada, futura) é resolvida **no
  frontend**, a partir da `linhaDoTempo` já recebida (`prontuario-
  paciente.tsx:951-959`), não existe no DTO do resumo -- então o backend
  desta fase não precisa saber nada sobre a próxima consulta, só sobre a
  última concluída.
- **"Desde o último encontro" não existe como conceito** hoje. Não há
  vínculo `consulta_id` em nenhuma entidade clínica (evolução, avaliação,
  check-in, envio de formulário, mensagem) -- só `documento_emitido` tem.
  O vínculo formal é o PB-24, registrado na Onda 4, fora de escopo aqui
  (mesma classe de gap já documentada no PB-15 para peso/IMC "da mesma
  consulta"). A leitura por **janela de data** (`concluidaEm` do último
  atendimento até agora) é a aproximação disponível, e ja e suficiente:
  todos os dados-fonte (`diarios`, `respostas`, `mensagens`) já são
  buscados com timestamp em `obterProntuario`.
- Todos os cinco sinais citados pelo audit já são buscados ou tem fonte
  clara dentro do próprio `obterProntuario`:
  - **peso**: `avaliacoesRecentes` (2 mais recentes, já buscadas pelo
    PB-16) -- só falta saber se a mais recente é posterior ao último
    atendimento.
  - **adesão**: já extraída de `diarios` (`LogDiarioRapidoOrm`) por
    `extrairIndicadoresRecentes`; "check-ins" no sentido do audit (registro
    do paciente no app) é o mesmo `diarios` -- contagem, não precisa de
    nova busca.
  - **formulários respondidos**: `respostas` (`RespostaCheckinOrm`), já
    buscada.
  - **mensagens**: `mensagens` (`MensagemNotificacaoOrm`), já buscada;
    "recebidas" = `status === 'recebido'`.
  - **escolhas de substituição**: `PlanoAlimentarEscolhaPacienteOrm`
    (`plano_alimentar_escolhas_paciente`, append-only, índice já existe em
    `(tenantId, versaoId, criadoEm)`) -- **única fonte não buscada hoje**
    em `obterProntuario`; único leitor atual é `ServicoPortalPaciente`
    (visão do próprio paciente, escopada por `versaoId`). Precisa de uma
    query nova, condicional a existir `versaoPlanoAtual` (mesmo padrão de
    `idsQuestionarios.length ? ... : []` já usado duas vezes nesta função).

## 4. Escopo: o que entra e o que fica de fora, e por que

- **Entra**: um campo novo `resumo.preparacaoConsulta`, presente somente
  quando existe `ultimoAtendimento` (sem atendimento concluído anterior,
  não há "o que mudou" para comparar -- é a primeira consulta do
  paciente). Contagens desde essa data: novos check-ins (diários),
  formulários respondidos, mensagens recebidas, trocas no plano vigente, e
  um booleano "há avaliação antropométrica nova" (o delta em si já está em
  `leituraClinica.deltaUltimaAvaliacao`, sem duplicar).
- **Fica fora, com justificativa**:
  - **Disparo automático "30 minutos antes"**: o audit descreve isso como
    o estado final do produto, não um requisito do v1 -- a própria seção
    12 recomenda construir a leitura determinística primeiro. Existe um
    padrão reaproveitável para um scanner de janela (`ProcessadorLembretes
    Agenda`, `@Cron` + `Between(agora+23h, agora+25h)` + marcador de
    idempotência na própria linha), mas transformar isso numa notificação
    automatica é escopo de automação (produto: canal, opt-out, janela de
    horário, mesmas regras já aplicadas a lembretes e recall) -- decisão
    de produto separada, não uma decisão tecnica que eu deva tomar sozinho
    nesta fase. Fica registrado como extensão futura natural, não como
    gap escondido.
  - **IA**: explicitamente adiada pelo proprio audit até a versão
    determinística se mostrar insuficiente.
  - **Vínculo `consulta_id` real**: é o PB-24 (Onda 4), gap já conhecido.
  - **Cobertura alem do cap de 30 itens** de `diarios`/`respostas`/
    `mensagens`: os contadores desta fase reaproveitam as mesmas listas já
    limitadas a 30 itens que o resto do resumo já usa (`respostas: respostas
    .length`, `checkinsRapidos: diarios.length`, `mensagens: mensagens
    .length` já sao contadores sobre a mesma janela de 30). Um paciente com
    mais de 30 diários/respostas/mensagens **desde o último atendimento**
    teria contagem subestimada -- mesma limitação que já existe hoje nesses
    tres contadores gerais, não uma regressão introduzida por esta fase.
    Resolver isso (paginação/contagem exata via `COUNT`) é uma melhoria de
    escala futura, não um requisito para o v1 do PB-25.

## 5. Desenho

- **`ServicoPacientes.obterProntuario`**: uma unica query nova e condicional,
  logo apos a resolucao de `versaoPlanoAtual` (mesmo ponto de
  `idsQuestionarios`):
  ```ts
  const escolhasSubstituicao = podeLerPlanos && versaoPlanoAtual && ultimoAtendimento
    ? await gerenciador.getRepository(PlanoAlimentarEscolhaPacienteOrm).count({
        where: { tenantId, versaoId: versaoPlanoAtual.id, criadoEm: MoreThan(ultimoAtendimento.inicioEm) }
      })
    : undefined;
  ```
  E o calculo dos demais campos a partir de arrays ja em memoria
  (`diarios`, `respostas`, `mensagens`, `avaliacoesRecentes`), todos
  condicionados a `ultimoAtendimento` existir:
  ```ts
  preparacaoConsulta: ultimoAtendimento
    ? {
        desdeAtendimentoEm: ultimoAtendimento.inicioEm,
        novaAvaliacaoAntropometrica: Boolean(
          avaliacaoAtualOrm && dataCivil(ultimoAtendimento.inicioEm) < avaliacaoAtualOrm.avaliadaEm
        ),
        checkinsRegistrados: diarios.filter(d => d.registradoEm > ultimoAtendimento.inicioEm).length,
        formulariosRespondidos: respostas.filter(r => r.finalizadoEm && r.finalizadoEm > ultimoAtendimento.inicioEm).length,
        mensagensRecebidas: mensagens.filter(m => m.status === 'recebido' && m.criadoEm > ultimoAtendimento.inicioEm).length,
        escolhasSubstituicao
      }
    : undefined
  ```
  `escolhasSubstituicao` fica `undefined` quando falta permissão
  (`planos_alimentares.ler`) ou não há plano publicado -- mesmo padrão já
  usado em `objetivoPlanoVigente` (PB-16); o frontend distingue "sem
  acesso" de "zero trocas" do mesmo jeito que já faz para o objetivo do
  plano.
- **DTO** (`dtos.ts`): `resumo.preparacaoConsulta?` com o formato acima,
  irmão de `leituraClinica`.
- **Frontend** (`prontuario-paciente.tsx`, aba Resumo): novo bloco
  "Preparação da próxima consulta", encaixado logo após "Leitura clínica"
  (Fase 273) -- só renderiza quando existe `proximaConsulta` (já calculada
  localmente a partir da linha do tempo) **e**
  `dados.resumo.preparacaoConsulta` (backend). Mostra a data-base ("desde
  o atendimento de DD/MM"), os contadores, e "nova avaliação registrada"
  (sim/não, remetendo ao bloco "Leitura clínica" para o delta em si, sem
  duplicar).

## 6. Seguranca

Nenhuma fronteira de autorizacao nova: tudo dentro do `obterProntuario`
existente, mesmo guard de rota (`pacientes.ler`). `escolhasSubstituicao` é
a única leitura de dado antes não buscado nesta função, e é uma
**contagem** (não expõe qual item foi trocado nem por qual substituto),
gated pela mesma permissão que já protege `planoAtual`/
`objetivoPlanoVigente` (`planos_alimentares.ler`). `mensagensRecebidas` é
contagem sobre a mesma lista `mensagens` que o resumo já expõe sem gate
fino (`mensagens: mensagens.length` já é incondicional hoje) -- consistente
com o que já existe, não uma nova exposição.

## 7. Implementacao e evidencia

Implementado nesta branch (`claude/jolly-turing-1eup7k`) em 2026-09-22,
logo apos o push da Fase 273 (PB-16). Sem migration, como desenhado.

**Backend** (`octaclin-backend`):
- `ServicoPacientes.obterProntuario`: `ultimoAtendimento` passou a ser
  resolvido logo apos o `Promise.all` inicial (em vez de mais adiante),
  para poder alimentar a nova query condicional de `escolhasSubstituicao`
  (`PlanoAlimentarEscolhaPacienteOrm.count`, `MoreThan(ultimoAtendimento
  .inicioEm)`) e o bloco `preparacaoConsulta`, que reaproveita os arrays
  ja em memoria (`diarios`, `respostas`, `mensagens`, `avaliacoesRecentes`)
  filtrados pela mesma data -- exatamente o desenho da secao 5, sem
  desvio.
- `dtos.ts`: `resumo.preparacaoConsulta?` com o formato desenhado.

**Testes novos** (TDD, RED confirmado antes da implementacao):
`servico-pacientes.spec.ts` ganhou tres casos -- um com atendimento
concluido, avaliacao nova, check-ins/formularios/mensagens antes e depois
da data de corte (provando que so os posteriores contam) e trocas de
plano via `count` mockado; um sem nenhum atendimento concluido (
`preparacaoConsulta` fica `undefined`); e um com atendimento concluido mas
sem `planos_alimentares.ler` (contadores computam normalmente,
`escolhasSubstituicao` fica `undefined` e o repositorio de escolhas nunca
e sequer consultado). Um teste pre-existente ("prioriza falha de
comunicacao...") e o benchmark sintetico
(`infraestrutura/performance/benchmark-prontuario.spec.ts`) precisaram de
um mock novo para `PlanoAlimentarEscolhaPacienteOrm` porque combinavam as
tres condicoes (permissao, plano publicado, atendimento concluido); o
orcamento de consultas do benchmark foi atualizado de 14 para 15
`getRepository` (a nova busca condicional de `escolhasSubstituicao`).

**Frontend** (`octaclin-web`):
- `lib/prontuario-api.ts`: `ProntuarioPacienteApi['resumo']` ganhou
  `preparacaoConsulta?` (opcional, diferente de `leituraClinica` que e
  obrigatorio -- aqui a ausencia e o caso normal quando nao ha atendimento
  concluido anterior).
- `components/pacientes/prontuario-paciente.tsx`: novo bloco "Preparação
  da próxima consulta" na aba Resumo, logo apos "Leitura clínica" -- so
  renderiza quando ha `proximaConsulta` (ja calculada localmente a partir
  da linha do tempo) **e** `dados.resumo.preparacaoConsulta` (backend), a
  intersecao exata desenhada na secao 5. Segue o mesmo padrao `<dl>`/`<dt>`/
  `<dd>` ja corrigido pelo gate de acessibilidade na Fase 273, sem repetir
  o erro.
- Playwright novo em `console-regression.spec.mjs`: "mostra a preparação
  da próxima consulta com o que mudou desde o último atendimento (PB-25)",
  usando o fixture compartilhado `prepararProntuarioMockado` (que ja tem
  uma consulta concluida e uma agendada futura) com `preparacaoConsulta`
  adicionado ao mock do resumo.

**Validacoes executadas nesta branch**:
- `pnpm --dir octaclin-backend typecheck` e `build` -- limpos.
- Suite completa do backend: 210 suites, 2018 testes, 0 falhas (3 suites/31
  testes SKIPPED por falta de Docker nesta sandbox -- RLS via
  testcontainers, mesma limitacao ja documentada).
- `node scripts/validar-redacao-auditoria.mjs`,
  `node --test scripts/validar-guardas-controladores.spec.mjs`,
  `node --test scripts/validar-migracoes-fora-de-banda.spec.mjs`,
  `node --test scripts/validar-inventario-security-quality.spec.mjs ...`,
  `node scripts/test-matriz-confiabilidade.mjs` -- limpos.
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros, mesmos warnings
  pre-existentes), `build` -- limpos.
- `pnpm --dir octaclin-web test:authz` -- verde (cadeia completa; sem par
  novo nesta fase, o campo novo viaja no endpoint `prontuario` ja
  existente).
- Playwright: `console-regression.spec.mjs` + `fase-248-estados-recuperacao
  .spec.mjs` (65/65, desktop e mobile, incluindo o cenario novo do PB-25),
  `acessibilidade.spec.mjs` completo (136/136 desktop, sem violacao nova --
  o bloco nao renderiza nos fixtures de acessibilidade porque eles nao tem
  consulta futura nem `preparacaoConsulta` no mock, comportamento
  esperado, nao uma lacuna de cobertura desta fase).
- `git diff --check` e `pnpm security:secrets` -- limpos.
- `test:workflows-seguros` reprova so o subteste que exige PowerShell,
  indisponivel neste sandbox Linux -- mesma limitacao de ambiente ja
  documentada, nao uma regressao desta fase.

**Pendencias**: checks remotos de CI e merge humano.
