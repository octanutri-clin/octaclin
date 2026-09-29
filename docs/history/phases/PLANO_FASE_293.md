# Fase 293 — aviso de conduta terapêutica próxima do vencimento

## Objetivo e decisão

Mostrar ao profissional, na fila de prioridade do dashboard clínico, a conduta publicada cuja `validade_fim` esteja entre hoje e os próximos sete dias corridos, inclusive, conforme decisão do proprietário. Hoje é a data civil em `GOOGLE_CALENDAR_TIMEZONE` válido, com o fallback clínico já utilizado pelo dashboard. Após o dia de validade, somente o alerta existente `conduta_vencida` se aplica. O aviso é interno; não cria tarefa, altera conduta ou envia mensagem ao paciente.

## Contrato

1. Reutilizar a consulta tenant-aware de pacientes ativos do profissional, condutas não arquivadas e versões publicadas não descartadas. Selecionar a versão vigente pela maior numeração, independente da ordem recebida do banco.
2. A janela preventiva é `hoje <= validade_fim <= hoje + 7 dias civis`. Validade ausente ou superior a sete dias não gera aviso. No oitavo dia anterior, nada aparece; no sétimo, aparece; no próprio dia, ainda é preventivo; no dia seguinte, passa a vencido. Datas gravadas antes da ativação entram na leitura do dashboard sem envio retroativo.
3. O DTO do alerta contém apenas IDs opacos, tipo, prioridade, data de validade e flag de ocultação. A interface mostra a data civil de vencimento e abre a aba Condutas do prontuário já autorizado, sem título/conteúdo clínico nem dados sensíveis em logs.
4. O novo tipo pode ser ocultado por usuário durante 24 horas. A ação revalida tenant, profissional, paciente ativo, conduta não arquivada, versão vigente e janela atual antes de persistir a ocultação. O alerta preventivo e o vencido têm IDs/tipos distintos, portanto ocultar um não oculta o outro.
5. O alerta vencido mantém prioridade 2; o preventivo usa prioridade 3. Nenhuma migration, configuração por clínica, outbox ou alteração de autenticação é necessária.

## Análise de lacunas e solução

| Lacuna | Solução |
| --- | --- |
| Sobreposição com o alerta vencido | Particionar pela data civil, com limite inferior inclusivo no preventivo e vencido estritamente anterior a hoje. |
| Virada do dia, mês, ano e horário de verão | Somar dias em UTC sobre `YYYY-MM-DD` clínico e comparar apenas strings ISO de data, sem duração em horas. |
| Versões retornadas sem ordem estável | Usar o resolvedor de versão vigente tanto na listagem quanto na revalidação da ocultação. |
| Conduta arquivada, rascunho ou paciente fora do escopo | Reutilizar filtros existentes e revalidar antes de ocultar. |
| Ocultação preventiva atravessando o vencimento | Tipos distintos; o vencido volta a aparecer no dia seguinte mesmo se o aviso preventivo estiver oculto. |
| Texto “Registrado em” e horário incorreto para coluna `date` | Exibir “Vence em” e data civil no aviso; o tipo vencido exibe “Venceu em”. |
| Conduta publicada antes da ativação | Cálculo em leitura: aparece se ainda estiver na janela, sem escrita ou disparo retroativo. |
| Nova versão publicada enquanto alerta está oculto | O ID de ocultação preventiva inclui a versão vigente, para uma nova versão não herdar a ocultação anterior. |

## Implementação e revisão

1. Acrescentar predicado de proximidade no domínio e resolver condutas no serviço do dashboard em uma única passagem.
2. Acrescentar tipo ao DTO, montagem da fila e revalidação da ocultação com ID de versão; manter as fronteiras existentes de `ExecutorTenant` e autorização.
3. Ajustar microcopy e link para o prontuário na interface.
4. Reconciliar auditoria, checklist e status no mesmo PR. Revisar diff, segredos e checks aplicáveis.

## Risco e rollback

R4 por leitura de dados clínicos por tenant. Rollback é reverter o deploy do serviço e interface; a tabela de ocultações pode conservar IDs do novo tipo por até 24 horas, sem efeito no contrato antigo. Não há DDL nem operação de produção. CI, revisão cruzada e prova de tenant/RLS seguem pendentes até execução na PR.

## Gates locais antes do PR

- PASS: typecheck backend e web; lint web com zero erros e 62 avisos no conjunto do projeto; `git diff --check`; `pnpm security:secrets`.
- SKIPPED: testes de comportamento específicos da janela preventiva e da ocultação, não solicitados nesta tarefa. Os specs existentes cobrem o alerta vencido, mas não provam os novos limites; registrar essa lacuna na matriz de confiabilidade e na PR.
- SKIPPED: prova externa de RLS, revisão independente, checks de CI e deploy; dependem da PR ou de ambiente autorizado. Sem migration nesta fase (NA).
- Limite de ambiente: typechecks locais executados em Node 24; o projeto declara Node 22 como faixa suportada, cuja validação fica para CI.
