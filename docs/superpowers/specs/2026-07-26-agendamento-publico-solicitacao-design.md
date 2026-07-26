# Fase 144 - Agendamento publico por solicitacao

## Objetivo

Permitir que uma pessoa solicite um horario disponivel de um profissional por
um link publico, sem criar uma consulta, paciente ou compromisso externo antes
da aprovacao manual do profissional.

## Escopo

- Link publico por profissional, com identificador opaco e revogavel.
- Consulta publica de horarios disponiveis em uma janela curta, sempre
  calculada contra consultas internas e bloqueios externos do Google Calendar.
- Formulario com nome, email, WhatsApp opcional, horario e observacao curta.
- Persistencia de uma solicitacao com estado `pendente`, `aprovada`,
  `recusada` ou `expirada`.
- Tela autenticada na agenda para aprovar ou recusar solicitacoes do proprio
  profissional, respeitando o escopo profissional ja aplicado no produto.
- Ao aprovar, criacao da consulta pelo servico de agenda existente, incluindo
  validacao de conflito, Google Calendar e notificacoes de agendamento.

## Fora de escopo

- Criacao automatica de paciente a partir do formulario publico.
- Confirmacao automatica de consulta sem revisao profissional.
- Pagamentos, lista de espera, remarcacao publica ou escolha de servico.
- Exposicao de email, WhatsApp, identificadores internos ou agenda completa
  pelo endpoint publico.

## Arquitetura

Um novo agregado de solicitacao pertence a um `tenantId` e a um
`profissionalId`. Ele guarda dados de contato criptografados e somente o
horario pedido, estado, expiracao e referencias de auditoria. O token publico
identifica o profissional sem depender de slug previsivel e pode ser rotacionado
ou desativado pelo profissional.

Os endpoints publicos nao usam JWT. Eles recebem apenas o token opaco,
aplicam rate limit por IP e por token, e retornam dados minimos: nome exibivel
do profissional, timezone, duracao padrao e horarios livres. A lista e a acao
de aprovar ou recusar exigem JWT, permissao de agenda e o filtro do profissional
autenticado.

## Fluxo

1. O profissional habilita e copia seu link de agendamento publico na agenda.
2. A pessoa abre o link e consulta horarios livres na proxima janela de 30 dias.
3. A pessoa envia uma solicitacao com os dados minimos e um horario exibido.
4. O backend revalida disponibilidade no momento de persistir e grava a
   solicitacao pendente, sem criar paciente ou consulta.
5. O profissional aprova ou recusa na agenda interna.
6. Na aprovacao, o profissional seleciona um paciente existente. O backend
   revalida o horario e usa `ServicoAgenda.criarConsulta` para concluir o
   agendamento e suas integracoes.
7. Uma solicitacao aprovada ou recusada nao pode sofrer nova decisao.

## Seguranca e confiabilidade

- Tokens publicos devem ser aleatorios, armazenados somente como hash e
  rotacionaveis sem apagar o historico.
- Dados de contato e observacao devem ser criptografados em repouso.
- A verificacao de disponibilidade ocorre na consulta publica e novamente no
  envio/aprovacao para evitar corrida de concorrencia.
- Expiracao impede aprovar solicitacoes antigas; registros permanecem para
  auditoria sem exibir dados sensiveis em logs.
- Rate limit impede enumeracao de tokens e envio repetido.
- Respostas publicas usam mensagens neutras para token invalido, inativo ou
  expirado.

## Interface

A pagina publica sera uma experiencia de tarefa unica: identidade do
profissional, seletor de dia, lista de horarios e formulario de contato. A
agenda interna exibira uma secao de solicitacoes pendentes com acoes explicitas
de aprovar ou recusar. A aprovacao exigira selecionar um paciente existente,
evitando deduplicacao automatica insegura.

## Testes e aceite

- Testes unitarios para token, disponibilidade, expiracao, isolamento de tenant
  e transicao de estados.
- Testes de autorizacao para impedir profissional de decidir solicitacao alheia.
- Teste E2E/visual do link publico em desktop e mobile, incluindo bloqueio por
  horario concorrente e caminho de aprovacao.
- Build, typecheck, scanner de secrets e preflight documental antes do commit.

## Decisoes explicitadas

- A solicitacao nao ocupa horario ate a aprovacao profissional.
- O paciente e vinculado apenas na aprovacao e deve existir no tenant.
- O envio de email, WhatsApp e Google Calendar permanece concentrado na agenda
  existente, sem duplicar integracoes no modulo publico.
