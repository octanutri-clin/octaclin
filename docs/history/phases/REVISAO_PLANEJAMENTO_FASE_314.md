# Revisão consolidada do planejamento — Fase 314

Revisão rev2, 2026-10-10. Autor: agente atual; **não é ratificação clínica,
parecer jurídico, auditoria de produção nem revisão independente do próprio
planejamento**. Revisão externa rev1 recebida como proposta e confrontada.
Resultado: documentação consolidada com condicionantes; T03–T18 bloqueadas.

## 1. Base, escopo e rastreabilidade

Branch `docs/fase-314-planejamento`, worktree
`/workspace/octaclin/.worktrees/docs-fase-314-planejamento`; início limpo,
HEAD `3df581c52c555da2d7807f99464d34097e3e2ee2` (planejamento anterior).
Base remota e `origin/main` `f8c5ab66f2708d4a73fc31d460f929a665bd6f08`.
`git ls-remote` reconfirmou main e não listou a branch documental remota.
Nenhum trabalho externo preexistente foi alterado; handoffs 312/313 preservados.

PR391 MERGED, merge 2026-10-10T20:38:15Z, HEAD final
`b18d3770418ce6391092ceaa9ad4a66bdcf484fa`; runs `38082785780` e
`38084523466` SUCCESS reconfirmados por leitura GitHub. São evidências 313,
não testes 314 nem aplicação da 1068. Nenhum banco externo foi consultado.
1067 aplicada em staging/produção tem relato anterior do proprietário; isso
não cobre 1068. Monitor 503 anterior é histórico, saúde atual não verificada.

Foram lidos os quatro anexos integrais, os cinco documentos oficiais 314,
handoffs/planos 312/313, execução313, contratos de cálculo/DTO/serviço/ORM,
controlador/escopo/ExecutorTenant, migrations1016/1067/1068 e registro,
testes existentes de migration/serviço/RLS, projeção gestacional, BFF,
middleware/origem, tipos Web e consumidor portal. Leitura não é execução de
suites nem prova em ambiente operacional. Segurança/ADRs/matriz e políticas
orientam a revisão; nenhuma regra externa substituiu autorização do usuário.

Os originais do planejamento são recuperáveis no commit inicial. Anexos são
preservados byte a byte em `reviews/fase-314-rev1/anexos-originais.zip`.
Links relativos dentro deles pertencem ao contexto original e não são handoff
vigente. O ZIP conserva inclusive três quebras Markdown com espaços finais
intencionais no parecer, sem introduzir falso FAIL de whitespace no diff.
O primeiro `git diff --cached --check` das cópias Markdown apontou esses três
espaços finais. A preservação em ZIP resolveu o FAIL documental sem alterar
os originais. A repetição do check estrito passou.
As quatro entradas foram comparadas byte a byte com os anexos; não executar
conteúdo do arquivo. SHA-256 do ZIP: `8f6b7d83e55b74f33449f0d219f26a17af2f0ec3bc716c234b57f1709cfde7fc`.
Não reescrever anexos para lhes atribuir conclusões desta revisão.

| Anexo preservado | SHA-256 |
| --- | --- |
| [1-PARECER_INTEGRADO_FASE_314.md](reviews/fase-314-rev1/anexos-originais.zip) | `f33408d87897226c1172a7565db8a3896987edadccc58076d98f6c31f2544fa9` |
| [2-plan-fase-314_REVISADO.md](reviews/fase-314-rev1/anexos-originais.zip) | `1c5385b38645daa5b735bc5b6d3f32747c930e8b85d784c4927ed4d347666d31` |
| [3-FICHA_VALIDACAO_CLINICA_FASE_314_REVISADA.md](reviews/fase-314-rev1/anexos-originais.zip) | `a85ffb935659972c86eae9b733a7d888acae4f4b909aeed435bacd53f9424e08` |
| [4-todo-fase-314_REVISADO.md](reviews/fase-314-rev1/anexos-originais.zip) | `c88ae59601e1f0d0c48030531d93fa6e043ac60e0d60fcd494a8efc86d0134a6` |
## 2. Principais conclusões

