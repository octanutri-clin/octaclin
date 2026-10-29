# FOOD07 — checklist de planejamento e execução

Contrato vigente: [plano](plan-pos-320-food07.md). [Matriz de aceite e aprovação UX](aceite-pos-320-food07.md). [Referências](referencias-pos-320-food07.md). **Implementação autorizada** pelo proprietário após integração das decisões UX, em 28/10/2026. Q1–Q3/S1–S3 preservadas. Estado de execução ao fechar T06/T07 está em [registro de execução](execucao-pos-320-food07.md); as evidências são específicas dos comandos e commits registrados.

## Estado atual — 29/10/2026, PR #452 HEAD `166cc03969c4fd351d1aa5d46db6201e2182c753`

T01–T06 possuem evidências locais registradas. **T06: PASS local funcional**, 13/13 Playwright desktop e 13/13 mobile, com NUX/PUX cobertos nos limites registrados; Axe sem violações nos alvos da spec. **PA07: PASS local em 5 cenários × 2 projetos (10/10)**. Typecheck/build Web PASS em Node 22.21.1; lint zero erros e um aviso preexistente no `portal-shell.tsx:78`. R4 independente estática integral FOOD07 favorável e sem achados materiais; o revisor não executou testes. CI do HEAD #452 `166cc039`: Backend, Web, Demo smoke, AI, governança, rollout/operação, CodeQL, Semgrep, Trivy e Dependency Review PASS; Mobile Expo e PR Gate FAIL pela auditoria de `deepmerge@4.3.1` e `node-forge` na base. Provenance do SBOM SKIPPED. A correção permanece isolada na #453; #452 não está pronta para revisão/merge até a correção entrar na base e seus próprios checks serem repetidos.


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
- [x] Avaliação etapa B das duas personas com screenshots de interface real sintética; limitações registradas em [revisão UX B/C](revisao-ux-pos-320-food07-b-c.md).
- [x] Avaliação etapa C das duas personas após testes; oportunidades P2 registradas como backlog, sem ampliar o escopo.

## Execução autorizada — checkpoint T05

T01–T03 preservadas. T04 código `f45d5132` **PASS técnico local específico**: envio porcionado/instruções/hash semântico, leitores/projeções e retirada transacional; **3.620 PASS/161 skipped**, typecheck/build PASS, matriz de serviço48/48 e PostgreSQL/RLS19/19. [Execução/RED/GREEN/limites](execucao-pos-320-food07.md). T05 BFF:70/70, autorização Web332/332, typecheck PASS, lint zero erros/70 avisos externos ao delta. R4 estática integral favorável, UX B/C executadas; R4 não executou testes. CI do delta enviado e resolução do gate Mobile/#453 ainda pendentes. CI do HEAD anteriorff6cde0e: Backend/Web/Demo/scanners PASS; Mobile audit/PR Gate FAIL em fluxo separado #453. G06 BLOCKED.

| Tarefa | Entrega / critério verificável | Gate |
| --- | --- | --- |
| T01 — PASS local | Metadados/duas bases/aritmética racional, limites, legado sem base, helpers de projeção e oráculo sintético independente com RED/GREEN; wiring HTTP/persistência nas tarefas seguintes | G01 parcial |
| T02 — PASS local específico | Ciphertext+índice tenant-aware/CAS, migração aditiva, count/paginação SQL e PostgreSQL real RLS/rollback | G02 |
| T03 — PASS local específico | Prévia server-side autorizada, fonte/versão/fingerprint, totais por quantidade e ausência por indicador, nenhuma escrita e EntityManager compartilhado | G01/G04 |
| T04 — PASS local específico | Share com instruções específicas/conferência por item, hash do pedido completo inclusive texto, replay409 divergente, snapshots/legados/agendamento, projeção pública e concorrência transacional | G02/G04 |
| T05 — PASS local específico | BFF/tipos/body/authz/no-store/limites e compatibilidade GET/cliente antigo | G03/G04 |
| T06 — PASS local | UI de metadados/base, origem/destino distintos, confirmação/cancelamento, prévia e revalidação, instruções por envio, portal, paginação/filtros, desktop/mobile/Axe; etapa B/C UX sintética; PA07 focal 10/10 | G03 |
| T07 — BLOCKED por dependência de segurança | Regressões locais T06/PA07 PASS; UX C e R4 estática independente integral PASS (sem testes próprios). CI do HEAD exato passou nos demais gates aplicáveis; Mobile Expo/PR Gate FAIL pelo audit de deepmerge/node-forge na base; SBOM provenance SKIPPED. Reexecutar CI após a correção #453 integrar à base | G04/G05 |

Cada tarefa exige testes RED funcionais antes da mudança, GREEN após, regressão apropriada e commit intencional. Não usar erro de infraestrutura como RED. Se um teste não executar, registrar BLOCKED/NOT RUN/SKIPPED com motivo. CI genérico não substitui o caso específico.

## Dependências e limites

- Migration1080 criada/registrada após conferir main e reserva1079 da #446; aplicada somente no PostgreSQL descartável `food07_test`. Nunca aplicada em staging/produção. Reconciliar numeração e leitores/escritores novamente antes de futura integração.
- Sem dependência de1079/motor FOOD05; composição futura com446 pode exigir resolução de registro/DTOs, jamais merge implícito.
- G06/produção BLOCKED; sem DDL em staging/prod, merge, deploy, configuração, quota/cobrança. Retorno03/11 não implica desbloqueio.
- Baseline/T01 e provas específicas T02: resultados e comandos no registro de execução. PostgreSQL T02 não substitui regressões amplas RLS bloqueadas por setup. Playwright FOOD07 e PA07 locais passaram; R4 estática integral passou sem execução de testes próprios; CI atual passou nos checks aplicáveis, exceto Mobile/PR Gate, bloqueados pela auditoria na base. Provenance SBOM skipped.
- CI #451 do HEAD 0d3382b6 não prova FOOD07. Falha Mobile em auditoria de dependências já presentes na base deve seguir fluxo separado, sem waiver ou mudança em dependências nesta fase por conveniência.
