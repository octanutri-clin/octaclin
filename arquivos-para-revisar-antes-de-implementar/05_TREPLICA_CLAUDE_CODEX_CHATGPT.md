# OctaClin — Documento de Tréplica Técnica
## Claude Code × Codex × Revisão Sênior Independente

> **Data:** 2026-08-22  
> **Base factual:** `main` em `fba815a`  
> **Estado confirmado:** Fase 255 concluída; Fase 256 como próxima oficial  
> **Objetivo:** permitir que Claude Code e Codex leiam, pela primeira vez, a resposta um do outro e a avaliação independente, produzindo uma tréplica adversarial antes de qualquer implementação.

---

# 0. Regra desta rodada

**NÃO IMPLEMENTAR NADA.**

Nesta rodada, Claude Code e Codex devem:

1. ler este documento integralmente;
2. confrontar sua revisão anterior com a revisão do outro agente;
3. confrontar ambas com a avaliação independente;
4. dizer explicitamente quais posições mantêm, retiram ou modificam;
5. separar fato verificado, inferência, preferência arquitetural, risco e decisão do usuário;
6. não buscar consenso artificial;
7. propor uma solução final menor e mais robusta que o pacote original.

---

# 1. Resumo dos três pareceres

## Claude Code

### Onde foi mais forte

Claude foi o melhor em **auditoria forense do repositório**.

Ele identificou, entre outros:

- `CLAUDE.md` já existia e estava desatualizado;
- `CODEOWNERS` já existia;
- PR template já existia;
- `SECURITY.md` já existia;
- issue template já existia;
- ruleset de `main` já existia;
- `validate:docs` já existia;
- `MATRIZ_CONFIABILIDADE_TESTES.md` já existia;
- `validar-preflight.ps1` já existia;
- `.mcp.json` versionado era uma superfície importante;
- hooks Claude existentes eram PowerShell;
- vários paths propostos para classificação de risco não correspondiam à árvore real;
- `test:next15` continuava citado mesmo após renomeação;
- a regra absoluta de tenant do pacote estava errada para fluxos públicos legítimos.

### Onde foi mais fraco

Claude foi agressivo demais em alguns cortes e misturou duas dívidas diferentes:

```text
volume total de Markdown
```

versus:

```text
volume de instrução automaticamente carregada pelo agente
```

Esses problemas coexistem, mas não são equivalentes.

---

## Codex

### Onde foi mais forte

Codex foi melhor como **arquiteto de governança**.

Sua contribuição mais importante foi separar:

```text
NORMATIVO
o que DEVE ser verdade

OBSERVADO
o que É verdade hoje

PLANEJAMENTO
o que pretendemos fazer

HISTÓRICO
o que aconteceu
```

Essa modelagem é melhor que:

```text
código > documentação
```

porque uma regressão não pode virar arquitetura apenas porque chegou ao código.

### Onde foi mais fraco

Codex preservou documentação demais e deixou passar problemas concretos que Claude encontrou.

Também afirmou que não havia limite agregado estável/verificável relevante para `AGENTS.md`; a documentação oficial atual do Codex documenta um limite agregado padrão de cerca de **32 KiB** para a cadeia aplicável de instruções.

---

## Avaliação independente

### Veredito atual

**GO COM AJUSTES SIGNIFICATIVOS.**

Mas:

**NÃO implementar o pacote original integralmente.**

A direção recomendada é:

> **fatos descobertos por Claude + modelo conceitual de Codex + menos artefatos novos + mais reaproveitamento de controles existentes + enforcement real.**

---

# 2. Ground truth confirmado

## 2.1 Estado atual

```text
main = fba815a
Fase 255 concluída
Fase 256 próxima oficial
```

## 2.2 `CLAUDE.md`

O root atual ainda aponta:

```text
Ultima fase concluida: Fase 224
Proxima fase recomendada: Fase 225
```

Logo ele é uma fonte ativa de contexto stale.

## 2.3 GitHub

Já existem:

```text
.github/CODEOWNERS
.github/PULL_REQUEST_TEMPLATE.md
SECURITY.md
ruleset de main
issue template
```

Portanto a ação correta é **revisar/ajustar**, não recriar.

## 2.4 Validações

O projeto já possui:

```text
security:secrets
test:security
test:confiabilidade
validate
validate:docs
validate:full
```

Portanto novos comandos como `agent:preflight` e `agent:verify` não devem nascer como sistemas paralelos.

## 2.5 `.mcp.json`

Existe:

