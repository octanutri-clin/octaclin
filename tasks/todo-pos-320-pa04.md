# PA04 — checklist de planejamento e implementação

Contrato: [plan-pos-320-pa04.md](plan-pos-320-pa04.md).
Base main6f0be7d (#417), branch docs/pos320-pa04-planejamento.
Planejamento consolidado; D01–D03 confirmadas. Runtime intacto.
Implementação aguarda troca manual para GPT-6 Luna alto.

## T00 — planejamento

- [x] #417 mergeada e conteúdo main idêntico ao HEAD aprovado a013555.
- [x] Cinco workflows e dez jobs CI do HEAD anterior conferidos SUCCESS.
- [x] Worktree isolada em main6f0be7d; PA03 e trabalhos anteriores preservados.
- [x] Consultar somente PA04 no mapa/catálogo/matriz/JSON; código interno indicado.
- [x] Auditar snapshots, listagem, projeção, scopes, BFF e sidebar/paginação.
- [x] Registrar G01–G08, segurança R4, testes PG e rollback sem migration.
- [x] D01: ambas, com resumos separados do rascunho e publicada atual.
- [x] D02: totais dos alimentos previstos na versão salva, sem substituições/metas.
- [x] D03: somente console profissional.
- [x] Consolidar handoff com decisões, dependências e critérios objetivos.
- [x] Verificações documentais: links Markdown locais, git diff --check e
  pnpm security:secrets PASS (Node22.21.1/pnpm11.25).
- [ ] Troca manual para GPT-6 Luna alto e continuidade antes de iniciar código.

## T01 — projeção estrita

- [ ] RED antes do helper; GREEN de zero, parcial, ausências e dados inválidos.
- [ ] Snapshot salvo, sem recomputar catálogo/árvore/histórico.
- [ ] Allowlist exata e decriptação/JSON indisponível sem detalhes sensíveis.
- [ ] Published pelo pointer correto; draft ativo; nenhum histórico substituído.

## T02 — backend em lote

- [ ] Metadados com select mínimo sem bytea clínica desnecessária.
- [ ] Totais num lote só das versões relevantes, limitado à página; sem N+1.
- [ ] Leitura autorizada por tenant/paciente/carteira antes de decriptar.
- [ ] Versões de outra clínica/paciente, arquivados e papéis negados sem resumo.
- [ ] Sem árvore, metas extras não aprovadas, entidades ou JSON cru na resposta.
- [ ] Contratos/consumidores antigos preservados; sem schema/migration.

## T03 — PostgreSQL real

- [ ] Instância descartável identificada, fixtures sintéticas e role sem BYPASSRLS.
- [ ] TenantA/B, carteiraA/B, transferência e arquivamento; FORCE RLS verificada.
- [ ] Query/projeção real, limites de lote, múltiplas páginas e seleção de versões.
- [ ] FOR SHARE do paciente serializa lotes com save/publicação/transferência.
- [ ] Barreiras reproduzíveis provam espera, coerência e negação após transferência.
- [ ] Não usar mocks ou CI antigo para alegar PASS de banco PA04.

## T04 — BFF/API Web

- [ ] Tipos opcionais/aditivos e interpretação segura de snapshots indisponíveis.
- [ ] Parâmetros pagina/limite allowlisted, scopes arbitrários descartados.
- [ ] Sessão/permissão/no-store e regressões BFF positivas/negativas.
- [ ] Nenhuma ampliação implícita da rota/projeção do portal.

## T05 — lista e paginação

- [ ] D01–D03 e labels vN/salvo; zero vs “—”, parcial e sem_snapshot explícitos.
- [ ] Lista usa total real, limite25, página atual e controles acessíveis.
- [ ] Dirty/FND02/operação/cópia impedem perda de rascunho ou resposta antiga.
- [ ] Nova carga/paciente reseta; create/archive/save atualizam estado de forma segura.
- [ ] Não fazer GET de detalhe por card nem somar composição no browser.

## T06 — regressões visuais

- [ ] Desktop/mobile/axe/keyboard, títulos longos e nenhum overflow.
- [ ] Duas páginas reais, resumo de publicada/rascunho conforme D01 e zero/parcial.
- [ ] Save/reidratação, dirty guard, colagem pendente e resposta atrasada.
- [ ] PA01–03/FND02, leitores, históricos e fluxos portal/PDF proporcional ao diff.

## T07–T08 — gates e entrega

- [ ] Lint, typecheck e builds Web/backend, Jest/BFF e PG específicos.
- [ ] Revisão cruzada R4 independente quando viável, autoria/limites declarados.
- [ ] Secrets/diff e documentos atualizados; somente dados sintéticos.
- [ ] Uma PR reúne plano e código; CI do HEAD/Scanners/Demo conferidos.
- [ ] Rollback conserva histórico; sem merge, deploy ou migration externa.

Evidência atual: apenas análise/merge/base/referências. Nenhum teste de
implementação PA04 foi criado ou executado; PG e ambientes externos SKIPPED.
