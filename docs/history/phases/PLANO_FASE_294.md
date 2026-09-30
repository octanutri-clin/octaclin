# Fase 294 — retorno de pacientes sem consulta futura

## Decisões e escopo

- Exibir uma simulação por lote na lista de pacientes filtrada por **sem consulta futura**. A equipe aprova explicitamente o contato; a simulação nunca envia mensagem.
- Sugerir intervalo factual pela mediana de até três intervalos entre as últimas quatro consultas concluídas. Menos de duas consultas: **histórico insuficiente**. A data sugerida ou ajustada é uma referência interna, sem horário e sem confirmação de agendamento; não entra na mensagem ou no seu payload.
- Reutilizar os canais e templates aprovados de recall de inatividade. Aplicar consentimento, janela de horário, contato disponível, profissional responsável e tenant tanto na simulação quanto no momento de enfileirar e de enviar.
- Incluir modelo inicial de e-mail para retorno no instalador idempotente já existente. A clínica deve instalar os modelos iniciais pelo painel de Comunicações; a simulação permanece somente leitura e informa quando falta canal ou modelo. WhatsApp segue exigindo modelo próprio aprovado.
- Impedir novo contato de retorno/recall por 30 dias após mensagem já enfileirada ou enviada, independentemente da regra ou canal. Consulta futura, paciente inativo e contato recente excluem o paciente.
- Lote limitado à seleção de até 25 pacientes; resposta por paciente e chave idempotente do lote para duplo clique/retry. Nenhuma migration ou envio retroativo.

## Revisão dos gaps antes da execução

1. A fila antiga de dashboard e o filtro de pacientes têm semânticas diferentes. A ação terá como fonte a lista de pacientes e validará de novo a ausência de consulta futura no backend; não usará a fila como prova de elegibilidade.
2. O recall antigo usa somente execuções de regra para frequência e pode contatar alguém com consulta futura. O gate de mensagem será comum aos dois fluxos, com serialização por tenant e paciente. A seleção do recall também deve excluir consultas futuras e mensagens recentes para que a simulação seja fiel.
3. A aprovação pode envelhecer até a entrega externa. O processador de notificações verificará de novo consulta, consentimento, janela e destino imediatamente antes do adaptador; entrega incerta terá reserva durável para não gerar duplicata automática.
4. A data ajustada não constitui promessa de consulta. A interface deixará claro que é referência temporária para a equipe, e oferecerá navegação à agenda para marcar de fato.
5. Template ou canal inexistente/inativo deve bloquear o envio sem fallback para texto livre. A simulação explicará esse impedimento.
6. Reprocessamento do mesmo lote não duplica mensagens. Um novo lote dentro de 30 dias permanece bloqueado pelo contato anterior.

## Entrega

1. Política compartilhada de retorno/recall no backend e operação de simulação/aprovação com autenticação, autorização, limite de lote e auditoria mínima.
2. Ação em massa na lista de pacientes, com prévia, estado por paciente, data interna ajustável e aprovação humana.
3. Reconciliação do recall existente e reserva segura no processador de notificações.
4. Reconciliação dos documentos canônicos, revisão de diff e gates aplicáveis antes do PR.

## Risco e reversão

R4: tenant, dados pessoais e comunicação externa. Não há DDL. Reverter o deploy desativa os novos fluxos; mensagens já enviadas são irreversíveis e mensagens já enfileiradas precisam ser avaliadas antes da reversão. Sem ação em produção nesta fase. Exigir revisão cruzada quando viável. A validação deve distinguir checagens locais de CI, staging e produção.

## Evidência após integração

- PR #348 integrado em 2026-09-30, merge `41873fe60d4553de6bf8d4c57c985780a1288f9a`.
- PASS: checks obrigatórios reportados pelo GitHub: Backend NestJS, Web Next.js, Demo Local Smoke, PR Gate, Governança, imagens backend/web/IA, CodeQL, Dependency Review, Trivy e demais verificações aplicáveis.
- SKIPPED no PR: AI FastAPI, Mobile Expo e Provenance do SBOM; não são considerados aprovados nem alteram a conclusão dos gates exigidos para esse PR.
- Sem migration/DDL nesta fase. A operação externa em staging/produção não foi verificada diretamente neste registro.
