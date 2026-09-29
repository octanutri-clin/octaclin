# Fase 291 — calendário configurável de lembretes e follow-ups de consulta

## Estado e evidência de partida

- Modelo escolhido: **Sol High**. Skills usadas: `idea-refine`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `nestjs-best-practices`, `typeorm`, `database-migration` e `security-review`.
- Implementação em revisão final na branch `feat/fase291-followups-configuraveis`, criada de `origin/main` no commit `dd70ca21` (merge do PR #344). A migration 1057 foi escrita e testada localmente, sem aplicação em banco externo.
- Risco **R4**: agenda de pacientes, envio externo, autorização e isolamento por tenant. O escopo deve passar por revisão cruzada quando viável.
- A auditoria de produto, seções 7, 15 e 16, pede acompanhamento das consultas não confirmadas. A fila manual de 48 horas já existe desde a Fase 264.6; o efeito automático condicionado à confirmação ainda falta.
- O lembrete atual (`ServicoLembretesAgenda`) procura apenas consultas `agendada` entre 23 e 25 horas à frente, tenta e-mail e WhatsApp separadamente e grava `notificacoes.lembrete24h` após chamar comunicações. A configuração é fixa e o caminho não garante uma reserva atômica por etapa.
- `CriarConsultaAgendaDto.enviarNotificacoes` corresponde ao controle da interface “Enviar e-mail e mensagem ao salvar”: ele governa o aviso imediato. O calendário futuro precisa de um controle próprio, sem reinterpretar essa opção existente.
- O PR #344 foi confirmado como integrado em 2026-09-29: checks aplicáveis `SUCCESS`, `Provenance do SBOM` `SKIPPED`. A reconciliação da Fase 290 entrou neste mesmo conjunto de alterações, sem PR documental isolada.

## Decisões do proprietário

1. A clínica controla **quantos** follow-ups são programados e **quando** cada um ocorre.
2. O editor oferece cadências mensal, quinzenal, semanal e diária e também etapas individuais relativas ao evento, incluindo dias, horas e minutos antes da consulta.
3. O lembrete fixo de 24 horas entra no calendário configurável; a clínica pode alterá-lo ou removê-lo.
4. Existe um padrão por clínica, com possibilidade de ajuste para uma consulta específica.
5. A quantidade máxima é **30 envios por consulta**.

## Contrato de produto proposto

### Configuração e experiência

- Um editor de calendário na área de Agenda apresenta as etapas em ordem temporal, a quantidade total ativa e uma prévia das datas/horários para uma consulta de exemplo ou selecionada. Só a prévia de uma consulta real pode indicar o canal elegível e o efeito da janela de comunicação daquele paciente.
- O modo **cadência** pede frequência, quantidade e instante da primeira etapa antes da consulta. Ele gera uma lista editável: por exemplo, três envios diários iniciados três dias antes produzem 3, 2 e 1 dia antes. Quinzenal corresponde a 14 dias de calendário; mensal usa meses de calendário no fuso da consulta. A lista gerada é a fonte persistida; frequência e quantidade podem ser alteradas gerando nova lista antes de salvar.
- O modo **manual** permite adicionar, remover e editar etapas como 7 dias, 5 dias, 1 dia, 12 horas, 6 horas, 1 hora e 30 minutos antes. O usuário pode gerar uma cadência e editar/adicionar etapas na mesma lista. Persistir a lista normalizada; a quantidade efetiva é o número de etapas salvas. A execução ordena as etapas pelo instante calculado.
- Para etapas expressas em dias, semanas, quinzenas ou meses, permitir escolher um horário local; sem horário específico, usar o horário local da consulta. Horas e minutos são subtraídos como duração exata do instante da consulta. Mostrar a prévia no fuso da consulta e tratar horário de verão de forma determinística, com testes.
- Cada etapa tem condição `sempre` (lembrete logístico) ou `somente_se_nao_confirmada` (follow-up de confirmação). O padrão inicial contém uma etapa de 24 horas com condição `sempre`, preservando a finalidade do lembrete existente. Uma confirmação encerra somente as etapas condicionais; a clínica pode alterar a condição das etapas.
- Uma etapa representa **no máximo uma mensagem externa**, pelo canal permitido preferido no momento do envio. O histórico separa programada, enfileirada, enviada, suprimida, falha e entrega incerta. Retentativa técnica da mesma etapa não aumenta a quantidade configurada. Configuração vazia ou desligada significa zero mensagens futuras. O teto de 30 considera todo o ciclo da consulta, inclusive horários anteriores após reagendamento; envios efetivos ou de resultado externo incerto consomem o orçamento, e a prévia mostra o saldo.
- O padrão é administrado por profissional autorizado com `automacoes.gerenciar` (capability privilegiada com MFA). A exceção por consulta usa a mesma capability, pode ser removida para voltar a herdar o padrão e só afeta a consulta do tenant autenticado. Colaboradores que apenas marcam consultas herdam o padrão.
- A consulta apresenta separadamente o controle de aviso imediato ao salvar e o calendário futuro. Para o calendário, a pessoa autorizada escolhe `herdar padrão`, `personalizar` ou `desativar`; o último equivale a zero etapas, sem alterar o opt-out do paciente nem o aviso imediato já enviado.
- O aviso imediato de criação permanece fora da contagem de follow-ups; a interface apresenta os dois números separadamente. Se uma etapa vencer muito perto do aviso de criação, o servidor evita repetir a mesma comunicação dentro da janela mínima de 30 minutos e registra a supressão na prévia/histórico.
- O texto continua vindo dos templates aprovados de lembrete de consulta. Esta fase personaliza calendário e quantidade; não abre edição livre do conteúdo enviado.
- O editor mostra a diferença entre o padrão e a exceção, simula o resultado antes de ativar uma alteração e informa quantas consultas futuras serão replanejadas. Não exibir dados de outros tenants nem conteúdo clínico na simulação.

### Regras de elegibilidade e tempo

- Processar `agendada` e `reagendada` enquanto o início ainda é futuro. Cancelamento, falta e conclusão encerram todas as etapas pendentes. Confirmar paciente suprime somente etapas condicionais.
- Em consulta criada depois de uma etapa já vencida, ignorar essa etapa; nunca fazer disparo retroativo ou em rajada. Em edição do padrão, replanejar somente etapas futuras das consultas que ainda herdam o padrão; exceções permanecem. Histórico enviado é imutável.
- Em reagendamento, invalidar etapas pendentes do horário anterior e calcular as etapas do novo horário, preservando as já enviadas no histórico e o saldo do teto de 30. Se o padrão exceder o saldo, manter as etapas futuras mais próximas da nova consulta e mostrar as descartadas na prévia. Uma nova etapa no mesmo instante lógico já enviado não deve gerar outra mensagem.
- `enviarNotificacoes=false` continua significando apenas “não avisar ao salvar”. O calendário futuro usa a política herdada ou a exceção explícita da consulta; criação pública, duplicação e série recorrente herdam o padrão quando não houver exceção. Preferências/opt-out do paciente ainda prevalecem em todos os envios.
- A exceção por consulta exige, além de `automacoes.gerenciar`, o escopo profissional já aplicado às operações da agenda. Um profissional não altera calendário de consulta de outro profissional só por compartilhar tenant.
- Preferências/opt-out, canal ativo, contato legível, janela local de comunicação, aprovação do template WhatsApp e limite operacional são reavaliados na execução. Quando a hora pedida cai fora da janela, usar o próximo horário permitido **anterior ao início da consulta** e mostrá-lo na prévia; se não houver, suprimir a etapa com motivo. Nunca enviar após o início.
- Rejeitar valores negativos, zero como antecedência, mais de 30 etapas, etapas duplicadas no mesmo instante lógico e cronogramas que não caibam antes da consulta. Validar intervalo mínimo de 30 minutos entre duas etapas da mesma consulta. Permitir zero etapas para desativar. O teto e eventual supressão pelo saldo são exibidos na UI/DTO.
- A confirmação WhatsApp já gravada em `notificacoes.confirmacaoPaciente` é o sinal atual. Mensagens livres de cancelamento/reagendamento continuam na caixa de entrada para decisão humana; não alterar a agenda automaticamente.

## Desenho técnico

### Persistência e migração

- Migration aditiva após a 1056, executável apenas fora de banda com role owner no ambiente confirmado. Criar uma política versionada por tenant e exceções opcionais por consulta; separar padrão de exceção por unicidade. Usar JSONB somente para a lista validada de etapas, sem mensagem, nome ou contato do paciente.
- Criar ocorrências persistidas por etapa e consulta: tenant, consulta, horário de início da consulta capturado, identificador lógico da etapa, vencimento, estado, versão de política, chave idempotente, referência da mensagem e motivo de supressão. Indexar `(tenant_id, estado, vencimento)` e impor unicidade por consulta/horário/etapa. A consulta e a ocorrência devem ter vínculo coerente com o mesmo tenant.
- A ausência de exceção significa herdar o padrão; uma exceção pode conter a sequência personalizada ou o estado `desativado`. Não criar uma coluna que misture esse controle futuro com `enviarNotificacoes`, cujo significado é o aviso imediato.
- Habilitar e forçar RLS nas novas tabelas, com políticas `USING` e `WITH CHECK` sobre `app.tenant_id`; criar índices e constraints necessários. Runtime não recebe privilégio de DDL.
- Configurações versionadas e histórico de ocorrências enviadas não são apagados por edições. Replanejar em lotes/cursor, por tenant, as ocorrências futuras afetadas por uma mudança do padrão; o endpoint de edição não faz varredura ilimitada. O contador por consulta é calculado do ledger persistido, com proteção transacional para não ultrapassar 30 em concorrência.

### Agendamento, envio e integração

- Centralizar a criação/replanejamento das ocorrências no serviço de agenda, alcançando criação interna, pública, duplicação, série recorrente, reagendamento interno/Google e cancelamento/desfecho. Toda entrada de ID relacionado é conferida no tenant derivado da credencial ou do processo servidor.
- Um processador por tenant ativo reivindica em lotes limitados as ocorrências vencidas com bloqueio de linha e `skip_locked`. A mensagem e o respectivo evento de outbox são gravados juntos pela infraestrutura de comunicações, com chave idempotente. Uma queda entre reivindicação e gravação é recuperada pelo lease da ocorrência. O despacho revalida consulta, horário, condição, política por ID e versão, paciente e canal antes do adaptador externo.
- Reivindicações `processando` precisam de lease/recuperação após queda do worker. O outbox atual deve ser verificado para esse cenário; se não recuperar eventos órfãos, adicionar a recuperação proporcional ao tipo novo antes de ativar o calendário.
- O processamento final da mensagem revalida a elegibilidade imediatamente antes do adaptador externo, para cobrir confirmação, cancelamento, remarcação e opt-out ocorridos após o enfileiramento. O caminho deve evitar ciclo de dependência entre módulos. Usar a chave idempotente e a unicidade existente das mensagens.
- Expor somente DTO mínimo de política, prévia e status das etapas ao console autorizado; não devolver entidades ORM nem payload bruto da agenda. A leitura de calendário acompanha `agenda.consultas.ler`, enquanto escrita de padrão/exceção exige `automacoes.gerenciar`. Auditar alterações de padrão/exceção e transições relevantes sem destino, corpo da mensagem ou dados clínicos.
- Não introduzir novo gatilho genérico em `regras_automacao`: esse contrato é por profissional e não oferece edição de um padrão por clínica. Reutilizar cron, outbox, comunicações, templates e preferências existentes.

### Compatibilidade, ativação e rollback

- A migração **não** ativa novos envios. A aplicação preserva o lembrete legado até a confirmação da migration e do cutover no ambiente alvo. Introduzir uma chave de ativação/versão do motor e fazer os dois caminhos se excluírem por tenant; não deixar o cron antigo e o novo dispararem a etapa de 24 horas simultaneamente.
- Na transição, reconhecer `notificacoes.lembrete24h` já processado para não reenviar a etapa equivalente. Como o marcador antigo não contém um identificador forte do horário da consulta, tratar casos ambíguos de forma conservadora e mostrá-los no relatório de simulação.
- Ensaiar com dados sintéticos em banco descartável: contagens, prévias, RLS, idempotência, uma série recorrente e consulta remarcada. Para staging/produção, confirmar banco, branch, role e migrations pendentes; aplicar fora de banda com owner; verificar antes de ativar. Não há autorização neste plano para executar migration externa.
- Rollback operacional: desligar o novo processador e preservar tabelas/histórico; o lembrete de 24 horas só pode voltar pelo caminho legado após checagem do ledger para não duplicar. Não reverter migration com dados de envio. Registrar passos e observabilidade no runbook.
- Garantir ausência de duplicação na aplicação e tratar recibo incerto do provedor como estado que exige reconciliação, sem retentativa cega após uma possível entrega externa.

## Tarefas em ordem de dependência

### Bloco 1 — contrato e persistência

1. [x] **Contrato do calendário.** Formalizar etapas, condições, limite de 30, gerador e regras de fuso. Dependência: nenhuma. Aceite: prévias determinísticas para fim de mês, fevereiro bissexto, quinzenal, semanal, diário, horas/minutos e horário de verão. Verificação: specs puras em TDD e casos rejeitados de duplicata/intervalo.
2. [~] **Schema e RLS.** Migration aditiva, ORM, índices, unicidade, política e ocorrência implementados. Dependência: 1. Aceite externo: tenant A não lê nem altera dados de B; exceção desativada não afeta o aviso imediato; nenhuma migration executa no runtime. Verificação: spec da migration PASS; prova em PostgreSQL real pendente no CI/ambiente de ensaio.
3. [x] **API de política e prévia.** Leitura, escrita versionada do padrão, escrita/remoção de exceção e cálculo de prévia. Dependências: 1–2. Aceite: escrita com `automacoes.gerenciar`, leitura com escopo de agenda, escopo do profissional, resposta mínima e rejeição de IDs de outro tenant. Verificação: specs de serviço e controller com casos negativos.

**Checkpoint 1:** contrato estável, schemas isolados por tenant e API autorizada; specs focadas, typecheck e revisão do diff destes componentes.

### Bloco 2 — ciclo da consulta

4. [x] **Criação e herança.** Integrar agenda interna, pública, duplicação e série recorrente ao padrão; manter `enviarNotificacoes` restrito ao aviso imediato. Dependências: 2–3. Aceite: cada consulta criada herda ou usa exceção sem retroatividade; zero etapas significa zero envios futuros; o aviso ao salvar preserva seu contrato. Verificação: specs de agenda e calendário.
5. [x] **Mudanças e reconciliação.** Remarcação, cancelamento, desfecho, confirmação e edição de padrão/exceção replanejam apenas ocorrências permitidas. Dependência: 4. Aceite: ledger enviado preservado, saldo de 30 respeitado e cursor por tenant sem rajada. Verificação: specs de agenda, saldo e política; concorrência real segue gate de banco.

**Checkpoint 2:** criação, alteração e encerramento mantêm calendário coerente em banco sintético; sem envio externo ainda.

### Bloco 3 — entrega e interface

6. [x] **Cron e outbox.** Reivindicar vencimentos por tenant; comunicações grava mensagem e evento idempotente na mesma transação. Dependência: 5. Aceite: uma queda do worker não deixa ocorrência ou evento preso para sempre. Verificação: specs de worker/outbox e recuperação de evento antigo; prova concorrente em Postgres real permanece gate externo.
7. [x] **Comunicações e checagem final.** Revalidar estado da consulta e preferências no despacho e antes do adaptador; selecionar um canal e template aprovado. Dependência: 6. Aceite: confirmação/cancelamento/opt-out posterior impede envio, payload mínimo, falha e recibo incerto não viram mensagem adicional. Verificação: specs de worker, canais, janela, template e corrida antes do envio.
8. [x] **Editor da clínica.** Construir gerador, lista editável, prévia, quantidade/saldo e desativação. Dependências: 3 e 7. Aceite: controles nativos de teclado e edição visível só com capability. Verificação: build, lint, testes de authz do BFF e cenário Playwright sintético de geração e salvamento.
9. [x] **Exceção e acompanhamento na consulta.** Ajustar/remover exceção e mostrar etapas previstas, enviadas e suprimidas na agenda. Dependências: 5 e 8. Aceite: voltar a herdar padrão funciona; recepção sem capability não muda o calendário. Verificação: specs backend negativas, teste visual e gate authz Web.

**Checkpoint 3:** fluxo completo com calendário customizado, confirmação e reagendamento, sem duplicatas e sem vazamento entre tenants.

### Bloco 4 — ativação e documentação

10. [x] **Cutover compatível no código.** Implementar exclusão do motor legado, leitura do marcador de 24h e gate de ativação após migration. Dependências: 6–7. Aceite: antes/depois do cutover há um único caminho por tenant. Verificação: testes da transição; simulação em banco sintético e aplicação externa permanecem gates operacionais.
11. [x] **Runbook e reconciliação.** Documentar migration/ativação/rollback e atualizar Fase 290 pelo PR #344, Fase 291, status, checklist e auditoria no mesmo PR de produto. Dependência: 10. Aceite: sem afirmação de produção sem prova; referências e próxima fase coerentes. Verificação: `pnpm validate:docs` e revisão factual contra GitHub.
12. [~] **Gates e revisão final.** Revisão cruzada R4 quando viável, testes adequados ao impacto, diff, secrets e handoff/PR único. Dependência: 11. Aceite: PASS/FAIL/NA/SKIPPED explícitos e nenhum dado sensível no diff. Verificação: gates locais PASS; revisão independente, PostgreSQL real, aplicação externa da 1057 e checks do PR pendentes.

## Revisão do plano: lacunas identificadas

| Lacuna | Resposta incorporada |
| --- | --- |
| O lembrete de 24h pode duplicar a primeira etapa nova | Cutover exclusivo por tenant, marcador legado e chave por etapa/horário. |
| O checkbox atual poderia ser interpretado incorretamente como opt-out futuro | Manter “Enviar e-mail e mensagem ao salvar” apenas para o aviso imediato e oferecer `herdar`, `personalizar` ou `desativar` para o calendário futuro. |
| Aviso imediato e primeira etapa podem coincidir | Exibir contagens separadas e suprimir etapa redundante dentro de 30 minutos do aviso inicial. |
| Confirmação ou remarcação chega depois da seleção | Revalidar na outbox e imediatamente antes do adaptador. |
| Alterar o padrão poderia disparar etapas antigas em massa | Replanejar somente vencimentos futuros, em lotes, com prévia. |
| Mês civil e horário de verão não equivalem a minutos fixos | Regras distintas para calendário e duração, com testes de borda. |
| Uma etapa em e-mail e WhatsApp contaria como dois envios | Selecionar um único canal externo autorizado por etapa. |
| Série recorrente pode multiplicar o volume | Gerar por ocorrência, impor limite de etapas e processar em lotes. |
| Reagendamento poderia reiniciar o teto de envios | Contar todo o ledger da consulta; replanejar somente o saldo e mostrar descartes. |
| A prévia genérica não conhece preferências do paciente | Mostrar horário/canais efetivos somente na prévia de uma consulta real. |
| O provedor pode aceitar uma mensagem antes de uma falha local | Registrar estado de entrega incerta e exigir reconciliação antes de nova tentativa. |
| Worker pode morrer com outbox em `processando` | Definir lease e recuperação de evento órfão antes de ativar o novo tipo. |
| Profissional pode tentar alterar consulta de colega no mesmo tenant | Validar também o escopo profissional antes de criar exceção. |
| Migration fora de banda pode ainda não existir no ambiente | Ativação separada, verificação da versão do schema e rollback sem perda de histórico. |
| A auditoria também cita falta e paciente sem próxima consulta | Deixar essas sugestões na sequência documentada; esta fase cobre o calendário de consultas ainda futuras. |

## Validação e handoff previstos

- TDD em contratos de calendário, APIs, RLS/tenant, ciclo da consulta, outbox/entrega e UI; testes negativos são obrigatórios para o limite R4.
- Depois da implementação, rodar specs focadas, typecheck, build/gates exigidos pelo impacto, `pnpm validate:docs`, `git diff --check` e `pnpm security:secrets`; registrar Node e ambiente usados. Não executar testes durante o planejamento.
- Revisar o diff e solicitar revisão cruzada de authz/tenant, migration, idempotência e conteúdo externo. O PR único incluirá código, migration, testes, runbook necessário e reconciliação documental.

## Evidência local e pendências de aceite

- **PASS:** backend Jest completo após a revisão do ID de política (234 suítes, 2202 testes), typecheck backend e Web, build Web, lint Web com 0 erros e 62 avisos, `test:authz` Web, linguagem da interface, Playwright Agenda (6 cenários), `test:migracoes-fora-de-banda` (13), `validate:docs`, `git diff --check` e `security:secrets`.
- **SKIPPED:** prova de RLS/FK e concorrência em PostgreSQL descartável local; Docker não está disponível. CI ainda precisa executá-la em PostgreSQL real. Não há evidência de migration 1057 aplicada em staging/produção.
- **Pendente:** revisão cruzada independente R4, checks da PR e aplicação fora de banda da 1057 em alvo confirmado antes do deploy/ativação. A existência do código não autoriza ativar envios reais.
- **Decisão de implementação:** a lista normalizada é persistida; o editor não guarda metadados separados do gerador nem um estado de desativação por etapa. Uma etapa removida deixa de constar da política e `ativo=false` desativa a sequência inteira. A prévia de consulta mostra horário solicitado e horário ajustado pela janela; seleção de canal é revalidada no envio e não é prometida na prévia.
