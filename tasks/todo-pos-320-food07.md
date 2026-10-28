# FOOD07 — checklist de planejamento e execução

Contrato vigente: [plano](plan-pos-320-food07.md). [Matriz de aceite e aprovação UX](aceite-pos-320-food07.md). [Referências](referencias-pos-320-food07.md). **Implementação autorizada** pelo proprietário após integração das decisões UX, em 28/10/2026. Q1–Q3/S1–S3 preservadas. Nenhum teste de implementação aprovado por esta atualização documental.

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
- [x] Aprovação humana NUX-01–05, PUX-01–05 enumerados; NUX-06/Fase 310 preservados, PUX-06 BACKLOG.
- [x] Decisões integradas ao plano e matriz próprios; relatórios históricos #451 não alterados.
- [x] Referência explícita a papéis/procedimento #451 no commit 0d3382b6; sem merge/cherry-pick.
- [x] Implementação autorizada com TDD, integração, regressão, R4 e PR Draft individual; sem autorização operacional.
- [ ] Avaliação etapa B das duas personas com interface real.
- [ ] Avaliação etapa C das duas personas após testes, antes da conclusão da PR.

## Execução autorizada — checkpoint T03

T01 código `bdb816f8` e T02 código `dc9620c0` concluídos tecnicamente; CI Backend/RLS T02 comprovado no HEAD4c5a8fc9. T03 código `5e20b279` implementado com prévia autorizada e reuso do motor; suíte completa3.577 PASS/150 skipped, typecheck/build PASS; **398/398 focados e PostgreSQL/RLS8/8 PASS**, re-revisão específica independente favorável após correções P1/P2. [Execução e limites](execucao-pos-320-food07.md). T04–T07 ainda pendentes, salvo allowlist mínima T04 antecipada por segurança. Não equivale a R4 integral nem CI global verde: Mobile audit permanece FAIL em fluxo separado #453. G06 BLOCKED.

| Tarefa | Entrega / critério verificável | Gate |
| --- | --- | --- |
| T01 — PASS local | Metadados/duas bases/aritmética racional, limites, legado sem base, helpers de projeção e oráculo sintético independente com RED/GREEN; wiring HTTP/persistência nas tarefas seguintes | G01 parcial |
| T02 — PASS local específico | Ciphertext+índice tenant-aware/CAS, migração aditiva, count/paginação SQL e PostgreSQL real RLS/rollback | G02 |
| T03 — PASS local específico | Prévia server-side autorizada, fonte/versão/fingerprint, totais por quantidade e ausência por indicador, nenhuma escrita e EntityManager compartilhado | G01/G04 |
| T04 | Share com instruções específicas/conferência por item, hash do pedido completo inclusive texto, replay409 divergente, snapshots/legados/agendamento, projeção pública e concorrência transacional | G02/G04 |
| T05 | BFF/tipos/body/authz/no-store/limites e compatibilidade GET/cliente antigo | G03/G04 |
| T06 | Duas bases antes/depois, origem/destino, lote corrigível, instruções ao lado de quantidades, portal pt-BR/404 seguro, erros/respostas tardias/desktop/mobile/Axe/PA07; personas B | G03 |
| T07 | Regressões, personas C, R4 independente e CI/scanners do HEAD, PR individual Draft | G04/G05 |

Cada tarefa exige testes RED funcionais antes da mudança, GREEN após, regressão apropriada e commit intencional. Não usar erro de infraestrutura como RED. Se um teste não executar, registrar BLOCKED/NOT RUN/SKIPPED com motivo. CI genérico não substitui o caso específico.

## Dependências e limites

- Migration1080 criada/registrada após conferir main e reserva1079 da #446; aplicada somente no PostgreSQL descartável `food07_test`. Nunca aplicada em staging/produção. Reconciliar numeração e leitores/escritores novamente antes de futura integração.
- Sem dependência de1079/motor FOOD05; composição futura com446 pode exigir resolução de registro/DTOs, jamais merge implícito.
- G06/produção BLOCKED; sem DDL em staging/prod, merge, deploy, configuração, quota/cobrança. Retorno03/11 não implica desbloqueio.
- Baseline/T01 e provas específicas T02: resultados e comandos no registro de execução. PostgreSQL T02 não substitui regressões amplas RLS bloqueadas por setup. Playwright FOOD07, CI do novo HEAD e revisão independente integral ainda pendentes; skips não são aprovação.
- CI #451 do HEAD 0d3382b6 não prova FOOD07. Falha Mobile em auditoria de dependências já presentes na base deve seguir fluxo separado, sem waiver ou mudança em dependências nesta fase por conveniência.
