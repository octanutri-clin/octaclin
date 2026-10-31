# FOOD06 — consolidação #455–#459 e auditoria Mobile

## Decisão e estado vigente

O proprietário solicitou reunir as cinco PRs e corrigir os erros antes da API
seguinte. A #455 permanece a PR única em Draft, base main. Os seis commits de
#456–#459 foram incorporados por **fast-forward**, sem squash, rebase, descarte,
merge na main ou escrita externa. Ramos e relatórios antigos são preservados.
PRs intermediárias serão encerradas como supersedidas depois de verificar que o
HEAD remoto da #455 contém integralmente4b23e8bf.

Nenhum requisito M01–M12 foi retirado ou declarado concluído pela consolidação.
A API factual já implementada é preservada. A nova API de **detalhamento M02**
fica para depois do CI consolidado, projeção/paginação e prova de capacidade.
Direitos de referências e G06 operacional continuam BLOCKED.

## Evidências históricas reconciliadas

| PR | Último HEAD antes de consolidar | Estado observado no GitHub |
| --- | --- | --- |
| #455 |0ec4cd31|20 success, Mobile Expo e PR Gate FAIL, SBOM provenance SKIPPED|
| #456 |1aba388a|19 success, Mobile Expo e PR Gate FAIL, SBOM provenance SKIPPED|
| #457 |6317a0c0|19 success, Mobile Expo e PR Gate FAIL, SBOM provenance SKIPPED|
| #458 |b4ccc2dd|19 success, Mobile Expo e PR Gate FAIL, SBOM provenance SKIPPED|
| #459 |4b23e8bf|19 success, Mobile Expo e PR Gate FAIL, SBOM provenance SKIPPED|

Demo smoke já terminou com sucesso nesses checkpoints. A falha comum é
`pnpm audit:security` no Mobile; typecheck, segurança e a11y passaram antes da
falha no job124593586540. O PR Gate falhou como consequência, não como prova de
regressão nutricional. Esses checks não aprovam o novo HEAD consolidado.

## Causa e correção delimitada

Auditoria bruta reproduzida com Node22.23.4/pnpm11.25.0:14 advisories —6 high,
5 moderate e3 low — concentrados em `node-forge@1.4.0`, `glob@13.0.6` e
`minimatch@10.2.6`. Não houve novo bypass, waiver ou redução de severidade.

- `node-forge`: override para1.4.1, corrigido upstream. Remove-se apenas a aplicação
  do antigo patch1.4.0; o arquivo histórico e teste RSA permanecem preservados.
- `glob`:14.0.2 corrige cancelamento AbortSignal; usa `path-scurry@3.0.0`.
- `minimatch`:11.0.1 corrige amplificação de globparts e usa
  `@isaacs/nonrecursive-glob-match@1.0.3`.
- Regenerar o lockfile trouxe `deepmerge` como nó órfão da metadata de
  `@expo/config@57.0.9`. O patch já existente havia removido seu uso. Um override
  de remoção **restrito a esse consumidor e versão** torna a mesma remoção
  reproduzível na resolução, sem apagar uso legítimo de outro consumidor nem
  mascarar a auditoria. Os testes reais de merge/prototype permanecem.

Registry npm confirmou publicação em27/10/2026, engines compatíveis com Node22,
integridades SHA512 fixadas no lockfile. Licenças: BlueOak-1.0.0 para glob,
minimatch e transitivos novos; forge permite BSD-3-Clause pela opção da licença
BSD-3-Clause OR GPL-2.0. Auditoria da política existente:586 pacotes aprovados.
Não se declara parecer jurídico geral nem direito de fontes clínicas DRI.

## RED/GREEN e compatibilidade

RED: auditoria original14 alertas. Primeiro ajuste deixou um low de deepmerge
reintroduzido; não foi declarado aprovado. Após a resolução coerente com o patch
existente: auditoria bruta0 e gate `audit-seguranca.mjs` **OK sem vulnerabilidades**.
Não se alterou a implementação do auditor, suas exceções ou limiares.

Verificação em cópia isolada `/tmp`, apenas arquivos versionados e casos
sintéticos; instalação frozen sem lifecycle, respeitando minimumReleaseAge,
trustPolicy e integridade existentes. Nenhum node_modules da worktree foi
sobrescrito ou reinstalado para contornar falha.

