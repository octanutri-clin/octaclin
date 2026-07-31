# Fase 170 - Integridade historica de formularios

Status: concluida e validada em producao em 2026-07-30.

## Entregue

- Cada envio novo guarda em `snapshot_estrutura` a versao, titulo, descricao,
  perguntas, configuracoes e opcoes existentes no momento do envio.
- Formularios publicos usam o snapshot quando presente, sem serem alterados
  por edicoes posteriores no editor.
- A leitura de respostas usa o enunciado e o tipo historicos do snapshot.
- Envios anteriores sem snapshot continuam com fallback para a estrutura atual.
- Envios manuais e os criados por agendamentos recorrentes capturam a mesma
  estrutura imutavel.

## Producao

A migration `AdicionarSnapshotEstruturaEnviosQuestionario1720000001007` foi
aplicada e registrada no Neon de producao. A coluna e anulavel para preservar
os envios existentes. O backend foi publicado pelo auto-deploy do Render no
commit `ceffdce`. Nenhuma variavel nova e necessaria.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
```

## Proxima fase

Fase 171 - Biblioteca de perguntas reutilizaveis.
