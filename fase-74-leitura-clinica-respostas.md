# Fase 74 - Leitura clinica de respostas

## Entregue

- Adicionado agregado protegido `GET /questionarios/:id/respostas/leitura-clinica`.
- A leitura clinica aceita filtro por `pacienteId`.
- O backend resume envios respondidos, pacientes, perguntas, media de respostas por envio e ultima resposta.
- O backend agrega indicadores por pergunta: total, sim/nao, media numerica, distribuicao e textos recentes.
- Adicionada rota BFF autenticada em `/api/questionarios/:id/respostas/leitura-clinica`.
- O editor de questionarios ganhou filtro por paciente, busca local e painel de indicadores clinicos.
- O historico detalhado continua disponivel abaixo dos indicadores.

## Decisoes

- A rota bruta de respostas da Fase 73 foi preservada para nao quebrar integracoes futuras.
- A agregacao clinica foi exposta em rota separada para manter contrato claro entre lista operacional e leitura analitica.
- A busca textual ficou no frontend para evitar complexidade de consulta antes de termos indexacao dedicada.

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

Fase 75: portal do cliente/paciente com acesso autenticado aos formularios, consultas e mensagens.
