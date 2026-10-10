# Fase 312 — sequência de implementação

Decisões fechadas; implementação e CI final da PR #390 concluídas. Evidências
em `docs/history/phases/PLANO_FASE_312.md`, handoff em `tasks/plan.md`.
Autoria/consulta/prévia confirmadas pelo proprietário.
Um escritor, mesma branch/PR. Cada checkpoint deve deixar contratos coerentes.
Paths de `pacientes/` e `clientes/` são relativos a
`octaclin-backend/src/modulos/`; demais paths de backend partem de
`octaclin-backend/src/`. Paths `app/`, `components/`, `lib/` e scripts BFF/visuais
partem de `octaclin-web/`, salvo quando indicado backend ou raiz.

## 1. Domínio e DTO do encaminhamento

Descrição: definir novo tipo, campos, modelo padrão e validação independente.
Dependências: decisões fechadas neste planejamento. Escopo médio.
Arquivos: `pacientes/dominio/documentos-clinicos.ts` e spec,
`pacientes/aplicacao/dtos.ts`; criar DTO/helper separado se necessário.

- [x] Quarto tipo/catálogo completo; título fixo; variáveis conhecidas e tokens
  essenciais no corpo efetivo; fallback vazio funciona; opcionais renderizam
  `Não informado`; literal `{{variavel}}` dentro de valor não reexpande.
- [x] DTO aninhado trim/limites/whitespace; validações condicionais no serviço;
  body clínico não entra em título, metadados, erro ou variável de outro tipo.
- [x] Jest focado cobre obrigatórios/limites/variáveis/override e snapshot antigo;
  não alterar três modelos existentes nem seu contrato de emissão.

## 2. Migration e proteção do snapshot

Descrição: persistência reconhece tipo novo, key e imutabilidade. Depende de 1.
Arquivos: migration 1067 e spec (reconfirmar número), `opcoes-typeorm.ts`,
`documento-emitido.orm.ts` e inventário de migrations existente. Escopo médio.

- [x] CHECK tipo ampliado, UUID nullable/obrigatório apenas para novo tipo,
  índice único parcial por tenant/autor/chave, trigger protege identidade/texto.
  Preservar checks/índices dos tipos antigos e RLS/FORCE.
- [ ] `down()` recusa sem apagar dados: provado em PostgreSQL real com linha
  encaminhamento; restaurar schema sem linhas ainda não foi executado em banco.
  Runtime não ganha DDL ou migrations no boot.
- [x] Jest do SQL/registro + typecheck; nenhuma migration em ambiente externo.

## 3. Prévia autorizada e preparação compartilhada

Descrição: mostrar renderização final sem criar documento. Depende de 1/2 e
contrato de prévia confirmado. Escopo médio; extrair helper para evitar serviço monolítico.
Arquivos: serviço documentos e spec; controlador e spec; DTO/helper de prévia.

- [x] Papel/vínculo/carteira/tenant e identificação validados diretamente;
  profissional arquivado/sem nome/sem registro e paciente fora do escopo negados.
  Nenhuma delegação/registro vindo do body nem texto automático do prontuário.
- [x] POST prévia renderiza texto puro limitado, DTO mínimo com hash SHA-256
  determinístico, sem ID/instante emitido; não salva arquivo/draft/documento.
  Auditoria registra acesso sem PHI/hash, e variáveis privadas não escapam DTO.
- [x] Jest cobre autorização positiva/negativa, modelo alterado, campos opcionais,
  ausência de efeito persistente e invariantes do hash (inclusive dia local).

Checkpoint A: domínio/DTO/migration/preparação coerentes; Jest específico,
typecheck/build backend. Verificar o plano contra o código antes da emissão.

## 4. Confirmação, replay e histórico

Descrição: transformar prévia conferida em snapshot cifrado uma vez. Depende de 3.
Arquivos: serviço documentos e spec, helper/DTO. Escopo médio.