```json
{
  "mcpServers": {
    "postgres-staging": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

Superfícies relevantes:

- nome diz staging;
- variável é `DATABASE_URL` genérica;
- `npx -y`;
- package sem versão explícita.

## 2.6 Web AGENTS

Já existe:

```text
octaclin-web/AGENTS.md
```

com bloco gerenciado pelo Next.js, que precisa ser preservado.

---

# 3. Questão — Qual é o problema principal?

## Claude

O problema maior seriam os **305 `.md` na raiz**, com grande quantidade de histórico e documentos de fase sem status claro.

## Codex

O root AGENTS está excessivo, mas também há dívida documental e conflito entre fontes.

## Avaliação independente

Ambos estão parcialmente corretos.

Existem dois problemas:

### A. Contexto automaticamente carregado

`AGENTS.md` grande importa diretamente para Codex.

### B. Dívida documental

Muitos arquivos históricos na raiz aumentam stale state, descoberta ruim e conflito de fontes.

Um não elimina o outro.

### Decisão

- reduzir AGENTS: **GO**
- organizar dívida documental: **GO**
- tratar apenas um deles como problema: **NO-GO**

### Perguntas de tréplica

**Claude:** mantém literalmente que “o problema não é o AGENTS.md”?  
**Codex:** quais leituras devem sair do conjunto obrigatório?

---

# 4. Tamanho do root `AGENTS.md`

## Claude

Rejeita meta fixa de 100–150 linhas e considera ~190 aceitável.

## Codex

Também rejeita meta rígida e sugeriu algo como 120–220 linhas / <12 KiB.

## Avaliação independente

Concordo com os dois.

Critério:

> toda regra no root deve ser realmente universal.

Meta operacional:

```text
~8–12 KiB
```

sem transformar isso em gate numérico rígido.

### Decisão

**GO.**

---

# 5. Root `CLAUDE.md`

## Claude

P0. Substituir 123 linhas stale por bridge curta.

## Codex

P0. Mesmo raciocínio.

## Avaliação independente

Concordância total.

Não corrigir:

```text
224 → 255
```

porque volta a apodrecer.

Modelo:

```md
@AGENTS.md

# Claude Code

