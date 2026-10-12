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
