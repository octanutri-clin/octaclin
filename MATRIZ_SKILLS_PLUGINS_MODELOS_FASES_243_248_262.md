# OctaClin - Matriz de skills, plugins e modelos das Fases 243 e 248 a 262

Atualizado em 2026-08-20.

## Objetivo

Esta matriz define antecipadamente quais capacidades devem ser usadas em cada
fase, qual modelo deve conduzir o trabalho e quanto raciocínio é proporcional ao
risco. Ela complementa o checklist e o roadmap; não substitui TDD, revisão do
diff, CI ou os gates documentados no repositório.

A recomendação de modelo usa a família GPT-5.6 atualmente disponível. A
documentação oficial classifica `gpt-5.6-sol` como a opção de maior capacidade e
suporta `low`, `medium`, `high`, `xhigh` e `max` de esforço de raciocínio:
<https://developers.openai.com/api/docs/guides/latest-model>.

## Regra de encerramento

Ao encerrar qualquer fase, o arquivo `fase-XXX-*.md` e a resposta ao usuário
devem informar explicitamente:

1. próxima fase recomendada;
2. modelo recomendado;
3. nível de raciocínio recomendado;
4. skills e plugins/MCPs que serão usados;
5. motivo para aumentar ou reduzir o esforço em relação à fase encerrada.

Se a execução real divergir desta matriz, registrar a divergência e sua razão no
documento da fase. Não elevar esforço apenas por precaução: `max` fica reservado
a segurança, autenticação ou decisão GO/NO-GO com impacto material.

## Inventário utilizável

### Skills disponíveis e relevantes

- Engenharia: `codex-engineering-guardrails:code-work` e
  `codex-engineering-guardrails:code-verification`.
- Planejamento e entrega: `ecc:plan-orchestrate`, `ecc:delivery-gate`,
  `ecc:living-docs-governance`, `ecc:git-workflow` e `ecc:github-ops`.
- Frontend: `ecc:frontend-patterns`, `ecc:frontend-design-direction`,
  `ecc:make-interfaces-feel-better`, `ecc:design-system`,
  `ecc:frontend-a11y`, `ecc:browser-qa` e `ecc:e2e-testing`.
- Backend e dados: `ecc:nestjs-patterns`, `ecc:backend-patterns`,
  `ecc:api-design`, `ecc:database-migrations` e `context7-mcp` para
  documentação atual de bibliotecas e SDKs.
- Saúde: `ecc:healthcare-emr-patterns`, `ecc:healthcare-phi-compliance` e
  `ecc:healthcare-eval-harness`.
- Segurança: `codex-security:threat-model`,
  `codex-security:attack-path-analysis`, `codex-security:deep-security-scan`,
  `codex-security:fix-finding`, `codex-security:validation` e
  `codex-security:track-findings`.
- Operação: `ecc:error-handling`, `ecc:latency-critical-systems`,
  `ecc:canary-watch`, `ecc:messages-ops` e `ecc:email-ops`.

`skills-lock.json` registra fontes pretendidas, mas não prova que os respectivos
arquivos estejam instalados na sessão. No ambiente verificado, apenas a skill
local `playwright` foi localizada. As demais entradas do lock não entram como
dependência deste roteiro até serem instaladas e aparecerem na lista ativa de
skills; as capacidades nativas acima cobrem o ciclo atual.

### Plugins e MCPs que serão usados

- **Browser/Chrome/Computer Use:** operação visual autenticada e verificação de
  produção quando necessária.
- **Chrome DevTools MCP:** rede, console, acessibilidade, LCP e memória.
- **Playwright MCP:** jornadas, screenshots e regressão desktop/web móvel.
- **Context7:** documentação atual de Expo, React Native, Next.js, NestJS,
  TypeORM e SDKs de integração antes de alterar suas APIs.
- **Penpot MCP:** fonte visual das fases de interface e consolidação. Não usar
  Figma enquanto estiver desconectado nem criar sistema visual paralelo.
