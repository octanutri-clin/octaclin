# Fase 292 — reagendamento proativo após falta

## Objetivo e decisões

Quando uma consulta receber o desfecho `falta`, oferecer à clínica uma decisão explícita de contato para reagendamento. A aprovação ocorre em uma layer da tela atual; o sistema só então prepara uma única mensagem em canal autorizado. A reprovação encerra a pendência sem contato. Uma fila persistente no painel permite decidir depois de fechar a layer. O contato não agenda horário nem altera o desfecho da consulta.

As faltas dos últimos 90 dias serão exibidas como indicador factual e influenciarão a ordem da fila de pacientes sem retorno, mantendo `score_risco` manual intacto. Fórmula geral, pesos clínicos e override auditado permanecem decisão de produto posterior, como registra a seção 5.1 da auditoria.

## Contrato e limites

1. O serviço de agenda grava estado mínimo de reagendamento na mesma transação que registra a falta. Consultas anteriores à ativação não são contatadas retroativamente. Repetir o desfecho terminal continua recusado.
2. A decisão usa tenant da credencial, escopo do profissional e permissão de escrita na agenda. Consulta fora de escopo não é encontrada. Repetição da mesma decisão é idempotente; decisão oposta após finalização é conflito.
3. A aprovação não ignora opt-out. O processador confere novamente consulta, paciente ativo, agendamento futuro, canal, template específico e janela de horário no momento do envio. A chave de idempotência de mensagem é por tenant e consulta. Nenhum texto, contato ou nome é adicionado ao estado da consulta ou à auditoria.
4. Mensagem só pode usar template `agenda.consulta.reagendamento_proativo` configurado na clínica; WhatsApp exige aprovação externa. Sem canal ou template, mostrar pendência operacional e permitir nova tentativa após configuração. A aprovação só pode gerar envio nos sete dias posteriores ao término da consulta perdida, mesmo quando a falta for registrada depois; depois disso, encaminhar o reagendamento à equipe.
5. A interface da agenda e do painel abre modal acessível depois de marcar falta. Fechar o modal preserva a pendência; a fila do painel permite aprovar ou reprovar depois. Estado de erro não é confundido com envio realizado.

## Ordem de implementação

1. Estado e decisão no serviço de agenda: transação, autorização, concorrência, idempotência e auditoria mínima.
2. Processamento de contato por tenant com preferência, janela, template, outbox existente e supressões. Sem migration se o JSONB atual comportar o estado mínimo.
3. Consulta de pendências e contagem de faltas recentes no dashboard, sempre filtradas por tenant e profissional. Ordenação explicável sem reescrever `score_risco`.
4. BFF e interface: layer nos dois pontos de registro de falta, fila de decisões e feedback de aprovação, reprovação ou bloqueio.
5. Revisão de lacunas, reconciliação da auditoria, checklist e status no mesmo PR; revisão do diff, typecheck/build e gates aplicáveis.

## Gaps revisados

| Gap | Tratamento |
| --- | --- |
| Score de risco não possui fórmula | Indicador separado; nenhum peso clínico inventado. |
| Dois profissionais aprovam ao mesmo tempo | Lock da consulta; estado terminal da decisão; chave de mensagem única. |
| Paciente agenda retorno antes do envio | Rechecagem de consulta futura e supressão da mensagem. |
| Modal é fechado ou navegador recarrega | Pendência persistida e fila no dashboard. |
| Opt-out ou canal muda depois da aprovação | Rechecagem na execução, sem override. |
| Horário bloqueado | Adiar até janela autorizada dentro do prazo; nunca enviar fora dela. |
| Preferência, prazo ou agenda mudam depois da criação da mensagem | Revalidar imediatamente antes do adaptador e cancelar a entrega; reservar a tentativa antes da chamada externa para evitar duplicidade em entrega incerta. O resultado final da mensagem é acompanhado em Comunicações. |
| Sem template específico configurado (WhatsApp sem aprovação) | Não enviar; sinalizar configuração pendente. A tela de comunicações oferece o evento para criação/edição de modelo. |
| Falta antiga ou produção sem template | Sem disparo retroativo; rollout depende de template/canal por tenant. |
| Falta registrada mais de sete dias depois da consulta | Estado expirado imediatamente, sem modal de aprovação ou envio; equipe agenda manualmente. |

## Risco, rollback e evidência

R4 por tenancy e comunicação sensível. Rollback: reverter o deploy desta fase; decisões já registradas permanecem no JSONB para reconciliação, e uma mensagem já entregue é irreversível. Não há DDL planejado. A confirmação do usuário sobre migrations de fases anteriores em staging/produção após rebuild é informação reportada pelo proprietário, não prova técnica coletada nesta fase. Não executar operações nesses ambientes. Revisão cruzada é desejável antes do merge.
