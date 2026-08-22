# OctaClin — Governança de Agentes de IA, Estrutura de Instruções e Regras Prioritárias

> **Status:** proposta para revisão e adoção  
> **Escopo:** Claude Code, OpenAI Codex e qualquer outro agente de IA que trabalhe no repositório OctaClin  
> **Objetivo:** tornar as instruções do projeto mais curtas, confiáveis, hierárquicas e executáveis, reduzindo ambiguidades, documentação obsoleta, conflitos entre agentes e mudanças inseguras.

---

## 1. Objetivo deste documento

O OctaClin já possui uma base de engenharia madura, com regras importantes de segurança, tenancy, autenticação, migrations, validação, CI/CD, produção e operação.

O problema a resolver não é ausência de instruções. É o oposto: as instruções cresceram ao ponto de o `AGENTS.md` raiz acumular simultaneamente:

- regras permanentes;
- estado atual do projeto;
- histórico de incidentes;
- procedimentos operacionais;
- quirks de ambiente;
- política de Git;
- comandos de validação;
- recomendações de modelos/skills;
- referências a documentos de diferentes épocas do projeto.

Essa concentração aumenta o risco de:

1. instruções importantes perderem prioridade no contexto do agente;
2. regras antigas competirem com o estado atual;
3. Claude Code e Codex receberem contextos diferentes;
4. agentes seguirem corretamente uma documentação já defasada;
5. o arquivo crescer além do tamanho adequado para instruções persistentes;
6. mudanças de baixo risco receberem o mesmo ritual de mudanças críticas;
7. dois agentes trabalharem simultaneamente na mesma área sem coordenação suficiente.

A proposta é transformar o sistema atual em uma **hierarquia de instruções pequenas, especializadas e verificáveis**.

---

# 2. Princípios fundamentais

Todas as decisões deste documento seguem os princípios abaixo.

## 2.1 Evidência acima de inferência

Regra principal do OctaClin:

> **Não conclua a partir de algo adjacente à evidência. Conclua a partir da evidência.**

Antes de afirmar que algo está:

- funcionando;
- validado;
- em produção;
- migrado;
- protegido;
- implantado;
- corrigido;
- aprovado pelo CI;

o agente deve obter evidência no mesmo ciclo de trabalho ou declarar explicitamente que não conseguiu verificá-la.

---

## 2.2 Código atual vence documentação histórica

Documentos registram decisões e contexto, mas podem envelhecer.

Quando houver divergência entre documentação e implementação, o agente deve:

1. identificar o conflito;
2. verificar código, migrations, configuração e infraestrutura atuais;
3. não escolher silenciosamente uma das versões;
4. atualizar a documentação canônica após confirmar o estado correto.

---

## 2.3 Segurança e isolamento são propriedades arquiteturais

Novas funcionalidades não podem enfraquecer:

- isolamento multi-tenant;
- RLS;
- autenticação;
- autorização;
- criptografia;
- proteção de PHI/PII;
- auditoria;
- idempotência;
- outbox/retries;
- separação de ambientes;
- políticas de segredo;
- recuperação operacional.

A funcionalidade só está concluída quando essas propriedades continuam válidas.

---

## 2.4 Agentes devem trabalhar com escopo limitado

Cada mudança deve ter:

- objetivo;
- arquivos/áreas esperadas;
- risco;
- validações necessárias;
- definição de pronto.

Um agente não deve aproveitar uma tarefa para realizar refactors amplos não relacionados.

---

# 3. Arquitetura recomendada de instruções

Recomenda-se substituir o modelo de “um grande arquivo raiz” pelo seguinte:

```text
/
├── AGENTS.md
├── CLAUDE.md
│
├── octaclin-backend/
│   └── AGENTS.md
│
├── octaclin-web/
│   └── AGENTS.md
│
├── octaclin-mobile/
│   └── AGENTS.md
│
├── octaclin-ai-service/
│   └── AGENTS.md
│
└── docs/
    └── agents/
        ├── SOURCE_OF_TRUTH.md
        ├── SAFETY_GATES.md
        ├── VALIDATION_MATRIX.md
        ├── CONCURRENCY.md
        ├── LESSONS_LEARNED.md
        └── ENVIRONMENT_PLAYBOOK.md
```

---

# 4. Função de cada arquivo

