# Fase 87 - Resposta LGPD ao paciente

## Entregue

- O backend gera uma resposta LGPD padronizada por status do protocolo.
- Criado o endpoint `POST /operacoes/lgpd/solicitacoes/:protocolo/resposta`.
- Criada a rota BFF `POST /api/operacoes/lgpd/solicitacoes/:protocolo/resposta`.
- A resposta inclui assunto de e-mail, corpo de e-mail, texto de WhatsApp e canais sugeridos.
- A preparacao da resposta registra evento `resposta_lgpd_preparada` no historico operacional.
- O painel `/operacoes` ganhou acao `Preparar resposta` dentro do detalhe do protocolo.
- A interface permite copiar a resposta combinada para atendimento manual.
- A regressao visual cobre preparacao e copia da resposta em desktop e mobile.

## Decisoes

- O disparo automatico por e-mail/WhatsApp ficou fora desta fase para evitar envio sem template LGPD revisado.
- A resposta preparada e registrada no historico, mas o envio continua manual nesta etapa.
- Os textos usam linguagem objetiva por status: recebida, em tratamento, concluida e indeferida.
- A acao fica no detalhe do protocolo para reduzir risco de resposta com contexto desatualizado.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-operacoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test --grep "operacoes LGPD"`

## Proxima fase

Fase 88: exibir no portal do paciente os protocolos LGPD abertos, status atual e resumo da ultima resposta/tratativa.
