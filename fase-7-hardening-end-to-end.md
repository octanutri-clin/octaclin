# Fase 7 - Hardening end-to-end OctaClin

## Objetivo

Fechar lacunas de confiabilidade entre backend e aplicativo mobile para transformar os fluxos da Fase 3 e Fase 5 em operacoes mais proximas de producao.

## Outbox transacional de comunicacoes

- `POST /comunicacoes/mensagens` agora persiste a mensagem e o evento `notificacao.enviar` na mesma transacao.
- A fila BullMQ deixa de ser chamada dentro do fluxo principal de criacao da mensagem.
- O `ProcessadorOutboxComunicacoes` roda a cada 30 segundos, busca eventos pendentes por tenant ativo e publica jobs idempotentes com `jobId = mensagem:<id>`.
- O evento registra tentativas, erro, `processado_em` e status `pendente`, `processando`, `processado` ou `falhou`.

Esse desenho reduz perda de notificacao quando o banco confirma a mensagem, mas Redis ou worker estao temporariamente indisponiveis.

## Sincronizacao offline em lote

- O backend recebeu `POST /mobile/sincronizacao/lote`.
- Cada item mobile envia `idLocal`, `tipo` e `payload`.
- A tabela `sincronizacoes_mobile` guarda o mapeamento entre `idLocal` e recurso criado.
- Retentativas com o mesmo `idLocal` retornam o mesmo recurso e evitam duplicidade.
- O app Expo agora lista pendencias SQLite, envia lote para a API e marca itens sincronizados individualmente.

Tipos suportados no lote:

- `diario_rapido`
- `midia_captura`
- `midia_audio`
- `acompanhante`

## Arquivos principais

- `octaclin-backend/src/infraestrutura/outbox/outbox-evento.orm.ts`
- `octaclin-backend/src/modulos/comunicacoes/aplicacao/processador-outbox-comunicacoes.ts`
- `octaclin-backend/src/modulos/mobile/infraestrutura/sincronizacao-mobile.orm.ts`
- `octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.ts`
- `octaclin-mobile/lib/api.ts`
- `octaclin-mobile/lib/banco-local.ts`

## Riscos remanescentes

- Falhas definitivas de outbox ainda precisam de tela operacional para reprocessamento manual.
- Concorrencia extrema no mesmo `idLocal` pode exigir tratamento explicito de violacao de chave unica para retornar o registro ja criado.
- O app mobile ainda usa token local de desenvolvimento na tela inicial; o proximo passo natural e integrar login real no fluxo Expo.

## Validacao executada

- `jest`: 9 suites e 22 testes passando no backend.
- `tsc --noEmit`: backend passando.
- `nest build`: backend passando.
- `tsc --noEmit`: mobile passando.
- `work/checar-imports-relativos.js`: 108 imports backend OK.
- `work/checar-imports-mobile.js`: 12 imports mobile OK.
- Varredura de nome legado em `outputs`: sem ocorrencias.
