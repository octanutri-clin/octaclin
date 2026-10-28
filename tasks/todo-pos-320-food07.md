# FOOD07 — checklist de planejamento e execução

Contrato proposto: [plano](plan-pos-320-food07.md). [Referências](referencias-pos-320-food07.md). Sem autorização de implementação até aceite do plano consolidado e autorização expressa. Q1–Q3/S1–S3 respondidas.

## Estado desta rodada

- [x] Base main conferida após fetch, `2f24fcb1`; branch própria `docs/pos320-food07-planning`.
- [x] FOOD05/PR446 e G06 preservados na worktree anterior.
- [x] Auditoria da Fase310: categorias, ingredientes, instruções, versão, escopos e envio imutável já cobertos.
- [x] Lacunas estáticas confirmadas: tags/rendimento/tempo inexistentes e UI fixa nos primeiros100 registros.
- [x] R017/R018 consultadas de forma direcionada, com licença/blobs documentados; nenhuma instalação/cópia.
- [x] Modelo de dados, consulta paginada, projeções, migration candidata, segurança e testes propostos.
- [x] Q1: campos opcionais, paginação e filtros aprovados.
- [x] Q2: proprietário aprovou também ajuste de quantidades por rendimento; proposta somente informativa substituída.
- [x] Q3: tags internas; rendimento/tempo em novos envios ao portal aprovado.
- [x] S1: bases receita inteira e por porção aprovadas.
- [x] S2: porções fracionárias com prévia aprovadas.
- [x] S3: envio porcionado ao portal aprovado; snapshot independente obrigatório.
- [ ] Aprovar implementação do plano consolidado; respostas funcionais já incorporadas. Aceite de escopo não equivale à execução.

## Execução futura — NOT RUN

| Tarefa | Entrega / critério verificável | Gate |
| --- | --- | --- |
| T01 | Metadados/duas bases/aritmética racional, limites, legado sem base, projeções e oráculo sintético independente com RED/GREEN | G01 |
| T02 | Ciphertext+índice tenant-aware/CAS, migração aditiva, count/paginação SQL e PostgreSQL real RLS/rollback | G02 |
| T03 | Prévia server-side autorizada, fonte/versão/fingerprint, nenhuma escrita e EntityManager compartilhado | G01/G04 |
| T04 | Share personalizado, hash do pedido completo, replay409 divergente, snapshots/legados/agendamento, projeção pública e concorrência transacional | G02/G04 |
| T05 | BFF/tipos/body/authz/no-store/limites e compatibilidade GET/cliente antigo | G03/G04 |
| T06 | Duas bases e mudança confirmada, formulário/páginas/seleção, frações/prévia/editor+portal, erros/respostas tardias/desktop/mobile/Axe/PA07 | G03 |
| T07 | Regressões, R4 independente e CI/scanners do HEAD, PR individual Draft | G04/G05 |

Cada tarefa exige testes RED funcionais antes da mudança, GREEN após, regressão apropriada e commit intencional. Não usar erro de infraestrutura como RED. Se um teste não executar, registrar BLOCKED/NOT RUN/SKIPPED com motivo. CI genérico não substitui o caso específico.

## Dependências e limites

- Número1080 da migration é candidato, não arquivo criado nem número formalmente reservado. Conferir colisões com main e PRs antes da implementação.
- Sem dependência de1079/motor FOOD05; composição futura com446 pode exigir resolução de registro/DTOs, jamais merge implícito.
- G06/produção BLOCKED; sem DDL em staging/prod, merge, deploy, configuração, quota/cobrança. Retorno03/11 não implica desbloqueio.
- Testes de runtime/banco/Playwright, baseline, builds, CI, scanners e revisão independente: NOT RUN nesta fase de planejamento. Verificação documental local separada.
