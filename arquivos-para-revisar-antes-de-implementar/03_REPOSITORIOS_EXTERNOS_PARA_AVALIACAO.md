# OctaClin — Repositórios Externos para Avaliação e Evolução do Projeto

> **Status:** backlog técnico para análise  
> **Objetivo:** identificar projetos open source que possam complementar o OctaClin sem duplicar desnecessariamente capacidades já existentes.  
> **Importante:** a presença de um projeto neste documento **não autoriza sua inclusão**. Cada integração deve ser analisada quanto a arquitetura, segurança, licença, LGPD, manutenção, dependências e custo operacional.

---

# 1. Critério utilizado

O OctaClin já possui capacidades maduras em:

- autenticação;
- autorização;
- multi-tenancy;
- RLS;
- prontuário;
- formulários;
- agenda;
- Google Calendar;
- Gmail;
- WhatsApp;
- notificações;
- API pública;
- webhooks;
- storage privado;
- PWA;
- importação/exportação;
- auditoria;
- LGPD;
- filas com Redis/BullMQ;
- CI/CD;
- observabilidade básica;
- plano alimentar;
- catálogo TACO.

Por isso, este backlog prioriza projetos que preencham **lacunas concretas**.

Não é objetivo adicionar tecnologia apenas por popularidade.

---

# 2. Resumo executivo

| Ordem | Repositório | Categoria | Lacuna principal | Prioridade |
|---:|---|---|---|---:|
| 1 | Trivy | Supply chain / segurança | SBOM, CVEs, misconfiguration, licenses | 10/10 |
| 2 | Semgrep | SAST / guardrails | Regras arquiteturais executáveis | 10/10 |
| 3 | OpenTelemetry JS | Observabilidade | Tracing distribuído | 9.5/10 |
| 4 | Testcontainers Node | Testes | Postgres/Redis reais e efêmeros | 9/10 |
| 5 | Mealie | Produto / nutrição | Lista de compras e modelagem de receitas | 9/10 |
| 6 | Open Food Facts | Nutrição / catálogo | Produtos industrializados e código de barras | 8.5/10 |
| 7 | React Email | Comunicação | Templates de e-mail reutilizáveis | 8/10 |
| 8 | axe-core | Acessibilidade | Testes automatizados WCAG | 7.5/10 |
| 9 | OpenObserve | Observabilidade | Backend central de logs/metrics/traces | 6.5/10 agora |
| 10 | Medplum | Interoperabilidade | FHIR/HL7 e integração clínica futura | 5/10 agora |

---

# 3. Prioridade 1 — Trivy

## Repositório

https://github.com/aquasecurity/trivy

## Categoria

Supply-chain security, SCA, SBOM e segurança de infraestrutura.

## O que agregaria

Trivy pode centralizar análise de:

- vulnerabilidades conhecidas;
- dependências;
- containers;
- Dockerfiles;
- secrets;
- misconfiguration;
- licenças;
- SBOM.

Pode gerar formatos como CycloneDX e ser integrado ao GitHub Actions.

## Lacuna que resolve

O OctaClin já possui:

- Dependabot;
- Secret Scanning;
- Push Protection;
- gates próprios.

Ainda assim, esses controles estão distribuídos.

Trivy pode criar uma visão consolidada de:

```text
código
+
dependências
+
container
+
infra
+
SBOM
+
CVEs
```

## Uso recomendado

Primeiro uso:

```text
GitHub Actions
↓
Trivy
↓
scan de dependências
scan de imagem
scan de misconfiguration
SBOM
↓
SARIF / GitHub Security
```

## Não fazer

- não substituir Dependabot automaticamente;
- não bloquear produção com regras excessivamente ruidosas sem baseline;
- não ignorar CVEs apenas porque não possuem exploit conhecido;
- não tratar toda vulnerabilidade com mesma criticidade.

## Perguntas para Claude Code/Codex

