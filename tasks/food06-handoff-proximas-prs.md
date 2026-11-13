# FOOD06 — handoff das próximas PRs (Auth-1, Auth-2, P2, P3, P4)

**Para quem executa (Codex ou Claude Code).** Este arquivo é instrução, não estado. Reconfirme `git status`, a branch, a PR e a `main` antes de escrever. Regras: `AGENTS.md`, `CLAUDE.md`, `docs/agents/REGRAS.md`.
Fonte do desenho: `tasks/food06-m11-restricoes-contrato-v3.md` (delta) e `tasks/food06-m11-restricoes-contrato-v2.md` (§4 desenho, §6 plano, §9 UX).
Estado de partida (verificar): #528 (contrato v3), #529 (domínio puro e auditoria Q5) e #531 (P1b, migration 1083) mergeadas.

## Regras comuns a todas as PRs abaixo

- O **proprietário mergeia**; nunca mergear, nunca push direto em `main`, nunca force-push.
- **Nenhuma migration em ambiente real** (Neon, staging, produção). Ensaio só em PostgreSQL descartável local ou Testcontainers. Antes de qualquer SQL, confirmar banco, branch e role alvo.
- Dados **sintéticos**; nenhum PHI, PII, secret ou arquivo de ambiente real em código, teste, log ou PR.
- TDD com RED primeiro; testes negativos para a propriedade crítica; mutações temporárias (sobreviventes viram testes); canários de vazamento; erro sem eco.
- Tenant resolvido pelo servidor a partir da credencial; nunca aceitar tenant do cliente.
- Antes de push: `git diff --check`, `pnpm security:secrets`, `pnpm test:tooling-agentes`, e os gates do módulo (jest, `tsc`/build, `test:rls:testcontainers` quando houver DDL/RLS).
- PR com risco declarado, escopo mínimo, rollback e lista **PASS/FAIL/NA/SKIPPED com motivo**. Gate que não puder rodar vira SKIPPED com motivo, e a PR abre mesmo assim.
- **Commits pequenos e push a cada etapa verde**, para o progresso não se perder. Uma PR por tarefa; uma branch por PR; parar após abrir a PR.
- Decisões do proprietário já tomadas: **Q3 sem reautenticação** (só caixa de confirmação em dois passos); o sistema **não verifica registro de conselho profissional**; flags desligadas por padrão; o motor é **inerte** sem regra clínica validada.

## Auth-1 — permissão por usuário: tipo e tabela (R4)

Branch: `claude/food06-auth-concessoes`. Escopo **somente**:
1. Permissão `restricoes.confirmar` em `PermissaoOctaClin` (`octaclin-backend/src/modulos/auth/dominio/permissoes.ts`), **fora de toda matriz de papel**. Teste: `possuiPermissao(papel, 'restricoes.confirmar') === false` para os cinco papéis (`SuperAdmin|Professional|Collaborator|Patient|Client`).
2. Migration aditiva (próximo número livre depois de `1720000001083`; confirmar na `main`) da tabela `concessoes_permissao_usuario`: `id`, `tenant_id`, `usuario_id`, `permissao`, `concedida_por`, `concedida_em`, `revogada_por`, `revogada_em`, `motivo` curto sem dado clínico. Índice único parcial (uma concessão ativa por usuário e permissão); `CHECK` da permissão contra lista fechada; RLS `ENABLE` + `FORCE` por `tenant_id` (padrão das migrations 1081 e 1083); histórico nunca apagado. ORM e registro em `infraestrutura/banco-dados/opcoes-typeorm.ts`. Padrão a imitar: `modulos/integracoes/infraestrutura/permissao-integracao-profissional.orm.ts`.
3. Testes: constraints, RLS com role não-owner, cross-tenant, `down` em PostgreSQL descartável.

**Fora:** serviço, endpoints, cascata de desativação e auditoria (Auth-2).

## Auth-2 — serviço e endpoints de concessão (R4)