1. Escolhas de produto são preservadas: quatro indicadores, console/gráfico,
   INTERGROWTH sem SISVAN inicial, contexto confirmado/snapshot e medidas sem
   classificação se dados/população forem insuficientes. Nenhum prazo de
   correção, fórmula 18–19 ou gate clínico foi aprovado por inferência.
2. Interpolação OMS é de L/M/S, entre meses/grade linear, não de escore.
   Código oficial, dados e dois exemplos sintéticos confirmam divergência do
   lookup por mês inteiro. Fonte consultada é versão de trabalho fixa,
   não automaticamente a edição clínica definitiva.
3. Grade do fornecedor não é faixa do algoritmo: pacote recente `anthro`
   corta antes de 60 meses, `anthroplus` inicia aos 60 e usa âncoras 60 e
   229/121 ausentes das planilhas iniciais. CL-01/G01 devem resolver isso.
4. <9 meses em pé, flags/edema e arredondamento precisam de política clínica
   própria declarada. O comportamento do pacote estatístico não é replicado
   cegamente; manter dados originais e não converter survey em diagnóstico.
5. G01 neonatal continua bloqueado: tabelas semanais e exemplo de entrada
   não são algoritmo diário. As fontes públicas consultadas não fecharam
   coeficientes/oráculo/termos; não afirmar inexistência absoluta na literatura.
6. Mineração documental encontrou condição comercial nas obras MS e GPL nos
   pacotes OMS. Uso científico e reprodução de obras/código são distintos;
   direitos concretos de incorporação precisam ser resolvidos antes de runtime.
7. Reuso da arquitetura é adequado com ajustes: papéis atuais, cifra/allowlist,
   paginação de registros examinados, limites de trigger1068 e provas PG cedo.
   Nenhuma tabela clínica paralela/dependência/runtime foi criada.

## 3. Matriz de divergências, correção e evidência

