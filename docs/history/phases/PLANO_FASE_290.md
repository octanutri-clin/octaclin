# Fase 290 — Lembrete de material educativo não visualizado

## Estado do plano

Planejamento revisado antes da implementação. Implementação concluída nesta
branch; as decisões de produto confirmadas foram: primeiro lembrete após 3 dias
corridos; repetir a cada 3 dias até o paciente visualizar; não incluir envios
anteriores à ativação. Evidências locais registradas ao final deste arquivo.

## Objetivo

Enviar ao paciente um lembrete no portal quando um material educativo enviado
pela clínica continuar sem visualização por 72 horas. Repetir em intervalos de
72 horas até a visualização, sem incluir os materiais enviados antes da Fase
290. O portal recebe sempre o aviso; e-mail ou WhatsApp podem ser usados somente
pelos canais permitidos nas preferências do paciente e nas regras já existentes
de janela, contato, template, frequência e opt-out.

## Evidência e contratos existentes

- `envios_material_paciente.visualizado_em` já é escrito de forma idempotente
  pelo endpoint autenticado do portal (`PATCH
  /portal/paciente/materiais/:envioId/visualizacao`). A gravação exige que o
  envio pertença ao paciente vinculado ao usuário e ao tenant autenticado.
- O envio de material individual e em lote registra `enviado_em` dentro de
  `ExecutorTenant`; ambos os caminhos precisam inicializar a agenda do primeiro
  lembrete.
- A outbox de comunicação já é processada a cada 30 segundos, usa reivindicação
  do evento, tenta novamente até o limite existente e encaminha para a fila
  configurada ou para o processador direto.
- A Fase 289 já mantém avisos do portal cifrados e resolve preferências,
  contatos, janela, templates e canal dentro do tenant. A Fase 290 seguirá esses
  contratos sem incluir título, observação ou conteúdo clínico no canal externo.
- A auditoria já declara o PB-07/Fase 264.3 como concluído. A leitura do código
  confirma que não é necessário recriar a trilha de visualização.

## Regras de produto

1. O primeiro lembrete vence 72 horas depois do envio do material.
2. Se continuar sem visualização, a próxima ocorrência vence 72 horas depois
   da ocorrência anterior. Uma rodada atrasada agenda a próxima para 72 horas
   após a rodada atual, sem emitir em sequência lembretes vencidos acumulados.
3. Marcar o envio como visualizado encerra futuras ocorrências. Um evento já
   enfileirado deve revalidar o envio antes de notificar.
4. O aviso do portal é sempre criado para envio elegível, mesmo quando não há
   canal externo permitido ou disponível. Canais externos seguem as preferências
   vigentes no momento do processamento, janela, opt-out, contato válido,
   template do tenant, aprovação WhatsApp e limite global de frequência já
   suportado pelas automações.
5. `qualquer` mantém a prioridade atual: e-mail primeiro; WhatsApp como
   alternativa quando e-mail não está disponível. No máximo um canal externo
   por ocorrência.
6. O conteúdo será genérico: informa que há material disponível no portal, sem
   revelar título, observação ou dado clínico em push, e-mail ou WhatsApp.
7. Envios anteriores à ativação ficam com a nova data de agenda nula; não haverá
   backfill nem disparo retroativo.
8. Se uma mensagem externa for suprimida por opt-out, janela fechada, limite,
   contato ou template ausente, o aviso do portal continua válido e a próxima
   ocorrência mantém o intervalo de 72 horas.

## Risco e limites

- **R4**: os dados pertencem a pacientes e o processamento cruza isolamento
  multi-tenant e canais externos. Todas as leituras e gravações novas usam o
  tenant enumerado no servidor e `ExecutorTenant`; nenhum tenant vem do payload
  do paciente.
- A migration é aditiva e não altera dados existentes. Não executar migration
  em staging ou produção nesta fase. A aplicação fora de banda permanece com o
  proprietário segundo o runbook. Para rollback de aplicação, interromper os
  novos workers revertendo o código; manter coluna e índice aditivos no banco,
  que a versão anterior ignora. Não executar `down` contra ambiente persistente.