Use `STATUS_ATUAL_PROJETO.md` para estado atual.
Não mantenha fase atual neste arquivo.
```

### Decisão

**GO P0.**

---

# 6. Nested `CLAUDE.md`

## Claude

ADIAR; carrega sob demanda.

## Codex

ADIAR; não depender de mecanismo específico antes de validar.

## Avaliação independente

Concordo.

Quando existirem nested AGENTS maduros, nested CLAUDE pode atuar só como bridge.

### Decisão

**ADIAR P2.**

---

# 7. `.claude/rules/`

## Claude

NO-GO agora.

## Codex

ADIAR P2.

## Avaliação independente

Não descartar definitivamente.

Pode ser útil para comportamento exclusivamente Claude-specific, mas regras críticas compartilhadas devem ficar em:

```text
AGENTS
scripts
CI
GitHub
```

### Decisão

**ADIAR.**

---

# 8. Source of Truth

## Claude

Quer fundir em `REGRAS.md`.

Defende:

> código vence em fatos; política/norma de segurança vence em requisitos.

## Codex

Defende quatro planos:

- normativo;
- observado;
- planejamento;
- histórico.

## Avaliação independente

Adotar o modelo de Codex, mas não necessariamente um arquivo próprio.

Regra:

> Divergência entre normativo e observado é defeito ou incidente; não é vitória automática de um lado.

### Decisão

**GO conceitual; fundir em `docs/agents/REGRAS.md`.**

---

# 9. Regra de tenant

## Claude

A regra JWT-only está errada.

Propõe tenant resolvido no servidor a partir de credencial verificada.

## Codex

Mesmo entendimento, incluindo capability/token/API key.

## Avaliação independente

Concordância total.

Nova norma:

> O tenant é resolvido no servidor a partir de credencial ou capability verificada — JWT, token opaco/capability ou API key validada. Nunca de identificador arbitrário declarado em header/body.

Também exige corrigir ADR-002.

### Decisão

**GO P0.**

---

# 10. `STATUS_ATUAL_PROJETO.md`

## Claude

O pacote proposto reduziu demais sua importância.

## Codex

Trata como fonte de estado/progresso.

## Avaliação independente

Deve continuar canônico para **estado atual**, não norma.

Leitura condicional quando a tarefa depende de:

- fase;
- rollout;
- estado operacional;
- próximos passos.

### Decisão

**GO.**

---

# 11. `COORDENACAO_DESENVOLVIMENTO_IA.md`

## Claude

Documento stale em cerca de 150 fases. Tirar de leitura obrigatória e marcar histórico.

## Codex

Também identifica stale state.

## Avaliação independente

Concordo.

Não precisa apagar imediatamente.

Marcar:

```text
STATUS: HISTÓRICO / SUPERSEDED
```

e apontar para fonte atual.

### Decisão

**GO P0.**

---

# 12. `LESSONS_LEARNED.md`

## Claude

GO forte. Preservar nomes de arquivos, variáveis, comandos e mecanismo de registro.

## Codex

GO, mas limitar a incidentes relevantes.

## Avaliação independente

Concordo com ambos.

Entram:

- incidentes de produção;
- falso verde;
- falha de segurança;
- erro recorrente;
- classe sistêmica;
- investigação de custo significativo.

Formato:

```md
## Data — título
Problema:
Causa:
Correção:
Como não repetir:
Controle criado:
Arquivos/comandos:
```

O root AGENTS deve manter:

> incidente sistêmico corrigido deve ser registrado no mesmo PR.

### Decisão

**GO P0/P1.**

---

# 13. `ENVIRONMENT_PLAYBOOK.md`

## Claude

GO, removendo quirks pessoais.

## Codex

GO, tornando portátil.

## Avaliação independente

Concordo.

Documentar:

```text
sintoma
diagnóstico
alternativas
```

e não transformar peculiaridade da máquina em regra universal.

### Decisão

**GO P1.**

---

# 14. Nova `VALIDATION_MATRIX.md`

## Claude

NO-GO. Já existe `MATRIZ_CONFIABILIDADE_TESTES.md`.

## Codex

GO com ajustes.

## Avaliação independente

Fico com Claude.

Não criar duas matrizes concorrentes.

Salvar da proposta:

- R0–R5 como vocabulário;
- PASS/FAIL/NA/SKIPPED;
- proporcionalidade de validação.

A matriz concreta continua sendo `MATRIZ_CONFIABILIDADE_TESTES.md`.

### Decisão

**NO-GO como arquivo novo.**

---

# 15. R0–R5

## Claude

Aceita como vocabulário pequeno.

## Codex

Quer formalização maior e talvez piso por path.

## Avaliação independente

Usar como linguagem de risco, não como algoritmo autônomo.

Path pode elevar risco mínimo, nunca reduzir.

### Decisão

**GO reduzido.**

---

# 16. `change-risk.yml`

## Claude

NO-GO; demonstrou paths incorretos.

## Codex

ADIAR; poderia servir como piso.

## Avaliação independente

Não agora.

No futuro somente se:

- paths forem reais;
- matcher tiver teste;
- classificador só elevar risco;
- houver override humano.

### Decisão

**ADIAR.**

---

# 17. TDD obrigatório

## Claude

Universalidade rígida demais.

## Codex

Também quer exceções.

## Avaliação independente

RED forte para:

- bugfix;
- segurança;
- lógica nova;
- migration;
- contrato/regressão.

Exceção justificada para:

- docs;
- rename;
- formatter;
- código gerado;
- refatoração puramente estrutural.

### Decisão

**GO COM EXCEÇÕES.**

---

# 18. `CONCURRENCY.md`

## Claude

NO-GO separado.

## Codex

GO reduzido.

## Avaliação independente

Concordo com Claude sobre o arquivo e com Codex sobre o conceito.

Colocar 15–25 linhas em `REGRAS.md`:

- 1 tarefa → 1 branch/worktree;
- não escrever simultaneamente em migration/auth/RLS/lockfile;
- handoff mínimo;
- review cruzado quando útil.

### Decisão

**NO-GO separado; GO incorporado.**

---

# 19. `.ai/ACTIVE_WORK.md`

## Claude

NO-GO.

## Codex

NO-GO.

## Avaliação independente

Concordância total.

Usar:

- branch;
- worktree;
- draft PR;
- issue.

### Decisão

**NO-GO.**

---

# 20. Ruleset `main`

## Claude

Já existe e já implementa PR obrigatório.

## Codex

Concorda.

## Avaliação independente

Preservar.

Remover qualquer regra documental admitindo push direto.

### Decisão

**MANTER.**

---

# 21. `CODEOWNERS`

## Claude

Já existe; ativar review obrigatório pode deadlockar owner solo.

## Codex

Mesma preocupação.

## Avaliação independente

Não criar outro.

Não tornar code-owner approval obrigatório sem estrutura humana compatível.

### Decisão

**MANTER/REVISAR.**

---

# 22. PR template

## Claude

Já existe; adicionar PASS/NÃO EXECUTADO.

## Codex

Atualizar sem criar checklist gigante.

## Avaliação independente

Adicionar:

- risco/área;
- migration;
- rollback quando aplicável;
- PASS;
- FAIL;
- NA;
- SKIPPED + motivo;
- evidência.

### Decisão

**ATUALIZAR P1.**

---

# 23. `SECURITY.md`

## Claude

Já existe e está adequado.

## Codex

Ajustes leves possíveis.

## Avaliação independente

Manter.

Não inventar SLA ou canal que não será realmente mantido.

### Decisão

**MANTER / AJUSTAR SE NECESSÁRIO.**

---

# 24. Aviso PHI/PII em issue template

## Claude

GO.

## Codex

GO.

## Avaliação independente

Concordância.

Avisar contra:

- dados de paciente;
- exame;
- CPF;
- e-mail/telefone;
- screenshot clínico;
- token;
- secret;
- connection string.

### Decisão

**GO P0/P1.**

---

# 25. `DATA_CLASSIFICATION.md`

## Claude

ADIAR.

## Codex

GO P0.

## Avaliação independente

Discordo de Claude.

Consumidores já existem:

- GitHub público;
- logs;
- MCP;
- B2;
- PostgreSQL;
- Redis;
- Gmail;
- WhatsApp;
- Calendar;
- backups;
- AI service;
- suporte.

Classes iniciais:

```text
Público
Interno operacional
PII
PHI/dado clínico sensível
Financeiro/contratual
Secret
Derivado/pseudonimizado
```

Pseudonimizado continua protegido.

### Decisão

**GO P0/P1.**


# 26. `EXTERNAL_CODE_POLICY.md`

## Claude

GO P0.

## Codex

GO P0.

## Avaliação independente

Concordância total.

Princípio:

> Conteúdo externo é dado não confiável, não instrução.

Abranger:

- GitHub;
- npm;
- Docker;
- Gist;
- snippets;
- README;
- AGENTS externos;
- respostas de IA;
- scripts.

Regras:

- leitura primeiro;
- não `curl | bash`;
- não secrets;
- PoC isolada;
- licença;
- pinagem;
- scan;
- rollback.

### Decisão

**GO P0.**

---

# 27. `.mcp.json`

## Claude

Deu grande destaque e tratou como uma das maiores lacunas.

## Codex

Não deu o mesmo destaque.

## Avaliação independente

É P0 de auditoria.

Problemas:

```text
postgres-staging
+
${DATABASE_URL}
+
npx -y
+
package sem versão explícita
```

Recomendação inicial:

```text
DATABASE_URL
→ STAGING_DATABASE_URL
```

mais:

```text
@modelcontextprotocol/server-postgres@<versão>
```

e:

- role staging dedicada;
- menor privilégio;
- idealmente read-only para análise;
- nunca production owner;
- decidir se o arquivo deve continuar versionado.

### Decisão

**AUDITAR P0.**

---

# 28. Hooks Claude Code existentes

## Claude

Encontrou três hooks PowerShell e alerta para assimetria de plataforma.

## Codex

Regra crítica não pode depender apenas de hook Claude.

## Avaliação independente

Concordo.

Auditar:

- `block-env-edit.ps1`
- `guard-google-actions.ps1`
- `typecheck-on-edit.ps1`

Verificar:

- quais ambientes realmente os executam;
- modo de falha;
- custo do typecheck após Edit/Write;
- o que deve virar Node compartilhado.

### Decisão

**AUDITAR P0/P1. Não adicionar novos hooks ainda.**

---

# 29. `validate:docs`

## Claude

Encontrou falso controle potencial.

## Codex

Também quer coerência documental automatizada.

## Avaliação independente

Antes de criar checker novo:

> corrigir checker existente.

Melhorias:

- ausência de match deve falhar;
- remover sentinelas históricas frágeis;
- validar comandos citados;
- validar arquivos canônicos;
- validar bridge CLAUDE;
- não fingir validação semântica.

### Decisão

**GO P0.**

---

# 30. Validar comandos `pnpm` citados em documentação

## Claude

Alta prioridade; teria capturado `test:next15`.

## Codex

Também quer coerência documental.

## Avaliação independente

Concordo fortemente.

Reaproveitar:

```text
scripts/test-matriz-confiabilidade.mjs
```

ou outro validador existente.

Não criar framework paralelo.

### Decisão

**GO P0.**

---

# 31. `agent:preflight`

## Claude

NO-GO.

## Codex

NO-GO como paralelo; GO como refatoração.

## Avaliação independente

Fico com Codex.

Objetivo:

```text
não criar novo preflight
```

e sim:

```text
tornar o existente portátil, confiável e reutilizável
```

Possível evolução:

```text
Node core
+
wrappers/CI/Claude/Codex
```

### Decisão

**REFATORAR, não duplicar.**

---

# 32. `agent:verify`

## Claude

NO-GO.

## Codex

NO-GO como duplicação; talvez composição futura.

## Avaliação independente

Não criar agora.

CI continua fonte principal para conclusão.

### Decisão

**NO-GO agora.**

---

# 33. `PRODUCTION_INVARIANTS`

## Claude

GO reduzido.

## Codex

GO, separando invariante de estado.

## Avaliação independente

Adotar conceito, não necessariamente arquivo separado.

Exemplo:

### Norma

```text
runtime normal não aplica DDL automaticamente
```

### Estado observado

```text
BANCO_EXECUTAR_MIGRACOES=false
```

Não misturar.

### Decisão

**GO reduzido.**

---

# 34. Default de migrations

## Claude

Prioriza configurar `BANCO_EXECUTAR_MIGRACOES=false`.

## Codex

Também reconhece default perigoso.

## Avaliação independente

Proponho discutir inversão para opt-in:

```ts
process.env.BANCO_EXECUTAR_MIGRACOES === 'true'
```

em vez de:

```ts
process.env.BANCO_EXECUTAR_MIGRACOES !== 'false'
```

Assim:

```text
env ausente
→ migrations desligadas
```

É fail-safe.

### Perguntas obrigatórias

Claude e Codex devem responder:

1. concordam com opt-in explícito?
2. quais ambientes seriam afetados?
3. existem testes que assumem default ligado?
4. qual rollout seguro?
5. como aplicar migrations fora de banda depois?

### Decisão

**NOVA QUESTÃO R4 PARA DEBATE.**

---

# 35. ADR-002

## Claude

Corrigir regra JWT-only.

## Codex

Mesma conclusão.

## Avaliação independente

GO P0.

Norma deve falar em:

```text
credencial/capability verificada
```

e não apenas JWT.

---

# 36. ADR-018

## Claude

R2 stale versus B2.

## Codex

Mesma conclusão.

## Avaliação independente

Não trocar simplesmente:

```text
R2 → B2
```

Separar:

```text
Arquitetura:
storage privado S3-compatible

