# OctaClin — Concorrência, Git e Handoff entre Agentes

> Status: ativo  
> Fonte de verdade para: trabalho simultâneo de Claude Code, Codex e desenvolvedores

## 1. Objetivo

Evitar:

- sobrescrita de trabalho;
- merges acidentais;
- dois agentes alterando a mesma migration;
- mudanças invisíveis em `main`;
- review do próprio trabalho em tarefas críticas;
- conflito de documentação.

## 2. Princípio

> Um agente deve possuir um escopo claro, não “o repositório”.

## 3. Fluxo por risco

### R0/R1

Push direto pode ser aceitável se:

- a política atual do repositório permitir;
- não houver outro agente na área;
- não tocar path crítico;
- gates aplicáveis passarem.

### R2/R3

Preferir:

```text
branch/worktree
→ implementação
→ gates
→ revisão
→ merge
```

### R4/R5

Obrigatório usar branch/worktree salvo procedimento aprovado em contrário.

Preferir revisão por agente diferente do implementador.

## 4. Worktrees

Quando Claude Code e Codex trabalharem em paralelo, prefira worktrees independentes.

Exemplo conceitual:

```text
main
├── worktree codex/feature-X
└── worktree claude/review-Y
```

Não compartilhe diretório de trabalho entre agentes concorrentes.

## 5. Reserva de escopo

Antes de iniciar trabalho paralelo, registrar no documento/fase/PR apropriado:

```md
## Trabalho ativo

Agente: Codex
Branch/worktree: codex/fase-XXX
Objetivo: ...
Arquivos/domínios previstos:
- ...
- ...

Não alterar simultaneamente:
- ...
```

Não é necessário reservar arquivos que apenas serão lidos.

## 6. Áreas que não devem ter dois escritores

Evitar concorrência em:

- migration atual;
- `opcoes-typeorm.ts`;
- auth/guards centrais;
- RLS/policies;
- crypto;
- `AGENTS.md`;
- checklist de fase atual;
- runbook de rollout;
- lockfile do mesmo pacote;
- configuração de deploy;
- navegação canônica;
- contrato compartilhado alterado pela tarefa.

## 7. Rebase e estado fresco

Antes de ação que dependa do estado remoto:

- leia estado atual no mesmo ciclo;
- atualize branch;
- confira conflicts;
- não use informação memorizada sobre PR/CI.

## 8. Dependabot e lockfiles

Quando bump de dependência exige mudança de API:

> versão e adaptação de código devem formar uma unidade coerente.

Não faça merge de uma metade que quebre `main`.

Dois PRs que modificam o mesmo lockfile devem ser rebased/regenados contra a árvore atual; auto-merge textual do Git não prova consistência do lockfile.

## 9. Revisão independente

Para R4/R5:

```text
Claude implementa → Codex revisa
```

ou:

```text
Codex implementa → Claude revisa
```

O revisor deve tentar falsificar a solução, não apenas confirmar estilo.

Procurar:

- bypass de autorização;
- cross-tenant;
- PII em log;
- migration não registrada;
- rollout incompleto;
- corrida;
- idempotência;
- teste que passa pelo motivo errado;
- alteração fora de escopo;
- duplicação de arquitetura.

## 10. Handoff obrigatório

Formato:

```md
## Handoff

### Objetivo
...

### Estado
...

### Arquivos alterados
- ...

### Decisões
- ...

### Gates executados
- PASS — ...

### Gates não executados
- ...

### Riscos restantes
- ...

### Próxima ação
...

### O que revisar
- ...
```

## 11. Commit

- pequeno;
- objetivo;
- uma intenção principal;
- não misturar formatting global com feature;
- não incluir arquivo temporário;
- revisar diff antes do commit.

## 12. Nunca fazer sem autorização

- `git reset --hard` sobre trabalho alheio;
- force push;
- apagar branch de outro agente;
- descartar alteração não identificada;
- resolver conflito escolhendo “ours/theirs” em massa;
- alterar migration já aplicada;
- reescrever histórico compartilhado.

## 13. Documentação concorrente

Somente um agente deve atualizar ao mesmo tempo:

- fase atual;
- checklist vivo;
- resumo consolidado;
- `AGENTS.md`.

Se implementação e revisão forem paralelas, defina quem fará o fechamento documental.

## 14. `main`

`main` é fonte de verdade integrada, não espaço de coordenação.

O fato de uma mudança estar em `main` não substitui:

- evidência do CI;
- validação;
- rollout;
- status de produção.

## 15. Encerramento

Antes de liberar o escopo:

- branch sincronizada;
- diff revisado;
- gates registrados;
- documentação atualizada;
- handoff concluído;
- área marcada como livre para o próximo agente.