- **GitHub:** usar `gh` CLI autenticado como caminho principal; o MCP GitHub é
  opcional até estar conectado. PR, checks e Dependabot permanecem no GitHub.
- **Desktop Commander:** apenas diagnóstico do ambiente local quando o shell
  comum não for suficiente.
- **Documents/PDF/Spreadsheets:** somente quando a fase gerar contrato, relatório
  ou importação tabular; não são baseline de desenvolvimento.

### Plugins instalados que não entram neste ciclo

- Figma: instalado, mas desconectado e substituído pelo Penpot neste projeto.
- Vercel: não é a plataforma de produção do OctaClin; Render continua sendo a
  referência operacional.
- Supabase: não substituir Neon/PostgreSQL nem introduzir um segundo backend.
- Telegram, Unreal Engine, apresentações e geração de mídia: sem relação com as
  Fases 243/248-262.
- Ralph Loop: não usar para execução autônoma prolongada em auth, dados clínicos,
  migrations ou produção; esses limites exigem checkpoints humanos.

## Modelo por nível de risco

| Perfil | Modelo | Raciocínio | Uso |
| --- | --- | --- | --- |
| Mecânico | GPT-5.6 Sol | `medium` | texto, inventário, reconciliação e ajustes bem delimitados |
| Implementação padrão | GPT-5.6 Sol | `high` | UI, contratos e fluxo completo com testes |
| Alto risco | GPT-5.6 Sol | `xhigh` | migrations de framework, integrações, concorrência e dados clínicos |
| Crítico | GPT-5.6 Sol | `max` | autenticação, revisão de segurança e GO/NO-GO |

`low` fica reservado a leitura, busca ou alteração puramente mecânica já
especificada. Não é o padrão para implementar fases do OctaClin.

## Matriz por fase

### Fase 243 - Modernização e hardening do Mobile

- Modelo: **GPT-5.6 Sol, `xhigh`**.
- Skills principais: `context7-mcp`, `codex-security:fix-finding`,
  `codex-security:validation`, `ecc:git-workflow`, `ecc:e2e-testing` e
  `codex-engineering-guardrails:code-work`.
- Plugins/MCPs: Context7, GitHub/`gh` e Playwright quando o fluxo Mobile puder
  ser exercitado; Browser apenas para consoles necessários.
- Revisão: segunda passagem com `codex-security:security-diff-scan` em `high`.
- Motivo: migração acoplada de Expo/React Native, 37 alertas e cinco PRs
  automáticos incompatíveis quando isolados.

### Fase 248 - Estados e recuperação das superfícies clínicas

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:error-handling`, `ecc:frontend-patterns`, `ecc:frontend-a11y`,
  `ecc:e2e-testing` e `codex-engineering-guardrails:code-work`.
- Plugins/MCPs: Chrome DevTools e Playwright.
- Motivo: exige reproduzir falhas, preservar rascunhos e validar recuperação,
  mas não deve alterar regras clínicas.

### Fase 249 - Densidade e responsividade do console clínico

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:frontend-design-direction`,
  `ecc:make-interfaces-feel-better`, `ecc:design-system`,
  `ecc:frontend-a11y` e `ecc:browser-qa`.
- Plugins/MCPs: Penpot, Chrome DevTools e Playwright.
- Motivo: julgamento visual e consistência responsiva precisam de análise de
  screenshots, não apenas alterações de CSS.

### Fase 250 - Encerramento da dívida Mobile e higiene de PRs

- Modelo: **GPT-5.6 Sol, `medium`**.
- Skills: `ecc:github-ops`, `ecc:living-docs-governance`,
  `codex-security:track-findings`, `codex-security:validation` e
  `codex-engineering-guardrails:code-verification`.
- Plugins/MCPs: GitHub via `gh`; Context7 apenas se surgir incompatibilidade não
  resolvida na Fase 243.
- Motivo: é reconciliação baseada em evidência, não nova implementação.

### Fase 251 - Revisão integral de linguagem e microcopy

