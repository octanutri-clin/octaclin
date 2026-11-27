# Execução do segundo ciclo

Autorização: proprietário pediu começar o desenvolvimento das implementações do
segundo ciclo, todas funcionais, com perguntas/sugestões durante o trabalho.
Plano canônico: plan-ciclo2-login-cadastro-formularios-operacao.md.

## Decisões ratificadas em 25/11

- F08: blocos pessoais primeiro, criador edita e aplicações independentes.
- F09: oculto permanece no rascunho autorizado para reabertura, excluído do envio
  efetivo; histórico “Não aplicável”, distinto de zero/falso/ausente. Demais decisões
  condicionais serão auditadas antes de alterar contratos.
- F20: download ICS por profissional e paciente autorizados; dados mínimos, sem
  nome do paciente/dado clínico/sincronização automática.

## Base e dependência de integração

Main conferida em `0fd46a01`, merge da #584. GitHub confirma #585–#592 como MERGED nas branches
predecessoras, não em main. Não presumir que estadoMERGED indica disponibilização.
F01/F02 são independentes e partem dessa main. Fases que reutilizam #585–#592 exigem
consolidação explícita em PR própria/revisão, sem merge automático. Nenhuma
migration externa/configuração/Neon/Render/deploy por este ciclo.

## F01 — implementação local validada; PR Draft em preparação

Branch `feat/c2-f01-login-acessivel`; worktree `/workspace/c2-f01-login`; base `0fd46a01`.
Auditoria corrigiu uma hipótese do plano: CampoSenha já implementa Caps Lock, será
reusado. Lacunas reais: foco após falha, mensagem segura, referência conjunta
Caps Lock/erro e estado assíncrono. Escopo: interface login/MFA, sem backend,
permissão, política de senha ou novo método de autenticação. Risco R4 por auth;
revisão independente necessária. UX A das duas personas emitida; não é teste.

Evidências F01 em [c2-f01-login-acessivel.md](c2-f01-login-acessivel.md): RED/GREEN,
login/MFA, rede, atraso, teclado/200%, acesso26/26, typecheck/lint/linguagem/secrets
e R4 independente estática favorável. Suíte global interrompida não é PASS;
CI/build pendentes. F02 e F03–F20 ainda NÃO INICIADAS. Planejamento não representa
funcionalidade entregue. Leitor de tela manual NOT RUN. Nenhum merge/deploy.
