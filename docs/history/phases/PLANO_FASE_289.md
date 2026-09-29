# Fase 289 — aviso de plano alimentar publicado

## Objetivo e decisão de produto

Quando a clínica publicar uma versão revisada do plano alimentar, o paciente deve receber um aviso dentro do portal. O sistema também pode encaminhar a mensagem pelos canais de comunicação que o paciente autorizou, respeitando preferências, horário permitido, contatos válidos e a disponibilidade de canal/template. A mensagem será genérica e não repetirá refeições, metas, diagnóstico ou qualquer conteúdo do plano.

Decisão confirmada pelo proprietário: **portal + canais permitidos**.

## Modelo, skills e risco

- Modelo: Sol, esforço alto, conforme preferência registrada para mudanças do OctaClin.
- Skills: `agent-skills:planning-and-task-breakdown`, `test-driven-development`, `nestjs-best-practices`, `typeorm`, `security-review` e `fechar-fase`.
- Risco R4: publicação de dado clínico e comunicação externa, com limites de PHI, tenancy e consentimento. Escopo sem migration, sem alteração em providers e sem execução em ambiente externo.
- Revisão independente de tenancy/comunicações: solicitada quando o agente `tenant-security-reviewer` estiver disponível; a ausência será registrada no PR.

## Contrato funcional

1. Somente uma versão efetivamente publicada gera aviso. Revisar, salvar rascunho, publicar repetidamente a mesma versão e falhas transacionais não geram avisos duplicados.
2. O aviso dentro do portal é persistido como mensagem de canal lógico `portal`, na mesma transação que publica a versão, com chave estável por versão. A tabela e a tela de histórico existentes são reutilizadas, sem migration; o canal é derivado do tipo do evento, não gravado como dado livre em JSON. O texto é factual e genérico: existe um plano novo no portal. Não copia conteúdo clínico para auditoria, outbox, logs ou campos JSON em claro.
3. Um evento durável no outbox da mesma transação aciona os canais externos depois do commit. O processador usa chaves estáveis por versão e canal; antes de enfileirar, confirma que plano e versão ainda são os publicados e que o plano está ativo. Falha temporária pode ser reprocessada sem duplicar a mensagem; a publicação não é desfeita por indisponibilidade de provider.
4. No máximo um canal externo é selecionado por versão. E-mail/WhatsApp só são encaminhados se o paciente tiver contato válido, tiver autorizado o canal escolhido pela preferência; em `qualquer`, e-mail tem prioridade e WhatsApp é alternativa se e-mail não estiver disponível. O horário precisa estar dentro da janela configurada e o tenant possuir canal/template compatível. WhatsApp exige template aprovado. Opt-out ou janela fechada mantém o aviso no portal e não dispara provider.
5. O evento de outbox carrega apenas IDs opacos do paciente/plano/versão, tenant e tipo do evento. Texto, contato, nome do paciente e conteúdo do plano permanecem cifrados ou são resolvidos no tenant no momento do envio.
6. O paciente vê o aviso no portal junto ao histórico de notificações, com navegação para `/portal/plano`, que exibe o plano vigente conforme a autorização existente do portal. Mensagens externas do mesmo evento podem aparecer como histórico de entrega, mas não criam um segundo aviso de disponibilidade.
7. Publicação para paciente sem conta ativa continua concluída; o aviso no portal fica associado ao paciente, sem direcionamento para usuário inexistente. Canais externos continuam sujeitos às mesmas preferências e dados de contato.

## Plano de implementação e aceite

### 1. Persistência transacional do aviso e evento

- Escrever testes de publicação primeiro: aviso e outbox são criados na mesma transação; publicação rejeitada/rollback não deixa aviso; versão distinta gera nova referência; repetição da versão não duplica.
- Acrescentar chave de idempotência estável derivada de tenant, paciente e versão publicada, usando o índice existente de `mensagens_notificacao`; para o aviso do portal, derivar canal lógico `portal` pelo tipo do evento e não exigir canal/template de envio externo.
- Criar o evento de outbox dentro do `EntityManager` da publicação e restringir payload a IDs/tipo.

### 2. Envio externo com políticas atuais

- Estender o processamento do outbox para consumir o evento do plano, validar o tenant e resolver paciente, preferências, canais e templates dentro de `ExecutorTenant`. Instalar templates iniciais de plano de forma idempotente quando ausentes, sem substituir edições do tenant. O identificador inicial do template WhatsApp permanece estável para a seleção do evento; editar conteúdo invalida a aprovação e exige nova aprovação antes do envio.
- Confirmar no tenant que o plano ainda está ativo e a versão continua atual; plano arquivado ou versão substituída mantém histórico no portal e cancela o envio externo.
- Selecionar um único canal opt-in com destino válido e dentro da janela; em `qualquer`, preferir e-mail, usando WhatsApp somente como fallback quando e-mail estiver indisponível. Exigir template aprovado para WhatsApp. Reutilizar serviço, cifragem, limites e adaptadores existentes.
- Tornar retries idempotentes por versão/canal. Tratar indisponibilidade sem interromper publicação nem retirar o aviso do portal.
- Não criar templates WhatsApp aprovados automaticamente, não ignorar opt-out e não enviar conteúdo do plano.

