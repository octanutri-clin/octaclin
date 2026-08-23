# Fase 85 - Painel operacional LGPD

## Entregue

- O painel `/operacoes` ganhou a fila `Solicitacoes LGPD`.
- A fila consolida protocolos abertos no portal do paciente a partir de `consentimentos_lgpd`.
- O backend expõe `GET /operacoes/lgpd/solicitacoes` com filtros por status, tipo e paginacao.
- O backend expõe `POST /operacoes/lgpd/solicitacoes/:protocolo/status` para registrar tratativas.
- As tratativas sao gravadas como eventos `tratativa_lgpd`, mantendo historico imutavel por protocolo.
- A interface permite iniciar tratativa, concluir ou indeferir um protocolo.
- O BFF web adicionou rotas autenticadas para listagem e atualizacao de status LGPD.
- A regressao visual cobre a fila LGPD e a acao `Iniciar tratativa` em desktop e mobile.

## Decisoes

- Nao foi criada migration nesta fase: a fila usa os eventos LGPD ja registrados na Fase 84.
- O status atual e reconstruido pelo protocolo, aplicando a ultima `tratativa_lgpd` sobre a solicitacao original.
- A exclusao de dados continua sem execucao automatica; o painel registra tratamento operacional antes de qualquer acao irreversivel.
- O acesso permanece restrito a `SuperAdmin`, seguindo o padrao existente da area de operacoes.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-operacoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test --grep "operacoes LGPD"`

## Proxima fase

Fase 86: aprimorar o fluxo operacional LGPD com detalhes do paciente, exportacao do protocolo, comentarios internos e notificacao ao paciente quando a tratativa for concluida.
