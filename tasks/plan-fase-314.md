# Handoff de planejamento — Fase 314

## Estado vigente — liberação parcial REV14

[Contrato e gates canônicos](../docs/product/LIBERACAO_FACTUAL_FASE_314_REV14.md): entrega factual A independente de G01;
classificadores B bloqueados. G02 ratificado REV9. PR Draft #394 ainda aberta;
main não contém os ajustes REV11. A liberação factual depende de R4 independente,
CI do HEAD final, migrations/RLS por ambiente e autorização operacional. Fases
seguintes independentes podem ser desenvolvidas com seus próprios gates.
T01–T18 e evidências históricas abaixo preservados, sem bloqueio global por G01.

## Estado vigente — REV11 e G02 REV9

Ratificação integral pelo proprietário recebida em 2026-10-11. Protocolo vigente:
`docs/product/FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md`, hash
`3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a`.
G02-PROTOCOLO RATIFICADO_PELO_USUARIO; formalização institucional separadamente
pendente. G01 e direitos BLOCKED, ativação não autorizada. A execução técnica
continua autorizada. As limitações documentais antigas abaixo foram substituídas
pela autorização de desenvolvimento e pelo protocolo ratificado; preservar como
histórico. A main inclui a entrega técnica #392 e a correção #393.
Evidências recebidas imutáveis em `docs/history/phases/reviews/fase-314-rev11`;
scripts novos em `scripts/research/fase314`. Sem migrations novas/externas.

## T01–T18 — situação vigente

