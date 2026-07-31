# Fase 180 - Prontuario clinico

Status: codigo concluido e validado localmente em 2026-07-30. Publicacao em
producao pendente.

## Entregue

- Cabecalho clinico fixo com identificacao do paciente, situacao, contato e
  comandos para atualizar, criar evolucao e prescrever tarefa.
- Areas separadas em Resumo, Evolucoes, Plano, Formularios, Mensagens,
  Materiais e Historico, com navegacao por teclado oferecida pelo componente de
  abas compartilhado.
- Resumo inicial com indicadores e Linha de cuidado compacta; os registros
  completos ficam no Historico para reduzir a informacao simultanea.
- Formularios, mensagens, evolucoes e tarefas reutilizam a mesma linha do
  tempo clinica, filtrada por contexto, sem duplicar dados ou endpoints.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web run test:a11y
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run build
```

Resultados: oito cenarios do prontuario passaram em desktop e celular; os 10
cenarios de acessibilidade, 22 testes de autorizacao e o build de producao
foram aprovados.

## Producao

Pendente de publicacao e verificacao do endpoint de health.

## Proxima fase

Fase 181 - Portal completo do paciente.
