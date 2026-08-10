# Fase 222 - Confiabilidade Google Agenda e Gmail

Status: em validacao de producao em 2026-08-10.

## Problema observado

- As mutacoes OctaClin para Google Agenda funcionavam, mas eventos criados no
  Google nao apareciam como indisponibilidade na agenda interna.
- A conexao individual e o canal watch estavam ativos em producao, porem a
  conexao nao possuia `syncToken` e nao havia bloqueios externos persistidos.
- A Gmail API registrou falha ao renovar o refresh token durante a Fase 221.

## Entrega

- O reconciliador Google fica disponivel no processo HTTP; apenas consumidores
  BullMQ e cron continuam condicionados ao papel do processo.
- O callback OAuth executa a primeira reconciliacao depois de criar o canal.
- A carga inicial considera os ultimos 30 dias e os proximos 400 dias;
  chamadas com `syncToken` nao combinam filtros incompativeis.
- A renovacao semanal reinicia o token para mover a janela e uma carga completa
  bem-sucedida remove bloqueios externos fora do horizonte.
- `POST /agenda/google/sincronizar` oferece recuperacao autenticada e exclusiva
  do profissional conectado.
- A agenda ganhou o comando `Sincronizar agora`, com estado de processamento e
  recarga do feed interno.
- O helper Gmail valida `state` e grava o refresh token apenas em arquivo
  temporario explicitamente informado, sem imprimir o segredo no terminal.

## Evidencia local

- 4 suites e 27 testes focados do backend aprovados.
- Typecheck e build do backend aprovados.
- Typecheck, lint e build do web aprovados; a nova rota BFF consta no artefato.
- `node --check octaclin-backend/scripts/gmail-oauth-token.mjs` aprovado.
- O primeiro smoke produziu `syncToken`, mas revelou 8.530 instancias de um
  recorrente expandido ate 2040; a janela movel foi adicionada antes do aceite.

## Pendente de producao

- Publicar backend e web e executar `Sincronizar agora` com evento externo
  sintetico, confirmando bloqueio no feed e `syncToken` persistido.
- Confirmar `OCTACLIN_PROCESSO=all` enquanto nao houver worker dedicado.
- Renovar `GMAIL_REFRESH_TOKEN`, testar envio real controlado e apagar todos os
  arquivos/variaveis temporarios usados na rotacao.