| ID / prioridade | Proposta ou lacuna | Confronto/evidência | Integração / decisão restante |
| --- | --- | --- | --- |
| D01 / P0 | Lookup mensal poderia bastar | OMS `anthroplus` `zscore_indicator`, commit fixo no manifesto, interpola L/M/S | Plano/ficha/T01/T03/T04/T05 corrigidos; CL-01/03 ratificam edição e precisão |
| D02 / P0 | 16 XLSX suficientes para todas as bordas | 16 locais/14.338 linhas e hashes PASS; TXT oficial BFA/HFA 60–229, WFA 60–121 | Manifesto distingue arquivos de grades; âncoras e termos em G01/T04 |
| D03 / P0 | Fim OMS2006=1856 implica troca em1857 | `anthro` usa `age_in_months <60`; `anthroplus >=60` | CL-01 explicita conflito de routing/civil/estatístico; sem decisão automática |
| D04 / P1 | <9 meses suprime toda altura no pacote OMS | Código marca posição NA, sem apagar integralmente lenhei/HFA/BMI | CL-02 distingue proposta conservadora OctaClin de fato; T03/T05 normalizam antes da persistência |
| D05 / P1 | Flags brutas equivalem às oficiais | Código oficial arredonda z a duas casas antes das flags; cortes são estritos | CL-03/09 registra diferença; prova bruta/exibição/arredondamento separada |
| D06 / P1 | Cortes/nomes curtos SISVAN prontos | MS2011 quadros5–9/13, MS2008, desigualdades diferentes; nota WFA não avalia excesso de peso | CL-04 mantém cortes candidatos pendentes e nomes completos; sem decidir igualdade silenciosamente |
| D07 / P0 | INTERGROWTH semanal permitiria diária | PDFs 27–64, quantis arredondados; manuais448/454; CSV sem saídas | G01/CL-06 BLOCKED, T09 exige modelo diário comprovado; sem LMS por analogia |
| D08 / P0 | Prazo AAP até3anos autorizaria correção | Página AAP 403; prazo referido no parecer não confirmado diretamente | CL-07 exige fonte verificável e decisão de duração/base/IG; 64s0d continua proposta clínica |
| D09 / P1 | “Acesso profissional” significaria responsável exclusivo | Controlador pacientes: SuperAdmin/Professional/Collaborator; escopo-profissional filtra somente Professional | CL-10/plano/T12 preservam contrato; exclusividade312 não transposta |
| D10 / P1 | Novo JSON só alcançaria consumidor novo | `mapearAvaliacaoAntropometrica` devolve resultado JSON completo; portal lê allowlist numérica | T06/T16 exigem projeções/consumidores explícitos; tipos TS não sanitizam; portal não recebe contexto |
| D11 / P1 | take(limite+1) filtraria população pediátrica | Contexto dentro de bytea cifrado, sem discriminante SQL | Plano/T12: lotes gerais, cursor último examinado, página vazia com continuação, cobertura; sem flag clínica em claro |
| D12 / P1 | 1068 provaria imutabilidade completa | Trigger de avaliação é BEFORE UPDATE e permite soft delete/share; não bloqueia DELETE; índice replay é tenant/ator/key | Preservar mecanismo e provar grants/DELETE em T16-A; não editar1068 integrada; schema só reaberto se necessário |
| D13 / P1 | Supersessor/retificação já existiria | ORM/serviço append-only+nova avaliação/exclusão lógica, sem vínculo supersessor | Hipótese documentada; nenhum novo evento/migration ou comportamento de gráfico por inferência |
| D14 / P1 | NormalizaçãoT07/flagsT08 e bloqueiosT11 poderiam vir depoisT06 | IMC T05/T06 já depende de técnica, edema e segurança etária | T03/T05 recebem fundamentos; T11 precedeT06; T16-A/B antecipam PG antes deUI |
| D15 / P0 | Fonte governamental/GitHub seria licença irrestrita | Copyright MS2008/2011 limita reprodução comercial; DESCRIPTION OMS GPL; privacidadeIG não licença | Gate direitos aberto: forma concreta de incorporação submetida à avaliação, sem copiar obra/código |
| D16 / P0 rollout | Merge/CI provaria1068/produção | GitHub PR/run SUCCESS; runbook requer alvo/role/grants/policies/registro reais | G00 operacional/G05 abertos; bancos/migrations/deploy SKIPPED |
| D17 / P1 | Igualdade mediana certificaria validade clínica | Mediana é identidade algébrica; exemplos oficiais 60,32/60,911701 mostram precisão, não todos os casos | CL-03 exige oráculo por sexo/indicador/cauda/limite; nenhuma certificação clínica |

P0 indica bloqueador da entrega afetada; D16 é rollout, não impeditivo de
pesquisa documental. P1 deve ser resolvido no contrato/provas antes de entrega.

## 4. Gates e decisões clínicas

