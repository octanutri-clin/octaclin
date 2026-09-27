# Fase 284 - PB-22: biblioteca inicial de mensagens

## Evidência e decisão

Em 2026-09-27, a consulta aos PRs merged que mencionam PB-22 encontrou
reconciliação documental, sem entrega da biblioteca. O código em `main` tinha
criação manual de templates e seeds limitados a demo/staging. A auditoria de
produto, seção 15, mantinha PB-22 pendente. O proprietário autorizou executar
PB-22 e reconciliar a documentação nesta mesma branch e em um único PR.

Modelo: GPT-6 Sol, esforço médio. Skills utilizadas: `planning-and-task-breakdown`,
`test-driven-development`, `nestjs-best-practices`, `security-review`,
`vercel-react-best-practices` e `playwright-best-practices`.

## Escopo e critérios de aceite

1. Disponibilizar três modelos genéricos de e-mail, sem PII/PHI e sem evento de
   automação: boas-vindas, consulta agendada e check-in. Conteúdo versionado em
   código, com `codigoExterno` estável.
2. Criar cópias no mesmo commit transacional de provisionamento de tenant novo.
   Para tenant existente, permitir instalação explícita pela tela de
   Comunicações. A operação deve ser idempotente por tenant e preservar modelos
   já editados, inclusive sob duas solicitações concorrentes.
3. Permitir escolher e editar template existente, mantendo o canal. A prévia usa
   exclusivamente valores fictícios e não consulta paciente ou mensagens.
4. Exigir `comunicacoes.templates.gerenciar` no backend e no BFF, resolver tenant
   da sessão, consultar e alterar apenas registros desse tenant. Auditar a ação
   sem conteúdo de mensagem.
5. Alteração de conteúdo ou código de template WhatsApp invalida sua aprovação
   anterior. O processador revalida a aprovação antes de enviar mensagens já
   pendentes: enquanto não houver aprovação, registra falha e não chama o
   provedor. O código externo dos modelos iniciais é estável; nome e conteúdo
   continuam editáveis. Instalar modelos não dispara mensagens nem ativa
   automações.

## Risco, limites e rollback

R4 pelo provisionamento e escopo de tenant. Não há migration, DDL, backfill,
escrita em ambiente externo nem mudança de provider. O provisionamento aplica
contexto tenant antes de inserir as cópias; a instalação para tenant existente
usa `ExecutorTenant`. A transação mantém instalação e provisionamento atômicos.

Rollback de código: reverter o PR. Modelos já criados são dados persistentes e
não devem ser apagados automaticamente; remoção exige decisão e procedimento
separados por tenant. O botão para tenants existentes não migra dados em massa.
O campo `aprovado` dos novos modelos nasce falso; o fluxo de envio manual de
e-mail conserva o contrato anterior, de modo que a clínica deve revisar o texto
antes de o selecionar para envio. Não há envio automático nesta entrega.

## Evidência de validação local

- PASS: testes focados de backend, 5 suites e 67 testes, incluindo aprovação
  WhatsApp no processamento e imutabilidade do código dos modelos iniciais.
- PASS: typecheck e build do backend.
- PASS: build do Web Next.js.
- PASS: smoke visual Playwright desktop e mobile, 2 testes.
- PASS: `test:authz` completo do Web e BFF focado, 3 testes.
- PASS: lint do Web, com avisos preexistentes e sem erros.
- PASS: validação documental, scanner local de secrets, guarda de controladores
  e inventário de redação da auditoria.
- PASS: revisão final do diff e `git diff --check`.
- Revisão cruzada `tenant-security-reviewer`: identificou risco de envio de
  WhatsApp pendente após revogar aprovação e duplicação de modelo inicial se
  seu código fosse editado. Ambos foram corrigidos com testes de regressão.
- SKIPPED: prova contra PostgreSQL/RLS real e CI Node 22 antes do PR; não há
  banco de teste descartável confirmado neste ciclo. Checks do PR devem provar
  o gate no ambiente apropriado.

Este plano registra implementação pronta para revisão na branch; PB-22 só pode
ser marcado integrado em `main` após checks aplicáveis e merge.

## Fechamento de código em 2026-09-27

PR #320 integrado em `main` (merge `af839c5`, confirmado no GitHub). O CI teve
19 checks `SUCCESS`; `Provenance do SBOM` ficou `SKIPPED` e não é contado como
aprovação. Esta evidência comprova integração de código, sem afirmar deploy ou
aplicação em ambiente externo.
