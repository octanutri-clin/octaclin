# OctaClin — Agent Guide

Este arquivo é a primeira leitura obrigatória para Codex, Claude Code e qualquer outro agente de IA que trabalhe neste repositório.

> Regra principal: **não conclua a partir de algo adjacente à evidência. Conclua a partir da evidência, obtida no mesmo ciclo da afirmação.**

## 1. Antes de alterar código

Leia, nesta ordem:

1. `AGENTS.md` da raiz.
2. O `AGENTS.md` mais próximo do pacote/área alterada, quando existir.
3. `RESUMO_FASES_CONCLUIDAS.md`.
4. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
5. Os `fase-*.md` mais recentes diretamente relacionados à tarefa.
6. `docs/agents/SOURCE_OF_TRUTH.md`.
7. `docs/agents/VALIDATION_MATRIX.md`.
8. `docs/agents/SAFETY_GATES.md` para mudanças de risco elevado.
9. `docs/agents/CONCURRENCY.md` antes de branch/worktree ou trabalho paralelo.
10. `docs/agents/LESSONS_LEARNED.md` antes de produção, migrations, CI ou mudança crítica.
11. `docs/agents/ENVIRONMENT_PLAYBOOK.md` se houver problema de shell, Windows, CRLF, runtime ou execução local.
12. `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md` quando tocar deploy, integrações, secrets ou ambientes.
13. `DECISOES_ARQUITETURA.md` quando alterar arquitetura, segurança, tenancy, auth, dados ou integrações.

Documentos históricos não vencem estado atual nem implementação real. Em conflito, siga `docs/agents/SOURCE_OF_TRUTH.md`.

## 2. Estado do projeto

Não mantenha um histórico detalhado de fases neste arquivo.

Fontes canônicas:

- capacidades consolidadas: `RESUMO_FASES_CONCLUIDAS.md`;
- fase/próximo trabalho: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`;
- arquitetura: `DECISOES_ARQUITETURA.md`;
- produção/operação: `RUNBOOK_PRODUCAO.md`.

Nunca copie aqui números de migration, PR, commit, quantidade de migrations ou fase atual que possam ficar obsoletos.

## 3. Regras absolutas

- Preserve multi-tenancy e RLS.
- Tenant é derivado de identidade autenticada; nunca aceite tenant livre vindo do cliente.
- Preserve autenticação, autorização e separação de papéis.
- Sessão web autenticada deve respeitar a fronteira BFF já definida pelo projeto.
- Preserve `requisitarBackendAutenticado` onde ela for a fronteira canônica.
- Dados sensíveis devem ser minimizados, criptografados ou protegidos conforme arquitetura existente.
- Prefira arquivamento lógico a delete físico em dados clínicos/operacionais.
- Ações sensíveis devem permanecer auditáveis.
- Não introduza uma segunda implementação de capacidade já consolidada sem justificar migração/substituição.
- Não reverta mudanças que não são suas sem pedido explícito.
- Não faça refactor amplo fora do escopo da tarefa.
- Não declare `validado`, `aprovado`, `em produção`, `migrado` ou `corrigido` sem evidência fresca.
- Job `skipped` é não verificado, não aprovado.
- Nunca commite secrets, tokens, senhas, `.env` reais, dumps ou logs com credenciais.
- Nunca coloque PHI/PII real em prompt, fixture, screenshot, issue, PR, log, exemplo ou relatório.

## 4. Trabalho por fases

- Trabalhe pelas fases numeradas existentes.
- Não pule fase sem decisão explícita do usuário.
- Um agente pode avançar por mais de uma fase somente se fechar cada uma antes de iniciar a seguinte.
- Ao concluir uma fase, atualize seu `fase-XXX-*.md`.
- Atualize `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Atualize `RESUMO_FASES_CONCLUIDAS.md` quando a fase consolidar uma capacidade.
- Recomendações voláteis de modelo/skills/plugins devem ficar nos documentos próprios, não neste arquivo.

## 5. Classifique o risco antes de implementar

Use `docs/agents/VALIDATION_MATRIX.md`.

Resumo:

