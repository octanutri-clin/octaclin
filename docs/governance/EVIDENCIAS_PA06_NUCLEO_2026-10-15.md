# PA06 — evidências do núcleo de autosave e edição parcial

Data:2026-10-15. Risco R4 (persistência clínica, migration, concorrência e authz).
Base `eae74b1e`; branch `feat/pos320-pa06-autosave`. Escopo: primeira entrega
aprovada em “Pode começar”. Este documento conserva checkpoints do núcleo e da
UI abaixo; a integração final está na seção mais recente. Não é aceite final
nem evidência de produção. Nenhum dado real, provider pago ou dependência nova.

## Contratos e correções

- Snapshot editorial inteiro versionado/cifrado na versão existente. Limites:
  documento96KiB,50 refeições,100 itens/refeição,20 alternativas/item; envelope
  HTTP conserva parser100KiB. A incompletude não afrouxa validação clínica.
- Revisão geral independente da revisão PA05 de apresentação. CAS confere geração
  e revisão sob locks antes de substituir filhos. Adesão protegida monotônica;
  clientes legados não podem sobrescrever rascunho já aderido sem CAS.
- Save/revisão/publicação avançam contador geral; clone tem geração própria.
- Pendências/ilegibilidade não exibem cálculo, refeições ou objetivos antigos como
  atuais; bloqueiam revisão, publicação e prévia paciente. Documento editorial não
  é incluído em projeção paciente/publicada. Publicada usa materialização imutável.
- Apagar observação grava NULL, pois TypeORM ignora undefined em UPDATE.
- Detalhe do plano, rascunho e versão seguram locks compartilhados de escopo ao
  montar o resultado; writers/transferências usam locks exclusivos correspondentes.
- Coordenador em memória, ciclo60s sem debounce, um voo e último pedido pendente.
  Não substitui campos do formulário por ACK. Erros pausam; sem retries incertos,
  persistência no navegador, flush de unmount, beacon ou publicação por timer.
- BFF conserva sessão/permissões atuais, precondições,409 e no-store; backend
  continua autorizando tenant/paciente/carteira e referências antes de gravar.

## TDD observado

Falhas de compilação/infraestrutura iniciais não foram contadas como RED.

| Caso | RED significativo | GREEN / controle |
| --- | --- | --- |
| Revisão geral e legado |3 falhas: contador não avançava, replay e writer legado aceitos | Suíte do serviço e migration |
| Migration1073 |2 falhas: migration ausente no registro | Registro/SQL aditivo e down recusado |
| Parcial sem avaliação/meta | Documento não era persistido | Roundtrip cifrado/estado pendente |
| Revisão/publicação com CAS |3 falhas: baseline obsoleta aceita e contador inalterado | Transições protegidas, publicação e clone |
| Rota de edição | Handler ausente no controlador | Permissão/no-store e encaminhamento |
| Observação removida | PostgreSQL retornou “Observação inicial sintética” após remoção | NULL real + revisão/publicação sem texto anterior |
| Prévia/cópia antiga |2 falhas: rascunho pendente/ilegível devolvia refeições antigas | Supressão da estrutura antiga e409 na prévia |
| Corrupção editorial após publicar | Totais/refeições publicados ficaram indisponíveis | Publicada independe da cópia editorial |
| Limite de transporte | Documento acima96KiB era aceito pelo domínio | Cap compatível com parser100KiB |
| BFF transições | Precondição enviada virou `{}` | Corpo preservado e409 sem retry |
| Coordenador |12 casos falharam contra esqueleto sem comportamento | Ciclo, ACK A/edição B, serialização, erros/cleanup |
| Reverter edição durante request | Manual não enviava último documento após ACK | Último pedido considera request em voo |
| Leitura durante save |3 casos PG não aguardaram lock | Locks compartilhados de escopo; conferir tabela de execução |

Logs brutos locais `/tmp/pa06-*.log` são transitórios. Testes e comandos abaixo são
as evidências reproduzíveis versionadas; não dependem de conteúdo real.

## Execução e limites

Node22.21.1/pnpm11.25.0, versões declaradas pelo projeto. Scripts executados pela
raiz da worktree; quando houver wrapper corepack, manter o Node22 no PATH.

