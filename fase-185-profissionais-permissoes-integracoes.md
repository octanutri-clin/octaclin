# Fase 185 - Profissionais, permissoes e integracoes

Status: etapa inicial concluida no commit `d7a6a52` em 2026-07-31.

## Entregue

- A lista deixa explicito que criar, editar e arquivar depende da capacidade de
  gerenciar profissionais e deixa de expor o identificador interno do registro.
- A autorizacao de API e a restricao de troca de painel continuam sendo a fonte
  de verdade; a interface nao concede acesso por si so.

## Pendente para encerrar a fase

- A API de profissionais ainda nao devolve a situacao da Google Agenda por
  profissional. Esse contrato deve existir antes de exibir uma grade que possa
  sugerir um estado incorreto.
- Documentar na interface de SuperAdmin a troca excepcional de contexto quando
  o fluxo de impersonacao estiver disponivel no backend.
