# Fase 27 - Hardening de UX operacional

## Objetivo

Melhorar a previsibilidade das telas administrativas do OctaClin depois do login funcional, com feedback claro para operacoes persistidas no BFF.

## Entregue

- Mensagens de sucesso em Pacientes, Profissionais e Questionarios.
- Limpeza de mensagens antigas ao recarregar, salvar ou iniciar nova operacao.
- Estados de botao preservados durante salvamento, carregamento e arquivamento.
- Feedback de erro mantido junto ao fluxo, sem expor HTML interno do Next.js ou respostas brutas desnecessarias.
- Acoes de edicao e arquivamento separadas por icones nas listagens.

## Telas impactadas

- `/pacientes`
- `/profissionais`
- `/questionarios`

## Resultado esperado

Depois de criar, editar, agendar, reordenar ou arquivar, a interface confirma a acao concluida e atualiza os dados exibidos.
