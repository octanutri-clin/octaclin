# Fase 296 — revisão de registros de hábitos e lembretes de acompanhamento

## Decisão e limite

O proprietário aprovou a Fase 296 após o merge da Fase 295. O trabalho reúne a confirmação de revisão do **Registro de hábitos** (check-in rápido) e lembretes próprios do plano alimentar e das tarefas de acompanhamento. A resposta de questionário já tem revisão na Fase 288 e não será duplicada. A clínica ativa e configura os lembretes; o padrão é desligado. O aviso aparece no portal e pode seguir por **um** canal externo permitido pelo paciente. A ativação não dispara campanhas retroativas.

Risco R4: registro clínico, identidade do revisor, tenancy/RLS, autorização e comunicação com paciente. O tenant vem da credencial; paciente e profissional são validados no servidor. A revisão significa apenas que a equipe leu o registro, sem diagnóstico ou aceitação clínica. Não há decisão clínica autônoma.

## Arquitetura e contratos

1. Acrescentar `revisado_em` e `revisado_por_usuario_id` em `logs_diario_rapido` por migration aditiva 1059. Reusar RLS da tabela e introduzir índice para a fila. O conteúdo clínico continua cifrado em `valor_criptografado`; não entra em fila, auditoria, URL, outbox ou telemetria.
2. Criar fila paginada para Professional/SuperAdmin. A leitura individual devolve conteúdo mínimo decifrado e um comprovante HMAC curto, vinculado a tenant, registro, usuário e sessão; só então a revisão pode ser confirmada. Status no portal: “Aguardando revisão” ou “Visto pela equipe em ...”, sem promessa de conduta. Repetição é idempotente; registro de outro tenant, paciente arquivado ou fora do escopo profissional não é acessível.
3. Guardar configuração de lembretes em chave dedicada de `tenant_configuracoes`, protegida por `cliente.configuracoes.gerenciar`, sem misturá-la com o PATCH geral da conta. Plano: habilitação e intervalo de 1 a 30 dias; tarefa: habilitação e antecedência de 0 a 168 horas. Desligado por padrão; ativação e mudança de cadência iniciam nova janela de vigência, sem resgatar publicações/tarefas anteriores.
4. Processador periódico por tenant seleciona apenas plano vigente publicado ou tarefa pendente, paciente ativo e ocorrências novas dentro da janela. Idempotência em `mensagens_notificacao` e outbox na mesma transação; revalidação da origem e da configuração no despacho. Conteúdo genérico no portal, templates genéricos por canal; nenhum título, sintoma, adesão ou detalhe clínico sai por canal externo. Reusar política de opt-out, horário e limite de frequência. Sem canal elegível, o aviso permanece no portal.
   O lembrete de plano se repete por ciclo enquanto a versão publicada for vigente e a configuração estiver ativa; o produto ainda não registra leitura do plano, portanto leitura não encerra esses ciclos. O lembrete de tarefa é único por vencimento e cessa após conclusão, troca de data ou desativação. Uma configuração com antecedência zero admite a primeira rodada até uma hora após o vencimento, para tolerar a cadência do processador.
5. Interface: fila de revisão com leitura antes de concluir; status nos registros do portal; controles da clínica para ativar e ajustar intervalos. Estados de erro, carregamento e vazio; BFF com a mesma autorização do backend.

## Revisão de gaps antes da implementação

| Gap | Solução |
| --- | --- |
| “Check-in” também designa resposta de formulário | Escopo desta fase é `logs_diario_rapido`; usar “Registro de hábitos” na interface. |
| Marcar como revisado sem ler | Comprovante assinado emitido só na leitura individual; botão requer confirmação. |
| Revisão confundida com avaliação clínica | Microcopy factual e sem avaliação automática. |
| Dois workers ou retry duplicam aviso | Chave única por recurso/ciclo, lock por tenant e outbox transacional. |
| Plano trocado ou tarefa concluída antes do envio | Revalidar versão vigente, vencimento, status, paciente e config no despacho. |
| Ativação produz disparo em massa de histórico | Exigir recurso publicado/criado após a ativação; ignorar janelas vencidas. |
| Portal revela dado clínico em push/email/WhatsApp | Mensagens genéricas; preferências e templates aprovados no envio. |
| Lista inicial limita a 100 e causa starvation | Seleção no banco exclui ocorrências já notificadas, com índice e lote por tenant. |
| Retenção e exclusão LGPD | Reusar eliminação de `logs_diario_rapido` e `mensagens_notificacao`; as novas colunas não contêm narrativa. |
| Configuração pode ser sobrescrita pelo PATCH de conta | Chave e endpoint próprios. |
| Desativação concorre com uma rodada do agendador | Configuração e seleção usam a mesma trava transacional por tenant; o despacho externo ainda revalida a configuração antes do adaptador. |
| Migration criada mas fora da lista de execução | Registrar a 1059 em `opcoes-typeorm.ts`; gate de inventário de migrations a verifica. |
| Aviso cifrado aparece sem título no portal | Incluir os novos eventos no mapeamento de notificações e oferecer atalhos para plano/tarefas. |
| Nova página acessível fora do prefixo já protegido | Adicionar `/checkins` ao middleware e exigir papel clínico e `pacientes.ler` também na decisão de rota; backend mantém a validação de acesso aos dados. |

## Tarefas ordenadas e aceite

1. **Revisão clínica**: migration, ORM, serviço e endpoints com testes positivos/negativos de tenant, profissional, leitura, idempotência e sessão. Aceite: nenhuma revisão sem leitura; portal mostra o carimbo correto.
2. **Configuração**: domínio, endpoint e UI com validação, desativação por padrão e isolamento. Aceite: só Client com permissão pode ativar e ajuste não retroage.
3. **Lembretes**: seleção, portal/outbox, templates e despacho com testes de duplicação, mudança de status, canais, janela e falhas. Aceite: um aviso por ciclo elegível e no máximo um canal externo autorizado.
4. **Integração web**: BFF, fila, portal e preferências, com testes de contrato e cenários sintéticos de interface. Aceite: fluxos completos e acessíveis.
5. **Fechamento**: reconciliação da auditoria, checklist/status, revisão de diff, scanner de segredos, typecheck/build e CI de um único PR. Registrar PASS/FAIL/NA/SKIPPED e revisão cruzada R4.

## Rollback e prova externa

Desativar os dois lembretes por clínica interrompe novas ocorrências. Reverter o código remove rotas/processador; após gravar revisões, **não** executar `down` da migration sem decisão sobre preservação clínica. Migração/DDL em staging ou produção exige confirmação de banco, branch e role owner; a informação do proprietário de que as migrations anteriores foram feitas não autoriza executar a 1059. CI local e staging não provam produção. A prova PostgreSQL/RLS deve usar banco descartável ou ambiente explicitamente autorizado.
