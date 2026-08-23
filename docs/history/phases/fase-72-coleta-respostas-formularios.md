# Fase 72 - Coleta de respostas de formularios

## Entregue

- Adicionadas ORMs para `respostas_checkin` e `resposta_valores`.
- Adicionado token publico assinado para formulario no formato `tenantId.envioId.assinatura`.
- Adicionado endpoint protegido `POST /questionarios/:id/envios` para criar envio manual e retornar `linkFormulario`.
- Adicionados endpoints publicos:
  - `GET /formularios/:token`
  - `POST /formularios/:token/respostas`
- O backend valida token, envio expirado/respondido e respostas obrigatorias.
- Ao finalizar, o backend grava `respostas_checkin`, grava `resposta_valores`, marca o envio como `respondido` e atualiza `ultimoCheckinEm` do paciente.
- Adicionadas rotas BFF publicas em `/api/formularios/:token`.
- Adicionada pagina publica `/formularios/[token]` para o paciente responder sem login.
- O editor de questionarios agora permite selecionar paciente e gerar link publico do formulario.

## Decisoes

- O link publico usa assinatura HMAC e nao exige nova coluna no banco.
- A coleta aceita todos os tipos atuais de pergunta.
- Upload de midia registra os nomes dos arquivos nesta fase; upload real de arquivo fica para fase posterior do modulo mobile/midia.
- O envio manual nasce como `enviado`, com expiracao padrao de 7 dias.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-questionarios.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-web test:questionarios-preview`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 73: painel de respostas recebidas e leitura clinica por paciente/questionario.