- A autorização do WhatsApp depende de template previamente aprovado pela Meta;
  a aplicação não marca templates como aprovados.
- A recorrência é sem limite máximo porque a decisão foi repetir até visualizar;
  o intervalo de 72 horas, o canal permitido e o limite global existente
  reduzem o risco de excesso. O paciente pode continuar consultando o material
  pelo portal; este PB não altera consentimentos ou preferências.

## Desenho técnico

### Persistência e agenda

- Migration aditiva `1056`: coluna `proximo_lembrete_em TIMESTAMPTZ NULL` em
  `envios_material_paciente` e índice parcial para ocorrências não nulas. Sem
  backfill das linhas existentes.
- Mapear a coluna em `EnvioMaterialPacienteOrm`.
- Inicializar `proximoLembreteEm = enviadoEm + 72 horas` tanto no envio
  individual quanto no envio em lote.
- Novo processador cron no módulo de comunicações, habilitado somente junto dos
  demais processadores. Executar por tenant ativo com trava de rodada; selecionar
  no máximo 100 ocorrências vencidas por tenant, somente de envios ainda não
  visualizados e pacientes não arquivados.
- Dentro da transação tenant-aware, avançar a data para `agora + 72 horas` e
  gravar o evento de outbox de forma atômica. Concorrência entre instâncias não
  deve criar ocorrências duplicadas.
- A chave determinística inclui o ID do envio e o vencimento processado; retries
  não podem duplicar o aviso do portal ou a mensagem externa.

### Processamento e entrega

- Estender o processador de outbox para validar o payload e encaminhar o novo
  tipo de evento.
- O serviço de comunicações revalida tenant, envio não arquivado, material e
  paciente elegíveis e ausência de visualização antes de produzir efeitos.
- Criar uma notificação administrativa do portal com conteúdo cifrado e chave
  idempotente por ocorrência.
- Instalar templates iniciais de e-mail e WhatsApp de modo idempotente, sem
  substituir conteúdo editado por tenant e sem aprovar template WhatsApp.
- Selecionar no máximo um canal externo de acordo com as preferências atuais e
  encaminhar pelo caminho já existente de automação/outbox. Passar o intervalo
  de frequência de 72 horas por paciente e canal.
- Exibir a notificação no portal usando a projeção cifrada existente para avisos
  do portal, com texto genérico e acessível.

## Plano de implementação e aceite

### Tarefa 1 — Contratos e migration

- [x] Escrever testes para inicialização do prazo em envio individual e lote.
- [x] Escrever testes para migration, índice parcial e ausência de backfill.
- [x] Adicionar coluna, índice e mapeamento ORM.
- **Aceite:** novos envios recebem vencimento em 72 horas; registros legados
  permanecem nulos.

### Tarefa 2 — Agendador tenant-aware

- [x] Testar processamento de ocorrência vencida, não vencida, já visualizada,
  paciente arquivado e execução repetida.
- [x] Testar concorrência/idempotência e avanço sem catch-up em rajada.
- [x] Implementar cron por tenant e gravação transacional da outbox.
- **Aceite:** uma ocorrência vencida produz no máximo um evento e avança a
  agenda; nenhum item de outro tenant é alcançado.

### Tarefa 3 — Aviso do portal e canais externos

- [x] Testar criação idempotente do aviso cifrado do portal.
- [x] Testar cancelamento efetivo quando o envio é visualizado antes do despacho.
- [x] Testar opt-out, janela fechada, contato indisponível, preferência,
  fallback de canal e exigência de aprovação WhatsApp.
- [x] Testar que o payload externo não contém título, observação nem conteúdo do
  material.
- [x] Implementar templates e processamento do novo evento de outbox.
- **Aceite:** portal recebe conteúdo genérico; canal externo só é enfileirado
  quando todas as políticas autorizam.

### Tarefa 4 — Portal, documentação e reconciliação

- [x] Testar a renderização do novo aviso no portal sem expor payload cifrado.
- [x] Testar que o mapper do portal descriptografa a notificação e que o link
  abre a área do paciente.
- [x] Atualizar seção 15 e seção 16 da auditoria para refletir PR #343 mergeada,
  PB-07 concluído e Fase 290 implementada.
