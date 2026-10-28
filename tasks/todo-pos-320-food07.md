# FOOD07 — checklist de planejamento e execução

Contrato proposto: [plano](plan-pos-320-food07.md). [Referências](referencias-pos-320-food07.md). Sem autorização de implementação até decisões S1–S3 e aceite do plano.

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
- [ ] S1: base receita inteira confirmada ou múltiplas bases.
- [ ] S2: porções desejadas fracionárias ou inteiras.
- [ ] S3: escala somente na aplicação ao plano ou também envio personalizado ao portal.
- [ ] Aprovar implementação após incorporar respostas. Campo PENDENTE não deve ser tratado como aprovado por silêncio.

## Execução futura — NOT RUN

| Tarefa | Entrega / critério verificável | Gate |
| --- | --- | --- |
| T01 | Normalização/DTO/merge de metadata, omissão vs limpar, limites e projeção por allowlist com RED/GREEN | G01 |
| T02 | Ciphertext+índice tenant-aware/CAS transacionais; migração aditiva; count/paginação SQL; PostgreSQL real com RLS/rollback/concorrência | G02 |
| T03 | Tag interna não sai em HTTP/snapshot; legado íntegro; novo envio e replay/agendamento corretos | G02/G04 |
| T04 | BFF/cliente/body consulta/limites/authz/no-store; GET antigo preservado | G03/G04 |
| T05 | Formulário/paginação/filtros/erros/cancelamento/seleção entre páginas; desktop/mobile/teclado/Axe; aplicar não escala alimentos | G03 |
| T06 | Porcionamento determinístico no backend, base explícita, prévia/confirmar, limites e regressões de persistência; depende S1–S3 | G01–G04 |
| T07 | Regressões, R4 independente, documentação e CI/scanners do HEAD, PR individual Draft | G04/G05 |

Cada tarefa exige testes RED funcionais antes da mudança, GREEN após, regressão apropriada e commit intencional. Não usar erro de infraestrutura como RED. Se um teste não executar, registrar BLOCKED/NOT RUN/SKIPPED com motivo. CI genérico não substitui o caso específico.

## Dependências e limites

- Número1080 da migration é candidato, não arquivo criado nem número formalmente reservado. Conferir colisões com main e PRs antes da implementação.
- Sem dependência de1079/motor FOOD05; composição futura com446 pode exigir resolução de registro/DTOs, jamais merge implícito.
- G06/produção BLOCKED; sem DDL em staging/prod, merge, deploy, configuração, quota/cobrança. Retorno03/11 não implica desbloqueio.
- Testes de runtime/banco/Playwright, baseline, builds, CI, scanners e revisão independente: NOT RUN nesta fase de planejamento. Verificação documental local separada.
