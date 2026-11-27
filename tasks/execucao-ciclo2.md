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
predecessoras, não em main. Não presumir que estado MERGED indica disponibilização.
F01 parte dessa main; F02 é explicitamente empilhada sobre F01. Ambas independem
da cadeia #585–#592. Fases que reutilizam #585–#592 exigem
consolidação explícita em PR própria/revisão, sem merge automático. Nenhuma
migration externa/configuração/Neon/Render/deploy por este ciclo.

## F01 — PR #593 Draft; correção de smoke enviada

Branch `feat/c2-f01-login-acessivel`; worktree `/workspace/c2-f01-login`; base `0fd46a01`.
Auditoria corrigiu uma hipótese do plano: CampoSenha já implementa Caps Lock, será
reusado. Lacunas reais: foco após falha, mensagem segura, referência conjunta
Caps Lock/erro e estado assíncrono. Escopo: interface login/MFA, sem backend,
permissão, política de senha ou novo método de autenticação. Risco R4 por auth;
revisão independente necessária. UX A das duas personas emitida; não é teste.

Evidências F01 em [c2-f01-login-acessivel.md](c2-f01-login-acessivel.md): RED/GREEN,
login/MFA, rede, atraso, teclado/200%, acesso26/26, typecheck/lint/linguagem/secrets
e R4 independente estática favorável. Suíte global local interrompida não é PASS.
CI de `2d5941fb`: Web/build/Backend/scanners PASS, smoke/PR Gate FAIL por teste
antigo que exigia mensagem hostil do servidor na tela; provenance SKIPPED.
Correção somente no teste enviada em `f6f3e06b`, revisão estática delimitada e
segurança-browser 10/10 PASS. CI novo pendente. Reordenação flaky no run anterior
permanece registrada; isolada 1/1 PASS sem alteração. Leitor de tela NOT RUN.

## F02 — implementação validada localmente

Branch `feat/c2-f02-mfa-copia`, worktree `/workspace/c2-f02-mfa`, base `f6f3e06b`.
Commit funcional `cee90eb0`. Alvo da PR Draft: `feat/c2-f01-login-acessivel` (#593), não main. Quatro botões com
ACK real, falha/manual, foco e invalidação de feedback por contexto/desmontagem.
Evidências: [c2-f02-mfa-copia.md](c2-f02-mfa-copia.md). Principais 28/28,
adicionais 14/14 (com repetição), reforço 10/10 e regressões 44/44 PASS;
typecheck/lint/linguagem e R4 estática/UX B/C favoráveis no escopo. CI/build
pendentes; leitor de tela/seleção por toque NOT RUN. Não confundir com aceite global.

F03–F20 ainda NÃO INICIADAS. Próxima F03: recuperação de senha conforme contrato
atual, sem prazo fictício nem enumeração. Sem merge, deploy ou operação externa.
