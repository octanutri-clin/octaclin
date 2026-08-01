# Fase 196 - Comunicacoes, equipe e conta do cliente

Status: concluida em 2026-08-01.

## Objetivo

Transformar tres superficies administrativas extensas em jornadas claras,
sem alterar contratos de dominio que ja atendem ao produto:

- comunicacoes orientadas a conversas e resolucao de falhas;
- equipe separada entre diretorio clinico, acesso e integracoes;
- conta comercial dividida por ativacao, assinatura, consumo, equipe,
  preferencias, marca, integracoes e dados fiscais.

## Restricoes globais

- Reutilizar componentes, APIs, permissoes e modelos existentes; adicionar
  somente o contrato ausente para ajuste seguro de papel da equipe.
- Nao criar nova tabela, dependencia ou sistema visual.
- Nao expor UUIDs, papeis internos, escopos tecnicos ou configuracao secreta.
- Manter troca de contexto de profissional exclusiva do `SuperAdmin`.
- Preservar isolamento de tenant e gates atuais do BFF.
- Toda navegacao deve operar por teclado, ter alvo de toque de 44 px e nao
  depender apenas de cor para comunicar estado.
- Dados de teste devem ser sinteticos.

## Tarefa 1 - Contratos de jornada e testes em vermelho

- Cobrir a central de comunicacoes abrindo em Conversas.
- Cobrir a troca para Nova mensagem e Configuracoes.
- Cobrir resposta e nova tentativa a partir da conversa ativa.
- Cobrir equipe e conta por areas de tarefa.
- Cobrir ausencia de IDs e jargao tecnico na conta comercial.

## Tarefa 2 - Central de comunicacoes

- Criar as areas `Conversas`, `Nova mensagem` e `Configuracoes`.
- Manter inbox, contexto do paciente, busca, filtros, notas e estado de
  atendimento em `Conversas`.
- Levar o disparo manual para `Nova mensagem`.
- Levar canais, templates e inventario para `Configuracoes`.
- Ao responder ou revisar uma falha, preparar a mensagem e abrir a composicao.
- Manter erro, sucesso, vazio e carregamento explicitos.

## Tarefa 3 - Equipe e profissionais

- Tratar `/profissionais` como diretorio clinico e estado de integracoes.
- Explicar que convites e permissoes pertencem a area Equipe da conta.
- Exibir Google Agenda por profissional sem torna-la obrigatoria.
- Preservar criacao, edicao e arquivamento somente para quem pode gerenciar.
- Nao ampliar a troca de contexto alem do `SuperAdmin`.

## Tarefa 4 - Conta do cliente

- Substituir a pagina longa por areas selecionaveis de tarefa.
- Criar visao de ativacao com proximos passos objetivos.
- Separar assinatura de consumo, mantendo limites compreensiveis.
- Concentrar usuarios, convites, historico e permissoes em `Equipe`.
- Separar preferencias, marca, integracoes e dados fiscais.
- Remover `usuarioId`, nome interno de papel, origem tecnica e escopo de dados
  da interface comercial.

## Tarefa 5 - Revisao transversal

- Revisar falhas silenciosas nas comunicacoes.
- Revisar permissao e troca de contexto profissional.
- Validar responsividade, foco, teclado, estados e ausencia de overflow.
- Executar typecheck, lint, build, autorizacao/BFF, Playwright afetado,
  acessibilidade, secrets e matriz de confiabilidade.

## Tarefa 6 - Fechamento

- Criar `fase-196-comunicacoes-equipe-conta.md`.
- Atualizar checklist, resumo, status e log de desenvolvimento.
- Integrar por PR somente com os gates verdes.
- Validar health checks e logs do deploy de producao.
