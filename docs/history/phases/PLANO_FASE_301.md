# Fase 301 — indicadores factuais por profissional

## Decisão e objetivo

O proprietário escolheu o primeiro incremento do item 8 da auditoria:
indicadores por profissional no painel de operação existente. O PB-26 já mostra
carga, ocupação e no-show, mas não apresenta claramente consultas concluídas e
uma taxa de conclusão. A Fase 301 completa essa leitura factual, sem ranking,
comparação de desempenho individual ou interpretação de qualidade clínica.

Modelo sugerido: GPT-6 Sol, esforço alto. Skills: planejamento, TDD,
NestJS/TypeORM, segurança, React e Playwright; `fechar-fase` no encerramento.
Risco **R4**: os dados vêm da agenda e de profissionais do tenant. O menor
escopo mantém `Client` + `cliente.acessar`, `ExecutorTenant`, RLS e somente
agregados por profissional, sem paciente, prontuário, exportação ou novo papel.
Não há migration nem operação de produção. Rollback é de código; dados
persistidos não mudam.

## Contrato dos indicadores

- Mês civil no fuso da clínica. Consultas, desfechos e cancelamentos são
  contados pelo início no mês. O estado mostrado é o estado **atual** do
  agendamento, não um snapshot histórico.
- `consultas`: horários não cancelados iniciados no mês; `concluidas`, `faltas`
  e `canceladas` são contagens separadas. `taxaConclusao = concluidas /
  (concluidas + faltas) × 100`, arredondada ao inteiro; sem esses desfechos,
  retorna `null` e a tela diz “Sem dados”. Cancelamentos não entram no
  denominador. `taxaNoShow` mantém sua fórmula atual, complementar à conclusão.
- Ocupação usa união dos trechos de consultas não canceladas dentro da união
  dos expedientes no mês. Horários duplicados/sobrepostos contam uma vez,
  mantendo a taxa entre 0% e 100%. Falta ocupa o horário reservado;
  cancelamento não ocupa. Sem expediente, valores dependentes dele são `null`.
- Consulta que cruza o limite do mês contribui à ocupação somente no trecho
  pertencente ao mês e ao expediente, mesmo que tenha começado no mês anterior.
  Sua contagem de consultas/desfechos e do indicador fora do expediente continua
  no mês de início.
- Profissional arquivado com consulta iniciada no mês, horário não cancelado
  que cruza a fronteira do mês ou pacientes ativos ainda
  atribuídos aparece no histórico com marcador “Arquivado”. Profissional
  arquivado sem atividade/carga no período fica fora da tabela. Tudo permanece
  restrito ao tenant da credencial.
- O cliente vê fórmulas e contagens, sem nomes/IDs de pacientes, texto clínico,
  PHI, score ou dados financeiros. A tabela conserva leitura mobile e foco.

## Implementação planejada

1. Acrescentar regressões de sobreposição, fronteira do mês, mês sem desfechos,
   cancelamentos, profissional arquivado e escopo do tenant; observar RED.
2. Ajustar a leitura SQL temporal e a agregação de intervalos do serviço
   existente. Manter os nomes atuais de contrato e adicionar campos factuais
   mínimos; não criar módulo nem tabela novos.
3. Apresentar concluídas, conclusão, faltas e cancelamentos na tabela do
   portal, com definição acessível e estado sem dados. Ajustar fixture visual.
4. Reconciliar status, checklist, resumo, auditoria e matriz de confiabilidade
   na mesma branch. Registrar a Fase 300 integrada pelo PR #358 e deixar
   explícitas as recomendações ainda pendentes do item 8 e PB-30.
5. Revisar diff e fronteira de tenant, executar testes focados, typechecks,
   lint, browser proporcional, preflight documental, `git diff --check` e
   `pnpm security:secrets`; CI PostgreSQL/RLS e revisão cruzada são gates.

## Revisão de gaps antes de codificar

- **Sobreposição de consultas ou expedientes:** somar minutos por linha pode
  superar 100%; fundir intervalos antes de calcular ocupação.
- **Limite do mês:** consulta pode começar no mês anterior e ocupar o primeiro
  dia do seguinte. Selecionar por interseção temporal, mas contar desfechos
  apenas no mês de início; usar limites do PostgreSQL no fuso da clínica.
- **Histórico de profissionais arquivados:** filtro de ativos atual apaga
  períodos anteriores; incluir arquivados com atividade/carga, marcados.
- **Números sem desfecho:** não converter denominador zero em produtividade
  zero. Canceladas não são falta nem consulta concluída.
- **Unidade de interpretação:** minutos reservados medem agenda, não duração
  real de atendimento; a interface não os chama de tempo atendido.
- **Privacidade e escopo:** nome profissional já autorizado no PB-26; resposta
  continua agregada, por tenant, sem IDs de paciente. Não criar ranking nem
  expor o painel para `Professional` ou API pública nesta fase.

## Aceite e limites

O mesmo mês sintético deve produzir contagens, taxa e ocupação coerentes com
os contratos acima. A autorização de `Client` e o tenant da credencial devem
permanecer. PostgreSQL/RLS local exige ambiente disponível; `SKIPPED` não é
aprovação. A auditoria será reconciliada como estado atual, preservando o
texto histórico original quando identificado como tal.

## Execução local em 2026-10-01

- **PASS**: Jest de serviço/controlador (12 testes), BFF do painel (3 testes),
  typecheck backend/web, lint web sem erros (62 avisos não bloqueantes),
  linguagem, Playwright desktop/mobile (2 testes), matriz de
  confiabilidade, preflight documental, `git diff --check` e scanner de secrets.
- **SKIPPED**: PostgreSQL/RLS local, pois o comando `docker` não está instalado.
  O CI e a revisão cruzada R4 permanecem gates antes do merge. Nenhum banco
  externo, migration ou ambiente de produção foi alterado neste ciclo.
