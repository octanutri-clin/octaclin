# Handoff de implementação — Fase 317

## Estado e autorização

Branch `feature/fase-317-gamificacao`, base `origin/main a84921fb` reconferida por
fetch em2026-10-12. Worktree `/workspace/octaclin/.worktrees/docs-fase-317-planejamento`.
Planejamento commit52a9ba96 e primeiro incremento caafebc1; núcleo em commit
posterior verificável por git log (não presumir SHA/PR). Reconferir HEAD/status/diff.

Proprietário autorizou implementação, testes novos/regressões/PG descartável e
gates. Nenhum merge/deploy/migration externa/ativação autorizados. Piloto default
false e gate operacional desativado fora dos testes. A316 continua em stand-by
na worktree `research/fase-316-motores`; não herdar seu runtime/commits. Alteração
preexistente `octaclin-web/next-env.d.ts` no checkout principal preservada.

## Fontes de verdade para continuar

- [Plano/gates/gaps](../docs/history/phases/PLANO_FASE_317.md).
- [Contrato de produto/termo proposto](../docs/product/CONTRATO_PILOTO_GAMIFICACAO_FASE_317.md).
- [API/versões/projeções e execução da UI](../docs/product/API_PILOTO_GAMIFICACAO_FASE_317.md).
- [Checklist T00–T16](todo-fase-317.md).
- [Evidência e segurança do núcleo](../docs/history/phases/reviews/fase-317/IMPLEMENTACAO_BACKEND.md).
- [Manifesto de verificações](../docs/history/phases/reviews/fase-317/backend-verification.json).

D01–11 confirmadas: conquistas e comunidade; console/portal; adulto>=18;
nomes de exibição confirmados; publicação imediata/moderação posterior;
comentários/curtidas com nomes; gestor/SuperAdmin configuram/profissional conduz;
saída oculta tudo próprio; novo convite/aceite;90dias e exceção legal explícita.
D12 técnica: novo modelo317 e API separados, sem conversão implícita do legado.
Não reabrir essas decisões por preferência nem confundi-las com revisão do termo.

## Concluído no núcleo

- Flags317 e gate operacional literal; permissões do gestor/SuperAdmin sem acesso
  clínico novo; identidade/sessão/alvo revalidados no banco.
- Domínio adulto, contexto/carteira, cifra vinculada ao recurso, versões/nonce,
  locks e quotas; configuração administrativa usa CAS sem ledger clínico.
-1070 aditiva/entidades registradas; seis tabelas FORCE RLS, FKs/índices/triggers.
  Down sempre recusa: não apagar schema/registro/histórico por rollback automático.
- Conquistas/snapshot/compartilhamento/aceite/revogação; vínculos por geração.
- Círculo/convite/aceite/nome/saída/revogação/encerramento; nenhuma impersonação.
- Posts imediatos/comentários/edição/revisões/retirada/curtidas e nomes paginados.
- Denúncias privadas/moderação da carteira; evidência/decisão cifradas.
- Feed/cursors/projeções; APIs próprias de revogação disponíveis com flags off,
  sem nomes/textos. Consentimentos antigos também revogáveis.
- Retenção e worker/all (tenants inativos incluídos), purga efetiva de conteúdo e
  relações de identidade quando sem hold/FK necessário; tombstones contra replay.
- Client próprio pode registrar exceção legal cifrada/com prazo, não ler conteúdo;
  não recuperar registros vencidos. Imagem de rollback mantém essas proteções.
- Legacy APIs filtram modelo1/catálogo piloto; shared ORMs select:false para campos novos.

## Validações realmente executadas

PASS: suíte backend308 suites/2703 testes;73 condicionais SKIPPED. PG separado:
50 testes (31 gerais+19 piloto), container sintético/role nãoowner sem bypass.
PASS: testes de HTTP com identidade/serviços simulados, guards/validação reais;
typecheck; build/artefato; secrets; guardas45 controladores; cobertura de redação
de auditoria24 testes; matriz de confiabilidade; matriz a11y20 testes; migrations
fora de banda13 testes. Não equivalem a teste de UI ou revisão independente.

Aviso de depreciação pg em queries concorrentes de testes permanece documentado.
Uma seleção de fixture de revisão falhou e foi corrigida; rodada50 passou depois.
Rota no DTO e nomes de metadata de auditoria também corrigidos/testados.
Rollback vazio agora recusa com teste novo; up do banco não mudou nessa correção.

## Pendências de entrega

