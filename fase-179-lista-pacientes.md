# Fase 179 - Lista de pacientes

Status: codigo concluido e validado localmente em 2026-07-30. Publicacao em
producao pendente.

## Entregue

- A listagem passa a trazer ultima consulta concluida e proxima consulta ativa
  para os pacientes ja permitidos pelo tenant e pelo escopo do profissional.
- Busca por nome ou contato, filtros por risco, responsavel e situacao, mais
  atalhos completos para todos, alta prioridade e pacientes sem consulta futura.
- A tabela desktop mostra risco, responsavel, ultima consulta e proxima acao;
  no celular a mesma informacao aparece em lista de leitura e acao direta.
- A proxima acao e transparente: revisar risco alto, agendar retorno sem
  consulta futura ou informar a proxima consulta existente.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "lista de pacientes operacional" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web run test:a11y
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run build
```

Resultados: 17 testes do servico de pacientes, dois cenarios Playwright da
lista, os 10 cenarios de acessibilidade, 22 testes de autorizacao e o build
de producao foram aprovados.

## Producao

Pendente de publicacao e verificacao dos endpoints de health.

## Proxima fase

Fase 180 - Prontuario clinico.