| Comando | Estado observado |
| --- | --- |
| `pnpm --dir octaclin-backend test --runInBand src/modulos/planos-alimentares src/infraestrutura/banco-dados/edicao-planos.migracao.spec.ts` | PASS238 testes/17 suítes no núcleo final |
| `node octaclin-backend/scripts/test-pa05-postgres-local.cjs` | PASS12 casos PA04–PA06 no núcleo final;31 fora do filtro SKIPPED |
| `node octaclin-web/scripts/test-planos-alimentares-bff.mjs` | PASS29/29 |
| `node octaclin-web/scripts/test-nutricao-plano.mjs` | PASS33/33, incluindo14 casos do coordenador e19 de nutrição |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm --dir octaclin-backend build` | PASS, artefato dist/main.js validado após o ajuste final de leitura |
| `pnpm --dir octaclin-web typecheck` | PASS |
| ESLint nos arquivos Web de runtime alterados | PASS |
| `pnpm --dir octaclin-web test:authz` | Em andamento; não convertido em PASS |
| `node scripts/validar-migracoes-fora-de-banda.mjs` | PASS |
| `node --test scripts/validar-guardas-controladores.spec.mjs` | PASS11/11 |
| `node scripts/scan-secrets.mjs` | PASS nos padrões locais; não é prova de ausência absoluta de segredo |
| PostgreSQL integral Timescale/pgvector | SKIPPED local: espaço Docker insuficiente; gate integral obrigatório no CI |
| UI/Playwright/a11y e build Web completo | SKIPPED nesta etapa: T07/T08 ainda não implementados; gates da entrega final |
| Suite backend integral, revisão final integrada e CI do HEAD | PENDENTES para T09/T10 após UI |
| Migrations/deploy/ativação externos | SKIPPED: não autorizados nesta execução |

PostgreSQL15 descartável, imagem fixada no harness, dados sintéticos e role runtime
não owner, sem superuser/BYPASSRLS. A fixture aplica migrations reais com owner,
usa FORCE RLS real nas tabelas de planos e remove o container ao terminar. Omite
somente Timescale/pgvector/hypertable/coluna vetorial alheios ao domínio;31 testes
fora do filtro PA04–PA06 foram SKIPPED, não aprovados implicitamente. Conflitos
save/save, save/revisão, save/publicação e leitura/save usam barreiras com evidência
de espera de lock em pg_stat_activity. Inclui cifra/NULL, tenant, carteira, paciente,
transferência, permissão revogada, corrupção, arquivamento e constraints.

## Revisão cruzada

Agente revisor `/root/pa05_r4_review`, leitura apenas, sem autoria das mudanças
PA06 e sem execução de testes. Primeira rodada encontrou prévia antiga e NULL;
ambos reproduzidos e corrigidos. Segunda rodada confirmou essas correções e
identificou a dependência editorial indevida da publicada, também reproduzida e
corrigida. Reinspeção final do núcleo concluída sem novo achado concreto nos deltas;
conferidos locks de leitura, independência da publicada e limite HTTP. Isso não substitui a revisão
integrada depois da UI nem representa revisão externa humana/validação clínica.

## Implantação futura1073 e rollback

Não executar estes passos sem autorização operacional e identificação inequívoca
de projeto/branch/banco/role. Conferir1072 existente e1073 pendente no alvo real;
CI/merge não demonstram aplicação. Ensaiar backup eDDL conforme RUNBOOK_PRODUCAO.
Aplicar1073 fora de banda com owner autorizado antes do runtime que a exige;
conferir registro da migration, quatro colunas/constraints, FORCE RLS e grants
mínimos da role runtime. Validar staging antes de produção e registrar evidência
por ambiente. Não promover runtime a owner ou liberar DDL no boot.

Rollback conserva colunas/cifra e proteção CAS. `down` recusa apagar histórico.
Depois da primeira adesão não voltar ao backend que ignore edicao_protegida/CAS;
reverter UI desabilitando novos envios, manter backend compatível ou usar correção
aditiva. Abort de request não garante rollback no servidor: cliente deve tratar
resultado incerto e recarregar sob autorização antes de nova tentativa.

## Aditivo de evidências — T07/T08 UI, 2026-10-15

Esta seção atualiza o estado da UI; a tabela acima descreve apenas o checkpoint
do núcleo T01–T06, quando a UI ainda estava pendente.

| Comando / cenário | Resultado observado |
| --- | --- |
| `pnpm --dir octaclin-web typecheck` (após `next typegen`) | PASS |
| `pnpm --dir octaclin-web test:proteger-alteracoes-nao-salvas` | PASS 4/4 |
| `node octaclin-web/scripts/test-planos-alimentares-bff.mjs` | PASS 29/29; warning esperado de `headers()` no harness fora de request |
| `node octaclin-web/scripts/test-nutricao-plano.mjs` | PASS 33/33, 14 coordenador + 19 subtotal/macros |
| Playwright `console-regression.spec.mjs`, “reordena refeições…” | PASS 2/2 desktop/mobile; cobre 60 s, edição parcial, pendência, Axe, reload e salvar-e-sair |
| Playwright `pa02-copia-refeicoes.spec.mjs`, cinco cenários selecionados | PASS 10/10 desktop/mobile; incompletude, resultado parcial, cópia suspensa e resposta canônica |
| Playwright `fase-320-pa05-apresentacao.spec.mjs`, “salva os dois conjuntos…” | PASS 2/2 desktop/mobile; CAS, preferências e conflito 409 com reconciliação |
| ESLint focado nos seis arquivos alterados | Exit 0, zero erros; 12 warnings de `react-hooks` nos componentes de prontuário/editor |

Durante a primeira rodada visual, um servidor `next dev` antigo e travado foi
reutilizado e causou timeout antes de carregar a página. O processo local foi
reiniciado e os cenários foram repetidos em servidor limpo. A asserção de subtotal
PA02 também detectou que o formulário preservava composição local após ACK enquanto
o backend retornava snapshot recalculado; a UI passou a calcular os resultados
vigentes pela resposta canônica sem substituir os campos editáveis. O cenário foi
reexecutado e passou em desktop/mobile.

O fixture de cópia também exercita retorno materializado com forma divergente da
edição local (menos refeições). A UI não indexa subtotais ausentes: esconde os
cálculos, mantém o documento e apresenta pendência até a resposta ser compatível.
Os cinco cenários PA02/PA03 foram repetidos na revisão final em desktop/mobile,
10/10 PASS sem exceção de renderização.

Ainda pendente para T09/T10: suite visual completa (incluindo regressões adicionais
PA02–PA05/FND02), build Web, authz integral, revisão R4 independente da UI e CI do
HEAD final. Não se declara conclusão de T09/T10 nem prontidão para merge, deploy
ou ativação.


## Integração Sol — 2026-10-15 (em conclusão)

Troca manual de modelo autorizada e realizada. Preservadas todas as alterações
preexistentes de UI; revisão cruzada estática e achados detalhados em
[REVISAO_R4_PA06_2026-10-15.md](REVISAO_R4_PA06_2026-10-15.md).

Reproduções adicionais: A confirmado/B em voo/retorno aA protegia incorretamente
a saída; Escape removia modal de save pendente; prévia profissional mantinha metas
anteriores;400 suspendia novos saves;429 impedia retry limpo; hidratação selecionava
avaliação e defaults ausentes; digitação percentual perdia a vírgula. Correções e
testes preservam texto numérico, não substituem edição local pelo ACK e mantêm
conflito/incerteza bloqueados após composição IME/cópia. Campos percentuais crus
opcionais ficam cifrados no mesmo documento, com allowlist e validação clínica
separada; não há alteração adicional de schema.

Resultados intermediários, não substituir pelo status do CI:

- Backend integral antes do aditivo percentual:329 suítes PASS,6 SKIPPED;
  2906 testes PASS,113 SKIPPED. Nova execução final iniciada após o aditivo.
- DTO/conversão percentual: RED1 falha real (campo não permitido),20 aprovados;
  GREEN21/21. UI RED significativo: `1,` virou `1` durante digitação sequencial.
- PostgreSQL final após o aditivo:12 PASS,31 SKIPPED,43 total. Mesmas omissões de
  Timescale/pgvector explicitadas acima; nenhum banco externo.
- Duas tentativas visuais em Next dev foram interrompidas/limitadas por timeouts;
  não são GREEN nem prova de defeito clínico. Repetir em build de produção local,
  sem compilação concorrente durante a navegação.
- Backend não declara script lint. Tentativa `pnpm --dir octaclin-backend lint`
  falhou por comando inexistente; não é lint PASS. Typecheck/build executados
  separadamente conforme os scripts reais.
- Um comando inicial `test -- --runInBand` tratou argumento como filtro e não
  encontrou testes; a execução válida usa `test --runInBand`.

Para liberar espaço local foram removidos apenas caches `.next` ignorados das
worktrees concluídas PA02–PA05, após confirmar ausência de arquivos rastreados.
Fontes/dependências/alterações de outras worktrees preservadas. Artefatos de teste
locais usam exclusivamente dados sintéticos. Nenhum rollout externo ocorreu.


### Gates finais já concluídos

| Verificação | Resultado real |
| --- | --- |
| `pnpm --dir octaclin-backend test --runInBand` após o aditivo percentual | PASS329 suítes,6 SKIPPED;2907 testes,113 SKIPPED (3020 total) |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm --dir octaclin-backend build` | PASS; `dist/main.js` verificado pelo script oficial |
| `pnpm --dir octaclin-web lint` | PASS (exit0),69 warnings e zero erros; sem alegação de que todos são preexistentes |
| Governança local: secrets, migrations, confiabilidade, matriz a11y, redação/resposta auditoria, Actions imutáveis e guardas | PASS;11/11 casos de guardas |
| Revisão cruzada estática R4 núcleo/UI | PASS após correções; independente da autoria, sem execução de testes pelo revisor |

Build Web, regressões visuais finais e authz integral ainda em execução nesta
seção. Somente registrar PASS quando concluídos. CI do HEAD e banco integral
Timescale continuam obrigatórios. Não há autorização de rollout implícita.


- Integração numérica/último ACK: nutrição/coordenador/campos38/38 PASS; no-op
  rejeitado reproduzido com37 PASS/1 FAIL antes da correção. BFF29/29 e saída4/4
  repetidos PASS. Textos/timestamp só refletem confirmação real de revisão.
- Os harnesses de nutrição e BFF agora definem `include: []` no tsconfig temporário:
  entram `files` declarados e imports; não recompilam todas as telas em cada suíte.
  Typecheck/build geral preservados. Revisão estática confirmou nenhuma assertion
  removida. Não foi feita alteração ampla dos harnesses de outras fases.
