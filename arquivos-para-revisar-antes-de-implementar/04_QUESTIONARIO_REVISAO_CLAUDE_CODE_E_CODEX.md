# OctaClin — Questionário Detalhado para Revisão Independente por Claude Code e Codex

> **Objetivo:** fazer Claude Code e Codex revisarem de forma independente toda a proposta de governança, arquivos de agentes, segurança, GitHub, automação e repositórios externos **antes de qualquer implementação**.  
> **Importante:** não implementar, não editar e não criar arquivos durante esta revisão, salvo se o usuário pedir posteriormente.

---

# 1. Instrução principal para o agente revisor

Você está atuando como **revisor adversarial e arquiteto do OctaClin**.

Não tente concordar com os documentos.

Sua missão é encontrar:

- regra errada;
- regra perdida;
- regra duplicada;
- regra obsoleta;
- arquivo desnecessário;
- responsabilidade no arquivo errado;
- conflito com código real;
- conflito com CI real;
- conflito com deploy real;
- conflito com GitHub real;
- conflito com seu próprio mecanismo de instruções;
- risco de segurança;
- risco de PHI/PII;
- risco de cross-tenant;
- burocracia sem benefício;
- automação possível;
- automação perigosa;
- oportunidade de simplificação.

Antes de responder, confronte as propostas com o repositório real.

---

# 2. Resultado obrigatório

Para **cada arquivo/proposta**, responda:

```md
## <arquivo/proposta>

### Status recomendado
GO / GO COM AJUSTES / ADIAR / NO-GO

### O que está correto
...

### O que está incorreto
...

### O que está faltando
...

### O que é redundante
...

### Conflitos com o repositório real
...

### Riscos
...

### Alterações propostas
...

### Pode ser automatizado?
...

### Dependências para implementar
...

### Prioridade
P0 / P1 / P2 / NÃO IMPLEMENTAR
```

---

# 3. Perguntas transversais — responder antes de revisar arquivo por arquivo

1. Qual é a fase atual real do projeto?
2. Qual documento é hoje tratado de fato como fonte de verdade do estado?
3. Existem documentos que afirmam fases/arquiteturas conflitantes?
4. Quais documentos são claramente históricos mas não estão marcados como históricos?
5. Quais instruções do `AGENTS.md` atual seriam perdidas na proposta?
6. Quais instruções atuais são obsoletas?
7. Quais instruções atuais são demasiado específicas para ficar na raiz?
8. Quais regras atuais deveriam virar teste ou CI?
9. Há regras atuais que se contradizem?
10. Há paths/pacotes que a proposta pressupõe mas não existem?
11. Há comandos propostos que não existem no `package.json`?
12. Há nomenclaturas de roles incorretas ou desatualizadas?
13. Há regras de produção que divergem do estado/configuração real?
14. Há arquitetura descrita que já foi substituída?
15. Há risco de uma nova documentação virar segunda fonte de verdade?
16. A quantidade proposta de documentação é proporcional ao tamanho/equipe atual?
17. O que pode ser simplificado sem perder proteção?
18. O que deveria obrigatoriamente ser automatizado?
19. O que não deve ser automatizado?
20. Qual a maior lacuna de governança que os documentos ainda não cobrem?

---

# 4. Revisão do `01_GOVERNANCA_AGENTES_E_REGRAS.md`

Perguntas:

1. O diagnóstico do `AGENTS.md` atual é correto?
2. O arquivo realmente está grande o suficiente para prejudicar aderência do seu agente?
3. Quais seções dele devem permanecer obrigatoriamente no root?
4. Quais devem ser deslocadas?
5. A meta de ~100–150 linhas faz sentido no OctaClin ou é artificial?
6. Qual tamanho seria mais adequado?
7. O conceito de “mapa, não manual” melhora seu comportamento no projeto?
8. A hierarquia de fontes proposta corresponde à realidade?
9. Código deve sempre vencer ADR? Em quais situações não?
10. Ambiente real deve vencer runbook para diagnóstico? Como registrar a divergência?
11. O modelo R0–R5 é útil?
12. Existem classes de risco faltantes?
13. R4/R5 estão amplos demais?
14. Existem tarefas de migration que seriam R3?
15. Existem mudanças de docs que podem ser R4?
16. A Definition of Done proposta é suficiente?
17. Ela cria checklist demais?
18. Quais itens deveriam ser verificáveis automaticamente?
19. A política de branch/worktree está adequada?
20. O que manter da política antiga de push para `main`?
21. O documento diferencia corretamente governança e operação?
22. Existe conteúdo que deveria virar ADR?
23. Existe conteúdo que deveria virar `SECURITY.md`?
24. Existe conteúdo que deveria permanecer no `AGENTS.md`?
25. Há qualquer recomendação incompatível com seu mecanismo real de instruções?

### Perguntas específicas para Claude Code

26. O desenho `CLAUDE.md → @AGENTS.md` é suportado e adequado no fluxo atual?
27. Há caveats no import?
28. Como nested `CLAUDE.md` realmente é carregado?
29. Há risco de instruções aninhadas não entrarem quando esperamos?
30. `.claude/rules/` seria melhor que nested `CLAUDE.md` em algum caso?

### Perguntas específicas para Codex

31. Como o Codex atual agrega `AGENTS.md` raiz + aninhados?
32. Existe limite de tamanho relevante?
33. O novo `AGENTS.md` de ~7–8 KiB está adequado?
34. Há risco de regras em `docs/agents/` não serem lidas se o `AGENTS.md` apenas apontar para elas?
35. Quais regras precisam obrigatoriamente estar inline no `AGENTS.md` para máxima aderência?

---

# 5. Revisão de `proposta_arquitetura/AGENTS.md`