Provider operacional atual:
Backblaze B2
```

Assim uma nova troca de provider não invalida a arquitetura.

### Decisão

**GO P0.**

---

# 37. ADRs individuais

## Claude

ADIAR.

## Codex

GO parcial para novas decisões.

## Avaliação independente

Não migrar todo o histórico agora.

Usar ADR individual para novas decisões importantes e migrar antigos apenas quando tocados de forma significativa.

### Decisão

**P2.**

---

# 38. `AGENTS.md` backend

## Claude

GO P1.

## Codex

GO P0.

## Avaliação independente

GO P1.

Conteúdo esperado:

- NestJS;
- TypeORM;
- `ExecutorTenant`;
- RLS;
- auth/guards;
- DTO;
- crypto;
- migrations;
- `opcoes-typeorm.ts`;
- BullMQ;
- worker;
- integrações;
- fluxos públicos legítimos;
- testes críticos.

### Decisão

**GO P1.**

---

# 39. `AGENTS.md` web

## Claude

GO P1.

## Codex

GO P0.

## Avaliação independente

GO P1.

Preservar bloco Next.js gerado.

Adicionar regras OctaClin sobre:

- BFF;
- cookies HttpOnly;
- `requisitarBackendAutenticado`;
- wrappers legítimos;
- authz;
- rotas públicas;
- PWA;
- a11y;
- Playwright;
- dados client-side.

### Decisão

**GO P1.**

---

# 40. `AGENTS.md` Mobile

## Claude

ADIAR.

## Codex

GO P0.

## Avaliação independente

Fico no meio.

Enquanto não há trabalho ativo, root contém:

```text
Mobile permanece NO-GO para distribuição.
Não publicar, não ativar sync e não alterar gates sem decisão explícita.
```

Criar AGENTS específico quando mobile voltar à roadmap.

### Decisão

**ADIAR / P2.**

---

# 41. `AGENTS.md` AI service

## Claude

NO-GO.

## Codex

GO P0.

## Avaliação independente

Fico mais perto de Claude.

Enquanto serviço é pequeno e sem provider externo, root pode conter:

```text
não usar saída de IA como decisão clínica autônoma
```

Criar AGENTS específico quando surgirem:

- provider;
- prompts;
- PHI;
- evals;
- retenção;
- decisões clínicas assistidas.

### Decisão

**ADIAR.**

---

# 42. `docs/agents/README.md`

## Claude

NO-GO.

## Codex

GO como roteador.

## Avaliação independente

Com 3–5 documentos, não precisa.

Criar somente se o diretório crescer e realmente precisar de roteamento.

### Decisão

**NO-GO agora.**

---

# 43. Freshness/status de documentação

## Claude

Cético; cabeçalhos de “última revisão” já falharam na prática.

## Codex

Freshness apenas nos poucos documentos canônicos.

## Avaliação independente

Fico com Codex.

Mais importante que data:

```text
STATUS
CANÔNICO PARA
SUBSTITUÍDO POR
```

Usar data apenas onde tem valor operacional real.

### Decisão

**GO seletivo.**

---

# 44. LICENSE

## Claude

P0.

## Codex

Decisão do usuário.

## Avaliação independente

`license: null` é fato.

Mas ausência de licença open source pode ser intencional se o projeto for:

```text
código proprietário em repositório público
```

Logo não é automaticamente falha técnica.

A decisão é:

```text
proprietário / source-visible
vs
open source
```

Nunca adicionar MIT/Apache automaticamente.

### Decisão

**P1 jurídica/comercial.**

---

# 45. Threat Model

## Claude

GO reduzido, com foco em MCP, API key, tokens públicos e webhook.

## Codex

GO P1 com STRIDE leve.

## Avaliação independente

Concordo.

Escopo mínimo:

- tenant isolation;
- JWT/capabilities/API keys;
- BFF;
- Postgres/RLS;
- Redis/jobs;
- storage;
- webhooks;
- OAuth;
- Gmail/Calendar/Meta;
- MCP;
- Mobile;
- SuperAdmin;
- AI.

### Decisão

**GO P1 reduzido.**

---

# 46. Third-party policy

## Claude

ADIAR.

## Codex

GO P1.

## Avaliação independente

No início, fundir o essencial em:

```text
EXTERNAL_CODE_POLICY.md
```

Se a governança jurídica crescer, separar depois.

### Decisão

**FUNDIR INICIALMENTE.**

---

# 47. CodeQL

## Claude

Não colocou como prioridade inicial central.

## Codex

Sugere avaliar CodeQL/default setup antes.

## Avaliação independente

Vale avaliar primeiro por ser:

- GitHub-native;
- baixo atrito para repo público;
- bom baseline.

Mas não substitui regras arquiteturais custom do Semgrep.

### Decisão

**AVALIAR P1.**

---

# 48. Semgrep

## Claude

GO P1, inicialmente 3 regras, com cuidado para wrappers do BFF.

## Codex

GO P1 em warning.

## Avaliação independente

Concordância alta.

PoC inicial:

1. evitar logs sensíveis;
2. evitar bypass de camada canônica comprovável;
3. regra OctaClin com bom sinal/ruído.

Não bloquear merge na primeira versão.

### Decisão

**GO P1 PoC warning.**

---

# 49. Trivy

## Claude

GO P1.

## Codex

GO P1.

## Avaliação independente

GO.

Começar com:

- dependencies;
- SBOM;
- misconfiguration;
- images quando aplicável;
- licenses.

Evitar duplicar secret scanning ruidosamente, pois GitHub + scanner local já existem.

### Decisão

**GO P1.**

---

# 50. Testcontainers

## Claude

GO para prova RLS real.

## Codex

ADIAR e testar primeiro service containers.

## Avaliação independente

Definir primeiro o problema:

> provar PostgreSQL/RLS real em CI.

Sequência:

```text
service container simples
→ se insuficiente
→ Testcontainers
```

### Decisão

**P1/P2, problema primeiro.**

---

# 51. OpenTelemetry

## Claude

ADIAR até worker/distribuição.

## Codex

ADIAR.

## Avaliação independente

Concordo.

Já existe correlação/telemetria local.

Reavaliar quando houver:

- worker separado;
- múltiplos processos;
- necessidade de trace distribuído.

### Decisão

**ADIAR.**

---

# 52. axe-core

## Claude

Medir primeiro o gap de `test:a11y`.

## Codex

GO em algumas jornadas.

## Avaliação independente

Antes:

```text
o que o gate atual não detecta?
```

Depois decidir adoção.

### Decisão

**GAP ANALYSIS PRIMEIRO.**

---

# 53. React Email

## Claude

NO-GO agora.

## Codex

ADIAR.

## Avaliação independente

Não é bloqueador.

### Decisão

**P2.**

---

# 54. Mealie

## Claude

ADIAR.

## Codex

Referência P2.

## Avaliação independente

Usar como referência quando lista de compras entrar em roadmap.

Não integrar.

### Decisão

**P2 referência.**

---

# 55. Open Food Facts

## Claude

ADIAR.

## Codex

ADIAR.

## Avaliação independente

Reavaliar quando branded foods/barcode/ingredientes/allergens forem requisito medido.

### Decisão

**P2.**

---

# 56. OpenObserve

## Claude

NO-GO.

## Codex

NO-GO agora.

## Avaliação independente

Concordância.

### Decisão

**NO-GO agora.**

---

# 57. Medplum

## Claude

NO-GO.

## Codex

NO-GO agora.

## Avaliação independente

Concordância.

Reabrir apenas com requisito comercial real de FHIR/HL7/SMART.

### Decisão

**NO-GO agora.**

---

# 58. Cal.com, Novu, OpenFGA, Trigger.dev/Inngest

## Claude

Mantém NO-GO por duplicação.

## Codex

Mantém não priorizados.

## Avaliação independente

Concordância.

Reavaliar somente quando houver lacuna concreta.

---

# 59. Arquitetura documental recomendada agora

```text
/
├── AGENTS.md
├── CLAUDE.md
│
├── octaclin-backend/
│   └── AGENTS.md              # P1
│
├── octaclin-web/
│   └── AGENTS.md              # preservar bloco Next.js
│
└── docs/
    └── agents/
        ├── REGRAS.md
        ├── DATA_CLASSIFICATION.md
        ├── LESSONS_LEARNED.md
        ├── ENVIRONMENT_PLAYBOOK.md
        └── EXTERNAL_CODE_POLICY.md
