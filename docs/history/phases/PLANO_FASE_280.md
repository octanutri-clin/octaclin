# Fase 280 — PB-26: painel de operação da clínica

## Decisão e escopo

O proprietário fixou a Onda 5 na sequência PB-26 → PB-27 → PB-21 → PB-29 e
escolheu GPT-6 Sol em esforço médio para este PB. Risco R4: o painel agrega
agenda e classificação de pacientes, atravessando tenancy, autorização e
dados sensíveis. O menor escopo é uma leitura agregada para `Client`, no portal
da clínica, sem lista ou identificador de paciente e sem mudança de schema.
Auditoria do tenant é PB-27; exige decisão jurídica antes de implementação.

O endpoint `GET /cliente/painel-operacao` aceita apenas `mes=AAAA-MM`; o tenant
vem exclusivamente da credencial. A consulta usa `ExecutorTenant`, parâmetros
SQL e RLS. O BFF repete a exigência de `cliente.acessar`. Nenhum indicador
entra em log, cache de navegador, telemetria ou exportação.

## Fórmulas e leitura

- Período: mês civil no fuso configurado da clínica; padrão é o mês atual.
  Consultas entram pelo início no período. Pacientes novos são os cadastrados
  no período que continuam ativos na data da leitura.
- Pacientes ativos: `status_ciclo_vida = ACTIVE`, sem arquivamento ou exclusão.
  Inclui recém-cadastrados, conforme decisão do proprietário. Em risco é
  subconjunto desses ativos: `status_adesao = risco` ou `score_risco >= 70`.
- Carga: pacientes ativos atribuídos ao profissional, consultas não canceladas
  iniciadas no mês e contagem de consultas sem profissional atribuído.
- No-show por profissional: `falta / (falta + concluida)` no mês. Sem consulta
  com desfecho, exibir “Sem dados”. Agendadas/reagendadas e canceladas não
  entram no denominador.
- Ocupação: minutos de consultas não canceladas dentro das faixas de expediente
  cadastrado ÷ minutos disponíveis nessas faixas no mês. Faltas ocupam o slot
  reservado; cancelamentos não. Consultas total ou parcialmente fora da faixa
  são contadas à parte. Sem expediente cadastrado, ocupação e contagem fora
  da faixa são “Sem dados”, não zero. O expediente de PB-18 restringe apenas
  agendamento público; consultas manuais/recorrentes podem estar fora dele.

## Entrega e evidência

1. Serviço de agregação tenant-aware, endpoint protegido e contrato mínimo.
2. Aba Operação no portal do cliente com seletor de mês, fórmulas legíveis,
   estados de carregamento/erro/sem dados e tabela por profissional.
3. Testes positivos e negativos de mês e escopo do tenant, contrato BFF e
   cenário visual com dados sintéticos. Revisão cruzada de tenancy.
4. Typecheck, testes focados, authz Web, build, `git diff --check`, scanner de
   secrets e validação documental; resultados registrados na PR. Nenhuma
   prova de produção é inferida desses gates.

## Rollback e limite operacional

Não há migration nem escrita persistente. Reverter o endpoint, a aba e o BFF
restaura o comportamento anterior. Nenhuma ação em staging/produção é parte
desta PR. A revisão dos indicadores deve usar dados sintéticos ou contagens
agregadas autorizadas; nenhuma PHI/PII real deve entrar em issue, PR, log,
fixture ou ferramenta externa.