Depende da Auth-1 mergeada. Escopo:
1. `ServicoConcessoesPermissao.exigir(tenantId, usuarioId, permissao)`: consulta a concessão **ativa no banco, via `ExecutorTenant`, na mesma transação**, e **falha fechado** com erro genérico sem eco. Fonte da verdade é o banco, **não** as claims do JWT (que ficam congeladas até rotacionar). Não consultar banco dentro de `GuardaPermissoes` (continua síncrono).
2. Conceder, revogar e listar: quem concede é `Professional` (o autônomo pode habilitar a si mesmo) ou `SuperAdmin` administrando o tenant; a concessão só vale para usuário de papel `Professional`; `Collaborator`, `Patient` e `Client` nunca recebem; **`SuperAdmin` não ganha acesso clínico implícito**. DTO fechado com confirmação em dois passos (booleano explícito). **Sem reautenticação.** Sem verificar conselho profissional.
3. Revogação em cascata ao desativar o usuário (padrão de `modulos/integracoes/aplicacao/servico-usuarios-cliente.ts`, ~L372-381).
4. Auditoria via `registrarAuditoriaNaTransacao`, sem conteúdo clínico; ajustar `scripts/validar-redacao-auditoria.mjs` se chaves novas reprovarem (`pnpm test:redacao-auditoria`).
5. Testes: matriz papéis × concessão (positivo e negativo); sem concessão, revogada, outro tenant, outro usuário, papel não elegível; `test:authz`; mutações (remover checagem do banco, aceitar papel não elegível, ignorar `revogada_em`).

**Fora:** telas e o serviço de restrições.

## P2 — serviço e API de restrições (R4, plano v2 §6 "D")

Depende da Auth-2. Reler v2 §4 e §6, v3 §2.1 e §4 antes de começar. Escopo (reconferir no contrato):
1. Serviço sobre as tabelas da 1083, com ORM e `codec-conteudo-restricao.ts` já mergeados: registrar declaração, confirmar, inativar (protegida), reconfirmar, revisar, histórico e solicitações do paciente.
2. Usa o motor v2 e os módulos puros da #529: `restricoes-alimentares.ts`, `inativacao-restricao-protegida.ts`, `reconfirmacao-restricao.ts`, `solicitacao-restricao-paciente.ts`. Toda ação clínica exige `ServicoConcessoesPermissao.exigir('restricoes.confirmar')` e acesso autorizado ao paciente (carteira).
3. Papéis (v2 §4.7): `Professional` sem a permissão registra pendência; `Collaborator` registra pendência e lê só o que criou; `Patient` informa e solicita correção, nunca altera restrição confirmada; `SuperAdmin` sem acesso clínico implícito.
4. DTOs por allowlist (inclui o do portal: sem código técnico, sem motivação religiosa, sem justificativa interna, sem estado interno); auditoria sem conteúdo clínico; concorrência otimista por revisão.
5. Testes: funcionais e negativos, concorrência, `test:authz`, canários de vazamento, cross-tenant e cross-paciente. **Flag desligada por padrão.**

**Fora:** telas, M11/M04/M12.

## P3 — consumo no M11 e interfaces (R3–R4, plano v2 §6 "E")

Depende da P2. Escopo: marcadores e alertas no M11 (fonte e versão, faixa de pendência, selo "este registro ainda não gera alerta automático confiável"), tela da nutricionista e resumo do paciente com textos por chave, conforme v2 §9 e v3 D7-a e Q11. Preferência só ordena **depois** do filtro de segurança (Q8). Rodar as perspectivas UX (`docs/agents/ux/PROCEDIMENTO.md`, nutricionista e paciente, só casos sintéticos) e registrar relatório. Gates: Playwright desktop e mobile com axe, consistência de indeterminação, permissões. Rollback: desligar o consumo por flag.

## P4 — M04/M12 e controle do apply (R4, plano v2 §6 "F")

Depende da P3. Escopo: consumo em M04/M12 e controle do apply com a **impressão** do motor (TOCTOU prévia × aplicar, `compararPreviaComAplicacao`); aprovação humana específica; se o servidor achar diferença, mostrar o que mudou e preservar o rascunho. Gates: E2E, TOCTOU, revisão clínica e de segurança. Rollback: reverter o leitor, nunca o writer.

## O que nenhuma PR resolve (ativação, contrato v3 §3)

ATV-1 validação clínica; ATV-2 matriz LGPD (`docs/governance/MATRIZ_TRATAMENTO_LGPD_RESTRICOES.md`); ATV-3 proteção dos fluxos novos (auditoria Q5); ATV-4 vigência da RDC 727/2022 (`docs/governance/REGISTRO_REGULATORIO_ALERGENICOS.md`); ATV-5 curadoria global; ATV-6 pacientes representados; ATV-7 teste de compreensão; ATV-8 autorização por ambiente; ATV-9 revisão R4 e UX B/C. Sem isso o código fica pronto e **inerte**; não declarar ativação nem produção.