| Verificação | Resultado |
| --- | --- |
| Instalação frozen | PASS, pnpm11.25.0/Node22.23.4 |
| Segurança existente | PASS19/19, incluindo RSA e merge seguro do config |
| Compatibilidade nova | PASS4/4: glob sync/async/braces/ignore, cancelamento, matcher e fingerprint real |
| Segurança + a11y + compatibilidade | PASS38/38, nenhum skipped |
| Typecheck Mobile | PASS |
| Licenças | PASS586 pacotes, política inalterada |
| Audit bruto/gate existente | PASS0 advisories, nenhuma supressão |
| Expo doctor offline | BLOCKED:19/21 checks; dois requerem API Expo/React Native Directory e falharam por ECONNREFUSED |
| Export Android/iOS/Web | PASS, bundles e metadata gerados em diretório temporário |
| CI consolidado | PENDENTE antes do push |

O teste novo de compatibilidade inicialmente pressupôs `Minimatch.makeRe`, API
removida na versão11. Não é API utilizada pelo consumidor fingerprint instalado:
a inspeção mostrou `pattern`, `negate` e `match`. A prova foi corrigida para o
contrato **real**, incluindo a função `isIgnoredPath` do próprio fingerprint e
negação/reinclusão/dotfiles. Não se enfraqueceu teste preexistente nem contrato
prometido. As provas novas são caracterização/compatibilidade; o RED de segurança
é a auditoria reproduzida, não um alegado exploit de cada advisory.

## Revisão independente e limites

Revisor `/root/food06_mobile_audit_review`, somente leitura, sem coautoria ou
execução própria dos testes. Não identificou bloqueador estático. Conferiu
exports/engines/licenças, remoção coerente de deepmerge e risco do major matcher.
Pediu prova semântica de fingerprint/glob, atendida pelos quatro testes sintéticos.
Não é revisão independente integral FOOD06, validação dinâmica própria ou aceite
clínico. Novas correções futuras exigem revisar o delta correspondente.

As evidências de backend3797 PASS/166 SKIPPED e63 testes focados do fundamento
M02 permanecem históricas de4b23e8bf. A consolidação não altera esses fontes,
autorização, RLS, snapshot ou DTO. CI final deve comprovar novamente a integração,
incluindo PostgreSQL descartável; skipped local não equivale a RLS aprovado.

## Próximos passos e modelos

1. Finalizar export, diff/segredos; enviar consolidação à #455 ainda Draft.
2. Confirmar que contém4b23e8bf e encerrar #456–#459 como supersedidas, sem apagar
   ramos/revisões. Não realizar merge de PR ou operação de produção.
3. Conferir CI do HEAD exato; tratar qualquer falha real, não repetir checks por
   conveniência ou chamar Mobile/PR Gate de verde antes da evidência.
4. Somente então avançar com contrato da API paginada/autorizada M02.

Recomendação ao proprietário: GPT-6.1 Sol/médio para consolidação e correções
bem delimitadas; Sol/alto para API, autorização/paginação e concorrência. Terra/alto
é opção para revisão independente complexa. Luna(GPT-6)/alto pode cuidar de
ajustes documentais e testes simples delimitados depois do contrato estabilizado.
Não há benchmark de custo/qualidade neste projeto para alegar economia percentual.
A troca da conversa é manual, deve ser avisada; não se presume modelo efetivo a
partir desta recomendação nem se muda modelo de subagente silenciosamente.


Comandos adicionais realmente executados na cópia isolada: instalação
`pnpm install --frozen-lockfile --ignore-scripts`, auditoria JSON, o auditor
versionado sem alterações, `tsc --noEmit`, todos os seis arquivos node:test de
segurança/compatibilidade/a11y, `expo-doctor` com EXPO_OFFLINE=1 e
`expo export --platform all`. Licenças auditadas pelo script da raiz sobre a
árvore instalada temporária. Scripts/libraries executados diretamente com Node22
para evitar delegação involuntária do pnpm run a outro Node da máquina.

Manifesto sanitizado da auditoria RED/GREEN e hashes dos lockfiles:
`research/food06/mobile-audit-consolidacao.json`. Nenhum dado real de paciente,
credencial, URL assinada ou corpo de log foi incorporado.