## 4.1 `AGENTS.md` raiz

Deve ser o **mapa de navegação dos agentes**, não um manual completo.

Meta recomendada:

- aproximadamente 100–150 linhas;
- somente regras universais;
- links para documentação especializada;
- estado atual resumido em poucas linhas;
- Definition of Done;
- regras de segurança;
- protocolo de validação;
- protocolo de Git/concorrência.

### Deve conter

- identidade do projeto;
- ordem de leitura;
- fonte de verdade;
- regras universais;
- regras de segurança;
- política de alterações;
- matriz de risco resumida;
- Definition of Done;
- links para documentos especializados.

### Não deve conter

- histórico completo de incidentes;
- longos tutoriais de shell;
- estado detalhado de dezenas de fases;
- troubleshooting de ambiente;
- comandos específicos de uma única migration;
- decisões já substituídas;
- recomendações voláteis de modelos;
- grandes trechos de documentação operacional.

---

## 4.2 `CLAUDE.md`

Claude Code deve receber a mesma fonte de verdade usada pelo Codex.

Conteúdo mínimo recomendado:

```md
@AGENTS.md
```

Opcionalmente, podem existir apenas instruções específicas do Claude Code abaixo da importação.

**Não duplicar o conteúdo do `AGENTS.md`.**

Duplicação cria risco de divergência.

---

## 4.3 `octaclin-backend/AGENTS.md`

Deve conter regras específicas do backend, por exemplo:

- NestJS;
- TypeORM;
- migrations;
- RLS;
- entidades;
- DTOs;
- services;
- guards;
- tenancy;
- criptografia;
- jobs;
- BullMQ;
- integrações externas;
- testes backend.

---

## 4.4 `octaclin-web/AGENTS.md`

Deve conter regras específicas da aplicação web:

- Next.js;
- BFF;
- `requisitarBackendAutenticado`;
- authz;
- rotas dinâmicas;
- Server/Client Components;
- acessibilidade;
- Playwright;
- PWA;
- cache;
- handling de erros.

---

## 4.5 `octaclin-mobile/AGENTS.md`

Deve registrar explicitamente:

- estado atual de distribuição;
- gates de Mobile;
- regras de sincronização;
- políticas de armazenamento local;
- proibição de habilitar distribuição sem decisão explícita;
- tratamento de dados clínicos no dispositivo.

---

## 4.6 `octaclin-ai-service/AGENTS.md`

Deve conter:

- limites da IA clínica;
- feature flags;
- revisão humana obrigatória quando aplicável;
- dados permitidos;
- logs proibidos;
- timeouts/retries;
- contratos da API;
- comportamento fail-closed;
- proibição de decisões clínicas autônomas fora do escopo aprovado.

---

# 5. Hierarquia de fontes de verdade

Adotar formalmente a seguinte precedência:

```text
1. Código, migrations e configuração efetivamente em uso
2. STATUS_ATUAL_PROJETO.md
3. DECISOES_ARQUITETURA.md / ADRs ainda vigentes
4. CHECKLIST_FASES_FUTURAS_PRODUCAO.md
5. Runbooks operacionais atuais
6. Documentos de fase recentes
7. Documentos históricos
```

## Regra de conflito

Quando duas fontes discordarem:

> **Não escolher silenciosamente. Verificar a implementação real e registrar a divergência.**

Depois da verificação:

- corrigir a documentação canônica;
- marcar documentos históricos quando necessário;
- evitar deixar duas instruções ativas e contraditórias.

---

# 6. Freshness da documentação

Documentos vivos devem possuir cabeçalho com:

```md
> Status: ativo
> Última revisão: YYYY-MM-DD
> Fonte de verdade para: <assunto>
> Substitui: <documento, se aplicável>
```

Documentos históricos devem possuir:

```md
> Status: histórico
> Não utilizar como fonte de verdade operacional.
```

---

# 7. Problemas de documentação que devem ser eliminados

## 7.1 Estado de fases desatualizado

Documentos antigos não devem permanecer com linguagem que pareça indicar o estado atual.

O estado da fase deve possuir **uma fonte canônica**.

---

## 7.2 Decisões arquiteturais substituídas

Quando um ADR deixar de representar a arquitetura atual:

- não apagar o histórico;
- marcar como `SUPERSEDED`;
- apontar para a decisão atual.