T07/T13/T14: BFF/UI/admin/portal e moderação, seguindo API317. T15: demo, fixtures,
Playwright/axe desktop/mobile/teclado, regressões, lint/typecheck/build web.
T16: documentação final/gates/revisão R4 e uma única PR com toda a fase. PR não
aberta neste checkpoint; CI remoto não consultado/executado para este incremento.
Não declarar fase concluída/GO antes disso. Não fazer push/merge de main.

G00 PASS; G01 termo/moderação BLOCKED para liberação; G02 revisão independente R4
BLOCKED; G03 PASS local; G04 IN_PROGRESS; G05 operação/piloto BLOCKED. Nenhuma
migration aplicada fora do container. NOT VALID/grants/RLS/owner/worker/alertas e
exclusão física precisam de preflight externo e autorização antes da ativação.

## Próxima ação exata — após a troca manual

**GPT‑6 Luna alto**, BFF/UI sob contratos fechados. Antes de continuar, reconferir
Git e ler API317. Reusar `octaclin-web/lib/server/sessao-bff.ts`, rotas de receitas
como referência de portal/no-store e os componentes existentes. BFFs específicos,
sem proxy genérico, com allowlists reais de entrada/saída e testes de origem/papel.

Implementar jornadas completas de conquistas e comunidade, incluindo painel
próprio de revogação mesmo com feed desligado, moderação e administração. Não
usar endpoints antigos para317, não publicar HTML/SVG, não incluir rankings ou
notificações. Adaptar demo/fixtures sem habilitar ambiente externo.

Ao terminar, executar gates e preparar PR única. Se surgir incompatibilidade do
núcleo/R4 ou for necessária a revisão final, solicitar retorno a **GPT‑6.1 Sol médio**
e pausar para a troca manual. Não iniciar outra fase ou retomar316.

Toolchain local confirmado: Node22.23.3/pnpm11.25.0 em
`/tmp/fase316-toolchain/node_modules/node/bin` e `/tmp/fase316-toolchain/node_modules/.bin`.
Não alterar engines/locks para usar o Node24 do host. Novos arquivos/commits devem
ser verificados e incluídos explicitamente; root next-env.d.ts não pertence à317.

## Retomada integrada — 2026-10-12

Esta seção substitui as pendências T07/T13/T14 e a próxima ação para Luna acima.
Worktree: `/workspace/octaclin/.worktrees/docs-fase-317-planejamento`; branch
`feature/fase-317-gamificacao`, base `a84921fb`; HEAD preservado nos três commits
existentes. Checkout principal e alterações de outras fases não foram tocados.

### Implementação acrescentada nesta retomada

- Fechada a lacuna de administração de exceções legais: endpoint Client-only e
  paginado lista apenas id, versão, prazo ordinário e hold registrado. O cursor tem
  validação estrita; backend executa no tenant próprio sob executor/RLS.
- Criada rota administrativa `/cliente/gamificacao-piloto` e link no portal do
  gestor. `/gamificacao/piloto` continua com configuração para SuperAdmin e fluxo
  clínico profissional, sem misturar os acessos do Client.
- BFF de retenção com sessão/permissão, origem mutável, body limitado a 8 KiB,
  allowlist de campos, UUID/ISO estritos, respostas `no-store` e projeção mínima.
  Texto da denúncia/justificativa nunca é retornado nessa listagem. Justificativa
  submetida é cifrada no backend; auditoria registra metadados sem o texto.
- Chave de idempotência do formulário permanece estável em tentativa incerta e
  só é descartada ao confirmar ou editar a intenção. O piloto não foi habilitado.

### Verificações executadas nesta retomada

- PASS: `octaclin-backend pnpm typecheck`.
- PASS: `octaclin-backend pnpm build` e verificador do artefato `dist/main.js`.
- PASS: `RLS_TESTCONTAINERS=true pnpm exec jest --runInBand
  src/modulos/gamificacao/aplicacao/piloto-gamificacao.integracao.spec.ts`
  (19/19, PostgreSQL em container descartável; warning conhecido de queries
  concorrentes no pg permanece no output).
- PASS: spec unitária da exceção (4/4), incluindo projeção sem evidência,
  cursor adulterado/tenant-bound e limite de 100 itens.
- PASS: `octaclin-web pnpm typecheck` e ESLint focado dos arquivos novos/alterados.
- PASS: `octaclin-web pnpm lint` (0 erros, 65 warnings preexistentes; nenhum nos
  arquivos alterados desta fase).
- PASS: `octaclin-web pnpm test:fase317:bff` (5/5) e Playwright/axe da fase
  em Chromium desktop/mobile (6/6), somente fixtures sintéticas; após a alteração
  final do texto do hold, o formulário do gestor foi repetido em desktop/mobile
  (2/2).
- PASS: `pnpm security:secrets` (nenhum segredo real identificado pelos padrões
  locais) e `git diff --check` preliminar.