1. Quais scans do Trivy são úteis para o monorepo atual?
2. Quais já duplicam gates existentes?
3. É possível gerar SBOM CycloneDX em CI?
4. Qual impacto de tempo no pipeline?
5. Quais severidades devem bloquear PR?
6. Como evitar falsos positivos conhecidos?
7. Como publicar SARIF no GitHub?
8. Como tratar dependências Mobile em NO-GO?

## Critério de aprovação

A proposta deve melhorar supply-chain security sem aumentar excessivamente o tempo do CI ou duplicar controles sem necessidade.

---

# 4. Prioridade 2 — Semgrep

## Repositório

https://github.com/semgrep/semgrep

## Categoria

SAST e regras estáticas customizadas.

## O que agregaria

O principal benefício para o OctaClin é transformar regras do `AGENTS.md` em **guardrails executáveis**.

Exemplos:

```text
regra escrita
↓
regra Semgrep
↓
CI
```

## Lacuna que resolve

Hoje várias propriedades dependem de:

- code review;
- memória dos agentes;
- testes;
- convenções.

Semgrep pode impedir padrões proibidos antes do merge.

## Regras OctaClin que poderiam ser estudadas

### Tenancy

Detectar:

- tenant obtido de header não confiável;
- query sem contexto esperado;
- acesso direto fora da abstração aprovada.

### PII

Detectar:

- `console.log` de DTOs clínicos;
- logs contendo objetos de paciente;
- dumps de requests.

### BFF

Detectar chamadas que bypassam:

```text
requisitarBackendAutenticado
```

quando essa fronteira for obrigatória.

### Integrações

Detectar chamadas diretas para:

- Gmail;
- Meta;
- storage;

fora das camadas aprovadas.

### Segurança

Detectar:

- APIs criptográficas proibidas;
- `any` em paths críticos;
- desativação de guards;
- endpoints sensíveis sem decorators esperados.

## Limitação

Semgrep Community não substitui:

- review;
- testes;
- análise profunda de dataflow em todos os cenários.

## Perguntas para Claude Code/Codex

1. Quais regras arquiteturais do OctaClin são estáticas o suficiente para Semgrep?
2. Quais padrões gerariam falsos positivos?
3. Criar PoC com 3–5 regras de alto valor.
4. Quanto tempo adiciona ao CI?
5. Pode gerar SARIF?
6. Pode ser usado localmente antes do commit?
7. Como versionar as regras?
8. Como testar as próprias regras Semgrep?

## Critério de aprovação

A PoC deve detectar uma violação real ou sintética sem gerar ruído excessivo.

---

# 5. Prioridade 3 — OpenTelemetry JavaScript

## Repositório

https://github.com/open-telemetry/opentelemetry-js-contrib

## Categoria

Observabilidade distribuída.

## O que agregaria

Tracing de ponta a ponta entre:

```text
Next.js
↓
NestJS
↓
PostgreSQL
↓
Redis/BullMQ
↓
worker
↓
integrações externas
```

## Lacuna que resolve

Quando o backend tiver:

- múltiplas instâncias;
- worker dedicado;
- filas;
- chamadas externas;

logs isolados tornam diagnóstico mais difícil.

OpenTelemetry fornece correlação por trace/span.

## Exemplo de resultado

```text
POST /consulta
  ├─ auth
  ├─ authorization
  ├─ postgres
  ├─ enqueue
  └─ worker
       ├─ Gmail
       └─ audit
```

## Regra crítica

**Nunca colocar PHI/PII em spans.**

Não incluir:

- nome;
- e-mail;
- CPF;
- diagnóstico;
- conteúdo de prontuário;
- corpo completo da requisição;
- texto de mensagens clínicas.

## Uso recomendado

Primeira etapa:

```text
instrumentação OTel
↓
export local/dev
↓
validar overhead
↓
selecionar backend posteriormente
```

## Perguntas para Claude Code/Codex

1. Quais pacotes atuais possuem instrumentação automática?
2. Como correlacionar request HTTP e BullMQ?
3. Como propagar trace context para worker?
4. Quais atributos devem ser explicitamente bloqueados?
5. Qual overhead esperado?
6. Onde armazenar traces inicialmente?
7. Qual plano de amostragem é adequado?
8. Como correlacionar trace com audit log sem usar PII?

