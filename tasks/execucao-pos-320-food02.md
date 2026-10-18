# Execução — plano: tasks/plan-pos-320-food02.md

Branch feat/pos320-food02-planejamento; base95e9f33d; planejamento8b4d6d38.
Autorização: “Pode seguir, sol médio”. R4: biblioteca cifrada, snapshots,
autorização e migration aditiva. Só PostgreSQL local descartável em T05.

## Preflight

T01→T03: conteúdo original/normalizado e DTOs fechados; sem conflito.
T02→T04: coluna cifrada versionada + FK custom de medidas; reader antigo não
é rollback compatível. T03→T04: primeira aplicação revalida; preservação não
consulta biblioteca. T04→T06: publicar handoff real só após backendGREEN.
Decisão técnica: usar ledger canônico em tasks; scripts da skill cloud não
estão fornecidos no filesystem. Não instalar ferramenta para bookkeeping.
Sem revisão independente realizada nesta etapa, sem delegação automática.

## T01 — GREEN

RED normalização:27 falhas comportamentais com stub sem implementação;
/tmp/food02-t01-red.log. RED DTO:2 falhas/15 passam com classes sem contratos;
/tmp/food02-dto-red.log. GREEN normalização/DTO + micros existentes:
3 suítes/65 testes PASS, /tmp/food02-t01-final.log.
Comando: Node22 jest --config octaclin-backend/package.json --runInBand
--testPathPatterns='(alimentos-personalizados|micronutrientes).spec.ts'.
Preservada razão original, ausência/zero, base30g e overflow. Não equivale à
suíte integral nem à integração PostgreSQL, ainda pendentes.

## T02/T03 — fundamentos GREEN

Migration1076:2 RED de SQL/inventário, depois3 PASS incluindo1075.
Biblioteca:11 RED comportamentais, depois11 PASS. HTTP:7 RED, depois7 PASS.
A primeira tentativa GREEN do serviço parou em TS2532 no teste de detalhe;
assertion ajustada com non-null (campo obrigatório naquele endpoint), rerun GREEN.
Gate combinado:10 suítes/137 testes PASS, /tmp/food02-fundamentos-green.log.
Schema não foi aplicado externamente. RLS real/concorrência ainda dependem T05.
Biblioteca usa a identidade tenant/profissional e helpers criptográficos já
existentes; sem writes nas tabelas públicas. Scripts/ledger cloud não foram
executados nem instalados. Logs em /tmp são complementares a este registro.

## T04 — integração GREEN

Contexto/editorial:5 RED → GREEN. Serviço: tentativa inicial parou por import
faltante no teste; restaurado baseline, observados4 RED comportamentais reais,
aplicada integração e4 GREEN. Logs /tmp/food02-t04-servico-red-real.log e
/tmp/food02-t04-servico-green-real.log. Não contar compilação como RED funcional.
Medidas custom:4 RED → GREEN, sem compartilhar pai pessoal por medida clínica.
Projeção:1 RED/1 PASS com filtro ausente → GREEN com allowlists custom aninhadas;
projeção/hash legado preservado. Rotas custom de medidas:5 RED → GREEN.
Precisão/UUID: RED específicos → GREEN. Acrescentadas regressões de composição
custom em alternativa e composição parcial sem publicação, ambas PASS.
35 suítes/494 focados PASS em /tmp/food02-backend-focados-final.log.

## T05 — PostgreSQL/compatibilidade GREEN

Primeiro PG:28 PASS,6 falhas de fixture por entidade ausente na conexão de prova,
29 filtrados. Isso não foi RED de uma vulnerabilidade. Entidade acrescentada ao
inventário específico; preparação corrigida (um comando intermediário tinha cwd
incorreto, corrigido antes da segunda leitura da fixture). Repetição:
34 PASS/29 filtrados, /tmp/food02-postgres-green.log. PostgreSQL15 descartável,
role pa05_runtime sem superuser/BYPASSRLS/ownership, sem banco externo. FK/XOR,
RLS, CAS, duas ordens de aplicar/desativar, revogação/transferência e publicação/
nova versão com fatos preservados. Timescale/pgvector/hypertable SKIPPED local.

