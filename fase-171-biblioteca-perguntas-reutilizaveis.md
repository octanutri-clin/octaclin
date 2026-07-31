# Fase 171 - Biblioteca de perguntas reutilizaveis

Status: concluida localmente em 2026-07-30. Requer aplicar a migration antes
do deploy de producao.

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

## Deploy

Aplicar `AdicionarBibliotecaPerguntas1720000001008` no Neon de producao antes
ou junto da publicacao do backend. Ela adiciona `chave_clinica`,
`visivel_biblioteca` e um indice parcial para a consulta da biblioteca.

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
