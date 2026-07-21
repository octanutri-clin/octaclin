# Fase 71 - Modelos de questionarios

## Entregue

- Adicionado catalogo backend de modelos prontos de questionario.
- Adicionados modelos:
  - Check-in semanal de adesao
  - Recordatorio alimentar 24h
  - Triagem de primeira consulta
- Adicionado endpoint `GET /questionarios/modelos`.
- Adicionado endpoint `POST /questionarios/modelos/:modeloId/criar`.
- A criacao por modelo garante categorias, cria o questionario como `rascunho` e inclui perguntas, secoes, configuracoes e opcoes.
- Adicionadas rotas BFF correspondentes em `/api/questionarios/modelos`.
- O editor de questionarios agora carrega modelos no bootstrap e exibe uma biblioteca compacta no painel esquerdo.
- O profissional pode criar e selecionar um questionario a partir de um modelo com um clique.

## Decisoes

- Os modelos ficam versionados em codigo nesta fase para evitar migracao e permitir evolucao rapida do catalogo.
- A criacao por modelo nao publica o questionario automaticamente; o fluxo continua em `rascunho`.
- As categorias do modelo sao reaproveitadas por nome quando ja existem no tenant.
- Perguntas de modelo usam `configuracao.secao`, mantendo compatibilidade com a Fase 70.

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

Fase 72: fluxo de envio/coleta de respostas do paciente para formularios.
