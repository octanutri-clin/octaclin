# Plano da Fase 268 - alerta de check-in com adesao baixa (PB-05)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-20, imediatamente apos o fechamento da Fase 267
(PB-03, PR `#273` + `#274`, merges `9e78f31`/`c5f0683`). Com o PB-03
concluido, a Onda 2 do audit de produto (`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`)
exige como ultimo item o **PB-05 (alerta de check-in com adesao baixa)**.

O proprietario autorizou o inicio do PB-05 sem detalhar um novo contrato
verbatim (diferente dos incrementos 267.1-267.3, cada um com contrato,
defaults e lista de testes explicitos). O escopo abaixo foi derivado da
propria documentacao de produto ja aprovada:

- `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, secao 4 (quick win #9):
  "`adesaoPlano` (0-100) ja e coletada; um limiar simples gera a primeira
  automacao com efeito real."
- Mesmo documento, tabela da secao 3: "Check-in do paciente | Coletado, sem
  consumidor | Profissional nao sabe que houve sinal ruim | Notificar/alertar
  por limiar configuravel".
- Tabela da secao 11 (jornada do paciente): "Check-in respondido com adesao
  baixa | Nada | Tarefa + alerta no dashboard".
- Backlog (secao 15): `PB-05 | Alerta de check-in com adesao baixa |
  Automacao | Alto | P | Baixo | backend, PB-02`.

## 2. Por que isto e um gatilho novo, e nao parte do PB-01/PB-03

`adesaoPlano` ja alimenta a formula de prioridade de acompanhamento (Fase
265, `calcularPrioridadeAcompanhamento`): o fator `adesao_declarada_baixa`
soma 15 pontos quando a adesao do ultimo registro de habitos fica abaixo de
50% dentro de uma janela de 30 dias. Como a faixa `alta` exige score >= 70,
uma unica adesao baixa NUNCA e suficiente sozinha para entrar em `alta` e
disparar `paciente.risco_alto` (267.2) — ela e apenas um entre tres fatores
que se somam ao longo do tempo.

O PB-05 e, portanto, um sinal distinto e complementar: um alerta imediato
por CHECK-IN INDIVIDUAL, independente do score agregado, para o profissional
ser avisado no mesmo dia que o paciente declarou dificuldade — nao apenas
quando o quadro geral (faltas + adesao + ausencia de retorno) acumular
pontos suficientes. Os dois sinais convivem sem duplicidade: um mede o
"quadro geral do paciente" (prioridade de acompanhamento), o outro mede
"este check-in especifico preocupa".

## 3. Contrato fechado

```
{
  tipo: 'checkin.adesao_baixa',
  limiarAdesao: inteiro de 1 a 100   // default de produto: 50
}
```

- `limiarAdesao` default 50: reusa o MESMO corte que a formula de
  prioridade de acompanhamento ja usa para `adesao_declarada_baixa`
  (`prioridade-acompanhamento.ts`), para manter os dois sinais de "adesao
  baixa" do produto consistentes entre si em vez de inventar um segundo
  numero magico.
- Minimo 1 (nao 0): um limiar 0 nunca casaria contra `adesaoPlano < 0`
  (impossivel, a faixa valida e 0-100), entao equivaleria a desativar o
  gatilho silenciosamente — o contrato fechado rejeita esse valor sem
  sentido de forma explicita em vez de aceitar e nunca disparar.
- Sem `intervaloMinimoDias` nem `limitePorExecucao` (ao contrario de
  `checkin.atrasado`): o gatilho dispara POR CHECK-IN, nao por rodada
  periodica. Cada checagem de elegibilidade acontece uma unica vez, no
  momento em que o paciente responde o check-in pelo portal — nao ha rodada
  para limitar nem risco de "disparo em massa" (o teto natural e a
  frequencia real de check-ins do paciente, tipicamente no maximo um por
  dia). Adicionar esses dois parametros seria complexidade sem uso real.

## 4. Regra de disparo e invariantes

- Fonte do sinal: `RegistrarCheckinRapidoPortalDto.adesaoPlano`, sempre um
  numero 0-100 validado pelo DTO (`@IsNumber() @Min(0) @Max(100)`) — nunca
  ausente quando o check-in e aceito, entao a elegibilidade nao precisa
  tratar "check-in sem adesao informada" como caso possivel neste ponto de
  entrada.
- Elegibilidade: `adesaoPlano < limiarAdesao` da regra (estritamente menor,
  mesmo operador que a formula de prioridade ja usa).
- Alcance: somente regras ativas do tenant e do profissional responsavel
  pelo paciente (mesmo isolamento de todos os gatilhos anteriores).
- Como a elegibilidade depende do `limiarAdesao` PROPRIO de cada regra (duas
  regras do mesmo profissional podem ter limiares diferentes), reusa
  `dispararParaRegra` — o nucleo por-regra extraido na 267.3 — em vez do
  casamento generico de `dispararGatilhoAutomacao`, pelo mesmo motivo que
  `checkin.atrasado` ja exigiu essa extracao.
- Idempotencia: a origem da chave e o proprio registro de check-in
  (`log_diario_rapido.id`), criado ANTES do disparo na mesma transacao.
  Retry da mesma requisicao (reenvio de operacao offline, por exemplo) reusa
  o mesmo `checkinId` e portanto a mesma identidade deterministica de
  execucao/outbox (`orIgnore` sobre a chave primaria) — nunca duplica.
- Contexto duravel: somente `{ evento: 'checkin.adesao_baixa' }`. A adesao
  declarada, o humor e qualquer outro campo do check-in NUNCA entram no
  contexto, na execucao nem no outbox — mesma disciplina de PHI/PII das
  fases 267.1-267.3.
- Transacao: o disparo acontece na MESMA transacao de
  `ServicoPortalPaciente.registrarCheckinRapido` (via `ExecutorTenant`), como
  todos os gatilhos anteriores — nunca uma chamada separada fora da
  transacao do fato de origem.
- Web: o formulario de criacao de regras ganha a opcao "Check-in com adesao
  baixa" com um unico campo (`Limiar de adesao (%)`, default 50) e
  `condicoes: []` (mesmo motivo das fases 267.1/267.2/267.3: o contexto real
  de disparo e opaco, uma condicao generica nunca casaria). Reusa o
  simulador generico (`POST /automacoes/simulacoes`) sem endpoint dedicado —
  mesma decisao ja tomada para `questionario.respondido`/`paciente.risco_alto`,
  cuja elegibilidade tambem nao depende de `condicoes` avaliadas contra um
  contexto de simulacao.

## 5. Risco, rollout e rollback

R4 (automacao clinica-adjacente sobre dado de bem-estar autodeclarado pelo
paciente). Sem migration: reusa `log_diario_rapido` (Fase existente) e as
tabelas de automacoes ja criadas em 267.1. Nenhuma tabela nova, nenhuma
coluna nova. Rollback e reversao pura de codigo (revert do commit) — nao ha
dado persistente novo que exija procedimento de migracao para desfazer.

Nenhuma acao de producao, seed ou dado real foi usada nesta fase.

## 6. Fora do escopo desta fase

- Qualquer mudanca na formula de prioridade de acompanhamento (Fase 265) ou
  no gatilho `paciente.risco_alto` (267.2) — os dois sinais de "adesao
  baixa" continuam distintos e nao interagem entre si.
- Endpoint de simulacao nominal dedicado (candidatos/exclusoes) — nao se
  aplica a um gatilho por-evento, apenas aos gatilhos por-rodada
  (`paciente.inativo`, `checkin.atrasado`).
- Qualquer digest, agregacao ou notificacao push alem da fundacao duravel
  (execucao + outbox) ja existente — a acao (notificar/criar tarefa/enviar
  template) e a mesma infraestrutura da Fase 266 (PB-02), sem mudanca.
- Migration, producao ou provider externo.

## 7. Gates

- [x] `pnpm --dir octaclin-backend typecheck` / `build` / `test --runInBand`.
- [x] `pnpm --dir octaclin-web typecheck` / `lint`.
- [x] Playwright direcionado (`acessibilidade.spec.mjs`, suite `automacoes`,
  20/20, incluindo o teste de troca de gatilho estendido para a nova
  opcao) via workaround local de ambiente (symlink de revisao do Chromium,
  nada commitado).
- [x] `pnpm test:guardas-controladores`, `pnpm test:redacao-auditoria`,
  `pnpm test:confiabilidade`, `pnpm security:secrets`.
- [x] `git diff --check`.
- [ ] `pnpm validate:docs` — `SKIPPED`: `powershell` indisponivel neste
  sandbox Linux (mesma limitacao de ambiente das fases anteriores);
  substituido manualmente por `git status --short`.
- [ ] Checks remotos de CI e revisao humana da PR — pendentes ate a
  abertura/merge da PR desta fase.

## 8. Evidencia local

- `PASS` - dominio: `checkin-adesao-baixa.spec.ts`, 7 testes (defaults,
  valor explicito, faixa invalida nunca lanca, identificacao de tipo,
  elegibilidade por limiar).
- `PASS` - contrato fechado: 5 novos casos em `gatilhos-automacao.spec.ts`
  (defaults, valor explicito, tres casos de faixa invalida, campo fora do
  contrato) — 26/26 no arquivo.
- `PASS` - orquestrador: `disparar-gatilho-checkin-adesao-baixa.spec.ts`,
  7 testes (dispara abaixo do limiar, nao dispara no limiar ou acima,
  limiar proprio por regra, isolamento por tenant/profissional, isolamento
  defensivo sem profissional, idempotencia em retry, contexto sem dado do
  check-in).
- `PASS` - integracao no ponto de entrada real:
  `servico-portal-paciente.spec.ts` ganhou 4 testes dedicados (dispara
  abaixo do limiar, nao dispara no limiar, isolamento por outro
  profissional, retry da mesma operacao offline nao duplica) sem quebrar
  nenhum dos 37 testes preexistentes do arquivo — 41/41.
- `PASS` - `pnpm --dir octaclin-backend typecheck`.
- `PASS` - `pnpm --dir octaclin-backend build`.
- `PASS` - `pnpm --dir octaclin-backend test --runInBand`: 203/206 suites
  (3 puladas, mesmo padrao ja documentado nas fases anteriores de
  integracao dependente de ambiente), 1.955/1.986 testes (31 pulados).
- `PASS` - `pnpm --dir octaclin-web typecheck`.
- `PASS` - `pnpm --dir octaclin-web lint`: 0 erros, mesmos warnings
  preexistentes das fases anteriores (nenhum novo).
- `PASS` - Playwright `acessibilidade.spec.mjs`, suite "automacoes":
  20/20 em desktop e mobile, incluindo o teste de troca de gatilho
  estendido com a nova opcao "Check-in com adesao baixa".
- `PASS` - `pnpm test:guardas-controladores`, `pnpm test:redacao-auditoria`,
  `pnpm test:confiabilidade` (matriz atualizada), `pnpm security:secrets`.
- `PASS` - `git diff --check`.
- `SKIPPED` - `pnpm validate:docs`: mesma limitacao de PowerShell indisponivel
  neste sandbox Linux, substituida manualmente.
- `NA` - migration, banco externo, staging, producao e providers: reusa
  tabelas existentes, nenhum provider externo acionado.

## 9. Fechamento: PR #275 merge confirmado

O job "OctaClin CI" rodou sobre o commit `a1d0f1b` (head da PR `#275`) e
todos os 8 jobs concluiram com sucesso, incluindo "Demo local smoke" (com
"Smoke visual Playwright" verde). A PR foi revisada e mergeada por humano em
`main` no commit `306d2ed` em 2026-09-20.

Com o merge confirmado, o **PB-05 (alerta de check-in com adesao baixa)
esta definitivamente concluido**. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e
`STATUS_ATUAL_PROJETO.md` foram atualizados para substituir "checks remotos
e merge humano pendentes" pela evidencia real do merge. Com isso, a **Onda 2
do audit de produto (PB-01 -> PB-02 -> PB-03 -> PB-05) esta completa** — nao
ha proximo item obrigatorio nesta trilha; itens seguintes do backlog
(Onda 3) dependem de nova priorizacao do dono do produto.
