# Fase 222 - Confiabilidade Google Agenda e Gmail

Status: concluida em producao em 2026-08-10.

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

## Evidencia de producao

- Backend e web publicados nos commits `f58268a` e `4273aa5`.
- A reconciliacao inicial persistiu `syncToken` sem falhas consecutivas. Depois
  do limite de recorrencias, o banco manteve 2.904 bloqueios externos, 2.658
  futuros e horizonte maximo em 2027-09-14, sem consultas ativas residuais.
- O OAuth Gmail foi publicado em modo de producao e renovado com um cliente
  dedicado. A troca do refresh token retornou Bearer valido com escopo
  `gmail.send` e o Gmail aceitou uma mensagem real controlada.
- O health detalhado retornou `ok` para backend, banco, migrations, Redis,
  email com provedor `gmail_api` e Google Calendar.
- `OCTACLIN_PROCESSO` foi corrigido de `web` para `all`, pois o worker dedicado
  continua adiado, e o novo deploy permaneceu saudavel.
- Arquivos temporarios, copias DPAPI e area de transferencia usados na rotacao
  foram removidos; nenhum token ou segredo foi registrado na evidencia.

## Resultado

- Eventos externos do Google voltam a bloquear a agenda interna dentro da
  janela movel, com reconciliacao incremental e recuperacao manual.
- Mutacoes OctaClin continuam sincronizando com o Google Calendar.
- A Gmail API de producao voltou a renovar credenciais e enviar mensagens.