- **R0:** documentação/typo.
- **R1:** UI/microcopy sem regra de negócio.
- **R2:** feature local, componente ou rota comum.
- **R3:** API, banco não destrutivo, jobs ou integração.
- **R4:** auth, autorização, RLS, tenancy, crypto, migration, PHI/PII, produção.
- **R5:** operação destrutiva, rollout crítico ou risco de indisponibilidade/perda de dados.

R4/R5 exigem leitura de `docs/agents/SAFETY_GATES.md`.

## 6. TDD

Para feature ou bugfix, salvo justificativa registrada:

1. **RED:** escreva/ajuste o teste.
2. Rode e confirme que falha pelo motivo esperado.
3. **GREEN:** implemente o mínimo necessário.
4. Rode e confirme que passa.
5. **REFACTOR:** melhore sem alterar comportamento.
6. Rode regressão proporcional ao risco.

Um teste que falha ou passa pelo motivo errado não é evidência.

## 7. Validação

Escolha gates pela matriz de risco. Comandos comuns incluem:

```sh
pnpm --dir octaclin-backend test -- <specs> --runInBand
pnpm --dir octaclin-backend typecheck

pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:apis-dinamicas
pnpm --dir octaclin-web build

pnpm security:secrets
git diff --check
```

Se um gate aplicável não rodar, declare explicitamente.

A matriz de confiabilidade deve ser atualizada junto com seu validador quando um fluxo de alto risco for adicionado ou removido.

## 8. Migrations

Antes de considerar uma migration pronta:

- arquivo existe;
- está registrada onde as migrations são enumeradas;
- entidades/módulos relacionados estão registrados;
- teste falhou antes e passou depois quando aplicável;
- `migration:show` representa o estado esperado;
- constraints foram provadas pelo código/constraint correto;
- rollout segue o runbook atual;
- identidade do banco foi confirmada;
- integração está na mesma altura de schema necessária para ensaiar produção.

Nunca conclua que um artefato está ativo apenas porque o arquivo foi criado.

## 9. Produção

Mudança ou afirmação sobre produção exige evidência de produção.

Antes de agir:

1. confirme ambiente;
2. confirme branch/commit;
3. confirme identidade do banco/serviço sem expor segredo;
4. leia o estado atual;
5. siga `RUNBOOK_PRODUCAO.md`;
6. tenha rollback quando aplicável.

Não use integração/staging como evidência de produção.

## 10. Git e trabalho paralelo

Leia `docs/agents/CONCURRENCY.md`.

Resumo:

- commits pequenos e objetivos;
- prefira branch/worktree para feature e mudança crítica;
- Claude Code e Codex não devem editar simultaneamente o mesmo domínio;
- R4/R5 devem receber revisão independente sempre que viável;
- nunca faça force push ou reescreva trabalho alheio sem autorização explícita.

Push direto para `main` não é regra universal: aplique a política por risco definida em `CONCURRENCY.md`.

## 11. Definition of Done

Antes de declarar uma tarefa concluída:

- [ ] objetivo implementado;
- [ ] RED observado quando TDD se aplica;
- [ ] teste específico verde;
- [ ] lint/typecheck/build aplicáveis verdes;
- [ ] regressões proporcionais ao risco verdes;
- [ ] segurança/tenancy/RLS revisados quando aplicável;
- [ ] migration/artefato registrado quando aplicável;
- [ ] documentação atualizada;
- [ ] nenhum secret ou PHI/PII real adicionado;
- [ ] `git diff` revisado;
- [ ] `git diff --check` verde;
- [ ] CI verificado pelo run correto quando aplicável;
- [ ] gates não executados declarados;
- [ ] próximo passo/fase registrado quando aplicável.

## 12. Em caso de dúvida

- mantenha o escopo estreito;
- procure a implementação real;
- preserve decisões arquiteturais válidas;
- prefira falhar fechado em segurança;
- não invente estado;
- não transforme hipótese em fato;
- peça decisão do usuário apenas quando `SAFETY_GATES.md` exigir autorização ou quando houver escolha de produto/negócio que não possa ser inferida.