- Modelo: **GPT-5.6 Sol, `medium`**.
- Skills: `ecc:brand-voice`, `ecc:frontend-a11y`,
  `ecc:make-interfaces-feel-better` e `ecc:browser-qa`.
- Plugins/MCPs: Browser e Playwright; Penpot somente se a cópia alterar tamanho
  ou hierarquia visual.
- Motivo: trabalho amplo, porém regras de produto e glossário delimitam as
  decisões.

### Fase 252 - Navegação e descoberta de funcionalidades

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:codebase-onboarding`, `ecc:click-path-audit`,
  `ecc:frontend-patterns`, `ecc:frontend-a11y` e
  `codex-security:validation`.
- Plugins/MCPs: Browser, Chrome DevTools, Playwright e Penpot.
- Motivo: cruza rotas, papéis, permissões e arquitetura de informação; erro pode
  esconder função ou expor navegação indevida.

### Fase 253 - Agenda clínica confiável e operacional

- Modelo: **GPT-5.6 Sol, `xhigh`**.
- Skills: `ecc:nestjs-patterns`, `ecc:backend-patterns`, `ecc:api-design`,
  `ecc:error-handling`, `ecc:e2e-testing` e
  `codex-security:attack-path-analysis`.
- Plugins/MCPs: Context7, Browser, Chrome DevTools e Playwright.
- Motivo: concorrência, idempotência, agenda interna, Google Calendar e
  notificações formam uma fronteira de alto risco.

### Fase 254 - Lista e cadastro robusto de pacientes

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:healthcare-emr-patterns`, `ecc:frontend-patterns`,
  `ecc:database-migrations`, `ecc:frontend-a11y` e
  `codex-security:validation`.
- Plugins/MCPs: Playwright e Chrome DevTools; Neon/SQL somente se uma migration
  for realmente necessária e sempre pelo runbook.
- Motivo: dados cadastrais, duplicidade e rascunho exigem contratos consistentes
  sem ampliar coleta desnecessária.

### Fase 255 - Prontuário e linha de cuidado

- Modelo: **GPT-5.6 Sol, `high`** para implementacao; revisao de seguranca
  read-only em `xhigh`.
- Skills: `ecc:healthcare-emr-patterns`, `ecc:healthcare-phi-compliance`,
  `ecc:frontend-patterns`, `ecc:database-migrations` e
  `codex-security:attack-path-analysis`.
- Plugins/MCPs: Penpot, Chrome DevTools e Playwright.
- Revisão: segurança read-only em `xhigh` sobre tenant, paciente, autoria e
  trilha de auditoria.
- Motivo: maior concentração de dado clínico sensível e ações persistentes.

