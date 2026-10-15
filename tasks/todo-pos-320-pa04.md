# PA04 — checklist de planejamento e implementação

> Fechamento em 2026-10-14: PR #418 mergeada em `64f54b88`, árvore idêntica
> ao HEAD `37d7979` aprovado. Checks aplicáveis PASS, incluindo CI
> `38625821164`, Backend/PostgreSQL/RLS descartável, Web, Demo e PR Gate.
> SBOM provenance SKIPPED. Os itens pendentes abaixo preservam o checkpoint
> anterior; gates de integração/CI encerrados pela evidência remota, sem alegar
> execução local dos 64 casos bloqueados por ENOSPC. Sem migration/deploy externo.


Contrato: [plan-pos-320-pa04.md](plan-pos-320-pa04.md).
Base main6f0be7d (#417), implementação na branch feat/pos320-pa04-resumos-macros.
Planejamento consolidado; D01–D03 confirmadas. CI/PR ainda não criados.

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
- [x] Troca manual para GPT-6 Luna alto confirmada pelo proprietário.

## T01 — projeção estrita

- [x] RED antes do helper; GREEN em zero, parcial, ausências e dados inválidos.
- [x] Snapshot salvo, sem recomputar catálogo/árvore/histórico.
- [x] Allowlist exata; falha de decriptação/JSON sem detalhes sensíveis.
- [x] Published pelo pointer correto; draft ativo; histórico não substituído.

## T02 — backend em lote

- [x] Planos/metadados com select mínimo; cipher fora da consulta de metadados.
- [x] Metadados ORM limitados às publicadas atuais + drafts ativos; histórico contado em agregação tenant-scoped, sem materializar linhas antigas. Totais em lote só para versões relevantes; sem N+1.
- [x] Leitura autorizada por tenant/paciente/carteira antes de decriptar.
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
  BLOCKED: Testcontainers tentou iniciar `timescale/timescaledb-ha:pg15` após a
  limpeza das imagens sem uso; o driver Docker VFS consumiu os 8,7 GB livres e
  a criação do container falhou com `no space left on device`. O hook expirou e
  os 64 casos de integração não executaram. A imagem de teste foi removida após
  a tentativa; não é evidência de falha funcional.

## T04 — BFF/API Web

- [x] Tipos opcionais/aditivos e interpretação segura de snapshots indisponíveis.
- [ ] Parâmetros pagina/limite allowlisted, scopes arbitrários descartados.
- [x] Sessão/permissão/no-store e regressões BFF positivas/negativas; BFF 26/26.
- [ ] Nenhuma ampliação implícita da rota/projeção do portal.

## T05 — lista e paginação

- [x] D01–D03 e labels vN/salvo; zero vs “—”, parcial e sem_snapshot explícitos.
- [x] Lista usa total real, limite25, página atual e controles acessíveis.
- [x] Dirty/FND02/operação/cópia impedem perda de rascunho ou resposta antiga.
- [x] Nova carga/paciente reseta; troca de paciente usa guard síncrono no prontuário e editor + remount por key; create/archive/save atualizam estado de forma segura.
- [x] Lista/página/editor só são publicados juntos após lista, detalhe e avaliações resolverem; erro preserva página/editor anterior.
- [x] Não fazer GET de detalhe por card nem somar composição no browser.

## T06 — regressões visuais

- [x] Quatro cenários em desktop/mobile: paginação/resumos, falha de detalhe preservando lista/editor e troca A→B com respostas pendentes; 4/4 PASS, axe e overflow.
- [ ] Save/reidratação, dirty guard, colagem pendente e resposta atrasada.
- [ ] PA01–03/FND02, leitores, históricos e fluxos portal/PDF proporcional ao diff.

## T07–T08 — gates e entrega

- [x] Typecheck Web/backend; testes focados backend 44/44; BFF Web 26/26; scanner local de secrets, `node --check` e `git diff --check`.
- [x] Revisão R4 independente estática confirmou correções dos P2 e guard A→B; sem execução de testes pela revisora. Relatório `docs/governance/REVISAO_R4_PA04_2026-10-14.md`.
- [x] Lint focado: 0 erros/10 avisos de regras React hooks existentes.
- [x] Builds Web/backend e TypeScript; build Web emite aviso upstream do Next sobre API Node no Edge Runtime e depreciação de middleware.
- [ ] Suíte PostgreSQL real BLOCKED por `ENOSPC` no Testcontainers/Docker VFS; 64 casos não executaram.
- [x] Uma PR Draft #418 reúne plano e código.
- [ ] CI do HEAD, scanners e Demo da PR #418 conferidos; pendentes neste checkpoint.
- [ ] Rollback conserva histórico; sem merge, deploy ou migration externa.

Evidência atual: projeção, listagem, BFF e UI implementados; revisão R4 estática confirmou as correções e Playwright atualizado passou 4/4. PostgreSQL real permanece BLOCKED por ENOSPC no Docker VFS. Builds locais, typechecks, backend 44/44, BFF 26/26, lint e verificações estáticas passaram. PR Draft #418 aberta; CI/scanners/Demo pendentes. Staging, produção, deploy e migration externa SKIPPED; sem migration necessária.
