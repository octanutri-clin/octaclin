# Fase 171 - Biblioteca de perguntas reutilizaveis

Status: concluida e validada em producao em 2026-07-30.

## Entregue

- Perguntas podem receber chave clinica e ser disponibilizadas na biblioteca
  do proprio tenant.
- A biblioteca permite busca por enunciado ou chave clinica e filtro por
  categoria.
- A inclusao cria uma copia independente no questionario de destino, com
  configuracao, opcoes e chave clinica preservadas.
- A copia fica inicialmente fora da biblioteca para evitar duplicatas no
  catalogo; pode ser disponibilizada depois pelo editor.
- A visibilidade e persistida sem introduzir regras condicionais de exibicao.

## Producao

A migration `AdicionarBibliotecaPerguntas1720000001008` foi aplicada e
registrada no Neon de producao. Ela adiciona `chave_clinica`,
`visivel_biblioteca` e um indice parcial para a consulta da biblioteca. Backend
e web foram publicados pelo Render no commit `af7d337`; o health check do
backend retornou `200` e a rota protegida da biblioteca retornou `401` sem
sessao, como esperado.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

## Proxima fase

Fase 172 - Check-ins recorrentes por paciente.