- [x] Confirmacao/hash obrigatórios; divergiu efetivo → 409 antes de save;
  persistir preparação comparada e identificação própria. Patient/profissional
  lidos sob lock na confirmação; transferência/arquivamento não vence validação.
- [ ] Lock por tenant/autor/key + unique index; replay do mesmo UUID/pedido foi
  testado em serviço e índice em PostgreSQL; replay concorrente e mesma chave
  com pedido/paciente diferente ainda precisam de prova dedicada.
  Fingerprint no cabeçalho cifrado, antes de regenerar conteúdo no replay;
  não continuar transação abortada por colisão de índice.
- [ ] Jest testa falha incerta/timeout, retry cancelado, conflito de chave,
  callback sem e-mail/portal, alteração de cadastro/modelo após emissão não
  muda conteúdo, cancelamento cifra motivo e conserva snapshot.

## 5. Personalização do quarto modelo

Descrição: gestor configura corpo sem perder outros overrides. Depende de 1/4.
Arquivos: DTO e serviço Client/spec, `lib/cliente-api.ts`,
`components/cliente/modelos-documento.tsx`. Escopo médio.

- [x] Catálogo/DTO/UI incluem novo tipo, título fixo e variáveis/tokens
  necessários; reset individual volta ao padrão; backend valida modelo efetivo.
- [x] PATCH parcial preserva tipo omitido, inclusive envio de cliente antigo
  com três tipos; lock/merge na transação evita perda em atualização concorrente.
- [x] Jest Client/dominio e Web typecheck; antigos documentos não se alteram;
  padrões funcionam numa clínica sem configuração.

## 6. BFF e cliente HTTP

Descrição: transportar preview/emissão com permissão e no-store. Depende de 3/4/5.
Arquivos: BFF novo `app/api/pacientes/[id]/documentos/previa/route.ts`,
rotas tocadas de documentos/modelos, `lib/prontuario-api.ts` e harness BFF.
Escopo médio; subdividir roteamento e harness em commits se ampliar arquivos.

- [x] Prévia/POST exige gerenciar, GET exige ler; sessão/renovação/403/401 e
  parâmetros async reutilizam wrappers; backend continua autoritativo.
  Respostas sucesso/erro `private, no-store`; origem de mutação permanece protegida.
- [x] Harness `scripts/test-fase-312-bff.mjs`/spec usa padrão 311 e é
  incorporado a `test:authz`; prova que negações não chamam backend,
  propagação limitada de body, no-store, rota e status 409 correto.
- [x] BFF específico, autorização de rotas, `test:apis-dinamicas` e cadeia
  completa `test:authz` passam; o harness da 312 reportou 2/2.
  não registrar hash/campos clínicos em correlação ou mensagens de erro.

Checkpoint B: backend/domain/Client/BFF funcionam, Jest específico e
typecheck/build; documento antigo, recibo e declaração continuam compatíveis.

## 7. Formulário, prévia e impressão

Descrição: responsável confere encaminhamento antes de emitir. Depende de 6.
Arquivos: `aba-documentos.tsx`, componente de folha/prévia (se extraído),
`prontuario-paciente.tsx`, cliente HTTP. Escopo médio.

- [x] Campos exigidos/opcionais e ramo próprio; sinal de papel do pai governa
  oferta; ausência de consulta não cai no formulário da alta. Prévia legível
  com paciente/destino/motivo/contexto e autoria, sem alegar assinatura digital.
- [x] Alterações invalidam prévia; componente é reiniciado por paciente e ignora
  resposta velha; 409 pede prévia nova.
  Confirmar preserva UUID/body em falha incerta; clique duplo bloqueado;
  nova ação recebe nova chave. Não imprimir rascunho nem persistir em navegador.
- [x] Sucesso abre snapshot emitido e impressão/PDF; cancelado marcado na
  folha; sem botão enviar para encaminhamento; UI de três tipos antigos preservada.

## 8. Demo e Playwright

