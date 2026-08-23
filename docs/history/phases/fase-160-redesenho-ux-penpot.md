# Fase 160 - Redesenho UX/UI e especificacao Penpot

Status: concluida em 2026-07-30.

## Objetivo

Consolidar a fonte de verdade visual do OctaClin antes do redesenho do
frontend, preservando o carater clinico e operacional do produto e sem usar
dados reais de pacientes.

## Entregue

- Arquivo Penpot com as paginas 00 (visao e sistema), 01 (portal e
  agendamento), 02 (console e gestao) e 03 (especificacao).
- Sistema visual local com tipografia Figtree/Noto Sans, cores, espacamento,
  bordas, estados e componentes reutilizaveis.
- Especificacoes desktop e mobile para acesso, portal do paciente,
  agendamento publico, formularios, console clinico, agenda, prontuario,
  gestao, comunicacoes, automacoes, IA, operacoes mobile e gamificacao.
- Regras de responsividade, acessibilidade, permissoes e estados de
  carregamento, vazio, erro e sucesso por fluxo.

## Decisoes preservadas

- O portal do paciente usa linguagem nao tecnica e nao deve expor score de
  risco clinico.
- O console profissional agrupa navegacao em Clinica, Relacionamento e
  Administracao.
- Componentes repetidos devem ser reutilizados; esta fase nao introduziu
  codigo, deploy, dados reais, tokens ou credenciais.

## Validacao

- Estrutura do arquivo validada pelo Penpot sem erros.
- Pranchas principais revisadas em desktop e mobile.
- Todos os exemplos de pessoa e contato no desenho sao sinteticos.

## Proxima etapa

A Fase 161 implementa a base visual e a navegacao compartilhada no
`octaclin-web`, antes das revisoes profundas de cada jornada.
