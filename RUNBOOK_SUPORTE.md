# OctaClin - Runbook de suporte

Este runbook orienta o atendimento de suporte do OctaClin para problemas comuns de acesso, convites, comunicacoes e agenda. Nao registre secrets, senhas, tokens, URLs privadas ou dados clinicos desnecessarios em chamados.

## Triagem inicial

Antes de investigar um caso, colete somente o minimo necessario:

- perfil afetado: cliente, profissional, colaborador ou paciente;
- tenant/clinica informado pelo usuario;
- horario aproximado do erro;
- tela ou acao executada;
- mensagem de erro visivel;
- `requestId`, se aparecer em resposta tecnica ou logs;
- canal afetado: login, convite, senha, WhatsApp, email ou agenda.

Regras de seguranca:

- nunca solicitar senha do usuario;
- nunca pedir token de acesso, refresh token, senha de app, chave API ou URL de banco;
- nunca colar print com dados clinicos completos em issue, commit ou chat;
- mascarar email, telefone e nome completo quando a identificacao total nao for necessaria;
- se qualquer secret aparecer em chamado, seguir `RUNBOOK_ROTACAO_SECRETS.md`.

Validacoes iniciais:

```powershell
curl https://<backend-render-url>/health
curl https://<backend-render-url>/health/detalhado
```

Depois abrir o console operacional em `/operacoes` e revisar alertas criticos antes de tratar sintomas isolados.

## Login

Sintomas comuns:

- usuario nao consegue entrar;
- mensagem de API/backend indisponivel;
- login volta para a tela inicial;
- usuario entra no perfil errado;
- acesso negado apos login.

Checklist:

1. Validar se `/health` responde `ok`.
2. Validar `/health/detalhado` para banco e configuracoes criticas.
3. Confirmar que o usuario esta usando tenant, email e senha corretos.
4. Confirmar se o perfil esperado existe no tenant correto.
5. Conferir logs Render usando horario e `requestId`, quando disponivel.
6. Se houver muitas tentativas, aguardar janela de lockout ou orientar recuperacao de senha.
7. Se o erro for permissao, revisar `MAPA_ROTAS_PERMISSOES.md` e o papel do usuario.

Evidencia minima no chamado:

- tenant;
- perfil esperado;
- horario;
- rota/tela afetada;
- status de `/health/detalhado`;
- `requestId` ou trecho de log sem PII.

Escalonar para desenvolvimento quando:

- o backend estiver saudavel e o usuario valido ainda assim nao conseguir login;
- houver loop de sessao/cookie;
- permissao correta estiver bloqueando rota permitida.

## Convites

Abrange convites administrativos do portal do cliente e convites de primeiro acesso do paciente.

Sintomas comuns:

- convite nao chega por email;
- link expirou;
- link invalido;
- usuario ativado no papel errado;
- reenvio nao altera o estado esperado.

Checklist:

1. Confirmar se o email informado esta correto.
2. Pedir para verificar caixa de spam/lixeira.
3. Abrir portal do cliente e conferir historico de convites quando for usuario administrativo.
4. Usar reenvio pela interface antes de tentar qualquer acao manual.
5. Conferir `/operacoes` para falhas de email/outbox.
6. Validar `/health/detalhado`, especialmente `checks.email`.
7. Para convite expirado, gerar novo convite pela interface.
8. Para convite invalido, confirmar se o link foi copiado completo.

Nao fazer:

- nao copiar token de convite em canal publico;
- nao alterar senha manualmente em banco;
- nao reutilizar link expirado;
- nao criar usuario duplicado sem verificar email e tenant.

Escalonar para desenvolvimento quando:

- reenvio gera sucesso mas nenhum evento aparece em outbox/notificacoes;
- historico de convite diverge do estado do usuario;
- link valido falha no primeiro acesso.

## Recuperacao de senha

Sintomas comuns:

- email de recuperacao nao chega;
- token expirado;
- nova senha nao e aceita;
- muitas tentativas bloqueadas.

Checklist:

1. Confirmar email e tenant.
2. Orientar o usuario a solicitar nova recuperacao pela tela oficial.
3. Conferir spam/lixeira.
4. Validar `/operacoes` para falhas de email.
5. Validar `/health/detalhado` para email e banco.
6. Se houver bloqueio por excesso de tentativas, aguardar a janela de seguranca.
7. Se o token expirou, gerar nova solicitacao pela interface.

Regras:

- nunca solicitar senha atual ou nova senha;
- nunca enviar senha temporaria por WhatsApp/email manual;
- nunca expor token de recuperacao em chamado.