Descrição: provar jornada e integração de fixtures. Depende de 7.
Arquivos: `scripts/api-demo-local.mjs` backend, `scripts/smoke-e2e-bff.mjs`
Web, visual dedicado `fase-312-documentos.spec.mjs`; ajustar fixtures antigas
de documentos/modelos apenas onde usadas. Escopo médio.

- [x] Demo retorna DTOs corretos da prévia/encaminhamento e retry/replay;
  smoke BFF inclui emissão confirmada e negação de e-mail/ausência de efeito externo.
- [x] Playwright desktop/mobile: validar campos, ver prévia, editar/refazer,
  confirmar, repetir timeout com UUID, imprimir, cancelar, conferir histórico;
  testar modelo alterado e papel sem emissão; axe/foco e estado erro/recuperação.
- [ ] Regressão completa dos três tipos, gestão visual dos quatro modelos e
  cobertura de todos os mocks ainda depende da suíte visual completa no CI.
  locators específicos sem ambiguidades, nenhuma API relevante sem mock.

## 9. Prova PostgreSQL e fechamento

Descrição: confirmar propriedades reais, atualizar evidências e publicar PR única.
Depende de 1–8. Escopo de gate; código de testes em fatia separada se necessário.
Arquivos: harness `rls-isolamento-tenant.integracao.spec.ts` e entidades/provas
existentes; documentos citados abaixo; inventário de auditoria/acessibilidade.

- [ ] PostgreSQL real com migration/role sem owner/BYPASSRLS passou RLS por
  tenant, índice/trigger/cancelamento e rollback com dados; replay concorrente,
  autoria/carteira e transferência concorrente ainda não têm teste integrado de
  ponta a ponta. Índices legados foram preservados pela migration.
  O critério originalmente proposto inclui replay concorrente → 1 row e mesma
  key com outro pedido →409,
  UPDATE de corpo/cabeçalho/identidade/tipo bloqueado, cancelamento permitido,
  transferência concorrente respeita locks, índices legados preservados,
  down com dados recusa antes de DDL. Mock não conta como prova desse item.
- [ ] PASS/FAIL/SKIPPED explícitos; revisão R4 independente não foi feita nem
  simulada; rollback que preserva leitura/dados e procedimento owner fora
  de banda documentados. Gate jurídico de atestado continua pendente.
- [x] Atualizar `tasks/plan.md`, plano/checklist 312, status/roadmap/resumo,
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, matriz de confiabilidade e runbook;
  registrar lição proporcional de mocks/preview/idempotência quando aplicável.
- [x] Diff revisado; secrets/diff-check; commit/push e uma PR única aberta.
  Backend, Web, Governança, Demo smoke e PR Gate passaram no CI final
  `38048342326`; Provenance SKIPPED explícito; sem merge automático.

## Comandos e evidência esperada

No worktree acima, usar Node 22/pnpm 11.25.0 dos manifests e dependências
congeladas. Ler guia Next instalado antes de código Web, como manda AGENTS.

```bash
pnpm --dir octaclin-backend test --runInBand documentos-clinicos servico-portal-cliente
pnpm --dir octaclin-backend test --runInBand AdicionarEncaminhamentoDocumento opcoes-typeorm
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend test:rls:testcontainers
pnpm --dir octaclin-web test:fase312:bff
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:apis-dinamicas
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --grep "Fase 312" --reporter=list
pnpm test:a11y:matriz
pnpm test:confiabilidade
pnpm test:redacao-auditoria
pnpm test:guardas-controladores
pnpm test:migracoes-fora-de-banda
pnpm security:secrets
git diff --check
```

`test:fase312:bff` e a cobertura visual da fase foram adicionados. Demo local
smoke usa API sintética, sem serviço externo. O ambiente local detectou versão
de pnpm diferente do manifest e abortou a troca de módulos sem TTY; a suíte
`test:authz` roda pelo Node diretamente para preservar os módulos existentes.
CI executa Playwright completo; repetir localmente apenas se regressão nova
pedir. Não abrir PR documental isolada nem operar migration/produção neste ciclo.