## Critério de aprovação

Uma PoC deve rastrear um fluxo assíncrono completo sem expor dados clínicos.

---

# 6. Prioridade 4 — Testcontainers Node

## Repositório

https://github.com/testcontainers/testcontainers-node

## Categoria

Testes de integração com infraestrutura real descartável.

## O que agregaria

Criar ambientes efêmeros com:

- PostgreSQL real;
- Redis real;
- outros serviços Docker quando necessário.

## Lacuna que resolve

RLS, migrations, constraints, locks e BullMQ possuem comportamento que mocks nem sempre representam.

## Fluxos ideais para PoC

### PostgreSQL

```text
Jest
↓
container Postgres
↓
migrations reais
↓
roles
↓
FORCE RLS
↓
teste tenant A × tenant B
```

### Redis/BullMQ

```text
Jest
↓
Redis container
↓
queue
↓
worker
↓
retry / lock / idempotência
```

## Casos de alto valor

- RLS;
- migrations;
- constraints;
- rollback;
- locks distribuídos;
- fila;
- retries;
- idempotência;
- concorrência.

## Não substitui

- staging;
- testes de produção read-only;
- migration proof em ambiente de integração;
- backup/restore.

## Perguntas para Claude Code/Codex

1. Runtime Node atual é compatível com a versão escolhida?
2. Docker está disponível no CI?
3. Qual impacto de tempo?
4. Podemos reutilizar container por suíte?
5. Quais testes hoje dependem mais de ambiente compartilhado?
6. É possível iniciar pelas provas de RLS?
7. Como testar migrations do zero e incrementalmente?

## Critério de aprovação

A PoC deve provar pelo menos um comportamento impossível de validar adequadamente com mocks.

---

# 7. Prioridade 5 — Mealie

## Repositório

https://github.com/mealie-recipes/mealie

## Categoria

Nutrição, receitas, planejamento e shopping list.

## Tipo de uso recomendado

**Referência de produto e modelagem.**

Não começar incorporando o sistema inteiro.

## O que agregaria

Mealie possui conceitos maduros de:

- receitas;
- ingredientes;
- quantidades;
- unidades;
- planejamento;
- consolidação;
- lista de compras.

## Lacuna que resolve

O OctaClin já possui plano alimentar, receitas/preparações e substituições.

Uma lacuna natural é:

> gerar uma lista de compras utilizável a partir do plano alimentar.

## Possível fluxo OctaClin

```text
plano alimentar
↓
período selecionado
↓
refeições
↓
preparações
↓
ingredientes
↓
normalização de unidades
↓
consolidação
↓
lista de compras
```

Exemplo:

```text
[ ] arroz — 1 kg
[ ] patinho — 1,2 kg
[ ] banana — 14 unidades
```

## Evoluções possíveis

Posteriormente:

- marcar comprado;
- ignorar item já disponível;
- compartilhar com familiar;
- gerar por 7/14/30 dias;
- lista por categoria;
- adesão por refeição;
- usar substituições selecionadas pelo paciente.

## Atenção à licença

Mealie utiliza licença que deve ser analisada antes de copiar ou incorporar código.

Preferir:

> estudar domínio, UX e decisões de produto; implementar nativamente no OctaClin.

## Perguntas para Claude Code/Codex

1. Como Mealie modela ingredientes e unidades?
2. Como resolve ingredientes duplicados?
3. Como consolida múltiplas receitas?
4. Como representa itens manuais?
5. Quais conceitos podem inspirar o OctaClin sem copiar código?
6. Como encaixar lista de compras no modelo atual de plano alimentar?
7. Como lidar com substituições?
8. Como preservar versionamento do plano?

## Critério de aprovação

A proposta deve usar o modelo atual do OctaClin e não introduzir um segundo motor de plano alimentar.

---

# 8. Prioridade 6 — Open Food Facts

## Repositório

https://github.com/openfoodfacts/openfoodfacts-server

## Categoria

Base de produtos alimentícios.

## O que agregaria

Complementar TACO com:

- produtos industrializados;
- marcas;
- código de barras;
- ingredientes;
- informação nutricional;
- alergênicos declarados;
- imagens/rótulos quando disponíveis.

## Lacuna que resolve

TACO é excelente para composição de alimentos de referência, mas não pretende ser um catálogo completo de produtos comerciais.

## Arquitetura recomendada

Não misturar fontes silenciosamente.

Exemplo:

```text
FoodSource
├── TACO
├── OPEN_FOOD_FACTS
├── CLINIC_CUSTOM
└── PROFESSIONAL_CUSTOM
```

Cada item deve manter:

- fonte;
- identificador externo;
- data de sincronização;
- nível de confiança;
- dados originais quando necessário;
- versão/proveniência.

## Atenção clínica

Open Food Facts é crowdsourced.

Portanto:

> ausência de alergênico no banco não significa garantia de ausência no produto.

Nunca utilizar informação incompleta como garantia clínica.

## Possível funcionalidade

```text
paciente/profissional
↓
escaneia código de barras
↓
OctaClin consulta fonte externa
↓
mostra produto + proveniência
↓
profissional pode confirmar/adaptar
```

## Perguntas para Claude Code/Codex

1. Qual API é adequada para o caso?
2. Quais limites de uso existem?
3. Como armazenar provenance?
4. Como lidar com produto alterado pelo fabricante?
5. Como mapear macros para o modelo atual?
6. Como tratar informação ausente?
7. Como evitar dependência síncrona da API durante atendimento?
8. Qual política de cache é adequada?
9. Qual impacto da licença sobre uso de dados/código?

## Critério de aprovação

A fonte deve ser complementar e nunca substituir silenciosamente TACO ou dados validados pelo profissional.

---

# 9. Prioridade 7 — React Email

## Repositório

https://github.com/resend/react-email

## Categoria

Templates de e-mail.

## O que agregaria

Componentização e preview de e-mails transacionais.

Exemplo:

```text
emails/
├── components/
│   ├── layout.tsx
│   ├── button.tsx
│   └── footer.tsx
│
├── convite.tsx
├── recuperar-senha.tsx
├── lembrete-consulta.tsx
└── formulario-pendente.tsx
```

## Lacuna que resolve

Gmail/transporte/outbox já existem.

O ganho seria apenas na camada de apresentação:

- consistência;
- preview;
- manutenção;
- responsividade;
- compatibilidade entre clientes.

## Importante

Não substituir:

- Gmail API;
- outbox;
- retries;
- consentimento;
- auditoria;
- idempotência.

## Perguntas para Claude Code/Codex

1. Como integrar ao transporte atual?
2. É possível gerar HTML sem depender do serviço Resend?
3. Quanto adiciona ao bundle/backend?
4. Como testar snapshot/render?
5. Como preservar plain-text fallback?
6. Como evitar dados sensíveis desnecessários no HTML?

## Critério de aprovação

Templates melhores sem alterar a arquitetura de entrega.

---

# 10. Prioridade 8 — axe-core

## Repositório

https://github.com/dequelabs/axe-core

## Categoria

Acessibilidade.

## O que agregaria

Automatizar parte das verificações WCAG.

## Lacuna que resolve

O OctaClin já possui preocupação com acessibilidade.

axe-core pode transformar parte dessa preocupação em gate contínuo.

## Integração sugerida

Avaliar:

```text
Playwright
+
@axe-core/playwright
```

em fluxos críticos:

- login;
- dashboard;
- pacientes;
- prontuário;
- agenda;
- plano alimentar;
- formulários;
- portal paciente.

## Limitação

Automação não detecta todos os problemas de acessibilidade.

Continuar realizando revisão manual.

## Perguntas para Claude Code/Codex

1. Quais E2Es devem receber axe primeiro?
2. Como tratar violações conhecidas?
3. Quais regras devem bloquear CI?
4. Como evitar flakiness?
5. Como gerar relatórios úteis?

## Critério de aprovação

O gate deve ser previsível e evitar regressões reais sem criar ruído constante.

---

