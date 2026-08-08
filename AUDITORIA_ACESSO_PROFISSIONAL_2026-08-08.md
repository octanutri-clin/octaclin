# Auditoria de acesso do profissional - 2026-08-08

## Objetivo

Conferir se as funcionalidades ja implementadas para `Professional` estavam
realmente encontraveis e utilizaveis depois do login, sem ampliar permissoes ou
expor areas administrativas de outros papeis.

## Lacunas confirmadas e corrigidas

- `IA assistida` (`/ia`) ja tinha pagina, controller e permissao `ia.executar`,
  mas nao aparecia na navegacao principal nem na paleta de comandos;
- `Metas e adesao` (`/gamificacao`) ja tinha pagina, controller e permissao
  `gamificacao.gerenciar`, mas tambem dependia de URL direta;
- o backend ja entregava o resumo financeiro proprio ao profissional com
  `agenda.financeiro.ler`, mas a interface de recebimentos existia somente na
  area do cliente. A agenda agora mostra `Meus recebimentos` quando a sessao
  possui essa permissao e omite a comparacao entre profissionais;
- o build limpo do backend gerava `dist/src/main.js` depois que scripts
  TypeScript passaram a fazer parte da compilacao. O Render inicia
  `dist/main.js`, portanto o deploy falhava. `scripts` foi retirado do
  `tsconfig.build.json`, a saida e apagada antes de compilar e o build agora
  falha imediatamente se `dist/main.js` nao existir.

## Superficies profissionais ja acessiveis

| Area | Entrada | Funcoes principais |
| --- | --- | --- |
| Painel clinico | `/dashboard` | agenda do dia, filas clinicas, alertas e acoes rapidas |
| Agenda | `/agenda` | calendario interno, bloqueios, Google, solicitacoes publicas, pacotes, pagamento, teleconsulta e exportacao |
| Pacientes | `/pacientes` | busca, filtros, cadastro, edicao, importacao, exportacao, lixeira e convite do portal |
| Prontuario | `/pacientes/:id` | resumo, evolucoes, acompanhamento, plano alimentar, antropometria, formularios, documentos, mensagens, materiais, anexos e historico |
| Formularios | `/questionarios` | estrutura, editor, biblioteca, distribuicao, respostas e leitura longitudinal |
| Comunicacoes | `/comunicacoes` | inbox, canais, templates e estados de entrega |
| Automacoes | `/automacoes` | regras, lembretes e recall |
| Profissionais | `/profissionais` | diretorio, disponibilidade e estado do Google; sem gestao de outros usuarios |
| Notificacoes | sino e `/notificacoes` | eventos do proprio usuario e do proprio escopo |
| IA assistida | `/ia` | sugestoes sujeitas a revisao humana |
| Metas e adesao | `/gamificacao` | metas e acompanhamento de adesao |

Funcionalidades do prontuario permanecem agrupadas no paciente para preservar
contexto clinico; elas nao precisam virar itens separados no menu lateral.

## Restricoes intencionais

- `/cliente` permanece exclusivo de `Client`: conta, assinatura, equipe,
  consumo e configuracoes comerciais;
- `/operacoes` permanece exclusivo de `SuperAdmin`: auditoria, LGPD, outbox e
  diagnostico operacional;
- `/portal/*` permanece exclusivo de `Patient`;
- `/mobile` continua fora da navegacao e redireciona para a superficie
  consolidada; as APIs tecnicas preservadas nao justificam um menu duplicado;
- `Professional` pode consultar o diretorio profissional, mas somente
  `SuperAdmin` possui `profissionais.gerenciar` e pode administrar outros
  profissionais ou acompanhar painel alheio.

## Criterios de aceite

- menu e paleta mostram IA e metas somente para papeis e permissoes aceitos;
- a agenda mostra recebimentos somente com `agenda.financeiro.ler`;
- o resumo profissional nunca mostra a tabela `Por profissional`;
- o backend produzido por build limpo contem `dist/main.js`;
- `/mobile`, `/cliente` e `/operacoes` nao ganham acesso indevido;
- testes de navegacao, autorizacao, desktop e mobile permanecem aprovados.

## Estado de rollout

Implementacao e validacao local concluidas. Backend e web entraram `Live` no
commit `ed5ae4f` em 2026-08-08. O smoke publico confirmou `/health` com HTTP 200,
a rota autenticada do catalogo alimentar com HTTP 401 sem sessao (rota presente
e protegida, nao 404) e `/login` da web com HTTP 200.

O aceite visual autenticado tambem foi concluido: o menu profissional mostrou
`IA assistida` e `Metas e adesao`; a agenda exibiu `Meus recebimentos`; `/ia` e
`/gamificacao` abriram sem alerta de erro; e links exclusivos de `Client`,
`SuperAdmin` ou `Patient` nao apareceram na navegacao profissional.
