# Fase 145 - Painel clinico do profissional

## Objetivo

Transformar o dashboard profissional em uma central diaria de trabalho clinico.
O painel deve priorizar quem precisa de acao agora, permitir acoes curtas e
manter o profissional no escopo de seus proprios pacientes.

## Usuarios e escopo

- `Professional` ve somente os dados clinicos atribuidos a ele.
- `SuperAdmin` pode selecionar explicitamente um profissional e acompanhar seu
  painel. A consulta de outro profissional deve ser registrada em auditoria.
- `Collaborator`, `Client` e `Patient` nao podem consultar o painel de outro
  profissional nem receber o seletor de profissional.
- Pacientes arquivados, encerrados ou pausados nao entram nas filas de retorno
  ou tarefas vencidas.

## Visao diaria e periodos

O painel inicia em `Hoje` e oferece filtros `Hoje`, `7 dias` e `30 dias`. A
API agrega somente os itens necessarios para a tela, com listas limitadas e
links para a area completa, evitando carregar prontuarios em massa.

Os indicadores principais sao:

1. consultas de hoje, proximas, concluidas, canceladas e faltas;
2. pacientes sem retorno, agrupados em `30`, `60` e `90+` dias;
3. formularios enviados aguardando leitura clinica;
4. tarefas de acompanhamento vencidas ou atrasadas;
5. solicitacoes publicas de agenda pendentes;
6. comunicacoes recebidas, pendentes ou com falha;
7. pacientes de risco clinico que precisam de revisao.

Um paciente e considerado sem retorno quando esta ativo e nao possui consulta
concluida nos ultimos 30 dias. Quem nunca concluiu consulta passa a entrar na
fila apos 30 dias do cadastro. O calculo usa a consulta concluida mais recente,
nao apenas a ultima consulta agendada.

## Priorizacao clinica

A fila principal e ordenada por impacto, nesta ordem:

1. paciente de risco alto sem retorno;
2. tarefa vencida;
3. atendimento proximo ou em atraso no dia;
4. formulario aguardando leitura;
5. solicitacao publica pendente;
6. comunicacao recebida, pendente ou com falha.

Cada item mostra somente o contexto minimo para decisao: nome do paciente,
nivel de risco, tempo sem retorno, prazo, horario ou estado operacional. Texto
integral de mensagens e dados clinicos detalhados permanecem nas telas
especializadas.

## Acoes rapidas

As acoes ficam disponiveis apenas quando o papel ja possui permissao para a
operacao de destino:

- abrir paciente, consulta, formulario ou comunicacao no contexto correto;
- criar retorno com paciente e profissional preselecionados na agenda;
- concluir uma tarefa de acompanhamento;
- revisar formulario pendente;
- responder ou reprocessar comunicacao;
- aprovar ou recusar solicitacao publica de agenda.

Nenhuma acao rapida pula as regras de negocio existentes. Criacao de consulta
continua a disparar calendario e notificacoes pelo fluxo normal; aprovacao de
solicitacao publica continua exigindo paciente explicito.

Conclusao de tarefa, reprocessamento, resposta e decisao de solicitacao devem
registrar auditoria com usuario, horario, profissional em contexto e origem
`dashboard_clinico`.

Itens nao urgentes podem ser ocultados ate o proximo dia sem apagar dados,
historico ou alertas de maior prioridade. A ocultacao e individual ao usuario e
nao altera o estado clinico do paciente.

## Experiencia e seguranca

- O painel deve preservar layout denso, legivel e sem rolagem horizontal em
  desktop e celular.
- SuperAdmin ve um aviso persistente com o profissional em contexto e precisa
  escolher o profissional antes de consultar dados de terceiros.
- Estados de carregamento, vazio, falha e recarregamento devem existir para
  cada fila sem bloquear o restante do painel.
- O backend aplica tenant e escopo profissional; filtros de interface nunca
  sao a unica protecao de dados.

## Arquitetura proposta

Criar um resumo clinico agregado no modulo de dashboard, protegido por
`dashboard.ler`, com `profissionalId` opcional apenas para `SuperAdmin`.
`Professional` tem o identificador imposto pelo usuario autenticado. O resumo
retorna contadores, filas limitadas e identificadores para navegacao, sem
duplicar dados de prontuario ou comunicacoes.

O BFF web repassa somente sessao autenticada e aplica a mesma regra de papel
antes de chamar o backend. O componente do dashboard consome esse contrato
unico, persiste o filtro de periodo no navegador e delega mutacoes aos BFFs
existentes ou a rotas dedicadas que registram auditoria.

## Criterios de aceite

- Professional nunca recebe dados de outro profissional, mesmo alterando a URL.
- SuperAdmin consegue trocar de profissional e essa consulta fica auditada.
- A fila de sem retorno respeita 30/60/90+ dias, risco e estados de paciente.
- Tarefas vencidas, formularios pendentes, comunicacoes e solicitacoes de
  agenda aparecem com acao contextual segura.
- Acoes rapidas usam os fluxos clinicos existentes e deixam trilha de auditoria.
- Desktop e celular passam em teste visual sem overflow.
- Testes cobrem tenant, papel, escopo por profissional, ordenacao, filtros,
  estados vazios e as mutacoes acionadas pelo painel.