```

Não criar inicialmente:

```text
SOURCE_OF_TRUTH.md separado
SAFETY_GATES.md separado
VALIDATION_MATRIX.md separado
CONCURRENCY.md separado
README.md de docs/agents
.ai/ACTIVE_WORK.md
config/change-risk.yml
agent:preflight novo
agent:verify novo
AGENTS mobile grande
AGENTS AI grande
```

---

# 60. Conteúdo de `REGRAS.md`

Concentrar:

1. normativo × observado × planejamento × histórico;
2. safety gates;
3. R0–R5 resumido;
4. concorrência mínima;
5. Definition of Done complementar;
6. produção/migrations em alto nível;
7. quando ler documentação especializada.

Objetivo:

```text
menos arquivos
menos duplicação
mais clareza
```

---

# 61. Ordem de implementação recomendada

## PR 1 — correções imediatas

- root `CLAUDE.md` como bridge;
- `COORDENACAO_DESENVOLVIMENTO_IA.md` histórico;
- remover push direto;
- corrigir duplicidade Redis;
- corrigir ADR-002;
- corrigir ADR-018.

## PR 2 — validadores existentes

- corrigir `validate:docs`;
- ausência de match deve falhar;
- remover sentinelas históricas frágeis;
- validar comandos citados;
- corrigir `test:next15`.

## PR 3 — tooling/agentes

- auditar `.mcp.json`;
- variável staging específica;
- pin de package MCP;
- auditar hooks PowerShell;
- decidir migração para Node.

## PR 4 — governança nova

- root AGENTS reduzido;
- `REGRAS.md`;
- `LESSONS_LEARNED.md`;
- `DATA_CLASSIFICATION.md`;
- `EXTERNAL_CODE_POLICY.md`;
- `ENVIRONMENT_PLAYBOOK.md`.

## PR 5 — AGENTS por pacote

- backend;
- web preservando Next.

## PRs seguintes

- CodeQL baseline;
- Semgrep PoC;
- Trivy;
- PostgreSQL/RLS real;
- Testcontainers somente se necessário.

---

# 62. Onde a avaliação independente discorda de Claude

1. O `AGENTS.md` é sim um problema próprio, além da dívida documental.
2. Data Classification não precisa esperar OTel/Semgrep.
3. LICENSE não é automaticamente P0 técnico.
4. `.claude/rules` não deve ser descartado definitivamente.
5. Muitos Markdown não tornam modularização automaticamente errada.
6. Mobile pode merecer AGENTS pequeno quando voltar à roadmap.
7. O comportamento exato “no-op silencioso” dos hooks fora do Windows precisa ser medido; a assimetria, porém, é real.

---

# 63. Onde a avaliação independente discorda de Codex

1. Não criar `VALIDATION_MATRIX.md` paralela.
2. Não manter `CONCURRENCY.md` separado.
3. Não criar AGENTS AI agora.
4. Não criar AGENTS Mobile grande agora.
5. Reduzir quantidade de documentos compartilhados.
6. O limite agregado de AGENTS é documentado e importa.
7. Corrigir validadores existentes antes de criar novos mecanismos.
8. CodeQL não substitui Semgrep custom.

---

# 64. Onde a avaliação independente corrige a proposta original

A proposta original errou ao:

1. propor criação do que já existia;
2. não inventariar `.github/`;
3. não identificar `.mcp.json`;
4. não identificar hooks existentes;
5. usar paths incorretos;
6. propor Validation Matrix paralela;
7. propor `ACTIVE_WORK`;
8. propor preflight/verify novos antes de auditar os atuais;
9. simplificar tenant para JWT;
10. usar “código vence documentação” como absoluto;
11. confundir provider atual com arquitetura;
12. colocar ferramentas externas antes de correções atuais.

---

# 65. Matriz consolidada

| Item | Claude | Codex | Avaliação independente |
|---|---|---|---|
| Root AGENTS | GO P1 | GO P0 | GO P0/P1 |
| Root CLAUDE bridge | GO P0 | GO P0 | GO P0 |
| Backend AGENTS | GO P1 | GO P0 | GO P1 |
| Web AGENTS | GO P1 | GO P0 | GO P1 |
| Mobile AGENTS | ADIAR | GO P0 | ADIAR/P2 |
| AI AGENTS | NO-GO | GO P0 | ADIAR |
| Nested CLAUDE | ADIAR | ADIAR | ADIAR |
| `.claude/rules` | NO-GO | ADIAR | ADIAR |
| Source of Truth separado | FUNDIR | GO | FUNDIR |
| Safety Gates separado | FUNDIR | GO | FUNDIR |
| Validation Matrix nova | NO-GO | GO | NO-GO |
| R0–R5 reduzido | GO | GO | GO |
| Concurrency separado | NO-GO | GO P1 | NO-GO separado |
| ACTIVE_WORK | NO-GO | NO-GO | NO-GO |
| Lessons Learned | GO | GO | GO |
| Environment Playbook | GO | GO | GO |
| Data Classification | ADIAR | GO P0 | GO P0/P1 |
| External Code Policy | GO P0 | GO P0 | GO P0 |
| Threat Model | GO P1 | GO P1 | GO P1 |
| Third Party Policy | ADIAR | GO P1 | FUNDIR inicialmente |
| Production invariants | GO reduzido | GO | GO reduzido |
| CODEOWNERS | já existe | atualizar | manter/ajustar |
| Ruleset | manter | manter | manter |
| PR template | atualizar | atualizar | atualizar |
| SECURITY.md | manter | ajustar leve | manter |
| PHI issue warning | GO | GO | GO |
| change-risk | NO-GO | ADIAR | ADIAR |
| agent:preflight | NO-GO | refatorar | refatorar |
| agent:verify | NO-GO | composição | NO-GO agora |
| validate:docs | corrigir | corrigir | P0 |
| validar pnpm em docs | P0 | P1 | P0 |
| `.mcp.json` | P0 | pouco destaque | P0 audit |
| hooks PowerShell | auditar | auditar | auditar |
| LICENSE | P0 | usuário | P1 jurídica |
| ADR-002 | corrigir | corrigir | P0 |
| ADR-018 | corrigir | corrigir | P0 |
| migration default | configurar false | default perigoso | discutir opt-in |
| CodeQL | secundário | P1 | avaliar P1 |
| Semgrep | P1 | P1 | P1 |
| Trivy | P1 | P1 | P1 |
| Testcontainers | P1/P2 | adiar | problema-first |
| OTel | adiar | adiar | adiar |
| axe-core | medir | GO P1 | medir primeiro |
| React Email | no-go agora | adiar | P2 |
| Mealie | adiar | referência | P2 referência |
| Open Food Facts | adiar | adiar | P2 |
| OpenObserve | no-go | no-go | no-go agora |
| Medplum | no-go | no-go | no-go agora |

---

# 66. Perguntas obrigatórias para Claude Code

Claude deve responder claramente:

1. Quais posições você mantém?
2. Quais retira?
3. Quais modifica após ler Codex?
4. Quais modifica após ler a avaliação independente?
5. Onde Codex possui evidência melhor?
6. Onde a avaliação independente está errada?
7. Você mantém que “o problema não é AGENTS”?
8. Como incorpora o limite agregado do Codex?
9. `REGRAS.md` unificado resolve sua preocupação documental?
10. Depois de considerar GitHub, logs, MCP, storage, integrações e backups, mantém Data Classification como ADIAR?
11. Mantém LICENSE como P0?
12. Se o projeto for proprietário e público, ausência de licença é aceitável?
13. Qual risco real atribui a `.mcp.json`?
14. `STAGING_DATABASE_URL` resolve parte suficiente?
15. A role MCP deve ser read-only?
16. O package MCP deve ser pinado?
17. O `.mcp.json` deve continuar versionado?
18. Você comprovou “no-op silencioso” dos hooks ou somente dependência de PowerShell?
19. Qual comportamento fail-safe ideal?
20. Apoia inverter migrations para opt-in `=== 'true'`?
21. Quais ambientes isso afetaria?
22. Qual rollout?
23. CodeQL antes de Semgrep?
24. Qual overlap?
25. Qual custo adicional de CI você aceitaria?

---

# 67. Perguntas obrigatórias para Codex

Codex deve responder claramente:

1. Quais posições mantém?
2. Quais retira?
3. Quais modifica após ler Claude?
4. Quais modifica após ler a avaliação independente?
5. Quais achados de Claude mudam sua arquitetura?
6. Onde Claude exagerou?
7. Revise sua afirmação anterior sobre limite de AGENTS.
8. Qual limite oficial atual reconhece?
9. Isso altera sua recomendação de tamanho?
10. Por que manter Validation Matrix nova se a matriz existente já cobre domínios concretos?
11. Você aceita retirar esse arquivo?
12. Por que manter Concurrency separado?
13. 15–25 linhas em `REGRAS.md` bastam?
14. Por que Mobile AGENTS seria P0?
15. Você aceita adiar?
16. Por que AI AGENTS seria P0 para serviço pequeno sem provider?
17. Você aceita gatilho futuro?
18. Qual tamanho mínimo para Data Classification?
19. Como evitar burocracia?
20. Você concorda que `.mcp.json` é ameaça relevante?
21. Deve entrar no threat model?
22. Qual role/URL/pin recomenda?
23. Apoia migration default opt-in?
24. Quais testes exige?
25. Por que CodeQL deveria preceder Semgrep?
26. O que CodeQL não substituirá?

---

# 68. Perguntas comuns aos dois

1. Qual a menor arquitetura de arquivos suficiente?
2. Quais documentos podem ser eliminados?
3. Quais regras devem ser duplicadas por defesa em profundidade?
4. Quais jamais devem ser duplicadas?
5. Quais três regras textuais deveriam virar CI primeiro?
6. Quais três automações propostas fariam mais mal que bem?
7. Como atacar a dívida dos 305 `.md`?
8. Devemos mover `fase-*.md` para histórico?
9. Quais links/scripts isso quebraria?
10. Como migrar com segurança?
11. Papel exato de `STATUS_ATUAL_PROJETO.md`?
12. Papel exato do checklist?
13. Papel exato dos ADRs?
14. Qual documento contém estado?
15. Qual contém norma?
16. Qual contém teste?
17. Qual contém história?
18. O que carregar automaticamente?
19. O que carregar sob demanda?
20. Qual sequência final de PRs?

---

# 69. Formato obrigatório da tréplica

Cada agente deve terminar com:

```md
# Tréplica

