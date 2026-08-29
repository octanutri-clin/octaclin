# Relatorio de seguranca - PR 38

Data: 2026-08-28
Risco: R4
Escopo: webhooks e endpoints publicos

## Resultado

O webhook de entrada da Meta passa a autenticar cada requisicao com
`X-Hub-Signature-256`, calculada sobre o corpo bruto exato com
`META_WHATSAPP_APP_SECRET`. Requisicoes sem assinatura, com assinatura
malformada/adulterada, content type diferente de JSON ou evento fora da janela
de validade falham antes de qualquer persistencia.

Reentregas identicas sao reservadas atomicamente no Redis por 24 horas, com
estado `processando` ou `concluido`. Uma duplicata concluida recebe HTTP 200
com `duplicado: true`, mas nenhum efeito e repetido. Uma duplicata ainda em
processamento recebe indisponibilidade, evitando confirmar um evento cuja
primeira execucao ainda pode falhar. Se a persistencia falhar, a reserva e
liberada para permitir nova tentativa legitima.

A verificacao GET aceita somente challenge numerico de ate 64 caracteres,
compara o verify token em tempo constante e fixa `text/plain; charset=utf-8`.

## Protecoes compartilhadas

- parser JSON com limite explicito de 100 KB e raw body preservado;
- rate limit atomico: no maximo `maxTentativas` atravessam um burst concorrente;
- reserva de idempotencia com `SET ... PX ... NX`;
- formulario publico limitado globalmente por IP e por IP + hash do token em
  consulta, escrita e upload;
- convite de paciente limitado globalmente por IP e por IP + hash do token em
  consulta e ativacao;
- agendamento publico preservado, pois ja possuia os dois niveis de limite;
- tokens nunca entram nas chaves Redis em texto claro.

## Janela temporal

Eventos Meta com mensagens ou statuses precisam conter timestamp numerico:

- atraso maximo: 24 horas;
- adiantamento maximo: 5 minutos.

Payloads validos sem eventos continuam sendo reconhecidos sem exigir timestamp.

## Gate Redis real

O job Backend NestJS do CI inicia `redis:7-alpine` descartavel e executa
`pnpm test:abuso:redis-real`. O teste dispara 40 chamadas concorrentes contra
um limite de 10 e exige exatamente 10 aceitas e 30 respostas 429. Outro teste
exige uma unica reserva de idempotencia entre 40 concorrentes.

Localmente esse gate exige Docker ou um Redis descartavel explicitamente
informado em `REDIS_PROVA_URL`. Nunca apontar esse teste para staging ou
producao.

## Pre-requisito de rollout

Antes do merge/deploy do backend de producao, configurar no Render:

- `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`;
- `META_WHATSAPP_APP_SECRET` com pelo menos 32 bytes.

Quando qualquer configuracao Meta estiver presente, o bootstrap de producao
falha fechado se esses dois segredos estiverem ausentes. O token legado
`META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN` continua opcional por compatibilidade,
mas nao substitui a assinatura Meta.

Nenhum segredo foi criado, lido ou alterado neste PR. A configuracao no
provider exige acao operacional humana separada.

## Rollback

O PR nao possui migration nem altera dados. Rollback de codigo pode ser feito
reimplantando o commit anterior. Nao remover os segredos do ambiente durante o
rollback: eles permanecem validos e nao prejudicam a versao anterior.

## Validacao

Registrar no corpo do PR os resultados reais de:

- Jest focado do webhook, limitador, formularios, convites e bootstrap;
- contrato HTTP real do Nest para raw body, MIME, status 200 e limite 413;
- suite completa do backend;
- typecheck;
- build;
- `git diff --check`;
- `pnpm security:secrets`;
- gate Redis real no CI.

O smoke real da Meta e SKIPPED neste PR: nenhuma chamada externa e autorizada
ou necessaria para provar os controles locais.