### Fase 256 - Formulários e check-ins ponta a ponta

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:contract-first`, `ecc:frontend-patterns`,
  `ecc:frontend-a11y`, `ecc:e2e-testing` e
  `codex-security:validation`.
- Plugins/MCPs: Playwright, Chrome DevTools e Penpot para os fluxos públicos.
- Motivo: muitas etapas, mas contratos e jornadas já existem e devem ser
  consolidados antes de qualquer nova modelagem.

### Fase 257 - Portal do paciente orientado por tarefas

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `ecc:healthcare-phi-compliance`, `ecc:frontend-design-direction`,
  `ecc:make-interfaces-feel-better`, `ecc:frontend-a11y` e
  `ecc:e2e-testing`.
- Plugins/MCPs: Penpot, Browser, Chrome DevTools e Playwright.
- Motivo: combina linguagem simples, privacidade, acessibilidade e navegação web
  móvel sem expor risco clínico.

### Fase 258 - Central de comunicações confiável

- Modelo: **GPT-5.6 Sol, `xhigh`**.
- Skills: `ecc:messages-ops`, `ecc:email-ops`, `ecc:api-design`,
  `ecc:error-handling`, `ecc:e2e-testing` e
  `codex-security:attack-path-analysis`.
- Plugins/MCPs: Context7, Browser e Playwright; consoles Gmail/Meta apenas com
  controle humano em login ou 2FA.
- Motivo: integrações externas, consentimento, opt-out, idempotência e estados
  de entrega exigem raciocínio de falha distribuída.

### Fase 259 - Acesso, convite e ativação

- Modelo: **GPT-5.6 Sol, `max`**.
- Skills: `codex-security:threat-model`,
  `codex-security:attack-path-analysis`, `codex-security:validation`,
  `ecc:nestjs-patterns`, `ecc:frontend-a11y` e `ecc:e2e-testing`.
- Plugins/MCPs: Browser, Chrome DevTools e Playwright.
- Revisão: segunda passagem independente de segurança antes do merge.
- Motivo: autenticação, recuperação, convite e quatro papéis são fronteiras
  críticas; falha pode virar escalonamento ou acesso entre tenants.

### Fase 260 - Desempenho, resiliência e diagnóstico

- Modelo: **GPT-5.6 Sol, `high`**.
- Skills: `chrome-devtools-mcp:debug-optimize-lcp`,
  `chrome-devtools-mcp:memory-leak-debugging`,
  `ecc:latency-critical-systems`, `ecc:error-handling`, `ecc:canary-watch` e
  `codex-engineering-guardrails:code-verification`.
- Plugins/MCPs: Chrome DevTools, Playwright e Browser/Render.
- Motivo: precisa de medição e perfil real; `xhigh` só será usado se a causa
  atravessar múltiplos serviços ou concorrência.

### Fase 261 - Regressão de segurança e privacidade

- Modelo: **GPT-5.6 Sol, `max`**.
- Skills: `codex-security:deep-security-scan`,
  `codex-security:threat-model`, `codex-security:attack-path-analysis`,
  `codex-security:validation`, `codex-security:track-findings`,
  `ecc:healthcare-phi-compliance` e `ecc:healthcare-eval-harness`.
- Plugins/MCPs: GitHub/`gh`, Context7 e Browser somente para controles
  read-only; nenhum teste destrutivo em produção.
- Motivo: revisão transversal de auth, RLS, OAuth, uploads, webhooks, secrets e
  LGPD exige máxima qualidade e evidência de origem a impacto.

### Fase 262 - Aceite de usabilidade e prontidão para piloto

- Modelo: **GPT-5.6 Sol, `xhigh`**.
- Skills: `codex-engineering-guardrails:code-verification`,
  `ecc:delivery-gate`, `ecc:browser-qa`, `ecc:e2e-testing`,
  `ecc:healthcare-eval-harness` e `ecc:frontend-a11y`.
- Plugins/MCPs: Browser, Chrome DevTools, Playwright, Penpot e GitHub/`gh`.
- Motivo: o trabalho é principalmente verificativo, mas a síntese GO/NO-GO
  precisa correlacionar produto, operação, segurança e usabilidade.

## Uso de subagentes

- Usar subagentes apenas quando as superfícies forem independentes e tiverem
  arquivos/contratos sem sobreposição.
- Um único agente coordena escrita e integração; revisores trabalham em modo
  read-only sobre segurança, acessibilidade ou testes.
- Fases 243, 253, 255, 258, 259, 261 e 262 devem ter revisão especializada
  separada da implementação.
- Fases 248, 249, 251 e 254 normalmente não precisam de mais de um executor; o
  ganho vem de browser/Playwright e revisão, não de paralelismo.
- Nenhum subagente aplica migration, altera produção, fecha PR ou usa credencial
  sem a mesma autorização exigida do agente principal.

## Como selecionar no Codex

No aplicativo, selecionar `GPT-5.6 Sol` e o nível indicado antes de iniciar a
fase. No CLI, uma sessão equivalente pode ser iniciada com:

```powershell
codex -m gpt-5.6-sol -c 'model_reasoning_effort="xhigh"'
```

Não alterar a configuração global apenas para uma fase. O agente que concluir a
fase deve repetir no fechamento qual seleção usar na próxima.