## Gate backend final e handoff

Integral inicial:350 suítes/3172 testes PASS,6 suítes/133 testes SKIPPED.
Após as duas novas provas, integral repetido:350 suítes/3174 PASS e os mesmos
6/133 SKIPPED condicionais; /tmp/food02-backend-integral-final.log. Typecheck e
build/artefato PASS; diff/secrets e matriz40 referências PASS. Nenhum lockfile,
dependência, Web runtime ou checkout principal modificado por esta execução.

## T06–T07 — UI/BFF local

Implementados BFF (lista/busca/criação/detalhe/PATCH e medidas caseiras),
cliente/tipos, formulário de composição parcial, componente da biblioteca e
integração com o editor. A aplicação é ação separada; o editor revalida o detalhe
e a revisão corrente. Autosave serializa somente `{id,revisao,aplicacaoId}`;
os fatos/normalização vêm do backend. Medidas caseiras personalizadas mantêm a
origem e os controles de permissão do backend.

Verificações: `pnpm typecheck`; `node scripts/test-nutricao-plano.mjs` (67/67);
`node scripts/test-planos-alimentares-bff.mjs` (52/52);
`pnpm test:origem-backend:bff` (9/9, inventário de 305 rotas);
`node scripts/test-autorizacao-rotas.mjs` (30/30);
`pnpm test:calculo-combinado-planos` (4/4);
`node scripts/test-copia-refeicoes-plano.mjs` (10/10);
Playwright FOOD02 (2/2) e regressões direcionadas PA (14/14), todas em
desktop/mobile. Axe passou no fluxo novo. ESLint dos arquivos alterados: sem
erros, 8 avisos de hooks/ref no editor legado `plano-alimentar-profissional.tsx`.
Comandos e limites em `docs/governance/EVIDENCIAS_FOOD02_WEB_2026-10-17.md`.

T01–T07 estão concluídos tecnicamente na worktree. No checkpoint original,
revisão/build/gates finais ainda estavam pendentes; os resultados T08 atuais vêm
abaixo. CI FOOD02 e scanners do HEAD final continuam pendentes. Sem push/PR
parcial; manter uma PR única após gates locais. Merge, deploy, migrations
externas e ativação não autorizados.

## T08 — revisão, build e regressões finais (2026-10-18)

- R4 independente estática identificou três achados Important: seleção usando
  callback obsoleto após GET; edição concorrente do formulário durante POST;
  troca de chave/payload depois de criação com resposta incerta. Achados, escopo
  e limitação herdada em `docs/governance/REVISAO_R4_FOOD02_2026-10-18.md`.
- RED/GREEN Playwright: os três casos falharam antes da correção (porção voltou
  de42 para100; vínculo custom reaplicado após escolha de catálogo; campo ficou
  habilitado durante resposta incerta). Correções usam callback atual, geração
  monotônica por contexto/permissão, bloqueio da edição enquanto salva e pedido
  imutável com chave preservada até confirmação/repetição/cancelamento explícito.
- GREEN final no build de produção: quatro casos FOOD02 desktop4/4 e mobile4/4;
  adicionalmente a suíte completa PA07 desktop19/19. O quarto caso cobre ABA de
  posse na mesma aba (perder/retomar) e a resposta velha não é aplicada.
- `pnpm build` Web PASS com188 páginas estáticas/dinâmicas geradas;
  typecheck PASS. ESLint focal:0 erros,8 avisos em efeitos/dependências e refs
  já existentes no editor legado; nenhum aviso no componente/rotas FOOD02 novos.
- `git diff --check`, `pnpm security:secrets`, `pnpm test:security` e `node
  --check` do spec visual PASS. `pnpm test:authz` permanece em execução. Backend
  T01–T05 não foi alterado nesta correção Web; evidências de PG/CI backend acima
  seguem inalteradas.
- A R4 foi executada por agente independente antes da correção; não houve
  segunda revisão independente do patch. Nenhum SQL/PG novo ou CI foi executado
  neste exame. CI/scanners do HEAD final ainda são obrigatórios para fechar T08.
