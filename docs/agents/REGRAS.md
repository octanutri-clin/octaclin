# Regras Compartilhadas Para Agentes

## Hierarquia de verdade

- Normativo define o que deve ser verdade: `AGENTS.md`, este documento,
  `SECURITY.md`, ADRs vigentes, politicas e invariantes.
- Observado descreve o estado real: codigo, migrations registradas, testes, CI,
  banco, configuracao do provider e ruleset.
- Planejamento define a intencao: fase ativa, checklist e roadmap.
- `STATUS_ATUAL_PROJETO.md` concentra fase, bloqueadores e proximo passo.
- Historico registra fatos passados, PRs, commits, postmortems e licoes.

Uma divergencia entre norma e observado e defeito ou incidente a investigar, nao
motivo para alterar a norma e normalizar uma regressao.

## Evidencia e gates

Nao conclua por evidencia adjacente. Producao requer evidencia de producao;
banco requer identificar conexao e role; arquivo existente nao prova registro;
somente `PASS`, `FAIL`, `NA` ou `SKIPPED` com motivo. Nenhum gate nao executado
pode ser tratado como aprovado.

Antes de alterar, leia as fontes condicionais ao risco:

| Risco | Leitura minima adicional |
| --- | --- |
| Segredo, PII, PHI ou provider externo | `DATA_CLASSIFICATION.md`, `SECURITY.md` e runbook relevante |
| Codigo ou dependencia externa | `EXTERNAL_CODE_POLICY.md` |
| Banco, migration, backup ou producao | `DECISOES_ARQUITETURA.md`, `VARIAVEIS_AMBIENTE.md` e runbook de producao |
| Auth, authz, tenant ou RLS | ADRs, matriz de confiabilidade e testes do dominio |
| Ambiente, shell, lockfile ou CI | `ENVIRONMENT_PLAYBOOK.md` e licoes relacionadas |

## R0-R5

R0 e alteracao editorial sem efeito operacional. R1 e mudanca local de baixo
impacto. R2 altera comportamento limitado. R3 atravessa fronteira relevante de
produto ou integracao. R4 envolve migration, producao, auth, authz, RLS,
tenancy, crypto, PHI/PII ou storage clinico. R5 e incidente, acao destrutiva ou
mudanca com potencial de dano amplo. A classificacao so pode elevar o risco
minimo sugerido pelo path ou pela superficie tocada.

Para R4/R5, use branch e PR, testes positivos e negativos, evidencia
especifica, rollback quando aplicavel e revisao independente quando viavel. Se
os dois agentes escreveram a mesma mudanca, declare que a revisao nao e
totalmente independente.

## Concurrencia e handoff

- Uma tarefa usa uma branch ou worktree e um unico escritor ativo por vez.
- Claude Code e Codex podem se revezar na mesma tarefa, branch e PR.
- Troca de agente nao cria nova PR nem reinicia planejamento; a PR e a unidade
  de integracao.
- Nao escreva simultaneamente em migrations, RLS, auth, tenancy, crypto,
  lockfile do mesmo pacote, configuracao de producao, contratos compartilhados
  ou arquivos centrais de governanca.
- Faca revisao cruzada de mudancas criticas quando viavel.
- Com 10% ou menos de tokens restantes, ou perto do limite sem percentual
  exposto, inicie handoff antes de nova subtarefa relevante.
- O agente que assume deve conferir branch, status, log, diff, PR, arquivos,
  commits, validacoes e fatos novos antes de escrever.

Formato minimo do handoff:

```md
## HANDOFF DE AGENTE

### PR / branch
`<branch ou PR atual>`

### Objetivo
<objetivo exato>

### Concluido
- [x] ...

### Pendente
- [ ] ...

### Arquivos alterados
- ...

### Commits relevantes
- ...

### Validacoes executadas
- PASS - ...
- FAIL - ...
- NA - ...
- SKIPPED - ... + motivo

### Fatos novos encontrados
- ...

### Riscos / pontos de atencao
- ...

### Proxima acao exata
<uma acao concreta>
```

Registre o handoff na PR, em comentario ou na transferencia estruturada para o
agente sucessor. Nao crie `.ai/ACTIVE_WORK.md`.

## Definition of Done complementar

1. Escopo aprovado e minimo implementado.
2. Nenhuma mudanca relevante fora do escopo.
3. Validacoes proporcionais ao risco executadas e reportadas.
4. Documentacao canonica atualizada sem duplicar estado mutavel.
5. Diff revisado, sem secrets, PHI ou PII real.
6. Checks aplicaveis aprovados.
7. Para R4/R5, rollback e evidencia de ambiente considerados.
8. Handoff, quando houve, registrado e revalidado pelo sucessor.

## Banco e producao

Identifique banco, branch e role antes de DDL. Migrations sao aplicadas fora de
banda com role owner conforme o runbook; runtime nao recebe poder administrativo
por conveniencia. Nao afirme configuracao, deploy, identidade ou health de
producao com base em staging, CI ou documentacao. Pare a acao afetada ao detectar
ambiente incorreto, evidencia insuficiente ou risco nao previsto.