Exemplo:

```md
Status: SUPERSEDED
Substituído por: ADR-XXX
```

---

# 8. Prioridades de implementação

## P0 — fazer primeiro

### P0.1 Reduzir o `AGENTS.md` raiz

Transformá-lo em mapa operacional curto.

---

### P0.2 Criar `CLAUDE.md`

Conteúdo inicial:

```md
@AGENTS.md
```

---

### P0.3 Criar hierarquia explícita de fontes

Criar:

```text
docs/agents/SOURCE_OF_TRUTH.md
```

---

### P0.4 Criar `AGENTS.md` por componente

Separar regras de:

- backend;
- web;
- mobile;
- AI service.

---

### P0.5 Criar gates de autorização

Algumas mudanças não devem ser feitas por inferência do agente.

Devem exigir decisão explícita quando envolverem:

- autenticação;
- autorização;
- tenancy;
- RLS;
- criptografia;
- estratégia de segredo;
- alteração destrutiva de banco;
- produção;
- envio real de comunicação;
- IA clínica;
- ativação/distribuição do Mobile;
- mudança de provedor crítico;
- remoção de auditoria;
- alteração de política de retenção de dados.

---

### P0.6 Ampliar política de PHI/PII

A regra não deve ser apenas:

> não commitar dados sensíveis.

Deve ser:

> **Dados reais de pacientes não entram em repositório, prompt, fixture, screenshot, log, issue, PR, exemplo, relatório de erro ou saída de ferramenta.**

Utilizar sempre:

- dados sintéticos;
- fixtures anonimizadas;
- IDs artificiais;
- exemplos explicitamente fictícios.

---

# 9. Segurança de PHI/PII

## Proibido

- copiar prontuário real em prompt;
- usar nome/e-mail/CPF real em teste;
- colocar token em issue/PR;
- salvar payload clínico completo em logs;
- subir dump produtivo no repositório;
- usar screenshot com dados reais;
- adicionar conexão real ao código;
- incluir segredo em documento Markdown;
- enviar dados sensíveis a ferramentas externas não aprovadas.

## Obrigatório

Quando for necessário reproduzir um bug:

1. reduzir o caso;
2. substituir identificadores;
3. remover conteúdo clínico;
4. manter apenas a estrutura necessária;
5. usar valores sintéticos.

---

# 10. Matriz de risco para alterações

Criar `docs/agents/VALIDATION_MATRIX.md`.

Modelo recomendado:

| Nível | Exemplos | Validação mínima |
|---|---|---|
| R0 | docs, typo | lint/checagem aplicável |
| R1 | CSS, microcopy | lint + typecheck do pacote |
| R2 | componente/rota comum | testes específicos + lint + typecheck |
| R3 | API, banco não destrutivo, integração | testes + typecheck + build + regressão relacionada |
| R4 | auth, RLS, tenancy, crypto, migration, produção | TDD + suíte específica + regressão + gates de segurança + revisão independente |
| R5 | dados destrutivos, rollout crítico | R4 + backup/restore + plano de rollback + autorização explícita |

O agente deve declarar o nível de risco da tarefa antes de escolher os gates.

---

# 11. Definition of Done

Nenhuma fase, feature ou bugfix deve ser declarada concluída sem:

- [ ] objetivo implementado;
- [ ] teste criado/atualizado quando aplicável;
- [ ] teste inicialmente falhou pelo motivo esperado;
- [ ] teste final passou;
- [ ] typecheck necessário passou;
- [ ] lint necessário passou;
- [ ] build necessário passou;
- [ ] regressões proporcionais ao risco passaram;
- [ ] segurança/tenancy/RLS revisados quando aplicável;
- [ ] migrations registradas quando aplicável;
- [ ] documentação atualizada;
- [ ] nenhum segredo adicionado;
- [ ] `git diff` revisado;
- [ ] CI verificado pelo run correto;
- [ ] mudanças não relacionadas removidas;
- [ ] próximo passo registrado quando aplicável.

---

# 12. Política de Git recomendada

O modelo atual de push direto para `main` deve ser refinado para suportar Claude Code e Codex em paralelo.

## Mudança simples

Pode utilizar fluxo direto somente quando:

- risco R0/R1;
- área não está sendo modificada por outro agente;
- não afeta segurança ou dados;
- validações passaram.

## Mudança funcional

Utilizar:

```text
branch / worktree
→ implementação
→ testes
→ revisão
→ merge
```

## Mudança crítica

Para:

- migration;
- auth;
- RLS;
- tenancy;
- criptografia;
- infraestrutura;
- produção;
- PHI/PII;
- integrações críticas;

utilizar obrigatoriamente:

```text
branch/worktree
→ testes
→ revisão independente
→ plano de rollout
→ merge
```

---

# 13. Coordenação Claude Code × Codex

Criar:

```text
docs/agents/CONCURRENCY.md
```

## Regra

Dois agentes nunca devem modificar simultaneamente o mesmo domínio sem divisão explícita.

## Modelo de reserva de escopo

Cada agente registra:

```md
## Trabalho ativo

Agente: Claude Code
Branch: feat/...
Escopo:
- octaclin-backend/src/...
- migration XXXX

Não alterar:
- arquivos acima até conclusão/handoff
```

Outro agente pode trabalhar em áreas independentes.

---

## Handoff mínimo

Quando um agente entregar trabalho para outro revisar:

```md
### Objetivo
...

### Arquivos alterados
...

### Decisões importantes
...

### Gates executados
...

### Gates não executados
...

### Riscos restantes
...

### O que revisar
...
```

---

# 14. Revisão independente

Alterações R4/R5 devem, sempre que possível, ser verificadas por agente diferente daquele que implementou.

Exemplo:

```text
Claude Code implementa
        ↓
Codex revisa

ou

Codex implementa
        ↓
Claude Code revisa
```

A revisão deve procurar:

- regressões;
- bypass de autorização;
- falhas de tenancy;
- PII em logs;
- migrations incompletas;
- erros de rollback;
- condições de corrida;
- testes que passam pelo motivo errado;
- código morto;
- duplicação de mecanismo já existente.

---

# 15. TDD

Para feature ou bugfix:

```text
RED
↓
teste falha pelo motivo esperado

GREEN
↓
mínimo necessário para passar

REFACTOR
↓
melhoria sem mudar comportamento

REGRESSION
↓
gates proporcionais ao risco
```

Não basta ver o teste falhar.

O agente deve confirmar que ele falhou **pela causa que o teste pretende provar**.

---

# 16. Migrations

Toda migration deve validar:

- arquivo criado;
- registro no array/configuração correspondente;
- entidade atualizada;
- módulos atualizados;
- teste da migration;
- aplicação em ambiente apropriado;
- inspeção do catálogo;
- constraints provadas pelo código de erro correto;
- rollback ou estratégia de reversão quando aplicável.

Nunca presumir que “arquivo existe” significa “migration será executada”.

---

# 17. Produção

Antes de qualquer ação ou afirmação sobre produção:

1. verificar ambiente;
2. verificar identidade de banco;
3. verificar branch/commit;
4. verificar status da infraestrutura;
5. obter evidência no mesmo ciclo;
6. não expor connection strings;
7. seguir runbook atual.

---

# 18. CI

Nunca declarar CI aprovado com base em:

- listagem incompleta;
- outro run;
- ausência temporária do run;
- job `skipped`;
- status antigo.

Usar o ID do run correto e verificar os jobs correspondentes.

---

# 19. Lessons learned

Mover o histórico detalhado de incidentes do `AGENTS.md` para:

```text
docs/agents/LESSONS_LEARNED.md
```

Cada item deve utilizar:

```md
## Incidente

### O que aconteceu

### Por que aconteceu

### Regra permanente criada

### Gate automatizado existente

### Gate automatizado ainda necessário
```

O `AGENTS.md` deve conter somente:

> Leia `docs/agents/LESSONS_LEARNED.md` antes de mudanças críticas.

---

# 20. Transformar regras em automação

Sempre que possível, uma regra textual recorrente deve evoluir para:

```text
regra humana
↓
teste
↓
linter
↓
scanner
↓
gate de CI
```

Exemplo:

```text
"tenant nunca vem de header não confiável"
```

é melhor quando acompanhado de:

- teste;
- regra de Semgrep;
- CI.

O objetivo é reduzir dependência de memória do agente.

---

# 21. Estrutura sugerida para o novo `AGENTS.md`