### 3. Apresentação no portal

- Incluir o aviso persistido no payload já consumido pelo portal, com consulta tenant-aware e acesso pelo `usuarioId` autenticado do paciente.
- Renderizar título, mensagem, estado e link apenas para o plano publicado atual. Preservar estados de carregamento, vazio e erro e evitar duplicar o mesmo aviso por canal externo.
- Adicionar testes para paciente associado, sem conta, outro tenant, plano arquivado e payload sem conteúdo clínico.

### 4. Revisão documental e gates

- Atualizar checklist, status atual, resumo de fases e reconciliação do backlog da auditoria no mesmo PR, incluindo a Fase 288 integrada pelo PR #324 e a evidência remota atual das fases/dependências.
- Adicionar entrada à matriz de confiabilidade para publicação, outbox, canais consentidos e isolamento do portal.
- Validar testes focados, typecheck/build backend e web se a interface mudar, `git diff --check`, `pnpm security:secrets`; revisar diff e estado dos gates remotos antes do PR.
- Não executar migration, backfill, staging ou produção.

## Revisão crítica do plano — gaps e tratamentos

| Gap potencial | Solução e prova exigida |
| --- | --- |
| Publicação gera efeito e a fila falha antes da mensagem existir | Outbox gravado na transação da publicação; teste prova rollback/atomicidade e reprocessamento. |
| Retry envia duas vezes | Chave de idempotência determinística por versão/canal e índice único existente; testar repetição e concorrência. |
| Outbox expõe PHI | Payload contém somente identificadores e tipo; texto genérico cifrado na tabela de mensagem; teste de contrato do payload. |
| Opt-out, horário ou contato inválido ignorados | Reutilizar funções existentes de preferência; testes negativos por canal e janela. |
| WhatsApp enviado sem aprovação | Exigir template aprovado; sem template aprovado, manter apenas aviso no portal. |
| Paciente pertence a outro tenant ou foi reassociado | Toda leitura/escrita sob tenant do servidor e vínculo paciente/usuário validado; testes negativos de tenant e responsável. |
| Portal mostra aviso repetido para cada canal de transporte | Identidade lógica única por versão para o aviso do portal; registros de envio ficam separados e não são projetados como novos avisos de portal. |
| A publicação falha porque provider está fora | Provider só é chamado pelo outbox após commit; indisponibilidade de fila/provider não reverte a publicação. |
| Outbox atrasado envia aviso de versão substituída ou arquivada | Validar tenant, plano, paciente, versão vigente e estado ativo antes de qualquer canal externo; manter aviso histórico sem CTA se não houver plano vigente. |
| Template inicial pode sobrescrever conteúdo da clínica | Instalação idempotente apenas para código estável ausente; template editado nunca é substituído; validar o instalador atual antes de reutilizá-lo. WhatsApp permanece inapto até aprovação registrada no template. |

## Rollback e limites

Rollback remove o evento/integração de comunicação e mantém o plano publicado. Os avisos já persistidos no portal podem permanecer como histórico informativo; não há dado clínico adicional a remover. Nenhuma migration ou operação de ambiente é prevista. O texto informa disponibilidade no portal, não confirma leitura nem entrega por e-mail/WhatsApp.

## Evidências de conclusão

- Implementação cobre persistência transacional, outbox, canal consentido, cifra e leitura pelo portal, template WhatsApp não aprovado por padrão, idempotência e navegação para o plano.
- PASS — Jest direcionado: cobertura dos fluxos de aviso, outbox, template, comunicação, publicação do plano e portal.
- PASS — Jest backend completo em Node 22: 228 suites passaram; 4 suites e 40 testes `SKIPPED` pela configuração do repositório; 2.172 testes passaram. Nenhum migration foi executado.
- PASS — `pnpm test:confiabilidade`: matriz válida, 40 referências críticas.
- PASS — `pnpm validate:docs`: preflight documental; confirmou Fase 288 concluída e Fase 289 como próxima/em andamento.
- PASS — backend `typecheck` e `build`, incluindo validação do artefato de produção.
- PASS — Web `typecheck`, `build` e lint sem erros; lint geral apresentou 62 avisos no projeto. Build reportou avisos do Edge Runtime e da convenção `middleware`.
- PASS — Playwright `portal-paciente.spec.mjs --grep "aviso de plano publicado"`: desktop Chromium e mobile Chromium.
- PASS — `git diff --check` e `pnpm security:secrets`; nenhum segredo real encontrado pelos padrões locais.
- PENDENTE — revisão final e publicação do PR.
- SKIPPED — revisão independente de tenancy: o agente `tenant-security-reviewer` não está disponível neste ambiente; provas locais de isolamento e revisão interna foram feitas.
- PENDENTE — CI remoto; registrar resultado após abrir o PR, sem inferir PASS de execução local.
- NA — migrations/backfill/ambiente externo: nenhuma alteração de schema ou execução fora da worktree.
- Risco residual: entrega por provider e eventual leitura do paciente dependem da configuração autorizada do canal e do template; não há prova de envio real nesta fase. WhatsApp permanece bloqueado até template aprovado.
