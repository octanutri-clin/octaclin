# Fase 281 - Auditoria da propria clinica (PB-27)

Data: 2026-09-26. Branch: `feat/pb27-auditoria-clinica`.
Estado: implementacao entregue na branch, aguardando CI e merge humano.
Risco R4: autorizacao, isolamento tenant e leitura de dados de auditoria.
Plano, politica aprovada e rollback: `docs/history/phases/PLANO_FASE_281.md`.

## Entrega

- Nova aba Auditoria no portal Client: data UTC, identificador opaco de
  usuario, acao e tipo de recurso. Filtros exatos, datas, paginacao limitada,
  estados de carregamento/vazio/erro e recuperacao.
- Backend usa JWT, papel exato Client, `cliente.acessar`, `ExecutorTenant`,
  predicado explicito de tenant e join que oculta identidade externa.
- BFF faz allowlist de filtros, rejeita repeticao/tenant arbitrario e usa
  sessao existente. Ambas as bordas respondem `private, no-store`.
- Consulta auditada sem copiar valores de filtro/resultados. Nenhum novo
  campo sensivel e selecionado: IP, navegador, metadados e identificadores
  de evento/recurso ficam fora do DTO.
- Retencao vigente de 3650 dias preservada. Sem migration, exportacao ou
  exclusao; nenhuma operacao em staging/producao.

## Evidencia local

- PASS: ciclo TDD inicial, 12 casos vermelhos antes da implementacao e
  verdes apos validacao/projecao.
- PASS: suite backend, 223 suites e 2129 testes; typecheck e build NestJS.
- SKIPPED: 4 suites/40 casos condicionados ao ambiente na suite backend,
  incluindo a prova RLS real. PostgreSQL/infraestrutura local nao configurados;
  a prova RLS nova esta conectada ao gate PostgreSQL existente do CI.
- PASS: HTTP com guardas reais de papel/permissao (JWT substituido por fixture),
  Client 200, outros papeis e falta de permissao 403, anonimo 401, query
  indevida 400; sem vazamento dos filtros para auditoria.
- PASS: BFF focado com autorizacao, parametros repetidos, tenant arbitrario
  e resposta no-store; typecheck Web e gate de linguagem.
- PASS: Playwright desktop/mobile, 6 casos incluindo regressao PB-26;
  dois cenarios PB-27 em cada viewport, com axe sem violacoes na aba.
  O primeiro ciclo identificou que limpar filtros nao apagava campos visuais;
  a correcao passou na repeticao dos mesmos cenarios.
- PASS: revisao independente `tenant-security-reviewer`, somente leitura;
  identificador adicional removido da projecao apos o primeiro parecer;
  segunda revisao sem achados concretos restantes. A revisao nao executou testes.
- PASS: guardas de controllers e redacao de auditoria, 35 testes.
- PASS: authz completo Web, lint sem erros (63 avisos), build Web e
  preflight documental. Build emitiu avisos de middleware/Edge Runtime do Next.
- PASS: matriz de confiabilidade (40 referencias), `git diff --check` e
  scanner local de secrets sem achados.
- NA: migration/DDL e rollout de banco, pois nao ha alteracao de schema.
- SKIPPED: smoke completo com stack demo local e verificacao de producao;
  frontend foi exercitado com fixtures sinteticas e o smoke completo fica no CI.

## Proximo passo

Parar apos abrir a PR, como solicitado pelo proprietario. Ele acompanha os
checks, informa falhas e realiza o merge. Proxima entrega da Onda 5: PB-21,
GPT-5.6 Terra / medio, skills context-engineering, test-driven-development,
nestjs-best-practices, typeorm e playwright-best-practices; revisao
tenant-security-reviewer para IDs de pacientes em operacoes em lote.