Estado detalhado G00–G05 é mantido no
[plano, seção10](PLANO_FASE_314.md#10-consolidação-técnica-rev2-e-gates-g00g05).

| Gate | Resultado nesta revisão |
| --- | --- |
| G00 | BLOCKED: base/bytes locais PASS; direitos e 1068 operacional abertos |
| G01 | BLOCKED: neonatal diário e referência computacional completa pendentes |
| G02 | BLOCKED: CL-01–CL-10 sem ratificação específica |
| G03 | BLOCKED: apenas documentação autorizada, T03–T18 proibidas nesta execução |
| G04 | SKIPPED: implementação/testes de software não executados |
| G05 | BLOCKED: CI314/revisão final/ambiente e rollout não comprovados/autorizados |

CL-01–CL-10 têm proposta, fonte, impacto, risco e aceite necessário na
[ficha, seção9](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md#9-consolidação-rev2--matriz-cl-01-a-cl-10).
Todos permanecem pendentes de ratificação. O envio de revisão externa não
encerra os itens; nenhuma informação profissional real será versionada.

## 5. Execução T01–T18 e critérios

A [sequência oficial atualizada](../../../tasks/todo-fase-314.md) preserva IDs,
requisitos anteriores, arquivos e critérios; divide fatias para até5 arquivos
por commit, checkpoints a cada2–3 fatias e provas de banco antes da UI.

| Tarefa | Dependência efetiva | Aceite objetivo resumido |
| --- | --- | --- |
| T01 | Pesquisa/CL pertinentes | Artefatos/termos/modelos/âncoras completos e provas externas; sem neonatal inventado |
| T02 | T01/G01 | Ratificação específica da ficha e G03 separado, registro interno protegido |
| T03 | T02/G03 | Idade/routing/contexto/normalização sem inferência; bordas e estados definidos |
| T04 | T01/T02/G03 | Referências offline determinísticas, âncoras, hashes e direitos conferidos |
| T05 | T03/T04 | IMC normalizado, caudas/percentis/flags/rótulos com oráculo independente |
| T06 | T05/T11 | DTO/domínio e snapshot cifrado, replay/idempotência/carteira/allowlist |
| T07 | T06/T16-A | Altura/idade, técnica ratificada, ajuste único e indicadores parciais |
| T08 | T07 | WFA/WFL/WFH, limites/flags/edema próprios, ausência parcial correta |
| T09 | T02/T03/T08 | Modelo neonatal diário validado, elegibilidade/PMA, sem rótulos SISVAN |
| T10 | T09 | Transição/fim da correção, contexto e séries separados, sem clamp |
| T11 | T02/T03, antesT06 | Bloqueios <18 e política ratificada18–19 por fórmula, legado intacto |
| T12 | T10/T11 | Projeção mínima por lote examinado, cursor SQL/limites/cobertura, T16-B |
| T13 | T12/T16-B | BFF wrappers/permissão/origem/cache/whitelist e harness registrado |
| T14 | T13 | Contexto explícito/reset/retry409/resultado parcial, desktop/mobile |
| T15 | T14 | Gráfico/tabela acessíveis, bases/duplicatas/limites/continuação explícitos |
| T16-A/B/C | T06/T12/T15 | PG real, RLS/tenant/papel, triggers/replay/corridas e consumidores |
| T17 | T16-C | Demo sintética e runners atuais, linguagem/a11y/build/CI sem suite órfã |
| T18 | T17 | Revisão R4 quando viável, PR única/HEAD final/limites operacionais claros |

T01-A/B/C e T02 são preparação documental, não implementação concluída.
Sem G01/G02/G03, não avançarT03–T18 nem executar suites de implementação.
Nenhum recurso de retificação, portal ou dependência externa novo foi aprovado.

## 6. Segurança e riscos residuais

- **Tenancy/paciente/carteira:** servidor resolve tenant do JWT; predicados
  explícitos+ExecutorTenant+FORCE RLS. Professional deve ter vínculo ativo;
  revogação/transferência não autoriza replay de PHI só porque a chave existe.
  Papéis atuais precisam de confirmação de finalidade CL-10.
- **Dados:** DOB/IG/técnica/edema/flags/resultado são PHI; cifrar contexto e
  minimizar projeção; não logar body, fingerprint, notas, erro de cifra,
  stack ou dados em analytics/exportação/Cache Storage/URL. IDs continuam
  protegidos; auditoria atual mínima não recebe novas medidas/nomes clínicos.
- **Concorrência:** lock do paciente e advisorykey reaproveitados; validar
  caminhos de alteração DOB/perfil/carteira, ordem de locks e snapshot de
  referência. Requisição incerta conserva corpo/key, não cria novo registro.
- **Integridade:** trigger1068 UPDATE não prova DELETE protegido. Grants e
  controle de exclusão devem ser provados na role efetiva; se preciso,
  endurecimento pede revisão do schema e autorização futura, nunca editar
  migration aplicada. Retenção/eliminação autorizada é questão separada.
- **Compatibilidade:** adultos/idosos/gestantes/312/313, portal/longitudinal,
  comparações/resumo/documentos precisam de provas ao implementar. Manter
  valores brutos existentes; não recalcular snapshots nem aplicar faixa
  adulta como fallback pediátrico. Perfis gestantes mantêm precedência.
- **Custo/DoS:** lote de leitura e corpo limitados, lookahead limitado,
  curvas visuais até200 pontos por referência, sem scan ilimitado/algoritmo
  no navegador. Limites são desenho técnico, não plausibilidade clínica.
- **Clínica:** edição de fonte, idade/fração/técnica, rótulos/flags/edema,
  elegibilidade/prematuro e18–19 ainda podem alterar resultados. Bloquear
  cálculo afetado até aceite; z matematicamente plausível não valida população.
- **Direitos/supply chain:** sem instalador/código remoto executado, sem novo
  pacote/lockfile. GPL e obras MS exigem avaliação de incorporação.
  Downloads para pesquisa não autorizam redistribuir dados/obras em produto.
- **Rollback:** conservar schema/cifra/snapshots/leitura e proteções; desligar
  novas operações se necessário. Não usar down destrutivo nem apagar dados.
- **Operação:** sem confirmação1068/roles/grants ou saúde atual; CI313 não
  prova produção. Mesmo após documentação e clínica, produção exige etapa
  operacional separada e autorização específica.

## 7. Verificações realmente executadas

| Verificação/comando | Resultado / limite |
| --- | --- |
| `git branch --show-current`, `git status --short`, `git log -1 --oneline`, `git rev-parse HEAD origin/main`, `git ls-remote --heads origin main docs/fase-314-planejamento` | PASS reconciliação Git, sem fetch/rebase/merge ou alteração em outras fases |
| `gh pr view 391 --repo octanutri-clin/octaclin --json state,mergedAt,mergeCommit,headRefOid` | PASS leitura do merge/HEAD313 |
| `gh run view 38082785780` e `38084523466 --repo octanutri-clin/octaclin --json conclusion,headSha,status` | PASS CI313 reconfirmado; nada deCI314 |
| `rg`, `cat`, `sed` e leitura de instruções/contratos/migrations/tests/handoffs | PASS documental; buscas exploratórias de nomes inexistentes corrigidas, sem concluir ausência pelo primeiro path |
| Python stdlib urllib/hashlib + openpyxl read-only/data-only | PASS:16XLSX locais,14.338linhas/hash/aba/grades/LMS; re-download CDN16/16=403 BLOCKED |
| GitHub API/raw oficiais por commit, leitura de R/DESCRIPTION/TXT/test-zscores | PASS leitura, integridade e licença declarada; nenhum R executado, instalado ou copiado ao runtime |
| Python aritmético dos dois exemplos sintéticos oficiais | PASS comparação documental a2casas; não é teste do OctaClin nem validação completa de fórmula/caudas |
| urllib páginas/PDFs públicos INTERGROWTH/MS + SHA-256 | PASS seis PDFsIG rebaixados, hashes iguais; protocoloMS2008 obtido/extraído |
| `pdftotext -layout` do protocolo MS2008 e leitura de textos oficiais preservados | PASS documental; método/manualAAP não ratificado |
| AnthroPlus/Survey manuais/AAP acessados | BLOCKED403; duas URLs R iniciais404 corrigidas; destinoDOI403 anterior e busca bibliográfica vazia não provam ausência de dados |
| `git diff --check`, links locais/estruturas Markdown/escopo/hashes dos anexos, `pnpm security:secrets` | PASS: links/anchors/tabelas/IDs/CL e anexos byte a byte; scanner sem segredo real; higiene documental, não testes de implementação |
| Jest, Testcontainers, authz, Playwright, builds, migrations/DDL, staging/produção, merge/deploy | SKIPPED: fora da autorização desta execução |

Nenhum dado clínico real foi usado nas comparações ou enviado às fontes.
Exemplos são sintéticos explícitos de teste oficial; CSV de survey público
não foi usado como fixture nem seus casos impressos.

## 8. Arquivos e próximos passos

| Arquivo | Finalidade |
| --- | --- |
| [PLANO_FASE_314.md](PLANO_FASE_314.md) | Contratos/gates/paginação/segurança/rollback corrigidos |
| [Ficha](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md) | CL-01–CL-10, fontes/impactos/riscos/ratificação e distinção produto/fato/proposta |
| [Fontes](../../product/FONTES_ANTROPOMETRIA_FASE_314.md) | Integridade, hashes/commits/dados de apoio/licenças/limites de acesso |
| [Handoff](../../../tasks/plan-fase-314.md) | Estado consolidado, gates e próxima ação exata |
| [Tarefas](../../../tasks/todo-fase-314.md) | IDs preservados, antecipação de normalização/bloqueios/PG e critérios |
| Este relatório e ZIP dos quatro anexos em reviews | Divergências/evidências e preservação byte a byte do parecer recebido |

Ordem recomendada:
1. Equipe registra decisões CL-01/02/03/04/05/07/08/09/10 na ficha consolidada,
   especialmente duração/base da correção, elegibilidade e fórmula18–19.
2. Fechar CL-06/G01 neonatal e termos/dados completos OMS/MS/IG. Caso
   inviável, proprietário deve renegociar expressamente o escopo.
3. Consolidar edição/artefatos/intervalos/precisão e oráculos; ratificar versão
   da ficha em G02. A aprovação genérica de um parecer não substitui decisões.
4. Proprietário autoriza implementação/escopo de testes G03, então seguir
   T03–T18 conforme dependências; GPT-6.1 Sol médio no núcleo. Luna alto pode
   assumir T14/T15 após contratos; alertar e pausar antes de troca manual.
5. Antes do rollout, operador autorizado comprova1068/alvo/role/grants/RLS,
   revisão R4/CI final e ambiente. Não consultar nem mudar produção nesta revisão.

## 9. Parecer de prontidão

- **Planejamento documental:** consolidado e revisado tecnicamente com
  condicionantes; pronto para revisão/decisão do proprietário e equipe.
- **Validação clínica:** BLOCKED; CL-01–CL-10 sem ratificação definitiva desta versão.
- **Implementação:** BLOCKED; G01/G02 e autorização G03 ainda não atendidos.
- **Produção:** BLOCKED; sem implementação 314/provas/CI/revisão final e
  dependência1068/ambiente não confirmados. Nenhum deploy autorizado.

A etapa termina com documentos consolidados e bloqueios explícitos. Não iniciar
implementação automaticamente após publicar esta revisão.

## 10. Adendo de integração REV3

A revisão externa REV3 e a aprovação documental com ressalvas do proprietário
foram recebidas após este relatório rev2. Histórico acima preservado.
[Investigação vigente](INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md) acrescenta:
coeficientes contínuos candidatos, oráculo oficial sintético, discrepância
semanal55s, limites/licenças distintos, nascimento versus pós-natal e WHO
cronológica no gigs. Nenhuma evidência anterior de lacuna é apagada.

Manifesto/ficha/plano/handoff/checklist incorporam conclusões comprovadas e
propostas separadas. TodosCL continuam pendentes de ratificação específica;
G01/G02/G03BLOCKED. G00 decomposto em fonte/direitos e operação1068; gate
operacional aplica-se a rollout. Runtime/DB/testes de implementaçãoSKIPPED.

## 11. Adendo REV4 — decisões objetivas

ParecerREV4 recebido favorável comressalvas, sem ratificação clínica.
Fonte científicaElmrayed2025 diretamente lida eRCPCHNICM verificado; SBP 2023
indisponível403, SBP2017revalidado localmente. FichaCL-07 passou a distinguir
36corrigidosIG<32 de24corrigidos/opção local>=32, sempolítica universal.
ContagemJSON14/28 corrigiu menções26; dados originais preservados.
Crossref confirmaVillarCCBY-NC-ND; direitos/procedência ainda abertos.
Protocolo de prova externa finito22casos máximos eCIoffline substitui consulta
externa exaustiva. Ressalva55não recebeu tolerância ampliada nemcoeficiente novo.
[Matriz final de respostas](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md#11-matriz-final-de-decisão-cl-01cl-10--rev4)
e investigação seção8 registram fontes, alternativas/implicações ependências.
G01/G02/G03BLOCKED, T03–T18nãoiniciadas;nenhum runtime/DB/ambiente alterado.
