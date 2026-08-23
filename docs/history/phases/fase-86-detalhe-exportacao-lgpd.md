# Fase 86 - Detalhe e exportacao de protocolo LGPD

## Entregue

- O painel operacional LGPD ganhou detalhe por protocolo com linha do tempo de eventos.
- Criado o endpoint backend `GET /operacoes/lgpd/solicitacoes/:protocolo`.
- Criado o endpoint backend `GET /operacoes/lgpd/solicitacoes/:protocolo/exportar.csv`.
- Criadas rotas BFF equivalentes no Next, mantendo sessao HttpOnly no servidor.
- O detalhe mostra solicitacao original, tratativas, status, responsavel e datas.
- A exportacao CSV do protocolo inclui apenas campos operacionais necessarios, sem metadados brutos.
- A regressao visual cobre abertura de detalhe e exportacao do protocolo em desktop e mobile.

## Decisoes

- A linha do tempo continua sendo reconstruida a partir de eventos imutaveis em `consentimentos_lgpd`.
- A exportacao CSV fica por protocolo, evitando exportacoes amplas de dados sensiveis sem necessidade.
- A notificacao automatica ao paciente ficou fora desta fase para depender do mapeamento final dos templates/canais aprovados.
- O detalhe foi implementado inline no painel para manter o fluxo operacional rapido em desktop e mobile.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-operacoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test --grep "operacoes LGPD"`

## Proxima fase

Fase 87: resposta ao paciente para solicitacoes LGPD, com modelo de mensagem/e-mail por status e envio auditavel quando os canais estiverem prontos para notificacao operacional.