# 11. Prioridade 9 — OpenObserve

## Repositório

https://github.com/openobserve/openobserve

## Categoria

Backend de observabilidade.

## O que agregaria

Centralizar:

- logs;
- métricas;
- traces;
- dashboards;
- alertas.

## Lacuna que resolve

Após escala horizontal e worker dedicado:

```text
web N
backend N
worker N
AI service
Redis
Postgres
```

diagnóstico distribuído se torna mais difícil.

## Relação com OpenTelemetry

Ordem recomendada:

```text
1. instrumentar com OpenTelemetry
2. validar traces
3. escolher backend
4. avaliar OpenObserve
```

Não acoplar instrumentação diretamente a um fornecedor antes de existir necessidade.

## Risco

OpenObserve adiciona infraestrutura e manutenção.

Por isso, prioridade atual é menor.

## Perguntas para Claude Code/Codex

1. Self-host faz sentido para o porte atual?
2. Qual custo operacional?
3. Onde armazenar?
4. Como fazer retenção?
5. Como impedir ingestão de PHI/PII?
6. Quais alternativas gerenciadas existem?
7. Quando o volume justifica esse componente?

## Critério de aprovação

Só adotar quando o ganho operacional superar a responsabilidade de manter outra plataforma.

---

# 12. Prioridade 10 — Medplum

## Repositório

https://github.com/medplum/medplum

## Categoria

FHIR, HL7 e interoperabilidade em saúde.

## Tipo de uso recomendado

Referência e camada futura de interoperabilidade.

**Não substituir o prontuário do OctaClin.**

## O que agregaria

Ferramentas e modelos para interoperar com:

- laboratórios;
- hospitais;
- EHRs;
- healthtechs;
- sistemas externos;
- ecossistema FHIR.

## Lacuna que resolve

A API pública atual é ótima para integrações próprias.

FHIR resolve outro problema:

> interoperar com sistemas de saúde utilizando um padrão reconhecido.

## Mapeamentos que podem ser estudados

```text
OctaClinPaciente
→ FHIR Patient

OctaClinConsulta
→ Encounter

Exame
→ Observation / DiagnosticReport

Profissional
→ Practitioner

Organização
→ Organization
```

## Quando avaliar de verdade

Quando existir demanda concreta de:

- laboratório;
- hospital;
- operadora;
- parceiro clínico;
- integração padronizada.

## Perguntas para Claude Code/Codex

1. Quais recursos FHIR mapeiam bem aos modelos atuais?
2. O mapeamento deve ser síncrono ou via adapter?
3. Medplum seria dependência ou apenas referência?
4. Como lidar com consentimento?
5. Como mapear tenant?
6. Como versionar transformações?
7. É possível manter o domínio OctaClin independente do FHIR?

## Critério de aprovação

FHIR deve ser uma camada de interoperabilidade, nunca o domínio interno por obrigação.

---

# 13. Repositórios que não são prioridade agora

Alguns projetos são tecnicamente bons, mas hoje duplicariam capacidades que o OctaClin já possui.

## Cal.com

Não priorizar.

Motivo:

- agenda própria já existe;
- Google Calendar já existe;
- agenda interna é autoridade.

Risco: introduzir dois motores de scheduling.

---

## Novu

Não priorizar.

Motivo:

- notificações;
- outbox;
- canais;
- retries;
- preferências;

já possuem infraestrutura própria.

---

## OpenFGA

Não priorizar agora.

Motivo:

- autorização atual já está profundamente integrada;
- introduzir outro motor exige migração complexa;
- RLS e guards continuam necessários mesmo assim.

Pode ser reavaliado caso o modelo de autorização cresça para relações muito mais complexas.

---

## Trigger.dev / Inngest

Não priorizar agora.

Motivo:

- BullMQ/Redis já existem;
- worker dedicado já está planejado;
- adicionar outro motor de jobs criaria sobreposição.

---

# 14. Ordem recomendada de análise

## Onda 1 — Fundação e segurança

```text
1. Trivy
2. Semgrep
3. Testcontainers
4. OpenTelemetry
```

Objetivo:

