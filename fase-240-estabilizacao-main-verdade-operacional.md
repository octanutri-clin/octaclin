# Fase 240 - Estabilizacao do main e verdade operacional

Status: implementacao local concluida; validacao remota em andamento em
2026-08-13.

## Objetivo

Restabelecer uma base confiavel antes de abrir novo modulo: CI verde, suite
completa representativa, dependencias sem alerta alto conhecido, backup
realmente agendado e documentos coerentes com o estado executavel.

## Correcoes

- Os mocks Playwright voltaram a incluir `console.acessar`, e os seletores do
  cadastro usam os nomes acessiveis atuais. O teste do sino valida o menu de
  notificacoes, nao o link antigo para Comunicacoes.
- O portal do paciente usa relogio fixo nos testes; a consulta futura nao
  expira com a passagem do calendario. O contrato LGPD aceita os campos
  opcionais atuais sem afrouxar isolamento entre pacientes.
- O CI executa as 122 suites do backend, em vez de cinco specs escolhidas.
- Overrides transitivos fixam `nanoid 3.3.17`, `postcss 8.5.23` e `sharp 0.35.3`.
  Lint, typecheck e build Next validaram a compatibilidade.
- O backup automatico foi habilitado no repositorio. O restore passa a exigir
  a migration `CriarCondutasTerapeuticas1720000001026` e RLS forcada nas
  tabelas tenant-scoped recentes das Fases 218, 235, 236 e 237.

## Evidencia local

```text
Backend Jest: 122 suites, 829 testes aprovados
Playwright focado: 6/6 em desktop e mobile
Authz/BFF: 35/35
Backend: typecheck e build aprovados
Web: lint, typecheck e build aprovados
Auditoria de producao: nenhuma vulnerabilidade conhecida em backend/web
```

## Gate remoto

A fase somente pode mudar para concluida quando:

1. O workflow `OctaClin CI` do commit publicado estiver verde.
2. Uma execucao real de `Backup producao`, com o canario atualizado, concluir
   sem imprimir secrets e sem usar producao como destino de restore.
3. A primeira execucao agendada posterior permanecer habilitada para o
   monitoramento recorrente.

Nenhuma migration, seed ou mutacao clinica faz parte desta fase.