- PASS: `octaclin-web pnpm build`; compilou todas as rotas, incluindo
  `/cliente/gamificacao-piloto`, com avisos existentes de middleware/Edge Runtime.
- PASS: `pnpm test:authz` abrangente, repetido após remover somente o cache
  ignorado `.next/dev` que continha arquivos de tipo truncados. A execução limpa
  completou a cadeia, incluindo os cinco testes BFF desta fase.
- SKIPPED/PARCIAL: suite global `pnpm test:a11y` executada anteriormente foi
  interrompida após 25 de 274 casos; a cobertura dedicada nova inclui axe em seis
  cenários desktop/mobile, mas não substitui esse conjunto global.

Suite backend ampla anterior: 308 suites/2.703 testes PASS; PG amplo anterior:
50 testes PASS (31 gerais e 19 da Fase 317). A rodada atual adiciona os testes
focados listados acima; não declarar resultados de CI remota ou revisão R4.

### Estado de entrega/gates

T00–T14: PASS local. T15: IN_PROGRESS somente para CI remoto e revisão R4
independente; gates locais concluídos. T16: IN_PROGRESS até abrir a PR Draft
única e acompanhar CI.

G00 PASS; G01 BLOCKED pela revisão humana final do termo e da operação de denúncia/
moderação; G02 BLOCKED por revisão R4 independente; G03 PASS somente em banco
descartável; G04 IN_PROGRESS até CI remoto; G05 BLOCKED sem autorização de
operação/ativação.
Migration1070 não foi aplicada em staging/produção. Sem merge, deploy, push ou
ativação. Não usar dados reais.

### Próxima ação

PR Draft #405 aberta para `main`, head `57fdee0c4b4ae114c037a732a00c6a5e9f352277`.
No primeiro polling, checks CodeQL, Dependency Review, OctaClin CI, Semgrep e
Trivy estavam `QUEUED`. Acompanhar somente leitura; não fazer merge/deploy.
Antes da revisão R4 independente, solicitar troca manual para **GPT‑6.1 Sol
médio**. Corrigir eventuais achados R4/CI e repetir gates afetados após a troca.
G01/G02/G05 permanecem bloqueados.

## Retomada em Sol médio e revisão assistida R4 — 2026-10-12

Modelo trocado manualmente pelo proprietário; não solicitar nova troca para os
itens desta rodada. PR única Draft #405, HEAD recebido `68d34203`; base `a84921fb`.
Worktree limpa ao assumir; checkout principal e a316 em stand-by preservados.

Correções: BFF limita tipos/subobjetos/páginas; portal invalida dados/respostas
antigas e checkbox; console mostra comentários e permite retirada sem denúncia;
aceite tem texto integral e destinatários atuais mínimos; backend recusa retirada
nova já concluída sem inventar versão e preserva replay pela chave original.

PASS nesta rodada: PG real descartável21/21, Jest focal76 (21 condicionais pulados
nessa invocação e executados à parte), BFF8/8, Playwright12/12 desktop/mobile,
backend typecheck/build e lint focal sem warnings. Build web final/authz integral
em execução; registrar resultado antes de concluir. Testes globais anteriores e
CI do HEAD recebido não aprovam automaticamente os fixes desta rodada.

[Relatório R4](../docs/history/phases/reviews/fase-317/REVISAO_R4.md).
Não houve revisão independente plena: o histórico desta conversa inclui autoria
do núcleo. G02 segue BLOCKED. G01 termo/moderação e G05 operação seguem BLOCKED.
Nenhuma autorização inferida para migration externa, merge/deploy ou ativação.

Próxima ação exata: concluir authz, revisar diff/secrets/manifesto, commit/push das
correções na mesma PR e acompanhar CI do HEAD novo. Depois, encaminhar a um
revisor sem autoria para G02 e à equipe para termo/moderação; rollout somente
após autorização específica. Não abrir outra PR ou retomar316.

Smoke CI do HEAD recebido FAIL em mobile (seis atalhos vs cinco). R4-06 corrigido
sem afrouxar teste; retirada de atalho extra, Mais preserva conquistas/privacidade.
Reteste Playwright antigo desktop/mobile2/2 PASS. Authz completo final PASS por
logs TAP/textual sem falhas; último build com menu corrigido em execução.

Fechamento local: build final do menu PASS (exit0). Authz integral, lint focal,
PG21, Jest76, BFF8, Playwright12 e regressão de navegação2 PASS. G04 aguarda somente
CI do HEAD que será enviado; G01/G02/G05 continuam BLOCKED. Próximo passo:
commit/push na PR405 e conferir os checks desse HEAD, sem merge/ativação.