> aumentar confiabilidade antes do piloto e da escala.

---

## Onda 2 — Produto

```text
5. Mealie
6. Open Food Facts
7. React Email
8. axe-core
```

Objetivo:

> acrescentar capacidades perceptíveis sem reescrever arquitetura existente.

---

## Onda 3 — Escala e interoperabilidade

```text
9. OpenObserve
10. Medplum
```

Objetivo:

> preparar a plataforma para escala operacional e ecossistema externo quando houver demanda concreta.

---

# 15. Processo obrigatório antes de adicionar um repositório

Para cada projeto avaliado, Claude Code ou Codex deve produzir:

```md
## 1. Problema
Qual problema concreto do OctaClin estamos resolvendo?

## 2. Estado atual
Como o OctaClin resolve parcialmente isso hoje?

## 3. Ganho
O que a nova ferramenta oferece?

## 4. Sobreposição
O que ela duplicaria?

## 5. Arquitetura
Onde entraria?

## 6. Dados
Que dados receberia?

## 7. PHI/PII
Há risco de exposição?

## 8. Tenancy
Como isolamento é preservado?

## 9. Segurança
Quais novos riscos surgem?

## 10. Licença
Qual licença e quais obrigações?

## 11. Dependências
O que entra no monorepo?

## 12. Infraestrutura
Precisa de serviço adicional?

## 13. CI/CD
Quais gates mudam?

## 14. Observabilidade
Como será monitorado?

## 15. Rollback
Como remover caso não funcione?

## 16. PoC
Qual o menor experimento possível?

## 17. Critério de sucesso
Como decidir GO / NO-GO?

## 18. Recomendação
GO / NO-GO / ADIAR
```

---

# 16. Regra de integração

Sempre preferir:

```text
adaptar
>
integrar
>
copiar
>
substituir
```

nessa ordem de preferência, salvo justificativa técnica clara.

O OctaClin já possui domínio e arquitetura próprios.

Projetos externos devem **complementar**, não transformar o sistema em uma colagem de frameworks.

---

# 17. Licenças

Antes de reutilizar código:

- identificar licença;
- verificar compatibilidade;
- verificar obrigação de distribuição;
- verificar atribuição;
- diferenciar uso de API de incorporação de código;
- diferenciar inspiração arquitetural de cópia.

Projetos AGPL exigem análise especialmente cuidadosa.

---

# 18. Segurança e LGPD

Nenhuma PoC externa pode utilizar dados reais de pacientes.

Usar:

- fixtures sintéticas;
- tenant fictício;
- pacientes fictícios;
- payloads artificiais.

Se uma ferramenta externa receber telemetria:

- confirmar quais dados saem da infraestrutura;
- bloquear PHI/PII;
- documentar retenção;
- revisar base legal e contrato quando aplicável.

---

# 19. Critério geral de GO

A integração só deve avançar se:

```text
ganho de produto/engenharia
>
complexidade adicionada
+
risco
+
manutenção
+
lock-in
+
custo operacional
```

---

# 20. Backlog sugerido

```text
[ ] Avaliar Trivy
[ ] Avaliar Semgrep
[ ] PoC Testcontainers com RLS
[ ] PoC OpenTelemetry HTTP → BullMQ → worker
[ ] Estudar domínio de shopping list do Mealie
[ ] Projetar lista de compras nativa
[ ] Avaliar Open Food Facts como fonte complementar
[ ] Avaliar React Email
[ ] Avaliar axe-core no Playwright
[ ] Reavaliar OpenObserve após worker dedicado
[ ] Reavaliar Medplum quando houver demanda FHIR/HL7
```

---

# 21. Resultado esperado

Este documento não representa uma lista de dependências para instalar.

Representa uma lista de **hipóteses técnicas e de produto** a serem analisadas individualmente.

A regra é:

> Não perguntar “como colocar este projeto no OctaClin?”.

Perguntar primeiro:

> “Qual lacuna concreta ele resolve melhor do que a arquitetura que já possuímos?”

Somente depois disso deve existir uma PoC ou proposta de integração.
