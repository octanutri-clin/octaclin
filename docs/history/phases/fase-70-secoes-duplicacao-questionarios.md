# Fase 70 - Secoes e duplicacao de questionarios

## Entregue

- Adicionado campo `Secao` nas propriedades da pergunta.
- A lista de perguntas passa a exibir a secao de cada pergunta.
- O preview do paciente agrupa perguntas por secao.
- A normalizacao backend preserva `configuracao.secao` em todos os tipos de pergunta.
- Adicionado endpoint backend `POST /questionarios/:id/duplicar`.
- A duplicacao copia questionario, perguntas, configuracoes e opcoes, criando o novo questionario como `rascunho`.
- Adicionada rota BFF `POST /api/questionarios/:id/duplicar`.
- Adicionado botao `Duplicar` no editor de questionarios.

## Decisoes

- A secao fica em `configuracao.secao` para evitar nova migracao de tabela nesta fase.
- O questionario duplicado sempre nasce em `rascunho` e com `versao` 1.
- Se o titulo nao for informado na duplicacao, o backend usa o padrao `Titulo original (copia)`.
- Ao trocar o tipo da pergunta, a secao atual e preservada.

## Validacao

- `pnpm --dir octaclin-backend test -- configuracao-pergunta.spec.ts --runInBand`
- `pnpm --dir octaclin-backend test -- servico-questionarios.spec.ts --runInBand`
- `pnpm --dir octaclin-web test:questionarios-preview`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web build`
- `git diff --check`

## Proxima fase

Fase 71: biblioteca de modelos de formularios e fluxo de criacao a partir de templates.
