# FOOD06 P2 — preparação e handoff

- Branch `codex/food06-p2-restricoes`; base `312d6727`, conferida em 2026-11-13.
- Objetivo: serviço e API de restrições (R4), conforme contratos v2/v3; flags
  desligadas e nenhum consumidor clínico novo ativado automaticamente.
- P1b (#531) e Auth-2 (#535) estão na base. A concessão deve ser verificada com
  `ServicoConcessoesPermissao.exigir` no mesmo `EntityManager` transacional da
  ação protegida; também é obrigatório verificar a carteira do paciente.
- Conteúdo clínico deve usar o codec vinculado a tenant, paciente, registro e
  revisão. Ilegível não é ausência. Histórico, auditoria e CAS são obrigatórios.
- A guarda estática `guarda-escrita-restricoes.spec.ts` tem lista de consumidores
  vazia: qualquer inclusão precisa ser nominal e acompanhada das provas de codec.
- A flag de restrições ainda não consta em `FEATURE_FLAGS_CONHECIDAS`; desenhar
  seu gate fechado sem contornar os bloqueios de ativação e sem ativar em ambiente.
- UX etapa A: personas nativas `/root/ux_nutri` e `/root/ux_paciente` receberam
  briefing sintético sobre o contrato na base `312d6727`; sem telas ou teste
  visual. Ambos indicaram testar distinção pendência/confirmada, conflitos de
  revisão e projeção mínima do portal. A interface futura deve tratar recuperação
  de conflito e resultado incerto; isso não autoriza ampliar o escopo de P2.
  Registrar o relatório completo e manifesto conforme `docs/agents/ux/PROCEDIMENTO.md`.
- Instalação congelada local PASS com Node 22/pnpm 11.25. Primeiro incremento:
  `autorizacao-restricao-clinica.ts` e seu spec, ainda sem consumidores. RED
  funcional com stub recusando acesso; GREEN 9/9 para concessão transacional,
  papel, vínculo de profissional e paciente. Typecheck PASS. Testes usam mocks;
  não comprovam RLS, locks concorrentes ou semântica de PostgreSQL.
- Tooling local: Node 12/12 PASS, wrapper `pnpm test:tooling-agentes` FAIL por
  ausência do executável `python3`; CI Linux deve executar a parte Python. Scanner
  de segredos e typecheck PASS. Não foi instalada dependência para contornar isso.
- Revisão estática parcial por `/root/p2_tenant_review`: sem achado reproduzido
  no helper, mas exige PostgreSQL real, runtime não-owner sem BYPASSRLS, outro
  tenant/carteira efetivamente existentes, revogação e reatribuição concorrente,
  `app.tenant_id` e fluxo chamador com tenant da sessão. Sem execução do revisor.
- Incremento posterior: prova P2 adicionada ao inventário RLS integrado, com
  tenant e pacientes sintéticos separados, concessão ausente/revogada, pacientes
  de outra carteira e tenant, e revogação bloqueada durante a transação. A prova
  localmente foi SKIPPED por Docker indisponível. CI da PR #536, run `43432488847`,
  job Backend `131909264184` no HEAD `6fd15558`: PASS na suíte RLS/Testcontainers
  (270/270), incluindo esta prova; suíte geral 5.059 PASS, 181 SKIPPED. São grupos
  sobrepostos, não somar. O CI do HEAD seguinte deve ser conferido separadamente.
- Nenhum SQL externo, migration, deploy, merge ou configuração externa alterada.
- Próxima ação: usar o helper no serviço transacional, implementar os testes e
  operações P2; manter o acesso clínico indisponível até proteção por flag.
- Pendente: todas as operações P2, API/DTOs,
  testes negativos de banco e de concorrência,
  provas RLS, UX B/C, revisão R4 independente, gates completos e PR.