Escalonar para desenvolvimento quando:

- token recem-gerado for recusado;
- email envia com sucesso mas link abre tela invalida;
- o fluxo permitir redefinicao sem token valido.

## WhatsApp

Sintomas comuns:

- mensagem nao envia;
- status fica pendente;
- webhook nao registra recebimento;
- template recusado;
- mensagem recebida nao vincula ao paciente.

Checklist:

1. Abrir `/operacoes` e revisar alertas de WhatsApp/comunicacoes.
2. Validar `/health/detalhado`, especialmente `checks.whatsapp`.
3. Conferir se o template do evento esta aprovado e mapeado.
4. Conferir se o paciente tem telefone valido e opt-in para WhatsApp.
5. Conferir status da mensagem no painel de comunicacoes.
6. Para recebimento, enviar mensagem de teste ao numero Meta e verificar inbox.
7. Se o erro mencionar token, phone number id ou app secret, seguir `RUNBOOK_ROTACAO_SECRETS.md`.

Evidencia minima:

- horario;
- evento/template;
- telefone mascarado;
- status interno;
- ID Meta, se existir;
- `requestId` ou log sanitizado.

Escalonar para desenvolvimento quando:

- Meta aceita a mensagem mas o status interno nao atualiza;
- webhook chega mas nao aparece na inbox;
- associacao com paciente correto falha.

## Email

Sintomas comuns:

- email nao chega;
- envio falha por autenticacao;
- remetente incorreto;
- convites ou recuperacao de senha nao disparam.

Checklist:

1. Validar `/health/detalhado`, especialmente `checks.email`.
2. Abrir `/operacoes` e revisar falhas de comunicacao/outbox.
3. Enviar email controlado pela interface quando existir acao manual.
4. Conferir spam/lixeira no destino.
5. Conferir se Gmail SMTP/Gmail API esta configurado no Render.
6. Se senha de app ou OAuth foi revogado, seguir `RUNBOOK_ROTACAO_SECRETS.md`.

Evidencia minima:

- horario;
- tipo de email;
- destinatario mascarado;
- status interno;
- mensagem tecnica sanitizada.

Escalonar para desenvolvimento quando:

- provider indica sucesso mas OctaClin marca falha;
- email critico nao gera notificacao/outbox;
- template fica sem dados obrigatorios.

## Agenda

Sintomas comuns:

- consulta nao cria;
- conflito nao e detectado;
- evento nao aparece no Google Calendar;
- remarcacao/cancelamento nao sincroniza;
- timezone incorreto.

Checklist:

1. Validar se profissional, paciente, data e horario estao corretos.
2. Conferir se ha conflito local no OctaClin.
3. Validar `/health/detalhado`, especialmente `checks.googleCalendar`.
4. Confirmar calendario alvo e timezone do tenant.
5. Criar uma consulta controlada e verificar o Google Calendar.
6. Remarcar e cancelar a consulta controlada quando o problema envolver sincronizacao.
7. Se credencial Google foi revogada, seguir `RUNBOOK_ROTACAO_SECRETS.md`.

Evidencia minima:

- tenant;
- profissional;
- horario original e horario esperado;
- status da consulta;
- ID de evento Google, se existir;
- `requestId` ou log sanitizado.

Escalonar para desenvolvimento quando:

- OctaClin confirma sucesso e Google nao recebe evento;
- cancelamento/remarcacao local nao atualiza payload/historico;
- timezone persiste incorreto apos ajuste de tenant.

## Escalonamento

Use este criterio:

- P0: sistema fora do ar, login indisponivel para todos, banco indisponivel ou vazamento de secret/PII.
- P1: comunicacoes ou agenda indisponiveis para um tenant ativo.
- P2: falha afeta usuario individual com alternativa manual segura.
- P3: duvida operacional, ajuste de texto, melhoria ou treinamento.

Ao escalar:

1. Registrar resumo objetivo.
2. Anexar evidencias sanitizadas.
3. Informar impacto, tenant e horario.
4. Indicar validacoes ja executadas.
5. Citar runbook seguido.
6. Se houver risco de dados, pausar acoes manuais e acionar responsavel tecnico.

Runbooks relacionados:

- `RUNBOOK_PRODUCAO.md` para deploy, healthchecks, logs e incidentes gerais.
- `RUNBOOK_ROTACAO_SECRETS.md` para exposicao ou rotacao de credenciais.
- `RUNBOOK_BACKUP_RESTORE.md` para backup, restore e recuperacao de banco.
- `CHECKLIST_GO_LIVE.md` para liberacao de clientes reais.
