# Fase 185 - Profissionais, permissoes e integracoes

Status: concluida e enviada para deploy no commit `806d676` em 2026-07-31.

## Entregue

- A lista deixa explicito que criar, editar e arquivar depende da capacidade de
  gerenciar profissionais e deixa de expor o identificador interno do registro.
- A autorizacao de API e a restricao de troca de painel continuam sendo a fonte
  de verdade; a interface nao concede acesso por si so.
- SuperAdmin visualiza por profissional somente a situacao conectada ou
  desconectada da Google Agenda. O endpoint nao devolve tokens ou calendarios.

## Pendente para encerrar a fase

- Documentar na interface de SuperAdmin a troca excepcional de contexto quando
  o fluxo de impersonacao estiver disponivel no backend.