O estado técnico, critérios restantes e dependências estão no
[checklist canônico](todo-fase-314.md#t01t18--situação-vigente-desta-continuação),
para evitar três tabelas concorrentes. G02 ratificado; G01/direitos e ativação
continuam bloqueados. Evidências e comandos em
`docs/history/phases/VALIDACAO_FASE_314_REV11.md`.

## Histórico das etapas anteriores

Consolidado rev2 em 2026-10-10; revisão técnica dos quatro anexos externos.
Somente documentação autorizada. Ficha continua NÃO RATIFICADA.

## Objetivo e estado

Planejar antropometria pediátrica com quatro indicadores, gráfico no console
e prematuros INTERGROWTH → OMS com idade corrigida. **Somente planejamento**;
não existe implementação da 314, PR de entrega nem autorização de deploy.

Branch: `docs/fase-314-planejamento`; base `origin/main` `f8c5ab66` (PR #391).
Worktree: `/workspace/octaclin/.worktrees/docs-fase-314-planejamento`.
Plano: [PLANO_FASE_314.md](../docs/history/phases/PLANO_FASE_314.md).
Ficha: [FICHA_VALIDACAO_CLINICA_FASE_314.md](../docs/product/FICHA_VALIDACAO_CLINICA_FASE_314.md).
Fontes: [FONTES_ANTROPOMETRIA_FASE_314.md](../docs/product/FONTES_ANTROPOMETRIA_FASE_314.md).
Execução futura: [todo-fase-314.md](todo-fase-314.md).

O handoff 313 em `plan.md` contém gates operacionais/revisão ainda pendentes.
Este handoff separado preserva todos eles; não sobrescrever `plan.md` da 313.
Promover somente após decisão de execução, mantendo seu histórico e links.

## Concluído

- [x] Conferir merge #391/CI pós-merge; não inferir aplicação da 1068.
- [x] Inventariar cálculo/DTO/snapshot/UI/consumidores/portal e gaps.
- [x] Obter/inspecionar fontes oficiais públicas e hashes; runtime offline.
- [x] Registrar decisões recebidas e propostas técnicas verificáveis.
- [x] Preparar arquitetura, tarefas pequenas, matriz de provas e rollback.
- [x] Links locais, `git diff --check` e `pnpm security:secrets` PASS.

## Pendente

- [x] Registrar etapa INTERGROWTH sem SISVAN, elegibilidade definida pela equipe
  e proposta para revisão de transição após 64s0d.
- [ ] Consolidar duração/base da idade corrigida e elegibilidade detalhada.
- [ ] Fechar métodos mensais/caudas/flags e referência computacional neonatal
  suficiente: não interpolar escores a partir de tabelas arredondadas.
- [ ] Ratificação clínica da ficha consolidada, incluindo política 18–19.
- [ ] Autorização de implementação e de seu escopo de testes.
- [ ] Conferência operacional externa da 1068 antes de liberar a aplicação;
  ausência de confirmação continua SKIPPED, sem executar neste planejamento.

## Próxima ação exata

Encaminhar a ficha rev2 com matriz CL-01–CL-10 à equipe para respostas explícitas,
especialmente idade/correção/elegibilidade/18–19; resolver dados e direitos G01.
Depois registrar ratificação G02 e obter autorização G03. **T03–T18 bloqueadas**.
Não considerar anexos recebidos aprovação clínica nem autorização de código.

## Revisão rev2: fatos e gates

- [Relatório completo e divergências](../docs/history/phases/REVISAO_PLANEJAMENTO_FASE_314.md).
- Base inicial limpa, commit `3df581c5`; PR391/CI final/pós-merge reconfirmados.
- PASS:16 XLSX locais/14.338 linhas/hash/aba/LMS, seis PDFs INTERGROWTH
  baixados novamente/hashes iguais. Re-download OMS CDN bloqueado403.
- Fonte OMS oficial consultada: interpolação de L/M/S, âncoras 60/229/121,
  diferença de grade/idade aplicável, precisão e flags. Dois exemplos
  sintéticos comparados matematicamente; não são testes do OctaClin.
- Termos MS limitam reprodução comercial de obras; pacotes OMS declaram GPL.
  Avaliar forma concreta de incorporação, sem presumir licença irrestrita.
- Papéis atuais preservados; leitura por lotes examinados cifrados/cursorSQL;
  1068 protege UPDATE com exceções, não prova DELETE. PG/revisão futura exigidos.
- Implementação/DB/merge/deploy não realizados. Documentos 312/313 e runtime
  permanecem sem alteração; anexos preservados byte a byte, histórico via Git.

| Gate | Estado | Próximo requisito |
| --- | --- | --- |
| G00 | BLOCKED, partes PASS | Direitos/artefatos e prova operacional1068 externa futura |
| G01 | BLOCKED | Modelo neonatal diário/oráculo/termos e fechamento computacional OMS |
| G02 | BLOCKED | CL01–10 ratificadas para versão/hash da ficha |
| G03 | PASS técnico / BLOCKED assistencial | Desenvolvimento e testes autorizados; ativação depende de G01/G02 |
| G04 | IN_PROGRESS | Implementação protegida e provas em execução; sem aceite clínico |
| G05 | BLOCKED | RevisãoR4/CI314 final e ambiente/1068; autorizações operacionais separadas |

A tabela completa/evidências está na seção10 do plano. Prova de ambiente não
é inferida do merge313. T01/T02 avançam apenas como documentação nesta sessão.
Ordem futura e subfatias T16-A/B/C preservadas em `todo-fase-314.md`.

## Verificações documentais finais

- PASS: `git diff --check`, links locais/anchors e colunas de tabelas Markdown.
- PASS: CL-01–CL-10 presentes, IDs T01–T18 preservados e anexos byte a byte.
- PASS: `pnpm security:secrets`, nenhum segredo real identificado. Node24/pnpm11
  geraram aviso de versão; futuro software/CI deve usar runtime declarado.
- SKIPPED: testes de implementação, builds/PG/authz/Playwright; nenhum runtime,
  migration, staging/produção, merge/deploy autorizado ou executado.


## Modelos

GPT-6.1 Sol médio para algoritmo/persistência/integração; Luna alto pode assumir
as telas quando o contrato estiver fechado. A troca é manual: avisar e pausar.
O mesmo modelo atual dá conta do planejamento e do núcleo da implementação.

## Limites das evidências

Downloads/inspeção documental não são ratificação clínica. Testes da 314 não
executados, sem código implementado. Nenhum PHI/PII real enviado a fontes,
GitHub ou providers; somente dados públicos e fixtures futuras sintéticas.
Não fechar revisão independente/saúde de produção pelo CI da fase anterior.

## Handoff vigente — integração REV3

Revisão documental aprovada **com ressalvas** pelo proprietário, pesquisaG01
realizada sem implementar. [Relatório](../docs/history/phases/INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md)
e ficha seção10 apresentam propostas de todos osCL e fontes/alternativas.

- Equações contínuas candidatas identificadas; 12 casos/24 resultados sintéticos
  contra calculadoraOxford mais caso55s/2 resultados, concordância amostral.
- Quatro PDFs rebaixados/hashPASS;1.064 quantis com ressalva55s,z−3.
- Origem detalhada primária/direitos/edição/completudeOMS continuam abertos.
- Nascimento versus pós-natal, janela0–2 dias e divergência WHO cronológica
  gigs versus proposta corrigidaOctaClin exigemCL-05/06/07; prazo não presumido.
- G00-fonte/direitosBLOCKED; G00-operação1068BLOCKED,consultaSKIPPED;
  G01/G02/G03BLOCKED; G04SKIPPED; G05BLOCKED. NenhumT03–T18iniciado.

**Próxima ação exata:** resolver procedência/direitos e política clínica com
respostasCL específicas para versão/hash da ficha; completarG01, registrarG02
somente com aceite humano, obterG03 e escopo de testes. Não iniciar implementação.
Documentos/runtimes312/313,tenant/cifra/snapshots/portal/migrations preservados.
ModeloSol 6.1 médio adequado; Luna alto sóUI com contrato fechado e troca manual
avisada/pausada. SemPR/push/merge/deploy nesta execução.

## Verificações da consolidação REV3

PASS: `git diff --check`; Python stdlib conferiu links locais/âncoras e
colunas Markdown, CL-01–CL-10/IDs T01–T18 e ZIP byte a byte. PASS:
`pnpm security:secrets`, sem segredo real; aviso Node24/pnpm11 fora da faixa
do projeto registrado, sem afirmar compatibilidade do software.
PASS documental: integridade das fontes, amostras sintéticas contra oráculo;
ressalva semanal55s permanece explícita. Nenhuma dessas provas é teste do
runtime OctaClin. SKIPPED: Jest/PG/authz/Playwright/builds/CI314 e qualquer
banco/migration/staging/produção/merge/deploy. Diff limitado à documentação314.

## Handoff REV4 — somente decisões objetivas pendentes

Fonte vigente: [matriz final da ficha](../docs/product/FICHA_VALIDACAO_CLINICA_FASE_314.md#11-matriz-final-de-decisão-cl-01cl-10--rev4)
e [evidências/metodologia](../docs/history/phases/INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md#8-fechamento-objetivo-rev4--evidência-contagens-e-direitos).

CL-07 atualizada:Elmrayed 2025 sustenta36corrigidos em IG<32, não em>=32;
RCPCHNICM vai a24corrigidos, instrumento e não política universal; SBP 2023
403, orientação de desenvolvimento atribuída aoREV4; SBP2017local revalidado.
Propostas de36<32 e24>=32provisória aguardam ratificação porfaixa/indicador.
Contagem corrigida:14 casos únicos/28 resultados dos JSONs, sem nova consulta.
VillarobraCCBY-NC-ND, direitos/incorporação abertos. Testes futuros finitos e
offline com tolerâncias prospectivas;55 semanas continua ressalva, sem clamp/ajuste.

Próxima ação: receber respostasCL e fonte/precisão/direitos, fechar requisitos
objetivosG01; registrarG02 específico e obterG03/testes. Não repetir rodada
genérica, não iniciarT03–T18. Segurança/histórico/runtime/migrations/313preservados.
G00fonte/1068separadosBLOCKED, G01/G02/G03BLOCKED,G04SKIPPED,G05BLOCKED.
Nenhum contato enviado/ambiente externo alterado. Sol6.1médio continua suficiente.

### Verificações efetivamente executadas na REV4

PASS: leitura do parecer/documentos e inspeção Git; consultas públicas Nature,
RCPCH, EuropePMC, Crossref e recursosINTERGROWTH; leitura científica sem dados
individuais; hashes dos downloads/documentos e preservação do parecer.
PASS: recontagem dos trêsJSONs originais,14casos únicos/28resultados e hashes
intactos; nenhuma consulta nova ao oráculo e nenhuma saída recalculada como
novo resultado oficial.
PASS: conferência Python de55links locais/âncoras, colunas Markdown, dezCL e
IDs T01–T18; `git diff --check` e `pnpm security:secrets` sem segredo real.
Aviso Node24/pnpm11fora da faixa do projeto é limite do ambiente; não houve
teste de compatibilidade do runtime.
BLOCKED403: SBP2023 com/semwww, novoSBP2017 eScienceDirect; SBP2017 local
revalidado não equivale are-downloadPASS.
SKIPPED: testes de implementação/Jest/PG/BFF/UI/builds/CI314, migrations/DDL,
staging/produção, contato a terceiros, push/PR/merge/deploy. Escopo apenas
documentos314; contratos/migrations/runtime deoutras fases preservados.

## Autorização controlada de desenvolvimento — 2026-10-11

O proprietário autorizou desenvolvimento T01–T18, testes locais descartáveis,
commits e uma PR Draft, mantendo protocolos não ratificados/direitos não
comprovados bloqueados no backend. Esta autorização substitui a proibição
operacional anterior de implementar. G03-desenvolvimento PASS por autorização
expressa; ativação assistencial/merge/deploy continuam não autorizados.
G01/G02 permanecem BLOCKED. Implementação não equivale a validação clínica.
REV5 não localizada na worktree nem nos anexos; solicitada ao proprietário.
Nenhum protocolo ou direito presumido pelo título desse documento ausente.
Base remota reconferida f8c5ab66; HEAD documental a8db3308, alterações REV3/REV4
preexistentes preservadas. Migration1068 registrada, sem evidência de aplicação
externa; provas exclusivamente em PostgreSQL descartável/Testcontainers.
Risco R4: snapshots clínicos cifrados, projeções autorizadas, RLS/carteira/replay.
Algoritmos científicos sem artefatos/direitos ratificados usam fornecedor vazio
no caminho assistencial; cálculo experimental só em testes locais sintéticos.
Sem opção de cliente/variável de ambiente capaz de habilitar protocolo pendente.

## REV5 recebida — desenvolvimento técnico autorizado

A [REV5](../docs/product/DECISOES_RATIFICACAO_FASE_314_REV5.md) foi recebida e preservada com hash e arquivo original. CL-01–CL-10 permanecem propostas sem aceite humano. A autorização posterior permite executar T03–T18 tecnicamente, inclusive endpoints e persistência protegidos; substitui a limitação P0 documental. G03-desenvolvimento PASS; G03-ativação, G01 e G02 BLOCKED. Não há permissão de merge/deploy nem prova externa de migration 1068. Artefatos de referência sem direitos comprovados não serão incorporados ao runtime.