## 1. Posições que mantenho
## 2. Posições que retiro
## 3. Posições que modifico
## 4. Onde o outro agente estava correto
## 5. Onde o outro agente estava incorreto
## 6. Onde a avaliação independente estava correta
## 7. Onde a avaliação independente estava incorreta
## 8. Nova arquitetura documental recomendada
## 9. Nova ordem de implementação
## 10. P0
## 11. P1
## 12. P2
## 13. NO-GO
## 14. Respostas às perguntas específicas
## 15. Respostas às perguntas comuns
## 16. Top 10 riscos remanescentes
## 17. Decisões que exigem o usuário
## 18. Veredito final
GO / GO COM AJUSTES / NO-GO
```

---

# 70. Classificação obrigatória das conclusões

Na próxima resposta, cada conclusão relevante deve ser marcada mentalmente ou explicitamente como:

```text
FATO VERIFICADO
INFERÊNCIA
PREFERÊNCIA ARQUITETURAL
DECISÃO DE RISCO
DECISÃO DO USUÁRIO
```

Consenso entre IAs não transforma inferência em fato.

---

# 71. Consensos fortes atuais

Há consenso substancial em:

- root CLAUDE como bridge;
- root AGENTS menor;
- correção da regra de tenant;
- remoção de push direto;
- `COORDENACAO_DESENVOLVIMENTO_IA.md` stale;
- `LESSONS_LEARNED`;
- NO-GO para ACTIVE_WORK;
- manter ruleset;
- ajustar PR template;
- preservar SECURITY;
- criar External Code Policy;
- corrigir validate:docs;
- validar comandos citados;
- auditar hooks;
- adiar OTel/OpenObserve/Medplum;
- PoC Semgrep/Trivy;
- tratar conteúdo externo como não confiável.

---

# 72. Divergências que a tréplica precisa resolver

1. quantidade final de documentos;
2. Data Classification agora ou depois;
3. Validation Matrix separada ou não;
4. Concurrency separado ou não;
5. Mobile AGENTS;
6. AI AGENTS;
7. `.claude/rules`;
8. LICENSE;
9. CodeQL versus Semgrep primeiro;
10. Testcontainers versus service containers;
11. migration default;
12. `.mcp.json`;
13. grau de limpeza dos Markdown históricos.

---

# 73. Veredito desta rodada

O processo adversarial cumpriu seu objetivo.

A proposta original não deve ser implementada em bloco.

Claude trouxe a auditoria factual mais forte.

Codex trouxe o modelo conceitual de governança mais sólido.

A síntese atual é:

```text
evidência factual de Claude
+
modelo normativo/observado de Codex
+
redução de artefatos
+
reuso de controles existentes
+
enforcement em CI/GitHub
=
direção recomendada
```

A próxima rodada deve **reduzir**, e não aumentar, a superfície da solução.

O objetivo final não é possuir a governança mais sofisticada.

É possuir a menor governança que:

- impeça regressões críticas;
- preserve o contexto realmente necessário;
- não apodreça rapidamente;
- funcione com Claude e Codex;
- seja verificável;
- não crie burocracia desnecessária;
- acompanhe o OctaClin até produção e escala.
