# Fase 278 — PB-17: catálogo e série de marcadores laboratoriais

## Escopo e decisão de produto

Risco R4: exames são dados clínicos, o vínculo entre resultado e catálogo precisa
respeitar tenant e paciente, e a fase acrescenta schema. O PB-17 entrega um
catálogo por tenant com nome, unidade e faixa numérica padrão; cada resultado
vinculado guarda uma cópia da faixa efetivamente informada. O profissional pode
ajustá-la na coleta. A decisão foi confirmada pelo proprietário em 2026-09-25.

O sistema mostra apenas “fora da faixa informada” quando valor, limite e
unidade da **mesma coleta** são numéricos e explícitos. Não converte unidades,
não infere faixa de textos livres legados, não diagnostica e não publica
resultados no portal. Resultados antigos seguem legíveis sem vínculo e sem
classificação automática. O catálogo não contém valores de pacientes.

## Contrato mínimo

- Criar, listar e arquivar definições do catálogo no escopo do tenant, com
  permissões existentes de pacientes e trilha de auditoria sem conteúdo
  clínico. Alterar um padrão exige arquivar a definição e criar outra; os
  resultados anteriores mantêm seu snapshot.
- Criar coleta com `catalogoMarcadorId` opcional em cada resultado. Se presente,
  o servidor busca a definição no tenant autenticado, usa o nome canônico e
  copia unidade/faixa padrão, aceitando ajustes explícitos do resultado. Uma
  unidade diferente não herda a faixa padrão sem limites informados para ela.
- Listar coletas com vínculo, snapshot e estado factual derivado. A UI agrupa
  por ID do catálogo para mostrar a série temporal do paciente. Nomes livres
  antigos não são ligados automaticamente por similaridade textual.
- Negar ID de catálogo ausente, arquivado ou de outro tenant com 404; manter a
  verificação de paciente/carteira antes de buscar resultados.

## Testes e gates

TDD: testes positivos e negativos de vínculo tenant, arquivo, snapshot,
unidade/faixa, valor não numérico, compatibilidade legada, permissão e série.
Migration aditiva com RLS forçada, FK composta por tenant e índice; validar
registro no TypeORM e schema em banco descartável quando disponível. Rodar
typecheck, specs focadas, gates de autorização, `git diff --check` e
`pnpm security:secrets` antes de push. Revisão cruzada de tenancy após editar
serviços com IDs relacionados.

## Ambiente e rollback

Código e migration são preparados nesta branch. Nenhuma migration será
executada em staging ou produção pelo agente. A aplicação futura exige banco,
branch e role owner confirmados pelo proprietário conforme runbook. A migration
é aditiva e aceita resultados legados; antes de aplicar a migration, rollback
é descartar esta branch/PR. Depois da aplicação, o rollback de código mantém
as colunas extras sem uso; não usar `migration:revert` em ambiente com dados.
Arquivar uma definição impede novos vínculos e preserva o histórico.