1. O arquivo está curto o suficiente?
2. Está longo demais?
3. Está curto demais e perdeu conhecimento?
4. A ordem de leitura inicial é realista?
5. Obrigar leitura de muitos arquivos em toda tarefa aumentará custo/contexto?
6. Quais leituras devem ser condicionais?
7. Quais documentos listados não existem?
8. `RESUMO_FASES_CONCLUIDAS.md` deveria ser lido em toda tarefa?
9. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` deveria ser lido sempre?
10. A fase atual deve aparecer no root ou nunca?
11. A regra “não manter números mutáveis” deve ter exceções?
12. As regras absolutas refletem a arquitetura real?
13. Tenant realmente é sempre derivado da identidade autenticada?
14. Há fluxos públicos em que tenant é resolvido por outro mecanismo?
15. `requisitarBackendAutenticado` é realmente fronteira única em todos os casos?
16. A regra de arquivamento lógico tem exceções legais/técnicas?
17. Os papéis deveriam aparecer aqui?
18. Os papéis deveriam ficar no AGENTS de backend/web?
19. A classificação R0–R5 deveria estar inline ou só linkada?
20. O TDD obrigatório é adequado para todas as features?
21. Quais exceções deveriam ser formalizadas?
22. Os comandos listados existem?
23. Existem gates relevantes omitidos?
24. `pnpm security:secrets` deve rodar antes de todo fechamento?
25. As migrations estão tratadas com rigor suficiente?
26. Falta mencionar registro explícito em `opcoes-typeorm.ts`?
27. Falta mencionar entidades/módulos?
28. A seção produção possui gates suficientes?
29. A política Git está suficientemente clara?
30. A Definition of Done tem itens redundantes?
31. Há algo do `AGENTS.md` atual que precisa voltar para este arquivo?
32. Há algo neste arquivo que deveria ser removido e ficar em docs especializados?
33. O arquivo é determinístico ou contém linguagem ambígua?
34. Alguma regra pode produzir decisões perigosas pelo agente?
35. Qual versão final você recomendaria em linhas/seções?

---

# 6. Revisão de `proposta_arquitetura/CLAUDE.md`

## Para Claude Code

1. `@AGENTS.md` funciona exatamente como esperado?
2. O import é relativo ao arquivo?
3. O root `CLAUDE.md` deveria conter algo além do import?
4. As regras adicionais propostas são necessárias?
5. Elas duplicam o AGENTS?
6. “procure AGENTS mais próximo” é algo que Claude deve fazer manualmente ou nested CLAUDE deve importar automaticamente?
7. Devemos criar nested `CLAUDE.md`?
8. Devemos usar `.claude/rules/` no lugar?
9. Há risco de recursion/import estranho?
10. Há recomendação oficial melhor?

## Para Codex

11. O arquivo é irrelevante para você?
12. Sua presença pode confundir alguma automação?
13. Vale manter apenas para Claude?
14. Deve existir uma regra dizendo que `CLAUDE.md` nunca vence `AGENTS.md`?
15. O Codex deve revisar alterações em `CLAUDE.md` mesmo não o utilizando?

---

# 7. Revisão de `SOURCE_OF_TRUTH.md`

1. A precedência está correta?
2. Código/configuração “em uso” é fácil de provar?
3. Como diferenciar código morto de código efetivamente em uso?
4. Ambiente real deve ficar acima da documentação quando a questão é intenção arquitetural?
5. `RESUMO_FASES_CONCLUIDAS.md` deveria estar acima de ADR?
6. `CHECKLIST` deveria estar acima de ADR?
7. Como tratar feature flag?
8. Como tratar config que está errada em produção mas diverge do runbook?
9. A regra de conflito é suficientemente fail-closed?
10. Quem deve atualizar a documentação canônica?
11. Devemos impedir que um agente “corrija documentação” quando talvez o código esteja errado?
12. Quais fontes adicionais existem no repo?
13. GitHub Actions/workflow deveria aparecer na hierarquia?
14. IaC/deploy config deveria aparecer?
15. Schema real do banco deveria aparecer?
16. OpenAPI/contratos deveriam aparecer?
17. Existem generated files que não devem ser fonte?
18. O status `SUPERSEDED` é suficiente?
19. Precisamos de `DRAFT`, `DEPRECATED`, `ARCHIVED`?
20. “Última revisão” ajuda ou tende a ficar falsa?
21. O validador de docs sugerido é viável?
22. O que ele pode validar sem fingir que conhece a verdade semântica?
23. Há risco de código vencer uma decisão de segurança que deveria bloquear o código?
24. Como formular a precedência para evitar isso?
25. Qual texto exato você mudaria?

---

# 8. Revisão de `SAFETY_GATES.md`

1. Quais itens realmente exigem autorização explícita?
2. Quais já são autorizados pela fase?
3. Existe risco de o agente ficar pedindo confirmação demais?
4. Existe risco inverso de ele interpretar autorização ampla demais?
5. A política de PHI/PII está correta?
6. Existem dados internos não clínicos que também precisam restrição?
7. Como lidar com dados fictícios porém realistas?
8. Como garantir que fixtures não vieram de produção?
9. O secrets gate atual cobre untracked?
10. O secrets gate deve rodar em PR?
11. O modelo de tenancy está correto?
12. Existem jobs sem tenant por design?
13. Existem ações SuperAdmin que atravessam tenants?
14. Como devem ser auditadas?
15. Os testes mínimos de RLS estão completos?
16. O projeto usa `FORCE ROW LEVEL SECURITY` onde esperado?
17. Há cenários de owner/bypass que testes precisam contemplar?
18. Auth deve testar CSRF/Origin?
19. Precisa testar Fetch Metadata?
20. Crypto possui regras específicas não representadas?
21. Rotação de chaves está contemplada?
22. Blind index está contemplado?
23. Integrações externas precisam de data classification?
24. Webhooks precisam de replay protection além de assinatura?
25. IA clínica possui limites adequadamente definidos?
26. Há IA não clínica que deveria ter política diferente?
27. Produção precisa de aprovação humana sempre?
28. Quais operações são R5 de verdade?
29. O fail-closed está aplicado corretamente?
30. Onde fail-open é necessário por disponibilidade?
31. Quais gates podem ser automatizados?
32. Quais precisam continuar humanos?
33. Há requisitos de LGPD não contemplados?
34. Há requisitos de consentimento faltantes?
35. Qual ameaça mais relevante do OctaClin não aparece aqui?

---

# 9. Revisão de `VALIDATION_MATRIX.md`

1. R0–R5 é granular o suficiente?
2. R0 e R1 poderiam ser combinados?
3. R4/R5 deveriam ser chamados de “critical/security” em vez de número?
4. Como classificar mudança que toca múltiplas áreas?
5. Deve valer o maior risco?
6. Quais gates reais do repo faltam?
7. Quais comandos listados não existem?
8. Qual gate é caro demais para ser default?
9. Qual gate é barato e deveria rodar sempre?
10. Build web deve rodar em R2?
11. Backend build existe/deve entrar?
12. Mobile precisa de matriz própria?
13. AI service precisa de matriz própria?
14. Quais testes de contratos existem?
15. Quais testes de secrets existem?
16. Quais testes de backup/restore existem?
17. Quais smokes de produção existem?
18. Quais workflows GitHub devem ser considerados evidência?
19. Como classificar migration aditiva sem data migration?
20. Como classificar backfill?
21. Como classificar alteração de index?
22. Como classificar schema constraint?
23. Como classificar UI de prontuário sem API?
24. Como classificar microcopy de consentimento/legal?
25. Como classificar dependência npm com CVE?
26. O formato PASS/NÃO EXECUTADO é suficiente?
27. Precisamos registrar FAIL?
28. Precisamos registrar “não aplicável” separado de “não executado”?
29. Como evitar que o agente escolha risco menor para poupar gates?
30. `change-risk.yml` poderia resolver isso?
31. Quais gates podem rodar em paralelo?
32. Quais devem ser sequenciais?
33. Devemos ter tempo-alvo de CI?
34. Quais gates devem bloquear merge?
35. Qual matriz final você recomenda?

---

# 10. Revisão de `CONCURRENCY.md`

1. O fluxo atual realmente tem Claude e Codex simultâneos?
2. Worktree é a melhor unidade de isolamento?
3. Branch apenas já basta?
4. Quais paths não podem ter dois escritores?
5. A lista proposta corresponde aos paths reais?
6. Devemos proibir dois agentes no mesmo pacote?
7. Ou apenas no mesmo domínio?
8. Como reservar escopo?
9. `.ai/ACTIVE_WORK.md` é confiável?
10. Issue/draft PR seria melhor?
11. É possível automatizar locks de trabalho?
12. O custo seria maior que o benefício?
13. Review cruzado Claude↔Codex faz sentido?
14. Há tarefas onde ambos compartilham o mesmo ponto cego?
15. Quando review humano é obrigatório?
16. Um agente pode revisar seu próprio trabalho em R2/R3?
17. R4 sempre deve ter outro agente?
18. O que fazer se só um agente estiver disponível?
19. Como fazer handoff sem criar documentação excessiva?
20. O template de handoff é longo demais?
21. Quais campos são realmente necessários?
22. Como resolver conflito de fase/checklist?
23. Quem deve fazer fechamento documental?
24. Dependabot está tratado corretamente?
25. Lockfile concorrente está tratado corretamente?
26. Devemos proibir force push totalmente?
27. Existem casos de rebase/force-with-lease legítimos?
28. Como ruleset muda esse documento?
29. Se todo trabalho virar PR, o documento simplifica?
30. Qual modelo de concorrência você implementaria hoje?

---

# 11. Revisão de `LESSONS_LEARNED.md`

1. Todas as lições importantes do AGENTS atual foram preservadas?
2. Alguma foi resumida demais e perdeu o detalhe necessário?
3. Alguma contém estado já obsoleto?
4. Alguma contém identificadores/configuração que não deveriam permanecer?
5. Alguma deveria virar `ENVIRONMENT_PLAYBOOK`?
6. Alguma deveria virar `PRODUCTION_INVARIANTS`?
7. Alguma deveria virar teste?
8. Alguma deveria virar workflow?
9. Alguma deveria virar Semgrep?
10. Alguma deveria virar script?
11. O documento está grande demais?
12. Precisamos separar por categoria?
13. Produção/migration?
14. CI/dependencies?
15. shell/tooling?
16. frontend/testing?
17. O formato de novos incidentes é bom?
18. Registrar todo erro pequeno criará ruído?
19. Qual limiar deve existir para entrar em Lessons Learned?
20. “custo” é campo útil?
21. Deveria existir link para PR/incidente?
22. Deveria existir `status: automated/manual`?
23. Quando uma regra vira gate, a lesson deve permanecer?
24. Devemos registrar data?
25. Devemos registrar owner?
26. O arquivo deve ser leitura obrigatória só para tarefas específicas?
27. Quais?
28. Há conteúdo sensível nele?
29. Quais itens podem ser removidos do root AGENTS com segurança porque agora estão aqui?
30. O que ainda falta migrar do AGENTS atual?

---

# 12. Revisão de `ENVIRONMENT_PLAYBOOK.md`

1. Quais quirks ainda são atuais?
2. Quais eram específicos de uma máquina/sessão antiga?
3. O ambiente Claude difere do ambiente Codex?
4. Devemos separar instruções por agente?
5. CRLF ainda é problema real?
6. Qual arquivo/teste tem exceção conhecida?
7. Devemos documentar exceção específica ou corrigir a causa?
8. `python3` realmente não existe em todos os ambientes relevantes?
9. Devemos evitar afirmações globais sobre runtime?
10. `node -e` deve ser desencorajado sempre ou apenas em casos complexos?
11. `sed` deve ser desencorajado?
12. Existe PowerShell no fluxo atual?
13. Existe Git Bash?
14. O prefixo `!` é específico demais para ficar em repo?
15. PTY continua um problema?
16. Portas 3000/3010 são fixas?
17. Devemos ter script de cleanup?
18. Lockfile precisa de orientação específica de versão de pnpm?
19. Devemos usar Corepack?
20. `packageManager` define versão?
21. O playbook deve conter comandos copiáveis?
22. Como impedir que um comando envelhecido permaneça?
23. O documento pode ser reduzido?
24. Quais regras são universais e quais são históricas?
25. Alguma regra deve virar script em vez de texto?

---

# 13. Revisão do `README.md` de `docs/agents`

1. A taxonomia faz sentido?
2. Algum arquivo está na categoria errada?
3. Falta algum link?
4. Deveria incluir ordem de leitura?
5. Deveria incluir “quando ler” por documento?
6. Precisamos de owner/status?
7. Está duplicando o AGENTS?
8. É útil ou dispensável?
9. Deve listar future docs como `DATA_CLASSIFICATION`?
10. Deve apontar para governance e architecture?

---

# 14. `AGENTS.md` do backend — perguntas antes de criar

1. Quais diretórios reais formam o backend?
2. Qual é a arquitetura modular real?
3. Como tenant é propagado?
4. Onde `ExecutorTenant` vive?
5. Existem exceções legítimas?
6. Quais guards são canônicos?
7. Como roles/permissions são implementados?
8. Onde RLS é configurado?
9. Onde migrations são registradas?
10. Onde entities são registradas?
11. Onde modules/providers são registrados?
12. Quais padrões de DTO são obrigatórios?
13. Como validação de input funciona?
14. Como erros são mapeados?
15. Como auditoria funciona?
16. Quais campos são criptografados?
17. Como blind indexes são usados?
18. Como queues/jobs preservam tenant?
19. Qual é o modelo de idempotência?
20. Como distributed locks funcionam?
21. Qual é a estratégia de worker atual?
22. Quais integrações externas pertencem ao backend?
23. Quais não devem ser chamadas diretamente?
24. Quais comandos de testes são canônicos?
25. Quais testes são obrigatórios em RLS?
26. Quais arquivos críticos deveriam ser declarados?
27. Há convenções de nome em português?
28. Há `any` proibido?
29. Há imports específicos devido a tsconfig?
30. Quais regras hoje estão no root e deveriam morar aqui?
31. Quais regras não devem entrar aqui?
32. Qual seria o tamanho alvo?
33. Nested AGENTS funcionará no Codex como esperado?
34. Claude precisará de nested CLAUDE?
35. Que regra backend é tão crítica que ainda deve ser repetida no root?

---

# 15. `AGENTS.md` da web — perguntas antes de criar

1. Qual fronteira BFF é canônica?
2. `requisitarBackendAutenticado` cobre todos os authenticated requests?
3. Quais exceções existem?
4. Como sessão/cookies são tratados?
5. Qual política de Origin/Fetch Metadata existe?
6. Como authz de UI funciona?
7. `lib/navegacao-console.ts` continua canônico?
8. Quais roles/permissions são representadas?
9. Como APIs dinâmicas Next 16 são tratadas?
10. O gate `test:apis-dinamicas` existe e é atual?
11. Quais regras Server/Client Components existem?
12. Qual política de cache?
13. Qual política de erro?
14. Como PWA/offline funciona?
15. Onde IndexedDB criptografada entra?
16. Quais fluxos possuem E2E?
17. Quais são alto risco?
18. Qual teste a11y existe?
19. axe-core já está parcialmente presente?
20. Qual navegador/viewport é canônico?
21. Quais patterns de loading/empty/error são obrigatórios?
22. Há design system?
23. Quais imports/components são canônicos?
24. Quais rotas públicas têm regras diferentes?
25. Quais dados nunca devem ficar no client?
26. Quais logs client-side são proibidos?
27. O AGENTS deve mencionar microcopy/language?
28. Deve mencionar Fase 251 ou fonte canônica em vez da fase?
29. O que deve sair do root AGENTS?
30. Qual seria o tamanho alvo?

---

# 16. `AGENTS.md` do Mobile — perguntas antes de criar

1. O Mobile continua NO-GO?
2. Qual é a razão atual?
3. `mobile.sync=false` continua verdade?
4. Onde essa configuração vive?
5. Expo 57 continua versão atual?
6. Quais advisories permanecem?
7. Quais gates faltam para distribuição?
8. Quais funcionalidades existem?
9. O Mobile manipula PHI/PII?
10. Como armazenamento local é protegido?
11. Existe sync?
12. Existe offline?
13. Existe autenticação?
14. Que dados podem ficar no dispositivo?
15. Que dados não podem?
16. Como logs mobile funcionam?
17. Crash reporting existe?
18. Distribution deve exigir aprovação explícita?
19. Quem pode alterar `mobile.sync`?
20. Quais testes existem?
21. Quais comandos existem?
22. Há EAS?
23. Há credentials/certificados?
24. Como evitar que agente publique acidentalmente?
25. O que root AGENTS precisa repetir sobre NO-GO?
26. Quando remover essa regra?
27. Qual documento será fonte do status de distribuição?
28. O AGENTS deve conter estado mutável NO-GO ou apontar para fonte?
29. Como evitar stale status?
30. Qual versão final você recomenda?

---

# 17. `AGENTS.md` do AI service — perguntas antes de criar

1. O serviço está ativo em produção?
2. Está feature-flagged?
3. Quais endpoints existem?
4. Que dados recebe?
5. Recebe PHI/PII?
6. Qual provedor/modelo utiliza?
7. Há revisão humana?
8. O que a IA pode produzir?
9. O que não pode produzir?
10. Há decisão clínica autônoma?
11. Quais fallbacks?
12. Quais timeouts?
13. Quais retries?
14. Como logs são sanitizados?
15. Como prompts são armazenados?
16. Existe retenção?
17. Existe auditoria?
18. Existe versionamento de prompt?
19. Existe avaliação/evals?
20. Como feature flags são controladas?
21. Há chamadas externas?
22. Quais secrets?
23. Qual contrato com backend?
24. Quais testes?
25. Que comportamento deve ser fail-closed?
26. Quais riscos de prompt injection existem?
27. Quais dados nunca podem sair?
28. `DATA_CLASSIFICATION.md` deve ser prerequisito?
29. `THREAT_MODEL.md` deve cobrir esse serviço?
30. Qual regra precisa ficar também no root?

---

# 18. Nested `CLAUDE.md` por pacote

## Para Claude

1. Você recomenda nested CLAUDE importando AGENTS?
2. Como o loading funciona em prática?
3. Ele carrega quando arquivo do subdir é lido ou apenas cwd?
4. Se root CLAUDE já importa root AGENTS, nested CLAUDE deve importar apenas nested AGENTS?
5. Há risco de root ser importado novamente?
6. Qual estrutura exata minimiza duplicação?
7. `.claude/rules` seria mais apropriado?
8. Como testar carregamento?
9. `InstructionsLoaded` ajuda?
10. Devemos versionar todos os nested CLAUDE?

## Para Codex

11. Esses arquivos não impactam seu carregamento?
12. Você recomenda revisar consistência entre nested CLAUDE e AGENTS?
13. Há algum arquivo que possa ser compartilhado de forma melhor?

---

# 19. `.claude/rules/`

## Para Claude

1. Há uma necessidade real?
2. Qual regra seria melhor em path-scoped rule que AGENTS?
3. Quais regras são Claude-specific?
4. Como paths funcionam?
5. Qual precedence?
6. Como conflito com CLAUDE é resolvido?
7. Como auditar o que carregou?
8. Quanto isso aumenta contexto?
9. Quais hooks podem observar?
10. Você recomenda não usar inicialmente?

## Para Codex

11. `.claude/rules` cria assimetria perigosa?
12. Que regra importante jamais deveria existir somente ali?
13. Como manter equivalência de segurança?

---

# 20. `CODEOWNERS`

1. Quais paths críticos reais existem?
2. Quais usuários/times podem ser owners?
3. O repo tem organização/time configurado?
4. CODEOWNERS funciona no plano atual?
5. Quem revisará se o usuário estiver sozinho?
6. Devemos usar owner único?
7. Isso criará bloqueio de merges?
8. Como proteger o próprio CODEOWNERS?
9. Quais arquivos de governança devem ser protegidos?
10. `.github/workflows`?
11. migrations?
12. auth?
13. crypto?
14. deploy?
15. scripts de produção?
16. package manager/lockfiles?
17. `SECURITY.md`?
18. `change-risk.yml`?
19. Como combinar com ruleset?
20. GO/NO-GO?

---

# 21. Ruleset de `main`

1. Qual proteção existe hoje?
2. Branch protection ou ruleset já existe?
3. Quais checks são required?
4. Quais deveriam ser?
5. Force push está bloqueado?
6. Delete branch?
7. Require PR?
8. Require review?
9. Require code owner?
10. Require conversation resolution?
11. Require signed commits é necessário?
12. Require linear history?
13. Merge commit/squash/rebase?
14. Qual estratégia melhor para fases?
15. Administrador deve ter bypass?
16. Claude/Codex possuem bypass?
17. Devem possuir?
18. Push direto R0/R1 ainda faz sentido?
19. O custo de PR para docs é relevante?
20. Como Dependabot trabalha com o ruleset?
21. Workflows automáticos quebrariam?
22. Release/deploy depende de push direto?
23. Qual risco de lockout?
24. Como testar ruleset antes?
25. Recomendação final: A ou B?

---

# 22. `PULL_REQUEST_TEMPLATE.md`

1. Já existe template?
2. Existe mais de um?
3. O template proposto está longo?
4. Quais campos são essenciais?
5. “Agente autor” é útil?
6. Pode gerar vergonha/ruído ou é operacional?
7. Fase deve ser obrigatória?
8. Risco deve ser checkbox?
9. Risco deveria ser calculado por CI?
10. Teste RED deve aparecer em todo PR?
11. R0/R1 precisam disso?
12. Como deixar seções condicionais?
13. Migration deve ter checklist próprio?
14. Segurança deve ter checklist próprio?
15. Rollback deve ser obrigatório só R4/R5?
16. Gates não executados devem ser explicitados?
17. Review independente deve ser checkbox?
18. Como evitar checkbox performativo?
19. Pode ser gerado automaticamente?
20. Qual template final você recomenda?

---

# 23. `config/change-risk.yml`

1. A ideia é útil?
2. Paths refletem risco de forma suficiente?
3. Quais paths reais seriam R4?
4. Quais seriam R5?
5. Existem arquivos que mudam de risco conforme conteúdo?
6. Migration sempre R4?
7. Workflow sempre R4?
8. Docs de security sempre R4?
9. Lockfile sempre R3?
10. `package.json` pode ser R4?
11. Como tratar rename?
12. Como tratar generated files?
13. Como tratar deleted file?
14. Como tratar múltiplos paths?
15. Maior risco vence?
16. Devemos permitir override manual?
17. Quem pode override?
18. Override exige justificativa?
19. Script deve bloquear ou apenas recomendar?
20. CI deve bloquear?
21. Como testar matcher?
22. Qual biblioteca usar?
23. Podemos fazer sem nova dependência?
24. Como manter arquivo atualizado?
25. Vale a complexidade?

---

# 24. `.ai/ACTIVE_WORK.md`

1. Precisamos disso?
2. Branches/PRs já resolvem?
3. GitHub Project resolveria melhor?
4. O arquivo ficará stale?
5. Como limpar automaticamente?
6. Agente deve editar ao começar?
7. E se dois começam simultaneamente?
8. Merge conflitante no próprio ACTIVE_WORK?
9. Deve ser versionado?
10. `.gitignore`?
11. Existe melhor mecanismo?
12. Pode ser um issue?
13. Pode ser comentário em PR?
14. Pode ser lock local por worktree?
15. Recomendação final?

---

# 25. `EXTERNAL_REPOSITORY_REVIEW.md`

1. O template cobre todas as decisões?
2. Falta manutenção/comunidade?
3. Falta versão/runtime?
4. Falta CVE/advisory?
5. Falta bus factor?
6. Falta cadence de release?
7. Falta custo?
8. Falta lock-in?
9. Falta data residency?
10. Falta licença de dados?
11. Falta política de telemetry?
12. Falta update strategy?
13. Falta uninstall/exit strategy?
14. PoC deve ter limite temporal?
15. Devemos exigir ADR para GO?
16. Onde salvar avaliações preenchidas?
17. `docs/reviews/third-party/`?
18. Como marcar reavaliação?
19. Quanto detalhe é suficiente?
20. Ajustes recomendados?

---

# 26. ADRs

1. `DECISOES_ARQUITETURA.md` atual é suficiente?
2. Está grande?
3. Possui decisões superseded misturadas?
4. Quais deveriam virar ADR imediatamente?
5. Devemos migrar histórico?
6. Ou apenas novas decisões?
7. Qual numeração?
8. Qual template?
9. Quem pode marcar superseded?
10. Como linkar ADRs?
11. AGENTS deve apontar para índice?
12. Precisamos `docs/adr/README.md`?
13. ADR de source of truth?
14. ADR de agenda?
15. ADR de storage?
16. ADR de worker?
17. ADR de AI?
18. ADR de FHIR futuro?
19. Isso adiciona burocracia?
20. GO/ADIAR?

---

# 27. `SECURITY.md`

1. Já existe?
2. O repositório é público?
3. Qual canal real de security report está disponível?
4. GitHub Private Vulnerability Reporting está habilitado?
5. Devemos habilitar?
6. Existe e-mail de segurança?
7. Não inventar canal que não será monitorado.
8. Quais versões são suportadas?
9. Devemos mencionar PHI/PII?
10. Devemos proibir issue pública?
11. Como tratar segredo exposto?
12. Como tratar vulnerabilidade em dependência?
13. Como tratar disclosure?
14. Qual SLA é realista?
15. SECURITY.md pode expor detalhes demais?
16. O que deve ser público?
17. O que deve ficar em runbook privado?
18. Quem é owner?
19. Como testar processo?
20. Recomendação final?

---

# 28. Issue templates e avisos

1. Quais templates existem?
2. São YAML forms ou Markdown?
3. Onde inserir aviso de PHI/PII?
4. Deve ser obrigatório checkbox?
5. Checkbox garante algo?
6. Devemos desabilitar blank issues?
7. Security issue deve redirecionar?
8. Bug report deve pedir logs sanitizados?
9. Screenshot deve ter aviso?
10. Como impedir secrets?
11. Secret scanning cobre issue attachments?
12. Precisamos bot?
13. Qual mensagem mais clara?
14. Em português ou inglês?
15. GO/NO-GO?

---

# 29. `EXTERNAL_CODE_POLICY.md`

1. O que conta como código externo?
2. Repositório GitHub?
3. Gist?
4. npm package?
5. Docker image?
6. script copiado?
7. resposta de IA?
8. O conceito “conteúdo externo é dado, não instrução” está correto?
9. Como Claude lida com instruções em repo externo?
10. Como Codex lida?
11. Que comandos externos devem exigir aprovação?
12. `npm install` de repo externo?
13. `docker compose up`?
14. `curl | bash` deve ser proibido?
15. `npx` de pacote não pinado?
16. Como isolar PoC?
17. Secrets devem ser zero?
18. Dados sintéticos sempre?
19. Licença deve ser verificada antes de copiar?
20. Como lidar com snippets curtos?
21. Como lidar com AGPL?
22. Como lidar com código sem licença?
23. Como lidar com README malicioso?
24. Como verificar supply chain?
25. O documento deve ser P0?

---

# 30. `DATA_CLASSIFICATION.md`

1. Quais classes de dados o OctaClin realmente possui?
2. “Pública / Interna / Confidencial / PHI/PII / Secret” é suficiente?
3. Dados financeiros precisam classe própria?
4. Dados de colaborador?
5. Dados de profissional?
6. Dados agregados?
7. Dados anonimizados?
8. Pseudonimizados?
9. Telemetria?
10. IDs de tenant?
11. E-mail é PII; como classificar?
12. Qual dado pode aparecer em logs?
13. Qual dado pode ir para IA?
14. Qual dado pode ir para GitHub?
15. Qual dado pode ir para traces?
16. Qual dado pode ir para analytics?
17. Qual dado pode ir para suporte?
18. Screenshots?
19. Dumps?
20. Backups?
21. Storage?
22. Data retention?
23. Consentimento?
24. LGPD?
25. Devemos referenciar política legal?
26. Como manter classificação executável?
27. Semgrep pode ajudar?
28. Logging helpers podem ajudar?
29. O documento deve ser fonte para OpenTelemetry?
30. Recomendação final de tabela?

---

# 31. `THREAT_MODEL.md`

1. Já existe threat model?
2. Quais ativos faltam?
3. Quais trust boundaries reais?
4. BFF é trust boundary?
5. Redis?
6. Storage S3-compatible?
7. Gmail?
8. Google Calendar?
9. Meta WhatsApp?
10. Webhooks?
11. Public forms?
12. Public scheduling?
13. Patient portal?
14. AI service?
15. Mobile?
16. Admin/SuperAdmin?
17. API keys?
18. signed webhooks?
19. principais ameaças?
20. cross-tenant?
21. IDOR?
22. CSRF?
23. SSRF?
24. webhook forgery/replay?
25. queue poisoning?
26. OAuth token leakage?
27. object storage leakage?
28. prompt injection?
29. supply chain?
30. insider/admin misuse?
31. backup exposure?
32. logs?
33. Qual metodologia usar? STRIDE leve?
34. Precisamos modelar tudo agora?
35. Qual escopo mínimo de alto valor?

---

# 32. `THIRD_PARTY_POLICY.md`

1. O projeto já possui licença policy?
2. Quais licenças são permitidas?
3. AGPL é aceitável em serviço separado?
4. E copiar código AGPL?
5. E usar API de software AGPL hospedado por nós?
6. Precisa revisão jurídica?
7. Quem decide?
8. Licença de dados deve ser separada?
9. Open Food Facts?
10. Mealie?
11. OpenObserve?
12. Medplum?
13. Devemos exigir SBOM?
14. Devemos exigir maintenance score?
15. Devemos exigir pin/version?
16. Devemos exigir dependabot?
17. Como tratar package abandonado?
18. Como tratar transitive licenses?
19. Trivy pode ajudar?
20. Política agora ou após Trivy?

---

# 33. `PRODUCTION_INVARIANTS.md`

1. Quais invariantes são verdade hoje?
2. Confirmar cada um no ambiente/config real.
3. Runtime DB role não executa DDL?
4. Qual role?
5. `BANCO_EXECUTAR_MIGRACOES` qual estado atual?
6. O runbook corresponde ao painel?
7. Worker dedicado ainda pendente?
8. `OCTACLIN_PROCESSO=all` ainda atual?
9. Escala horizontal ainda proibida?
10. Mobile ainda NO-GO?
11. `mobile.sync=false`?
12. Agenda interna ainda source of truth?
13. Google Calendar ainda efeito recuperável?
14. Notifications idem?
15. Quais outros invariantes existem?
16. Backup?
17. Redis?
18. storage?
19. secret scanning?
20. health checks?
21. Como automatizar sem expor secrets?
22. Onde script roda?
23. Produção pode ser consultada do CI?
24. Devemos manter documento se não automatizar?
25. Quem atualiza quando invariante muda?
26. Deve ser ADR + invariant?
27. Como evitar stale?
28. Qual prioridade?

---

# 34. `agent:preflight`

1. Que problema real resolve?
2. Quais checks são baratos?
3. Quais devem ser offline?
4. Deve acessar GitHub?
5. Deve acessar produção? Provavelmente não por default — confirmar.
6. Deve rodar secret scan?
7. Deve detectar branch?
8. working tree?
9. base commit?
10. risk?
11. active work?
12. instruções?
13. versão Node/pnpm?
14. migrations?
15. Deve apenas informar ou bloquear?
16. Como Claude chama?
17. Como Codex chama?
18. Como humano chama?
19. Quanto tempo alvo?
20. Nova dependência?
21. Cross-platform?
22. Windows/Git Bash?
23. CI também deve rodar?
24. Que partes pertencem a `agent:verify` em vez de preflight?
25. GO/ADIAR?

---

# 35. `agent:verify`

1. Deve ser um meta-runner?
2. Como decide gates?
3. Por path?
4. Por flag de risco?
5. Por package?
6. Pode rodar build/test caro?
7. Deve paralelizar?
8. Deve reproduzir CI?
9. Como evitar divergência local vs CI?
10. Como reportar skipped?
11. Como reportar NA?
12. Deve salvar JSON?
13. PR template pode consumir saída?
14. CI pode consumir saída?
15. É duplicação do GitHub Actions?
16. Melhor reutilizar scripts existentes?
17. Qual MVP?
18. Pode começar apenas como `risk:classify`?
19. Quais riscos de falso verde?
20. GO/ADIAR?

---

# 36. `docs:agents:check`

1. Quais arquivos devem ser obrigatórios?
2. Como validar imports de CLAUDE?
3. Como validar links internos?
4. Como validar status?
5. Como validar ADRs?
6. Como validar tamanho do AGENTS?
7. Deveria falhar por tamanho?
8. Como detectar conteúdo contraditório? Provavelmente não automaticamente.
9. Como detectar fase divergente?
10. Vale a pena?
11. Devemos validar arquivos por JSON schema/frontmatter?
12. Introduzir frontmatter?
13. Markdown lint?
14. Links checker?
15. Nova dependência?
16. CI cost?
17. Cross-platform?
18. Deve ser required check?
19. Qual MVP?
20. GO?

---

# 37. Hooks do Claude Code

## Para Claude

1. Quais hooks estão disponíveis na versão atual?
2. `PreToolUse` é adequado?
3. Pode bloquear force push?
4. Pode bloquear delete destrutivo?
5. Pode chamar script do repo?
6. `TaskCompleted` consegue exigir verificação?
7. Qual risco de loop?
8. `InstructionsLoaded` realmente expõe o que precisamos?
9. Podemos auditar nested instructions?
10. Worktree hooks ajudam?
11. Hooks rodam localmente?
12. São versionados?
13. Como um dev pode bypassar?
14. Qual security model?
15. Um hook mal escrito pode bloquear o Claude?
16. Como testar?
17. Quais 1–3 hooks você recomenda?
18. Quais não recomenda?
19. Como garantir paridade com Codex?
20. ADIAR ou GO?

## Para Codex

21. Quais equivalentes existem no seu fluxo?
22. Se não houver, scripts/CI são melhor fonte compartilhada?
23. Que regra nunca deve ficar só no hook do Claude?

---

# 38. Segurança dos arquivos de instrução

1. `AGENTS.md` deve ser path crítico?
2. `CLAUDE.md`?
3. `.claude/rules/**`?
4. `.claude/hooks`/settings?
5. `docs/agents/**`?
6. `change-risk.yml`?
7. workflows?
8. PR template?
9. CODEOWNERS?
10. SECURITY.md?
11. Mudanças nesses arquivos devem exigir code owner?
12. Review humano?
13. Review cruzado?
14. Required checks?
15. Devemos proibir mudança junto com feature?
16. Ou apenas recomendar commits separados?
17. Como detectar alteração maliciosa?
18. Semgrep/CI pode ajudar?
19. Prompt injection via PR externo é risco?
20. Qual política final?

---

# 39. Revisão de `03_REPOSITORIOS_EXTERNOS_PARA_AVALIACAO.md`

Perguntas globais:

1. A lista está alinhada às lacunas reais?
2. Algum projeto duplicaria algo já existente?
3. Algum projeto importante está faltando?
4. Algum item deveria ser removido?
5. A ordem de prioridade está correta?
6. Quais não deveriam ser analisados antes do piloto?
7. Quais podem aumentar demais o escopo?
8. Há risco de “tool collecting”?
9. O processo GO/NO-GO é rigoroso o suficiente?
10. Devemos exigir PoC antes de ADR?
11. Devemos exigir ADR antes de PoC?
12. Onde salvar avaliações?
13. Quem revisa licença?
14. Quem revisa PHI/PII?
15. Quais podem enviar dados externamente?
16. Quais devem ser self-hosted?
17. Quais podem ser serviço SaaS?
18. Quais exigem Data Processing Agreement?
19. Quais mexem com supply-chain?
20. Quais merecem sandbox?

---

# 40. Trivy

1. O OctaClin já usa alguma SCA além de Dependabot?
2. Secret scanning já cobre o que?
3. Trivy duplicaria?
4. Scan filesystem?
5. Scan image?
6. Scan config?
7. Scan secrets?
8. Licenses?
9. SBOM?
10. CycloneDX ou SPDX?
11. Quais lockfiles?
12. Docker images existem?
13. Quais severidades bloquear?
14. `CRITICAL/HIGH`?
15. CVSS ou exploitability?
16. Como tratar advisory sem patch?
17. Ignore file?
18. Exceção precisa expirar?
19. SARIF?
20. GitHub Security?
21. CI cost?
22. Cache?
23. Local?
24. Mobile?
25. AI Python?
26. Misconfiguration?
27. License scan?
28. Qual PoC mínima?
29. GO/NO-GO?
30. Arquivos exatos que seriam alterados?

---

# 41. Semgrep

1. O repo já usa SAST?
2. CodeQL?
3. ESLint custom?
4. Semgrep duplicaria?
5. Quais 3–5 regras OctaClin têm maior ROI?
6. Tenant header?
7. logs PII?
8. BFF bypass?
9. integrações diretas?
10. crypto?
11. guards?
12. migrations registration?
13. É possível testar regras?
14. Onde versionar?
15. Community Edition basta?
16. Cross-file limitations?
17. SARIF?
18. CI?
19. pre-commit?
20. false positives?
21. suppression?
22. expiração de suppression?
23. Claude plugin/MCP é necessário? Provavelmente não — avaliar.
24. Segurança do próprio scanner?
25. Qual PoC?
26. Deve bloquear PR?
27. Quais regras apenas alertam?
28. GO?
29. Rollback?
30. Manutenção esperada?

---

# 42. OpenTelemetry

1. Há tracing hoje?
2. Há logs estruturados?
3. Há correlation ID?
4. Qual stack observability existe?
5. Onde instrumentar primeiro?
6. Next?
7. Nest?
8. pg?
9. Redis?
10. BullMQ?
11. worker?
12. AI service?
13. outgoing HTTP?
14. Gmail?
15. Google?
16. Meta?
17. storage?
18. Como propagar contexto em jobs?
19. Como impedir PII em attributes?
20. Precisa allowlist de attributes?
21. Sampling?
22. Error traces?
23. Baggage?
24. Tenant ID pode entrar em trace? Avaliar classificação.
25. Patient ID? Provavelmente não — confirmar.
26. Backend local para PoC?
27. OTLP?
28. Overhead?
29. Metrics agora ou só traces?
30. Logs correlation?
31. GO?
32. Momento correto antes/depois do worker?

---

# 43. Testcontainers Node

1. Node atual é compatível?
2. Docker disponível local?
3. Docker disponível GitHub Actions?
4. GitHub hosted runners?
5. Custos?
6. PostgreSQL module?
7. Redis module?
8. Reuse?
9. Parallel tests?
10. Migration from zero?
11. incremental migration?
12. RLS?
13. runtime role?
14. owner role?
15. FORCE RLS?
16. tenant A/B?
17. BullMQ?
18. distributed lock?
19. idempotency?
20. network?
21. flakiness?
22. startup time?
23. CI cache?
24. Windows?
25. Alternative: service containers no Actions?
26. Qual é melhor?
27. PoC mínima?
28. Que teste atual substituiria?
29. GO?
30. Não deve substituir staging — confirmar.

---

# 44. Mealie

1. Qual lacuna real: shopping list?
2. Já existe modelagem parcial?
3. Quais entidades atuais?
4. Recipes?
5. Preparations?
6. ingredients?
7. units?
8. substitutions?
9. weekly plans?
10. O que estudar do Mealie?
11. UX?
12. schema?
13. algorithm?
14. import?
15. shopping categories?
16. Licença AGPL — qual impacto?
17. Não copiar código?
18. Podemos apenas estudar UX/conceitos?
19. Lista de compras deve ser nativa?
20. Como consolidar unidades?
21. Como lidar com equivalências?
22. substituições?
23. porções?
24. desperdício/embalagens?
25. alimentos TACO?
26. produtos Open Food Facts?
27. adesão por refeição é mesma feature ou separada?
28. PoC?
29. GO como referência?
30. GO como dependência? Provavelmente não — analisar.

---

# 45. Open Food Facts

1. Necessidade real de branded foods?
2. Brasil coverage?
3. API limits?
4. Latency?
5. Reliability?
6. Barcode?
7. Nutrients?
8. ingredients?
9. allergens?
10. images?
11. provenance?
12. revision?
13. cache?
14. offline?
15. stale data?
16. crowdsourced confidence?
17. Não garantir ausência de allergen?
18. How to flag unverified?
19. Data license?
20. API license?
21. server code license?
22. ODbL implications?
23. Attribution?
24. Database derivative?
25. Store raw data?
26. Map to internal food model?
27. Source priority TACO vs OFF?
28. Professional override?
29. GO?
30. Qual PoC?

---

# 46. React Email

1. Como e-mails são gerados hoje?
2. Templates existem?
3. Handlebars?
4. HTML manual?
5. Gmail transport?
6. Backend ou web render?
7. React Email adiciona benefício real?
8. Bundle impact?
9. Serverless?
10. Version compatibility?
11. React 18?
12. Next 16?
13. HTML export?
14. Plain text?
15. Preview?
16. Testing?
17. Snapshot?
18. Accessibility?
19. Localization?
20. Branding?
21. Não alterar transport/outbox?
22. Dados sensíveis em e-mail?
23. Link signing?
24. Tracking pixels?
25. GO?
26. Qual primeiro template?
27. Pode ser adiado?
28. Alternativa sem dependência?
29. Manutenção?
30. Licença?

---

# 47. axe-core

1. A11y tests já existem?
2. Quais?
3. `@axe-core/playwright` já está instalado?
4. Se não, compatibilidade?
5. Quais páginas críticas?
6. Auth states?
7. Portal?
8. Prontuário?
9. Agenda?
10. Forms?
11. Plan?
12. False positives?
13. Rule exclusions?
14. Baseline?
15. Bloquear CI?
16. Que severity?
17. Manual review?
18. Keyboard?
19. Screen reader?
20. Color contrast?
21. Dynamic content?
22. Modal?
23. Charts?
24. Mobile?
25. GO?
26. PoC?
27. Dependência?
28. CI time?
29. Relatório?
30. Quando na roadmap?

---

# 48. OpenObserve

1. Observabilidade atual já resolve necessidade?
2. Quando worker dedicado muda isso?
3. Volume atual?
4. Logs/day?
5. Traces/day?
6. Metrics?
7. Self-host infra?
8. Storage?
9. Retention?
10. Backup?
11. HA?
12. Updates?
13. Security?
14. Auth?
15. Multi-tenancy interno?
16. PHI risk?
17. RUM?
18. Session replay deve ser proibido?
19. Data residency?
20. AGPL?
21. SaaS alternative?
22. OTel first?
23. Vendor-neutral instrumentation?
24. Cost?
25. Ops burden?
26. Alerting?
27. Incident integration?
28. GO now?
29. ADIAR?
30. Trigger para reavaliar?

---

# 49. Medplum

1. Existe demanda real de FHIR?
2. Algum cliente/parceiro pediu?
3. Qual FHIR version?
4. R4?
5. Patient mapping?
6. Encounter?
7. Observation?
8. DiagnosticReport?
9. Practitioner?
10. Organization?
11. Consent?
12. Medication?
13. Nutrition resources?
14. Extensions?
15. IDs?
16. Tenant mapping?
17. Adapter layer?
18. Sync?
19. Event?
20. Webhooks?
21. OAuth/SMART?
22. HL7?
23. Não substituir domínio interno?
24. Não substituir auth?
25. Licença Apache?
26. Dependência ou referência?
27. PoC?
28. ADIAR até demanda?
29. Trigger para reavaliar?
30. Qual preparação arquitetural pode ser feita sem Medplum?

---

# 50. Repositórios explicitamente não priorizados

Para Cal.com, Novu, OpenFGA e Trigger.dev/Inngest:

1. A justificativa para não priorizar ainda é válida?
2. A agenda interna já cobre necessidade?
3. Notifications/outbox já cobrem?
4. Authz atual já cobre?
5. BullMQ já cobre?
6. Existe alguma lacuna que mude a decisão?
7. Se não, registrar `NO-GO POR DUPLICAÇÃO`.
8. Qual evento futuro faria reavaliar?
9. Evitar revisitar a cada agente?
10. Vale documentar “not now” como ADR/backlog?

---

# 51. Ordem de implementação

Peça ao agente produzir sua própria ordem, respondendo:

1. O que precisa existir antes de trocar o `AGENTS.md`?
2. O que pode ser adicionado sem alterar comportamento?
3. O que depende de GitHub settings?
4. O que depende de confirmação humana?
5. O que depende de conhecer owners?
6. O que depende de segurança?
7. O que depende de código?
8. O que pode ficar P1?
9. O que deveria ser removido da proposta?
10. Qual menor sequência segura de commits/PRs?

---

# 52. Teste adversarial da proposta

O agente deve tentar construir ao menos 10 cenários nos quais a proposta falharia.

Exemplos:

1. Claude e Codex iniciam a mesma migration.
2. `SOURCE_OF_TRUTH` diz código vence, mas código contém regressão de segurança.
3. `ACTIVE_WORK.md` está stale.
4. `change-risk.yml` não reconhece novo path crítico.
5. nested CLAUDE não foi carregado.
6. agent escolhe R2 para evitar R4.
7. CODEOWNERS owner não está disponível.
8. ruleset bloqueia Dependabot.
9. docs:agents:check fica verde mesmo com instrução semanticamente errada.
10. external repo contém instrução maliciosa.

Para cada cenário:

```md
### Cenário
### Falha
### Impacto
### Controle existente
### Controle faltante
### Mudança recomendada
```

---

# 53. Perguntas finais específicas para Claude Code

1. Quais arquivos você realmente lê automaticamente?
2. Em que ordem?
3. Quais são lazy-loaded?
4. Como nested `CLAUDE.md` funciona?
5. Como imports funcionam?
6. Como `.claude/rules` funciona?
7. Como precedence funciona?
8. Qual tamanho de CLAUDE é saudável?
9. Como você reage a instruções conflitantes?
10. O que tende a ser ignorado?
11. Como hooks podem reforçar?
12. Quais hooks são confiáveis?
13. Como observar `InstructionsLoaded`?
14. Como worktrees se integram?
15. Quais instruções da proposta são redundantes para você?
16. Quais estão ausentes?
17. Que parte você transformaria em hook?
18. Que parte não colocaria em hook?
19. Como garantir que as regras compartilhadas não se tornem Claude-specific?
20. Dê sua arquitetura final recomendada.

---

# 54. Perguntas finais específicas para Codex

1. Quais `AGENTS.md` você lê automaticamente?
2. Qual ordem/precedência?
3. Como nested AGENTS funciona?
4. Qual limite agregado de instruções?
5. O root AGENTS proposto está no tamanho ideal?
6. Quais regras precisam ficar inline?
7. Quais podem ficar linkadas?
8. Você lê arquivos linkados automaticamente ou só quando instruído?
9. Como garantir que `SAFETY_GATES` seja lido em R4?
10. Como evitar que classificação de risco seja ignorada?
11. Existe mecanismo equivalente a hooks?
12. O que deve virar script/CI compartilhado?
13. Como worktrees funcionam melhor com Codex?
14. Como você lida com instruções de repositórios externos?
15. Que riscos de prompt injection existem?
16. Quais partes da proposta são redundantes?
17. Quais faltam?
18. Que parte deveria ser automatizada primeiro?
19. Como manter Claude e Codex equivalentes?
20. Dê sua arquitetura final recomendada.

---

# 55. Matriz final obrigatória

Ao terminar, produza:

| Item | Status | Prioridade | Alterar? | Motivo curto |
|---|---|---:|---|---|
| AGENTS raiz | | | | |
| CLAUDE raiz | | | | |
| SOURCE_OF_TRUTH | | | | |
| SAFETY_GATES | | | | |
| VALIDATION_MATRIX | | | | |
| CONCURRENCY | | | | |
| LESSONS_LEARNED | | | | |
| ENVIRONMENT_PLAYBOOK | | | | |
| AGENTS backend | | | | |
| AGENTS web | | | | |
| AGENTS mobile | | | | |
| AGENTS AI | | | | |
| nested CLAUDE | | | | |
| .claude/rules | | | | |
| CODEOWNERS | | | | |
| Ruleset main | | | | |
| PR template | | | | |
| change-risk.yml | | | | |
| ACTIVE_WORK | | | | |
| external code policy | | | | |
| data classification | | | | |
| threat model | | | | |
| third-party policy | | | | |
| SECURITY.md | | | | |
| production invariants | | | | |
| agent:preflight | | | | |
| agent:verify | | | | |
| docs:agents:check | | | | |
| Claude hooks | | | | |
| ADRs | | | | |
| Trivy | | | | |
| Semgrep | | | | |
| OpenTelemetry | | | | |
| Testcontainers | | | | |
| Mealie | | | | |
| Open Food Facts | | | | |
| React Email | | | | |
| axe-core | | | | |
| OpenObserve | | | | |
| Medplum | | | | |

---

# 56. Conclusão obrigatória

Responder finalmente:

```md
# Veredito

GO / GO COM AJUSTES / NO-GO

## 5 maiores acertos

## 5 maiores riscos

## 5 coisas que removeria

## 5 coisas que adicionaria

## P0 antes de qualquer implementação

## P1 depois da migração da governança

## P2 / futuro

## Ordem exata recomendada de implementação

## Mudanças que exigem decisão do usuário

## Pontos em que discordo explicitamente da proposta

## Perguntas que ainda não consigo responder a partir do repositório
```

O objetivo não é produzir aprovação. É produzir uma revisão tecnicamente defensável.
