# Fase 73 - Painel de respostas de formularios

## Entregue

- Adicionado endpoint protegido `GET /questionarios/:id/respostas`.
- O backend lista respostas finalizadas por questionario, restritas ao tenant autenticado.
- Cada resposta retorna paciente, envio, data de finalizacao, total respondido e valores por pergunta.
- Adicionada rota BFF autenticada em `/api/questionarios/:id/respostas`.
- O editor de questionarios agora exibe um painel de respostas recebidas por paciente.
- O painel permite atualizar respostas sem recarregar toda a tela.

## Decisoes

- O painel foi colocado na tela existente de questionarios para manter criacao, envio e leitura no mesmo fluxo operacional.
- A listagem retorna apenas respostas vinculadas a envios do questionario atual.
- Os valores sao formatados no frontend para suportar texto, numero, booleano, listas e objetos.

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

Fase 74: filtros e leitura clinica agregada por paciente/questionario.