Exemplo conceitual:

```md
# OctaClin — Agent Guide

## Projeto
Breve descrição.

## Antes de alterar código
1. STATUS_ATUAL_PROJETO.md
2. CHECKLIST...
3. AGENTS.md do pacote
4. documentação específica da tarefa

## Fonte de verdade
Ver docs/agents/SOURCE_OF_TRUTH.md

## Regras absolutas
- evidência > inferência
- sem PHI/PII real
- sem secrets
- preservar tenancy/RLS
- não alterar produção sem autorização
- não declarar gate que não rodou

## Fluxo
- classificar risco
- TDD quando aplicável
- implementação mínima
- gates
- revisão do diff
- documentação
- handoff

## Git
Ver docs/agents/CONCURRENCY.md

## Segurança
Ver docs/agents/SAFETY_GATES.md

## Validação
Ver docs/agents/VALIDATION_MATRIX.md

## Lessons learned
Ver docs/agents/LESSONS_LEARNED.md
```

---

# 22. Melhorias P1

Depois dos P0:

## P1.1 Definition of Done automatizada

Adicionar checklists ou validações que comprovem:

- migration registrada;
- matriz de confiabilidade atualizada;
- documentação necessária alterada;
- secrets gate executado.

---

## P1.2 Validador de documentação

Criar script que detecte:

- fase atual divergente;
- arquivo citado inexistente;
- ADR superseded ainda marcado ativo;
- documento obrigatório sem status/freshness;
- referências quebradas.

---

## P1.3 Revisão cruzada por agente

Para segurança:

```text
implementador != revisor
```

sempre que viável.

---

## P1.4 Matriz de arquivos críticos

Exemplo:

```yaml
critical_paths:
  - authentication
  - authorization
  - tenancy
  - migrations
  - crypto
  - production
```

Mudanças nesses paths disparam gates adicionais.

---

# 23. Melhorias P2

## P2.1 Modelos/skills fora do `AGENTS.md`

Recomendações de modelo, raciocínio ou plugin mudam rapidamente.

Mover para documento próprio:

```text
docs/agents/AI_TOOLING_MATRIX.md
```

Isso evita alterar o guia estrutural toda vez que uma ferramenta evoluir.

---

## P2.2 Playbook de ambiente

Mover peculiaridades de:

- Windows;
- Git Bash;
- PATH;
- CRLF;
- runtime empacotado;
- comandos alternativos;

para:

```text
docs/agents/ENVIRONMENT_PLAYBOOK.md
```

---

# 24. Critérios para aceitar a reorganização

A reorganização é considerada bem-sucedida quando:

- [ ] Claude Code e Codex usam a mesma fonte de verdade;
- [ ] `AGENTS.md` raiz é curto;
- [ ] regras específicas ficam próximas do código correspondente;
- [ ] documentação histórica não compete com estado atual;
- [ ] conflitos possuem regra formal;
- [ ] PHI/PII possui política explícita;
- [ ] mudanças são classificadas por risco;
- [ ] gates são proporcionais ao risco;
- [ ] dois agentes conseguem trabalhar em paralelo sem conflito;
- [ ] incidentes históricos permanecem acessíveis sem poluir todo contexto;
- [ ] regras críticas começam a migrar de texto para automação.

---

# 25. Ordem sugerida de execução

```text
1. Criar CLAUDE.md
2. Criar docs/agents/
3. Criar SOURCE_OF_TRUTH.md
4. Criar VALIDATION_MATRIX.md
5. Criar SAFETY_GATES.md
6. Criar CONCURRENCY.md
7. Criar LESSONS_LEARNED.md
8. Criar AGENTS.md por pacote
9. Reduzir AGENTS.md raiz
10. Marcar documentação antiga/histórica
11. Corrigir divergências arquiteturais conhecidas
12. Criar validações automáticas da documentação
```

---

# 26. Regra final

A reorganização não deve apagar conhecimento útil.

Ela deve mudar o modelo de:

```text
um arquivo enorme que o agente precisa lembrar
```

para:

```text
um mapa pequeno
+
documentação especializada
+
gates automatizados
+
evidência verificável
```

Esse modelo é mais adequado para um projeto que utiliza múltiplos agentes de programação e possui dados clínicos, multi-tenancy e infraestrutura de produção.