- [x] Atualizar checklist, status atual, resumo de fases e este plano com a
  evidência observada no GitHub e nos gates locais.
- [x] Revisar links, `git diff --check`, segurança de secrets e documentação.
- **Aceite:** documentação de estado, planejamento e histórico concorda e
  permanece no mesmo PR de produto.

## Revisão do planejamento: gaps identificados e respostas

| Gap potencial | Resposta incorporada | Evidência exigida |
| --- | --- | --- |
| Recriar um campo/fluxo de visualização que já existe | Reutilizar Fase 264.3, sem rota ou tabela duplicada | Teste do endpoint atual permanece verde; novo worker consulta o campo existente |
| Disparar em massa para materiais antigos após deploy | Migration sem backfill; somente novos envios recebem agenda | Teste de migration com `proximo_lembrete_em` nulo para linhas preexistentes |
| Lembretes duplicados por múltiplos workers | Trava por tenant, lock de linhas, atualização e outbox na mesma transação, chave idempotente | Teste de duas rodadas e unicidade de chave por ocorrência |
| Continuar enviando depois que o paciente leu | Revalidar `visualizado_em` no despacho, além do filtro do agendador | Teste em que leitura acontece entre agenda e despacho |
| Atravessar tenant com IDs de envio ou paciente | O evento não contém tenant; o worker recebe tenant do ciclo servidor e usa `ExecutorTenant` | Testes positivos e negativos com escopos distintos |
| Revelar dados clínicos nos canais externos | Conteúdo fixo e genérico, sem campos do material | Asserção sobre payload/conteúdo dos adaptadores |
| Ignorar opt-out, janela, contato ou template | Reutilizar `processarAvisoPlanoPublicado` como contrato de seleção e o enfileiramento existente | Casos positivos/negativos por política |
| Enviar muitos lembretes simultâneos ao mesmo paciente | Um canal por ocorrência e limite de frequência de 72 horas por paciente/canal | Teste de limite de frequência |
| Repetir intervalos vencidos após indisponibilidade | Após a ocorrência atual, reagendar a partir do instante da rodada; não processar vencimentos antigos em rajada | Teste com relógio avançado |
| Novo evento do portal não passar pelo mapper cifrado e ficar sem canal/texto | Incluir o evento na projeção segura do portal e oferecer retorno para a área de materiais | Spec do portal e cenário visual dedicado |
| Documento afirmar que a Fase 289 ainda está aberta | Cruzar PR #343 e atualizar os documentos de estado no PR desta fase | Estado `MERGED`; checks consultados no handoff |

Nenhum gap bloqueante permanece no escopo definido. A decisão sobre materiais
legados foi respondida pelo proprietário: não devem receber disparo retroativo.

## Validação planejada

- Specs focadas de materiais, portal, agendador, comunicação, outbox e migration.
- Typecheck e build do backend NestJS.
- Typecheck, lint focado, testes de autorização e build Web Next.js.
- Testes aplicáveis de tenancy e guardas de controladores.
- `pnpm test:confiabilidade`, `pnpm validate:docs`, `git diff --check` e
  `pnpm security:secrets`.
- CI do PR será registrado como snapshot quando aberto; não inferir aprovação
  de gates `SKIPPED` ou não executados.

## Arquivos previstos

- Backend: `modulos/materiais`, `modulos/comunicacoes`, portal do paciente e
  migration `1056`.
- Web: projeção de notificação do portal e testes existentes de portal.
- Documentação: auditoria de produto, checklist, status, resumo de fases e este
  plano.

## Registro de execução

Implementação e testes focados concluídos. Foram aprovados 105 testes em 7
suítes do backend para materiais, agenda, comunicações, outbox e migration; o
teste visual direcionado do aviso no portal passou. Build do backend, typecheck
e build Web, lint focado, `pnpm test:confiabilidade`, `pnpm
test:guardas-controladores`, `pnpm validate:docs` e `pnpm security:secrets`
passaram. A suíte Web `test:authz` terminou com código 0. O ambiente local usa
Node 24.19.0, fora da faixa
autoritativa `>=22 <23`; a validação compatível cabe ao CI Node 22. A migration
1056 não foi executada em banco externo.
