# PR #455 — descrição histórica no HEAD 2de6462b

Snapshot documental da descrição anterior à integração do carregador DB FOOD06.
Os estados abaixo são históricos, substituídos pelos checkpoints atuais em tasks/food06-fonte-versao.md.
Origem: https://github.com/octanutri-clin/octaclin/pull/455 — leitura em 03/11/2026.
Conteúdo preservado para rastreabilidade; destinos de links relativos ajustados ao local do arquivo; não representa autorização operacional ou estado atual.

---

## Incremento vigente — leitor e comparação interna M05/M07, HEAD 2de6462b

PR #455 **Draft**. **37,5% administrativos: 1 concluída (M09), 7 parciais, 4 pendentes.**
M05/M07 parciais. Não há nova API/BFF/UI, fonte DB real das versões ou ativação DRI.
Direitos/G06 BLOCKED. Sem merge, deploy, migrations externas ou FOOD05-MDL/D18.

### Implementado
- Leitor v1 do registro cifrado: valida esquema/motor e reconfere consistência exclusivamente
  com os fatos congelados via construtor/PA06 existentes. Zero, desconhecidos e precisão preservados.
  Campos extras, totais/avisos/marcadores divergentes e versões desconhecidas falham fechados.
- Razão decimal de gramas decodificada exatamente com BigInt, sem Number/arredondamento.
  Não amplia os limites do escritor; mantém a recusa de quantidades não representáveis.
- Contexto resolvido conservado, sem nascimento inferido e sem nova adjudicação clínica.
- Serviço interno ler/comparar reautoriza tenant/carteira; autoriza os DOIS registros antes de decifrar.
  Confere binding completo e escopo do corpo. Histórico permanece byte a byte, sem catálogo vivo.
- Comparador factual existente, sem atribuição causal; projeção sem escopo/contexto/hash.
  **Objeto integral do leitor continua protegido para uso server-side, não é DTO HTTP.**
- Transferência revoga anterior e preserva leitura histórica pelo novo responsável legítimo.
- Teste concorrente corrigido com RED determinístico de estatísticas cacheadas:
  pg_stat_clear_snapshot em cada poll, mantendo locks, prazo e asserts.

### Evidências e limites
- Decoder RED4FAIL/18PASS → GREEN; métodos PG RED3FAIL/1PASS (stub422 não conta como RED).
- R4 encontrou P3 de coerência contextual. **4RED** com hash coerente → corrigido sem mudar resolver/escritor.
- **142/142 focados PASS** (50leitor,32construtor,39comparador,18PG,3schema), zero skipped.
- **41/41 regressões PostgreSQL PASS** em FOOD04/receitas/1081, zero skipped, após correção final.
- **4.055 backend PASS / 198 SKIPPED**,384suítesPASS/10SKIPPED. Skips separados das provas executadas.
- **Node22.23.4**: typecheck, build Nest/artefato PASS; governança37/37, diff e segredos PASS.
- R4 independente **food06_reader_r4**, favorável e delimitada:78unitários+18PG próprios no checkpoint,
  **82unitários próprios finais** após P3. Não repetiu PG depois do patch localizado; root executou18PG depois.
  Não é R4 integral FOOD06, prova externa, execução de CI pelo revisor ou ratificação clínica.
- Base **80f658c4**: CI41679598259/scanners SUCCESS, incluindo migrations completas,
  inventário RLS, role runtime e Testcontainers. Fecha a falha do inventário de a56cf204.
- **CI/scanners deste novo HEAD: PENDING.** Não herda o verde da base.
- Web/Playwright/UX B/C novos N/A neste incremento sem interface; continuam gates da jornada futura.

Handoff: **tasks/food06-leitura-factual.md**. Plano/checklist/aceite/execução/status/progresso atualizados.
Próximo: carregador real autorizado de planos/versões/revisões, fonte/proveniência, materialização e CAS;
depois API/BFF por allowlist e UI. Esses itens ainda NÃO foram implementados por este leitor.

Local7fd70c24/remoto2de6462b, árvore idêntica7513641f254cf770e36c7d33abcfe7aa61ec11e7.
12blobs verificados, expected_sha/fast-forward, sem reset/rebase/force. Worktree principal preservada.

---

## Histórico — correção do inventário RLS — HEAD 80f658c4

CI a56cf204: Backend FAIL no inventário global; PR Gate FAIL por dependência.
Migrations completas, Demo, Web, Mobile, AI e scanners passaram. **Não é CI verde.**

Causa: tabela1081 append-only não constava da lista nominal do inventário.
Correção restrita ao teste: exige exatamente SELECT USING tenant e INSERT WITH CHECK tenant;
ALL, UPDATE/DELETE, policies adicionais ou ausentes continuam recusadas. Nenhuma policy
ou grant de runtime foi alterada. RED funcional no CI41671191108/job126040315172.
Foco local16/16 schema/PG PASS; revisão independente estática favorável, sem executar
inventário global. GREEN global ainda depende do novo CI com schema completo.

Local0cedaccd/remoto80f658c4, árvore idêntica f4b5276dcbcdd9a2d2e1de28aea4c3343db4105b.
Draft e37,5% mantidos; G06/direitos BLOCKED. Sem operações externas.

---

## Histórico — armazenamento factual interno M05/M07, HEAD a56cf204

PR #455 **Draft**. **37,5% administrativos: 1 concluída (M09), 7 parciais, 4 pendentes.**
M05/M07 permanecem parciais. Fonte clínica real/CAS, leitura clínica e API/BFF/UI ainda pendentes.
Direitos/DRI/G06 BLOCKED. Sem ativação, merge, deploy ou migrations externas.

### Entregue
- Migration aditiva 1081, entidade e serviço interno com ExecutorTenant/crypto/auditoria existentes.
  Novo armazenamento necessário: snapshots editoriais e documentos emitidos não comportam este registro sem mudar seus contratos.
- Conteúdo cifrado com envelope versionado vinculado à identidade/tenant/paciente/profissional/usuário/chave.
  Só metadados id/data na projeção e no índice paginado; nenhuma superfície HTTP nova.
- Professional responsável atual; autorização por tenant, permissões e carteira. Ordem de locks profissional → paciente → chave.
- Idempotência concorrente, conflito se mesma chave tiver outro conteúdo/paciente, auditoria na mesma transação e rollback integral.
- FORCE RLS com SELECT/INSERT, sem policy UPDATE/DELETE, FKs compostas. TRUNCATE depende de ausência de grant:
  não alegar proteção contra owner ou runtime privilegiada. Down recusa apagar histórico.
- Script oficial PostgreSQL/Testcontainers inclui a 1081, mantendo remoção das configurações externas.
- Carregador é callback interno transacional. Este incremento confere o contrato retornado, mas **não implementa**
  o adapter DB de planos/versões/fontes nem comprova CAS real da origem. Bloqueados para exposição futura.

### Evidências do delta
- RED funcional do schema e do writer; RED adicional de revogação concorrente → GREEN.
- **16/16** schema + PostgreSQL descartável (13 integração, 3 schema), zero skipped.
- **36/36** regressões PostgreSQL FOOD04/receitas/1081, zero skipped após flags corretos.
- Backend completo: **4.005 PASS / 193 SKIPPED**, 383 suítes PASS e 10 SKIPPED por gates explícitos.
- Node **22.23.4**: typecheck, Nest build e artefato dist/main.js PASS.
- Governança auditoria/migrations: **37 PASS**; diff-check e verificação de segredos PASS.
- R4 independente **food06_persistence_r4**: análise de leitura + execução própria **16/16**.
  Observação sobre lock profissional corrigida com TDD; re-revisão favorável no escopo interno.
  Não cobre cadeia completa de migrations, adapter real, produção ou validação clínica humana.
- Sem UI neste incremento; UX B/C e Playwright novos N/A aqui, continuam gates da jornada futura.
- Cadeia completa de migrations e scanners/CI deste **novo HEAD: PENDING**, sem transferir verde de commits anteriores.
  Base 5ac34b60 tinha Backend/Web/RLS e scanners SUCCESS, mas CI global ainda IN_PROGRESS na última consulta.
  Provenance SBOM, quando skipped pelo workflow, não representa aprovação.
- Mesma árvore local/remota **9678573a496162fc4ce92b94c5e89395bdc86f3a**.
  Commit local 3589f5f8 / remoto a56cf204: históricos preservados, publicação fast-forward com expected_sha,
  sem reset/rebase/force ou escrita na main.

Contrato, critérios, rollback e próximo passo: **tasks/food06-persistencia-factual.md**.
Não é conclusão da FOOD06. Próximo: loader autorizado de versões/revisões e leitor clínico seguro, depois API/UI.

---

## Histórico — construtor M05/M07, HEAD 5ac34b60

PR #455 **Draft**. **37,5% administrativos:1concluída(M09),7parciais,4pendentes**.
**Envelope factual imutável em memória; não é registro durável no banco.**
Sem API/BFF/UI, cifragem nova, migration ou ativação. DRI/direitos/G06 BLOCKED.

### Implementado

- Carregador interno recebe identidade/revisão e snapshots autorizados; construtor
deriva os próprios marcadores dos mesmos dados utilizados por PA06/M04. Não aceita
bases ou totais livres do navegador; isso não substitui autorização do carregador.
- Allowlist e cópia independente: campos computacionais/fonte/preparo, sem nomes,
descrições, nascimento original, referência textual livre, alternativas disponíveis
ou dados de refeições excluídas. Contexto resolvido pelo domínio existente.
- Congelamento profundo do envelope sem alterar/congelar a entrada; valores
históricos de porção preservados, sem consulta a catálogo atual ou segunda multiplicação.
- Decimais canônicos; diferenças só de ordem/rótulo/IDs copiados/case de hash/NFC
não geram diferença documental. Preparação não recebe equivalência por semelhança
nem fator de cocção. Ausência explícita/chave omitida se equivalem apenas no hash,
sem transformar ausência em zero ou modificar o snapshot.
- Fontes/concentrações incompletas e identidade manual/legada não resolvida ficam
não documentadas, preservando fatos. Referências numéricas continuam indisponíveis.
- Conferência de porção usa helpers existentes4casas(macros)/8casas(micros).
Divergência avisa e retira marcadores, **não corrige histórico**. Escritor antigo
com precisão diversa pode gerar aviso sem corrupção; ausência de aviso não prova
coerência do banco, autorização ou validade clínica.

### TDD, revisão e gates

| Gate | Resultado / limites |
|---|---|
| Histórico pré-reinício |12REDfuncionais/5PASS →56GREEN; logs temporários perdidos no restart, delta preservado |
| Fontes |Reprodução atual **5FAIL/19PASS** →63GREEN |
| R4 |Encontrou2P2: sparse array e base/gramas zero; reproduzidos com lacuna de coerência em **4FAIL/25PASS**, corrigidos |
| Canonicalização de ausência |**1FAIL/31PASS RED** → ajuste só no seed do hash |
| Foco final |**115/115PASS**,32construtor+39M07+44M04/cobertura, zero skipped |
| Backend final |**4.002PASS/180SKIPPED**,382suítesPASS/9SKIPPED; skips não são aprovação |
| Node22 |Typecheck, build Nest final e artefato dist/main.js PASS, Node22.23.4; sem engines/dependências alteradas |
| R4 independente |Favorável após correções;**68testes próprios+6probes PASS**. Complementos finais estáticos, sem suítes próprias adicionais/edição/DB/API ou validação clínica humana |
| Diff/segredos |PASS antes do commit |
| API/PG/Web/Playwright novos |**NOT RUN**: código interno não exposto, sem SQL/schema/rota/UI novos. Não reutilizar provas da base como execução deste envelope |
| CI deste HEAD |**PENDENTE**; sem herdar o verde da base |
| Base d8d63d62 |CI41419402009/scanners SUCCESS;23checks,22SUCCESS e Provenance do SBOM SKIPPED |
| G06/direitos |**BLOCKED**, nenhuma operação produtiva executada |

### Persistência e próximos gates

O inventário não comprovou armazenamento compatível: snapshots do plano pertencem
à versão/rascunho; DocumentoEmitido representa texto renderizado emitido ao paciente,
não análise interna. **Nenhuma tabela nova foi criada por suposição.**

Próximo incremento: repositório append-only cifrado e serviço transacional;
verificar main/numeração antes de propor migration, desenvolver/testar só em descartável.
Exigir vínculo de envelope/registro/escopo, schema/leitores versionados, autorização
tenant/paciente/carteira/fontes/proveniência, revisão/CAS, idempotência/replay,
locks ordenados, FORCE RLS/role runtime e rollback sem perda histórica.
Depois API/BFF/paginação/UI, UX B/C e R4 próprios. Não aceitar o registro bruto do cliente.

- Handoff `tasks/food06-construtor-registro-factual.md`; plano/checklist/matriz/
execução/status/progresso harmonizados; UX A M07 existente reutilizada, sem alegar
nova interface ou personas B/C. M05/M07 **não concluídas**.
- Local `5ecb21b0a9db571c3185fb47ad295d8561c8251c`; remoto `5ac34b6039e5ef919f1760a7f7f56ef3c89670b1`; árvore idêntica `f678af7317a7694c80830b618d9cbf868f8c97c6`.
-11blobs/árvore verificados, expected_sha/fast-forward; sem reset/rebase/force.
Worktree principal mantém next-env.d.ts preexistente intacto.

Não implementar FOOD05-MDL/D18. Sem merge/deploy/migrations externas/Neon/Render.
O retorno em03/11 não representa autorização operacional automática.

---

## Histórico — M07 fundamento interno, HEAD d8d63d62

PR #455 **Draft**, sem merge. **37,5% administrativos:1concluída(M09),7parciais,4pendentes**.
M07 permanece parcial. DRI/direitos/G06 BLOCKED. Sem API/UI/registro novo ou ativação assistencial.

### Implementado

- Comparador de dois estados congelados pelo mesmo PA06/M04, sem motor paralelo,
catálogo atual, soma de versões, segunda multiplicação de porções ou alternativas disponíveis.
- Contrato interno exige origem exata, instante registrado e revisão de rascunho;
confere vínculo tenant/paciente e coerência do plano/refeições. **Isso não autoriza HTTP
nem comprova a versão real no banco**: a camada autorizada futura deve resolver/verificar.
- Deltas/precisão/zero/parcialidade e indisponibilidade por nutriente reutilizados.
Total de cada versão separadamente, sem afirmar equivalência diária ou consumo real.
- Dimensões documentais planejamento/composição-fonte/referência/contexto:
ausente/malformado→não documentada, esquema desconhecido→incompatível.
Causalidade sempre não estabelecida; mudança de cobertura separada da mudança numérica.
- Projeção por allowlist, sem escopo, hashes ou contexto clínico.
**Construtor canônico dos marcadores não implementado**; hashes são contrato interno,
não autorização, revisão, coerência com snapshot ou prova causal.

### Evidências

| Gate | Resultado e limites |
|---|---|
| TDD M07 |**17FAIL/10PASS RED funcionais**, compilados; GREEN final **83/83** (39M07+44prévia/cobertura), zero skipped |
| Backend completo |**3.970PASS/180SKIPPED**,381suítesPASS/9SKIPPED; não transformar skips em RLS/provider aprovado |
| Node22 |Typecheck, build Nest e verificação dist/main.js PASS, Node22.23.4 compatível com engines |
| R4 independente M07 |Favorável no escopo interno;**83/83 próprios** e diff-check; sem escrita, DB/API/UI ou validação clínica humana |
| UX A complementar |Duas instâncias com papéis PR451/0d3382b6, brief sintético sem ferramentas/imagens/interação; portal direto N/A. B/C da futura UI pendentes |
| Diff/segredos |PASS |
| Web/Playwright/PG novos |NOT RUN neste delta puro e não exposto.162browser/72unitários PA07 e PG da base são evidências históricas |
| CI/scanners deste HEAD |**PENDENTE**, não herda o verde da base |
| Base b9ed65bc |**23checks:22SUCCESS/ProvenanceSBOM SKIPPED**; CI41398826715 SUCCESS com Backend/PG-RLS/Web/Demo/PRGate/scanners. Fecha M09 técnica e gate da correção PA07 |
| Direitos/G06 |**BLOCKED**, sem referências numéricas novas ou operação externa |

### Escopo restante e rastreabilidade

- **M07-C1/C2 parciais:** construir metadados/registro imutável M05–M07 a partir
da origem autorizada; revalidar carteira/tenant/paciente/fontes/versões/revisões
dentro da transação; API/BFF/RLS/concorrência/paginação e UI com gates próprios.
- Não aceitar hashes/totais do navegador; coerência e política canônica ainda devem
ser implementadas/testadas no servidor. Referência comum segue bloqueada quando
não elegível/autorizada. Não modificar publicações ou análises históricas.
- Handoff `tasks/food06-comparacao-versoes-dominio.md`; plano/checklist/matriz/
execução/status/progresso harmonizados; UX `docs/agents/ux/reports/FOOD06-M07-A/`.
- Método fixo mantido:100×(1+7×0,5)/12=37,5%; não é esforço/prazo/prontidão clínica.
- Local `33b4be0cade0830355706955473279f0532a1683`; remoto `d8d63d628c5caf6da8deba85e68f4c74b2a68af2`; árvore idêntica `2d292859c763a83e22f01f2daae7a1d6876ae3c1`.
-13blobs/árvore verificados, expected_sha/fast-forward; sem reset/rebase/force.
Alteração preexistente da worktree principal preservada.

**Próximo:** conferir CI exato deste HEAD; depois construtor/registro M05–M07,
reutilizando armazenamento apenas se comprovadamente compatível. Migration eventual
só desenvolvida/testada em descartável, nunca externa sem autorização. Nenhum
requisito M01–M12 removido. FOOD05-MDL/D18 não iniciado. Sem merge/deploy/Neon/Render.

---

## Histórico — M09 + correção PA07, HEAD b9ed65bc

PR #455 **Draft**, sem merge. **29,2% administrativos;0/12 melhorias integralmente encerradas**.
M09 e a correção têm evidências locais; **CI deste HEAD pendente**. DRI/direitos/G06 BLOCKED.

### Entregue nesta rodada

1. **M09:** guia próprio versionado na tabela factual e nas prévias, com sete tópicos
RDA/AI/UL, planejado/consumido, dados parciais, indisponibilidade e limites.
Não habilita valores DRI. Parser por allowlist, legado e fatos preservados;
URL NIH fixa, somente por clique e sem referrer.
2. **PA07:** prova determinística identificou confirmação prematura da liberação
de Web Locks. O adaptador agora aguarda a Promise original de locks.request;
o coordenador só publica ACK após conclusão, revalidando operação/abort.
Erro fecha em reconferir sem ACK. encerrar continua síncrono no cancelamento,
com release em background e rejeição capturada.

Não houve alteração de autorização/CAS, envelope do canal, timeout, dependência,
backend neste follow-up, schema, persistência ou configuração externa. Nenhum
retry cego, roubo de lock ou edição otimista. Abas com bundle antigo precisam
recarregar para executar o novo contrato de espera.

### Gates e evidências

| Gate | Resultado e alcance |
|---|---|
| TDD PA07 |**67PASS/2FAIL RED funcionais**, release confirmado antes da barreira e ACK prematuro → **72/72GREEN**, zero skipped |
| Browser controlado novo |**4/4PASS**, desktop/mobile × relógio real/simulado; bloqueio até término da Promise nativa, leitura antes de editar, zero escrita |
| Matriz integrada final |**162/162PASS**, zero skipped:8M09+12receitasM04+12editorM04+26FOOD07+66PA07/FOOD01–04+38tabela/contribuições/PA06 |
| Falhas históricas |Matriz anterior157PASS/1FAIL; isolado6PASS; suíte posterior61PASS/1FAIL. Preservadas, não convertidas em verde por retries |
| Causalidade |Fragilidade demonstrada e corrigida; **não comprovada a causa histórica** dos dois timeouts apenas pelo trace/reexecução |
| Web adicional |Harness PA06/prévia/fatos/contribuições **61/61PASS**; build webpack/typecheck **Node22.23.4 PASS**; lint2libs0erros/0warnings |
| Backend M09 |**3.931PASS/180SKIPPED** local; backend inalterado no follow-up PA07. Não apresentar skips como banco/provider aprovado |
| R4 PA07 independente |Favorável; **71/71 testes próprios** e diff-check no checkpoint; complemento final estático cobriu72ºteste de release rejeitado e2cenários browser. Sem browser/build próprios ou coautoria |
| R4 M09 |Favorável no delta;150Backend/60Web próprios no checkpoint, complemento final estático. Não é R4 integral FOOD06 |
| UX M09 B/C |Duas instâncias por papel explícito PR451/0d3382b6, brief sintético; sem ferramentas/imagens/interação próprias. Portal direto N/A; browser/capturas são do coordenador |
| Diff/segredos |PASS antes dos dois commits |
| Banco local novo |NOT RUN; sem delta de banco/backend neste follow-up |
| CI de b1c6d839 |Backend job125122724794 PASS, inclusive migrations descartáveis/role sem BYPASSRLS/Testcontainers-RLS; scanners PASS. Global ainda não declarado aprovado; não valida este delta Web |
| CI deste HEAD |**PENDENTE**. Revalidar Backend/PostgreSQL-RLS, Web, Demo, PRGate e scanners |
| Direitos/G06 |**BLOCKED**; nenhuma referência clínica numérica ou operação produtiva habilitada |

### Rastreabilidade e próxima ação

- `tasks/food06-interface-ajuda.md`: M09, fonte, RED/GREEN, UX e falhas anteriores.
- `tasks/food06-pa07-release.md`: prova determinística, correção, testes e limitações.
- Plano/checklist/matriz/execução/status/progresso harmonizados; história preservada.
- Local `96e3345b4bdbc37c6f7bf0f976893c84fb96f39e`; remoto `b9ed65bc1c40a48c91821f15301aa81a27ece8bc`; árvore idêntica `7ab482020506abcb091a738d6ad5d82959f5cbda`.
- Publicação Git Data API com blobs/árvore verificados e expected_sha/fast-forward;
sem reset, rebase, force ou alteração do delta preexistente da worktree principal.

**Próximo:** conferir CI exato deste HEAD; corrigir achados reproduzíveis.
Depois seguir M07 factual reutilizando snapshots autorizados, sem ativar referências
bloqueadas. Não encerrar M01–M12 nem a FOOD06 pela aprovação de um incremento.
FOOD05-MDL/D18 não iniciado. Sem merge/deploy/migration externa/Neon/Render.

---

## Histórico — M09 ajuda de interpretação, HEAD b1c6d839

PR #455 **Draft**. **29,2% administrativos;0/12 melhorias integralmente encerradas**.
M09 tem implementação e testes próprios; regressão PA07/CI do delta ainda pendentes.
DRI/direitos/G06 BLOCKED. Sem merge, deploy, migration externa ou ativação clínica.

### Implementado

- Guia próprio **Como interpretar estes valores**, sete tópicos recolhíveis: RDA, AI, UL, planejado/consumido, parcial, indisponibilidade e limites.
- Uma projeção server-side versionada reutiliza o catálogo existente, na tabela factual e nas prévias de porção/troca/receita. Nenhuma tabela DRI ou dado clínico nos textos.
- Metadados fora do fingerprint; sem gravação em planos/snapshots. Comparações permanecem desabilitadas.
- Parser por allowlist/limites, fonte NIH e URL exata; ajuda inválida preserva fatos e resposta legada continua válida. Link externo somente por clique, sem referrer.
- Zero conhecido, parcial, desconhecido e planejado≠consumido preservados. Nenhum motor paralelo, schema, dependência, fonte numérica ou autorização alterados.

### Evidências e limites

| Gate | Resultado |
|---|---|
| TDD Backend |2RED funcionais de projeção; GREEN e teste de fingerprint independente de redação |
| Backend completo |**3.931PASS/180SKIPPED**,380suítesPASS/9SKIPPED; skips não são prova de banco/provider |
| Web |12RED novos/48anterioresPASS → **61/61PASS** no harness PA06/prévia/fatos/contribuições |
| Browser M09 |**8/8PASS**, desktop/mobile; teclado, axe, fonte200%, fonte protegida, legado e ajuda inválida |
| Matriz integrada |Primeira158/158PASS; final **157PASS/1timeout PA07 aquisição desktop**, preservado como falha |
| PA07 diagnóstico |Cenário isolado3vezes por projeto **6/6PASS**; suíte inteira posterior **61PASS/1FAIL** em primeira transferência mobile, não no retorno antigo |
| Build/typecheck |Backend e Web webpack PASS, **Node22.23.4**, compatível com engines; Turbopack/symlink inválido foi setup, sem alteração para contornar segurança |
| Lint/microcopy/diff/segredos |PASS;6arquivos runtime0erros/0warnings |
| R4 M09 independente |Favorável no delta; revisor executou150Backend/60Web no checkpoint examinado; complemento final estático, sem browser/build/DB próprios. Não é R4 integral FOOD06 |
| UX B/C |Duas instâncias com papéis PR451/0d3382b6, brief sintético e sem ferramentas/imagens/interação próprias. Portal direto N/A. Capturas e browser são do coordenador |
| PostgreSQL M09 local |NOT RUN; sem alteração de banco. Gate oficial descartável deve executar no novo CI;141provas da API receita são históricas |
| CI deste HEAD |**PENDENTE**, não herda sucesso da base |
| Base c949821b |CI41357758927 SUCCESS, inclusive Demo/PRGate, scanners SUCCESS. Provenance SBOM não revalidada individualmente neste ciclo |

### PA07 — pendência preservada

Revisão independente adicional confirmou **lacuna de teste**, sem causa comprovada:
liberação sintética é síncrona; adaptador Web Locks não oferece ACK de liberação efetiva,
e mensagem `liberado` é publicada antes de aguardar esse término. Hipótese compatível
com aquisição única `ifAvailable`, mas trace não registra eventos lock/canal e não
comprova causalidade. Falha mobile ocorreu antes de salvar/retornar/fastForward.
Sem delta nos coordenadores PA07, nem evidência de perda de dados/quebra de CAS ou
autorização. **Não declarado PASS global**, não reabre A04/A05 FOOD05 por associação.

Próxima ação: prova determinística com barreira de liberação e browser instrumentado
sintético, confrontando CI; sem retry cego, timeout maior ou edição otimista.
Depois seguir M07 factual. Nenhum requisito M01–M12 retirado.

### Rastreabilidade

- Handoff: `tasks/food06-interface-ajuda.md`.
- Matriz/progresso/plano/checklist/execução/status harmonizados; história preservada.
- UX: `docs/agents/ux/reports/FOOD06-M09-BC/`.
- Git CLI sem credencial válida: publicação por Git Data API,29blobs e árvore verificados,
  expected_sha e fast-forward, sem reset/rebase/force.
- Local: `4473d6e733b3daf5f4125d39895a1604221d8496`; remoto: `b1c6d8398d14cefb74735d88f147f32893925d20`; árvore idêntica: `f7293a6b932784afb55883525ebe1354d31c05d0`.
- Worktree principal mantém alteração preexistente em next-env.d.ts intacta.
- FOOD05-MDL/D18 não iniciado. Sem operações Neon/Render/produção.

---

## Histórico — M04 receitas integrada na Web, HEAD c949821b

PR #455 **Draft**, sem merge. **29,2% administrativos;0/12 melhorias integralmente encerradas**.
M04 segue parcial: comparação clínica e matriz global ainda pendentes. DRI/direitos/G06 BLOCKED.

### Implementado

- Nova ação opcional **Calcular impacto no rascunho** na conferência FOOD07 de porções.
- Reutiliza o mesmo cliente/parser/ACK e tabela M04 de4macros/22micros: antes/depois/diferença, cobertura e ausência explícita. Zero conhecido não vira ausência; subtotal parcial não vira total completo. Percentual é variação sobre o próprio valor anterior.
- Variante de receita envia apenas ID/versão/porções/destino e precondições; nenhum ingrediente/composição do navegador.
- Confirmação usa callback pai, writer/CAS/ACK/releitura e dreno PA07 existentes, sem chamar inserção local simultaneamente.
- Consulta cancelada descarta resposta tardia; comando confirmado não é abortado por desmontagem. Cancelar/fechar bloqueados durante confirmação.
- **Fluxo legado preservado:** disponível antes da comparação e após descarte explícito; desabilitado enquanto o impacto estiver ativo. Biblioteca, portal e publicação mantêm seus contratos.
- Sem backend novo, dependência, migration, configuração externa ou ativação clínica.

### Evidências do delta

| Gate | Resultado e limites |
|---|---|
| TDD cliente |1RED funcional de body incompleto→48/48GREEN |
| TDD browser inicial |Ação ausente na build anterior; modal/biblioteca carregados |
| Matriz integrada |**150/150PASS**, sem skipped:12novos receita+12M04+26FOOD07+62PA07/FOOD01–04+38tabela/PA06, desktop/mobile |
| Após microcopy final |**2/2PASS**: axe/Escape, fonte200%, controles acessíveis e rolagem horizontal pelo teclado no mobile; reexecuções, não novos casos |
| Build/typecheck |PASS Node22.23.4; build final recompilada |
| Lint |0erros; novos arquivos/biblioteca sem warnings;8warnings preexistentes no editor central, sem supressões |
| Linguagem/segredos/diff |PASS |
| R4 independente delimitada |food06_m04_editor_r4 favorável;48testes próprios, leitura e conferência do delta final de microcopy. Sem browser/build/CI próprios, não é R4 integral FOOD06 |
| UX B/C |Duas personas independentes leram código e capturas sintéticas desktop/mobile; sem interação própria, usuários reais ou validação clínica. Sugestões P2/P3 registradas em backlog, sem escopo automático |
| CI/scanners deste HEAD |**EM VALIDAÇÃO**, não inferir PASS de commits anteriores |

A primeira bateria nova teve6PASS/6FAIL por fixtures/expectativas: ausência total versus subtotal parcial, refeição já expandida e texto exato de espera PA07. Corrigidos casos/seletores sem diminuir asserts ou ampliar timeouts. Matriz sequencial seguinte150PASS. A única alteração funcionalmente neutra posterior foi reformulação de frase para o gate de linguagem; recompilação e2retestes visuais concluídos.

### Banco e histórico de CI

- **4c1e2317 /CI41349977153:** FAIL Backend/PRGate; três novos casos PG pararam por `EntityMetadataNotFoundError` no DataSource explícito do teste. Não foi RED funcional nem falha de produto demonstrada.
- **373c1ddf /CI41355886047:** registro do harness corrigido, sem alterar schema/permissões/asserts. Backend **4.041PASS/65SKIPPED**; gate PostgreSQL/RLS descartável **141/141PASS,0skip**, incluindo os3casos de receita. Web/Mobile/scanners PASS. Demo/global ainda em execução na última consulta antes deste push; resultado global deve ser registrado conforme observado, podendo ser substituído pelo novo HEAD.
- Não houve execução de banco externo, migration de ambiente ou regularização operacional.
- CI do novo HEAD é gate próprio e inclui novamente as verificações aplicáveis.

[Execução/handoff](../../../tasks/food06-interface-previa-receitas.md) · [Matriz](../../../tasks/aceite-pos-320-food06.md) · [Progresso](../../../tasks/progresso-food06.md) · [UX e capturas](../../../docs/agents/ux/reports/FOOD06-M04-RECEITAS-BC/consolidado.md)

### Publicação e limites

Credencial CLI expirada: Git Data API com23blobs e árvore **53af3cdd9148dc183a560e2836ed2812f16a8d4d** idênticos ao commit localc5c20ad3. Remoto c949821b9622601f2c86db1d839542ae20eab3c7, pai373c1ddf; fast-forward com expected_sha, sem force/reset/rebase. Worktree principal preexistente preservada.

Sem merge/deploy/migrations externas/Neon/Render/quota/cobrança/FOOD05-MDL. Próximo: conferir CI deste HEAD e critérios restantes das ondas aprovadas. Não declarar FOOD06 concluída nem retirar Draft.

---

## Histórico preservado — incremento anterior

## API M04 de receitas — checkpoint anterior, HEAD 4c1e2317

PR #455 **Draft**, sem merge. **29,2% administrativos;0/12 melhorias encerradas**.
M04 parcial. Direitos DRI/G06 BLOCKED; FOOD05-MDL fora do escopo.

### Alterações

- Nova variante estrita `inserir_receita`: refeição de destino, ID/versão da receita e porções. Ingredientes e composição não vêm do cliente.
- Reuso de `ServicoPorcionamentoReceita.preverNaTransacao` FOOD07 no mesmo manager tenant-aware; sem motor paralelo/transação aninhada.
- Antes congelado; depois acrescenta ingredientes ao destino e usa preparador/resolvedores/PA06/cobertura/writer existentes. Ausente não vira zero; alternativas não se somam ao principal.
- Reautoriza paciente/plano e receita pessoal/clínica; receita ativa, catálogo/fonte autorizados. Receita sem base não recebe inferência.
- Locks paciente→plano→rascunho→receita read; versão, revisões e fingerprint conferidos novamente na confirmação.
- Identidades novas determinísticas, validação do documento expandido, novas alternativas não liberadas/não preferidas. Biblioteca e históricos preservados; replay409.
- Sem novas migrations/dependências/rotas ou alterações de ambiente.
- **A interface da biblioteca de receitas ainda não está conectada a esta operação.**

### Evidências e gates

| Gate | Resultado |
|---|---|
| RED/GREEN inicial DTO/serviço |4RED funcionais (188PASS)→192GREEN; setup incorreto anterior não é RED |
| Focados backend +reuso FOOD07 |431/431PASS |
| Backend completo final |3.926PASS/180SKIPPED;379suítes PASS/9SKIPPED; skipped não é aprovado |
| BFF |82/82PASS;2novos de receita, sessão/fetch simulados |
| Typecheck/build/artefato |PASS Node22.23.4 |
| Diff-check/scanner local de segredos |PASS |
| R4 independente delimitada |food06_m04_editor_r4 favorável;431/431testes próprios; sem PG/browser/build/CI próprios, não é R4 integral FOOD06 |
| Novos3PG/RLS |**PENDENTES de execução no novo CI**: materialização/histórico/flags/replay/tenant; arquivamento; CAS concorrente+rollback |
| CI/scanners deste HEAD |**EM VALIDAÇÃO** |

Imagem local `timescale/timescaledb-ha:pg15` ausente, overlay133MiB livres. Sem pull/alteração de infraestrutura; usar o gate oficial descartável de CI. A primeira suíte completa teve erro de tipo no assert PG novo; corrigido com assert estrutural igualmente exigente. A execução completa posterior passou nos testes executados.

Base anterior **c8389ebc**, CI[41338861846](https://github.com/octanutri-clin/octaclin/actions/runs/41338861846): Backend/Web/Mobile/Demo/PRGate e PG/RLS PASS; Semgrep/CodeQL/Trivy/Dependency Review/pesquisa PASS. Essa evidência não é atribuída ao delta novo. Browser da interface anterior:50+62 execuções PASS, histórico preservado abaixo.

[Contrato/execução/handoff](../../../tasks/food06-api-previa-receitas.md) · [Matriz](../../../tasks/aceite-pos-320-food06.md) · [Progresso](../../../tasks/progresso-food06.md)

### Publicação e continuidade

Publicação por Git Data API devido à credencial CLI expirada:14blobs e árvore integral **220ba80deca050b683c6313ef7dfb2e6dfceee78** iguais ao commit local3efe6588. Commit remoto 4c1e2317e22b5fdf7578a61ac5ec9614a5d3a033, pai c8389ebc; fast-forward com expected_sha, sem force/reset/rebase. Históricos preservados.

Próximo: comprovar o novo CI/PG; integrar prévia de receitas na Web com PA07/ACK/autosave e UX B/C. Não declarar M04 nem FOOD06 concluídas.
Sem merge/deploy/migrations externas/Neon/Render/quota/cobrança/ativação clínica.

---

## Histórico preservado — interface M04 anterior

## Interface factual M04 — checkpoint anterior, HEAD c8389ebc

PR #455 **Draft**, sem merge. **29,2% administrativos; 0/12 melhorias integralmente encerradas**.
M04 permanece parcial: receitas/preparo e demais operações aprovadas ainda pendentes. Direitos DRI e G06 BLOCKED.

### Implementado neste delta

- Ação por alimento no rascunho materializado/salvo: porção manual e troca de catálogo autorizado, com origem, revisão, preparo/fonte e peso explícito.
- Prévia sem gravação, 4 macros +22 micronutrientes antes/depois, cobertura/ausência explícitas e percentuais relativos ao próprio valor anterior; nenhuma adequação DRI habilitada.
- Cliente/projeções por allowlist e erros genéricos; proposta alterada invalida confirmação; cancelamento descarta respostas tardias.
- Confirmação reutiliza API, writer/CAS e releitura existentes; publicação separada; autosave60s usa revisão confirmada.
- PA07 aguarda ACK no dreno de operações existente. Comando já confirmado não é cancelado apenas pelo ciclo de vida do modal. Guardas de paciente/plano/geração/coordenador/sequência impedem callback antigo de invalidar outro contexto.
- Nenhuma dependência, migration, integração externa ou alteração de produção.

### Evidências do delta

| Gate | Resultado |
|---|---|
| TDD parser/ação/PA07 | RED funcional reproduzido e GREEN; HTTP adicional sem alegação de RED próprio |
| Harness Web | **47/47 PASS**, zero skipped |
| M04 +tabela/contribuições/PA06 desktop/mobile | **50/50 PASS** sequenciais, incluindo12 novos M04 |
| PA07/FOOD01–04 desktop/mobile | **62/62 PASS**, zero skipped |
| Build webpack/typecheck | PASS com Node22.23.4,194páginas |
| Lint/microcopy/segredos/diff | PASS;8warnings preexistentes no editor central, comparados ao HEAD base; nenhum novo |
| R4 independente delimitada | food06_m04_editor_r4 favorável;47 testes próprios e2 reproduções transitórias RED/GREEN, sem browser/build/banco/CI próprios; não é R4 integral FOOD06 |
| UX B/C | Personas independentes com papéis explícitos PR451/0d3382b6; avaliação textual de código/fluxo/provas, sem interação visual própria nem usuários reais |
| PostgreSQL/RLS da API anterior | PASS no CI a657e696;138/138 na suíte dedicada, incluindo5 novos cenários; não atribuir esse resultado ao novo HEAD |
| CI/scanners deste HEAD | **PENDENTE de conclusão** |

Primeira matriz browser teve49PASS/1falha de artefato ENOENT porque duas execuções compartilharam outputDir. Reexecução sequencial50PASS; nenhum assert/timeout reduzido. Não executar processos Playwright simultâneos no mesmo output.

Documentação: [execução/handoff](../../../tasks/food06-interface-previa.md), [progresso](../../../tasks/progresso-food06.md), [UX](../../../docs/agents/ux/reports/FOOD06-M04-BC/consolidado.md).

### Publicação e limites

Credencial CLI expirada: publicação pelo conector Git Data, com hashes dos15blobs e igualdade integral da árvore **ac7e37015da52f52971060e4ff7cc41eb8aa6b9c** conferidos. Commit remoto c8389ebc791a866b9c86101e43edb9df7d6a662b corresponde à árvore do commit local9111b625; ambos os históricos foram preservados. Fast-forward com expected_sha a657e696, sem force/reset/rebase. Esta distinção não altera o conteúdo validado.

Sem merge, deploy, migrations externas, Neon/Render, FOOD05-MDL ou ativação clínica. Próximo incremento: demais operações M04 aprovadas, após CI deste delta.

---

## Histórico preservado — incremento anterior da API

## API factual M04 — checkpoint anterior a657e696

PR #455 **Draft**, sem merge. **29,2% administrativos, 0/12 melhorias encerradas**.
M01–M12 mantidas; direitos das referências e G06 BLOCKED.

### Implementado e reuso

- Prévia/confirmar porção manual e troca de catálogo no rascunho salvo/materializado.
- DTO estrito, BFF8KiB/no-store e Professional responsável com gerenciamento.
- Antes congelado; depois pelo preparador/resolvedor/writer editorial existente, PA06 e cobertura. Nenhum motor paralelo, fonte do browser ou alteração de publicação.
- Reautorização tenant/paciente/carteira, locks paciente→plano→rascunho, revisão/fingerprint refeito. Confirmação materializa atomicamente; replay recebe409. Não há recibo persistido de ACK.
- Alternativas existentes/flags legítimas preservadas e não somadas ao principal.
- R4 achou e reproduziu omissão legada custom/medida e rótulo antigo; correções com null explícito e descrição autorizada após clone. Novos testes RED/GREEN.
- Demo do HEAD53835d72 falhou no gate de linguagem de um canário sintético; reprodução local e renomeação conjunta de fixture/assert, sem redução de controle.

### Evidências locais do delta

- Backend completo **3906 PASS / 177 SKIPPED**, 379 suítes PASS/9 skipped; **200/200** focados serviço/DTO/controller. Cinco skipped novos são PostgreSQL, não PASS.
- BFF **80/80**; Playwright **38/38** desktop/mobile FOOD06 factual + PA06, incluindo canário/teclado/axe/origem. Não é uma interface nova M04.
- Typechecks backend/Web, build Nest/verificador, Next webpack194páginas, ESLint afetado, microcopy, APIs dinâmicas164, authz de rotas30/30, diff e segredos PASS.
- Conjunto completo dos27scripts test:authz concluído localmente com Node22, até Fase318; nenhuma falha/skipped nos resultados.
- R4 independente delimitada /root/food06_m04_api_r4: **254/254** em6suítes backend próprias, **80/80 BFF**,22casos adversariais transitórios. Sem coautoria/edição, nenhum achado reproduzível pendente. Não executou PG/browser/HTTP real/CI; não é R4 integral FOOD06.
- Node22.23.4. Cache local reutilizado, sem dependência/lockfile/engine novos. Bootstrap pnpm recusado e build inicial com módulo fora do path não foram RED funcional; repetidos por caminhos locais suportados.

### CI / limitações / próximo

HEAD **a657e696f00cba9185f572e901f13b0f7177eb6f**, OctaClin CI **41312592535** em execução. Backend, Mobile, AI e governança PASS; CodeQL, Semgrep, Trivy, Dependency Review e pesquisa documental PASS. Web ainda em execução, Demo/PR Gate pendentes. Sem PASS global atribuído.
Cinco novos cenários reais PG/runtime/RLS: prévia imutável/confirmação/histórico/tenant; duas confirmações concorrentes CAS; autosave e OFF; transferência; falha intermediária/rollback de filhos/identidades. **PASS no CIa657e696**: Backend job124865954455, suíte completa4018PASS/65SKIPPED e etapa Testcontainers4suítes/138PASS/0SKIPPED, comando sem filtro, cinco casos ativos. NOT RUN local por imagem Timescale ausente/disco insuficiente. Isso não encerra PA07/interface M04.
SBOM provenance deve ser registrado pelo resultado real do workflow, sem dispensas.

Discussão Semgrep555 respondida e resolvida com triagem estática e revisão independente: literal constante em fixture excluída do build, sem entrada HTTP; canário/assert preservados. Não foi dispensado nem presumido o estado direto do alerta/SARIF. Evidência: comentário4435906197. Logs da falha Demo53835d72 confirmam exatamente o canário/microcopy reproduzido localmente.

Próximo: CI/PG, UI M04 no editor com PA07/ACK/autosave60s/cancelamento, UX B/C e demais operações receita/preparo. M04 permanece PARCIAL; nenhuma retirada do escopo. Sem merge, deploy, migrations externas, Neon/Render ou FOOD05-MDL/D18.

Publicação via conector por credencial Git/CLI indisponível (401): árvore remota **0442ac1d86983b1de58674ecff99a075360135ef** verificada byte a byte por hashes dos19blobs, idêntica ao commit local preservado **54030c5636512f94d27b76af6ed6a7a9f4b8e4b0**. Ref da PR avançada sem force e com expected_sha53835d72. Árvores iguais; SHAs dos commits diferem por autoria/metadados. Nenhum reset/rebase/descarte local.

Contrato/evidências/handoff: `tasks/food06-api-previa-micronutrientes.md`.
Progresso: `tasks/progresso-food06.md`.

<details>
<summary>Histórico preservado — checkpoints substituídos pelo estado acima</summary>

## Incremento vigente — núcleo factual M04, HEAD53835d72

PR única #455 **Draft**. Escopo M01–M12 mantido; **29,2% estimados administrativos,
0/12 melhorias integralmente encerradas**. Sete parciais/cinco pendentes pelo
método fixo de `tasks/progresso-food06.md`; não é prontidão clínica ou código%.

### Entregue neste delta

- Núcleo interno antes/depois reutilizando PA06/cobertura, macros/micros,
  diferenças com sinal escala8 e percentual de mudança versus próprio estado
  anterior — não RDA/AI/UL. Basezero/limitepercentual explícitos.
- Dados parciais/incompatíveis preservam subtotais e impedem delta aparentemente
  completo. Macros independentes válidos continuam disponíveis. Sem NaN/Infinity.
- Entradas preservadas, nenhuma fonte/snapshot cru projetado. Troca explícita de
  estados retira principal e mantém demais itens sem somar alternativa disponível.
- **Sem rota, UI, gravação ou aplicação M04.** Futuro serviço precisa autorizar
  paciente/fontes/revisões e construir estados server-side; isto não é DTO HTTP.
- Três novas regressões M02: duas bases de receita para1,5porções→187,5g,
  micronutrientes congelados uma vez, alternativa preferida/liberada não somada;
  catálogo com base10g/fonte congelada, nova materialização por fonte inativa negada.
- Duas provas PG/RLS de receitas adicionadas à suíte oficial, aguardando o CI.

### Evidências do delta

- TDD RED15/15 funcionais; GREEN193 focados após adversários e catálogo.
- Backend completo **3854PASS/172SKIPPED**,378suítesPASS/9SKIPPED. Os dois skipped
  novos são PG/RLS de receitas, não PASS; execução real depende do CI novo.
- Typecheck, build Nest/verificador, diff e scanner local de segredos PASS, Node22.
  Sem dependência, lockfile, engine, migration ou configuração operacional nova.
- R4 independente delimitada:166testes próprios, parecer sem achados. Experimento
  matemático transitório609pares sobre totais PA06, não oráculo clínico/oficial;
  reutilizou decimalParaEscala8 e script não persistiu.19casos versionados no núcleo.
  Não executou novoPG/browser/CI/providers e não é R4 integral da FOOD06.
- Web/BFF/browser inalterados neste delta; não inventar nova execução. Provas
 35Web/76BFF/38Playwright do incremento anterior são históricas daquele código.
  UX B/C nova aguarda primeira interface M04, sem criar portal ou nova prescrição.

### CI e gates

Basea35a22dd observada com backend, Web, scanners e PG/RLS/concorrência PASS;
Run41287980436 (a35a22dd) encerrou globalmente CANCELLED após a atualização da
branch, conforme concurrency existente; Demo não terminou nesse HEAD. Backend,
Web e provas PG/RLS concluídos são evidências individuais preservadas; não são
CI global PASS. SBOM provenance SKIPPED. CI/scanners do HEAD53835d72 em execução,
sem herdar PASS da base.

Próximo: conferir CI/novas provas de receitas, integrar API/BFF de prévia com IDs
estáveis/autorização/fontes/revisões/fingerprint, confirmação CAS/posse PA07 e UI.
A demonstração de troca no domínio não encerra aplicação integrada M02/M04.
Direitos e G06 **BLOCKED**. Sem merge, deploy, migrations externas, Neon/Render,
FOOD05-MDL/D18 ou referências clínicas habilitadas.

Handoff/contratos: `tasks/food06-previa-factual-dominio.md`.

<details>
<summary>Histórico preservado — checkpoints substituídos pelo estado acima</summary>

## Incremento vigente — M02 fonte/ordem/origem, HEADa35a22dd

PR única #455 **Draft**, sem merge na main. Base36223bcd aprovada com22checks
success e SBOM provenance SKIPPED. O CI do novo HEAD está pendente e não herda
PASS da base. **FOOD06 não concluída:25% estimados,0/12 melhorias encerradas.**

### Implementado

- Fonte/preparo/base por allowlist do snapshot publicado, ausência explícita,
  sem catálogo vivo, referência livre custom, cifra, contexto ou hash interno.
- Ordem opcional plano/contribuição validada por DTO+serviço, retrocompatível.
  Ordenação da seleção inteira antes da paginação, valor não arredondado,
  zero conhecido antes de desconhecidos, posições exatas e empates estáveis.
- Modal somente leitura por endpoint existente: versão publicada/ID/número,
  refeição e item exatos. Preserva rascunho, cancela resposta tardia e propaga
  403/404/409 até PA06. Apenas ingredientes/quantidades na projeção da UI.
- Largura mobile corrigida com RED423px>361px; nenhuma mudança de timeout,
  dependência, autorização, schema ou dado histórico.

### Evidências locais deste delta

- TDD funcional domínio/DTO/serviço; reprodução adicional Node22 sobre base
  extraída em diretório descartável:5FAIL/160PASS. Worktree não foi revertida.
- Backend completo3832PASS/170SKIPPED (377suítesPASS/9SKIPPED); focadas215PASS
  no checkpoint anterior às quatro negativas extras do pipe, incluídas no completo.
- Web35/35, BFF76/76; Playwright38/38 no build local otimizado desktop/mobile,
  inclusive origem errada, resposta tardia,403, teclado/axe e largura contida.
- Typechecks backend/Web, builds Nest/verificador e Next194páginas, lint, diff
  e scanner local de segredos PASS. Node22.23.4; cache local reutilizado por symlink,
  sem alteração de engines/lockfile. CI frozen/scanners ainda serão conferidos.
- R4 independente delimitada: P2 da ordem no parser reproduzido e corrigido,
 35Node próprios PASS e leitura estática final favorável. Não é R4 integral
  FOOD06 nem execução própria de browser/CI/PostgreSQL/benchmark pelo revisor.
- UX B/C por duas personas distintas com brief sanitizado, sem browser próprio
  ou usuários reais. Paciente N/A direto; sugestões de compreensão registradas,
  sem nova decisão de produto automaticamente aplicada.

### Gates e próximos passos

- Novo teste PostgreSQL/RLS ampliado para ordem8antes2, paginação/posições, fonte
  e imutabilidade: NOT RUN local; imagem Timescale ausente e filesystem Docker
  sem espaço suficiente. Não substituí imagem/segurança nem atribuí PASS a mock.
  A suíte oficial do CI deve executar essa prova com role runtime/RLS.
- Conferir CI do HEAD exato; completar matriz M02 de receitas/porções e
  substituição planejada explicitamente selecionada, depois M04 conforme dependências.
- Sem comparação RDA/AI/UL habilitada. Direitos e G06 BLOCKED; sem merge, deploy,
  migrations externas, Neon/Render ou FOOD05-MDL. Histórico permanece imutável.

Contrato/handoff: `tasks/food06-m02-origem-ordenacao.md`.
Progresso/metodologia: `tasks/progresso-food06.md`.
Artefatos UX/capturas/hash/benchmark: `docs/agents/ux/reports/FOOD06-M02-ORIGEM-BC/`.

<details>
<summary>Histórico preservado — checkpoints anteriores substituídos pelo estado acima</summary>

## Incremento vigente — interface factual M02, HEAD36223bcd

PR única #455 **Draft**. Este delta Web adiciona detalhe sob demanda por nutriente,
agrupado por plano/refeição/alimento, com paginação25, total integral e cobertura.
Base API992fee05 com22 checks success e SBOM provenance skipped, incluindo provas
PostgreSQL/RLS/concorrência. O PASS da base não valida automaticamente a UI nova.

### Implementado neste incremento

- Quantidades/unidades/peso congelados, formatação pt-BR e subtotal da refeição
  inteira distinguido dos alimentos da página. Sem nova soma nutricional visível.
- Projeção por allowlist e verificação de publicações, IDs, paginação, contagens,
  causas e reconciliação de agregados. Zero conhecido continua distinto de ausência.
- Estado apenas em memória, POST/no-store/abort, descarte de respostas tardias e
  invalidação403/404/409 até a PA06, incluindo remoção dos cartões legados.
- Teclado/axe e desktop/mobile com cenários sintéticos; relatórios UX B/C limitados
  à interface profissional. Nenhuma nova exposição no portal ou dados reais.

### Evidências e limites

- TDD funcional: parser, coorte, reconciliação, invalidação ancestral e igualdade
  integral de cobertura reproduzidos RED e corrigidos GREEN.
- Node22:31/31 unitários; Playwright FOOD06+PA06:36/36. Lint, typecheck e build Web
  PASS,194 páginas. Ferramentas reutilizadas de cache local; instalação congelada,
  scanners e integração completa dependem do CI do HEAD enviado.
- Os27 scripts de test:authz executados diretamente em dois workers, Node22,
  terminaram com exit0; nenhum skipped nessa bateria.
- R4 independente do delta: três achados corrigidos, sem pendências; revisor
  executou31 testes Node. Não executou browser/CI e não é R4 integral FOOD06.
- Detalhe das provas e limitações: `tasks/food06-interface-contribuicoes.md`.

### Progresso e próximo passo

**25% estimados administrativamente;0/12 melhorias integralmente encerradas.**
Seis parciais e seis pendentes, com pesos/metodologia em `tasks/progresso-food06.md`.
M02 ainda precisa de fonte/preparo, ordenação global e navegação segura de origem.
Depois seguem M04 e integrações conforme dependências, sem retirar M01–M12.
Direitos das referências e G06 continuam BLOCKED; nenhuma comparação RDA/AI/UL
ativada. Sem merge, deploy, migrations externas ou FOOD05-MDL.


CI do HEAD36223bcd: em execução; sem PASS atribuído antes da conclusão dos checks.

<details>
<summary>Histórico preservado — API M02 e consolidação; pendências de CI abaixo foram substituídas pelos resultados do respectivo HEAD</summary>

## Incremento vigente — API M02, HEAD992fee05

PR única #455, ainda Draft. Implementação autorizada de API/paginação/autorização/concorrência; baseec3690b1 terminou sem checks pendentes ou falhas antes da retomada. Não é conclusão da FOOD06.

### Implementado

- POST `analise-micronutrientes/contribuicoes` no backend e BFF compartilhado, sessão/permissão existente,64KiB e `private, no-store`.
- Código de micronutriente permitido, página1–10000, limite1–100, entrada sem coerção/extra. Total e cobertura integrais, apenas contribuições da página calculadas/projetadas.
- IDs persistentes de itens; quantidade/unidade/gramas e descrição congelados. Sem índice interno, ORM/cifra ou proveniência clínica.
- Reautorização tenant/paciente/carteira e revisão/publicação por página, dentro da fronteira transacional PA06; locks compartilhados com writers.409 se origem muda, negativa sem projeção parcial se acesso perdido.
- Snapshots publicados e seleção ON/OFF preservados; leitura repetida não grava nada. Não resolve catálogo vivo nem ativa DRI/RDA/AI/UL.

### Evidências locais

- TDD RED15 falhas iniciais →156 focados PASS. Revisor independente achou teto de200 páginas insuficiente; RED1FAIL/14PASS, correção nos dois validadores e regressão página10000/limite1.
- Backend completo **3816 PASS/170 SKIPPED**,376 suítes PASS/9 SKIPPED, Node22.23.4. Uma tentativa pela raiz falhou por path relativo de ficha313; repetição correta no diretório backend PASS sem alterar a Fase313.
- BFF RED75PASS/1FAIL →76/76PASS. Typechecks backend/Web, build Nest/verificador de artefato, lint da rota, diff e segredos PASS.
- R4 independente delimitada:154 testes próprios e120 janelas sintéticas; P2 de paginação fechado, sem bypass identificado. Benchmark domínio~222ms/10k itens/100 retornados, sem banco/cifra ou prova de carga.

### Gates ainda pendentes deste HEAD

Quatro cenários novos no PostgreSQL/RLS descartável do CI: páginas/identidades/cobertura/imutabilidade+isolamento; OFF concorrente409; publicação concorrente409/histórico; transferência sob lock e negativa da próxima página. **Não executados localmente: estão nos170 skipped, sem PASS atribuído.** CI/scanners do992fee05 em execução.

Nova interface, UX B/C de detalhes, fonte/preparo completos, teste HTTP real backend e carga ponta a ponta não foram executados neste incremento. Não afirmar aceite integral M02/M01–M12, revisão integral FOOD06 ou prontidão produtiva. Direitos/G06 BLOCKED; sem merge/deploy/migrations externas/FOOD05-MDL.

Contrato/handoff/testes: `tasks/food06-api-contribuicoes.md`. Próximo passo imediato: conferir o CI, sobretudo quatro provas PG do delta e scanners; corrigir qualquer falha comprovada antes de avançar para UI.

<details>
<summary>Histórico da consolidação e estabilização até ec3690b1 — estados supersedidos pelo incremento acima</summary>

## Última conferência da estabilização — ec3690b1

- Backend, Web e Mobile PASS no HEAD final. Backend inclui PostgreSQL descartável, role sem BYPASSRLS, suíte completa, Redis real e Testcontainers/RLS, todos concluídos com sucesso.
- Semgrep OSS PASS, zero novas anotações (check124653510171); sem discussão de revisão aberta. Estado direto do alerta539 não consultável via credencial atual (403), sem dispensa executada.
- Pesquisa25/25 PASS, inclusive controle de redirects antes da conexão; revisão independente do patch favorável e com execução própria14 testes+9 variantes sintéticas. Sem novas consultas aos sites oficiais.
- CI nesta consulta: 20 success; pendentes: Demo local smoke; skipped: Provenance do SBOM. Nenhuma falha registrada.
- Demo visual completo teve~18min no checkpoint anterior aprovado; não confundir duração com travamento nem alterar timeouts por isso. PR Gate depende da conclusão do workflow.
- **Não é conclusão da FOOD06**: M01–M12 seguem parciais, direitos e G06 BLOCKED. A API M02 continua pausada até finalizar os gates. Sem merge/deploy/migrations externas. PR permanece Draft.

---

## Estado vigente — PR consolidada FOOD06

Esta é a **PR única em Draft** dos incrementos #455–#459. HEAD `ec3690b1`. Consolidação fast-forward preservou integralmente o histórico até `4b23e8bf`, sem merge na main. #456 foi reconhecida pelo GitHub como integrada à base #455; #457–#459 foram encerradas como supersedidas, com branches/relatórios preservados. Não houve merge na main por este trabalho.

### Incluído

- Planejamento M01–M12, ratificação CL01–CL08 e núcleo isolado com referências injetadas sintéticas.
- Cobertura/causas, contexto puro, serviço/BFF factual autorizado reutilizando PA06 e provas PostgreSQL/RLS do CI nos checkpoints históricos.
- Tabela factual profissional, filtros, zero/ausência, invalidação e proteção de respostas tardias; UX B/C e revisão independente delimitadas.
- Fundamento interno M02 de contribuições, sem nova API pública de detalhe.
- Correção do gate Mobile: forge1.4.1/glob14.0.2/minimatch11.0.1 e resolução de deepmerge coerente com o patch existente. Auditor/severidades/exceções inalterados.

### Validação do delta Mobile

- RED audit14 advisories → GREEN0; auditor versionado informa OK sem vulnerabilidades.
- Instalação frozen, typecheck,38 testes de segurança/a11y/compatibilidade e export Android/iOS/Web PASS em Node22.23.4/pnpm11.25.0.
- Licenças PASS586 pacotes. Revisão independente estática favorável ao delta Mobile; não executou testes próprios nem revisou FOOD06 integral.
- Expo doctor local:19/21; dois checks BLOCKED por conexão recusada a APIs externas, não declarados PASS.
- Testes de compatibilidade verificam glob e fingerprint reais, incluindo cancelamento, negação/reinclusão e dotfiles.

### Evidências históricas, não substituem CI final

Backend3797 PASS/166 SKIPPED em4b23e8bf;63 focados de contribuições/PA06/cobertura. Interface:32 Playwright desktop/mobile,24 testes modelo/cliente/seleção,27 scripts authz e build Web. RLS real nos checkpoints da integração factual; revisão R4 restrita a cada incremento, não aprovação integral das12 melhorias. SBOM provenance SKIPPED nos HEADs anteriores.

**CI do HEAD ec3690b1 em execução.** Mobile Expo passou no CI de39bf016f. O Dependency Review desse checkpoint falhou por usar deny sobre uma licença dual; o novo HEAD usa allow derivado da política SPDX já aprovada, sem exceção por pacote nem mudança de severidade. Inventários continuam exigindo revisão por pacote. Gerador/workflow:14 testes PASS; com compatibilidade Mobile18/18. **Dependency Review PASS no d63e6f5b**, confirmado no GitHub. Os demais checks do HEAD ainda estão em execução. Falhas Mobile/PR Gate dos HEADs anteriores foram preservadas, não reclassificadas retroativamente como verdes.

### Estabilização do coletor — ec3690b1

Finding Semgrep em urllib: URLs iniciais eram constantes, sem SSRF inicial por usuário demonstrado; redirects só eram conferidos após conexão. Agora abertura inicial, cada redirect e destino final exigem uma das cinco URLs documentais exatas, sem nova dependência ou supressão. RED8 falhas funcionais →25/25 da suíte de pesquisa PASS, oráculo sintético inalterado. Transporte dos testes é sintético e não abre sockets. Preservados TLS/proxy, timeout25s, leitura limitada e manifesto somente completo.

Investigação e revisão de patch por instâncias independentes. Revisor executou14 testes e nove variantes adicionais, sem bypass/regressão; não validou sites reais nem scanner. Semgrep local ausente e API de alerta539 retornou403. Semgrep OSS no ec3690b1: check124653510171 SUCCESS, zero anotações e título “No new alerts in code changed by this pull request”. A consulta das threads não mostra discussão aberta. O estado direto do alerta539 não foi consultável (403); nenhuma dispensa foi executada. CI restante ainda em execução.

### Pendências e limites

- FOOD06 continua parcial: M01–M12 obrigatórias; detalhes de quantidades/fontes/preparo, cenários, histórico/exportação e demais aceites ainda pendentes.
- Direitos de tabelas clínicas e G06 operacional BLOCKED; nenhuma RDA/AI/UL assistencial habilitada.
- API de detalhamento M02 somente após estabilizar este CI, com paginação/projeções autorizadas e teste de capacidade.
- Sem merge, deploy, migrations externas, mudança de quota/infra; FOOD05-MDL/D18 fora do escopo.

Registro canônico, comandos, riscos e handoff: `tasks/food06-consolidacao.md`. Auditoria sanitizada e hashes: `research/food06/mobile-audit-consolidacao.json`.

<details>
<summary>Descrição original da #455 — histórico anterior à consolidação</summary>

## Estado vigente — FOOD06 ampliada
M01–M12 aprovadas integralmente para planejamento e implementação isolada; todas obrigatórias. Esta PR permanece Draft e não representa FOOD06 funcionalmente concluída ou autorização assistencial.

HEAD desta PR: `0ec4cd31`. Inclui ratificação CL01–CL08, pesquisa/fontes, núcleo puro com oráculo sintético e planejamento completo das quatro ondas, matriz de aceite e avaliações UX A independentes.

## Planejamento e UX
- `tasks/especificacao-pos-320-food06-melhorias.md`: especificação integral e auditoria PA06/FOOD04/05/07.
- `tasks/aceite-pos-320-food06.md`: critérios rastreáveis M01–M12, sem equiparar cobertura parcial a aprovação irrestrita.
- `tasks/onda-a-pos-320-food06.md`: contratos e dependências A1/A2.
- `docs/agents/ux/reports/FOOD06-A-2026-10-31/`: avaliações por duas instâncias separadas, referência explícita #451/0d3382b6; não são usuários reais ou testes visuais. UX B/C aguardam interface real.

## Incremento separado
**#456** implementa A1 em Draft, empilhada nesta branch/`0ec4cd31`: cobertura por micronutriente e explicações no domínio, sem novos endpoints ou persistência. Seus testes e CI pertencem ao HEAD próprio `d2430cee`, não ao desta PR. Não integrar implicitamente nem fazer merge automático.

## Evidências do núcleo desta PR
TDD funcional e oráculo Python Decimal com15 razões sintéticas.109/109 testes de domínio/regressão,19/19 Python, typecheck e build/artefato PASS local em Node22.23.4;22 testes de segurança dos workflows PASS. Revisão independente estática identificou P2 de arredondamento precoce, corrigido via RED/GREEN e fechado na reavaliação. Não é R4 integral da integração clínica.

Instalação congelada local BLOCKED por minimumReleaseAge de versões AWS não presentes no manifesto consultado; usados tools em cache, ts-jest29.4.14 versus29.4.15 do lock. Nenhuma política ou dependência alterada. Limitação registrada na execução.

## CI e gates
- Histórico cb8a9c47:22 success e SBOM provenance SKIPPED.
- eeb552fa:20 success, Mobile Expo/PR Gate FAIL, SBOM provenance SKIPPED.
-0ec4cd31: Backend e scanners PASS na consulta; Mobile FAIL; Web ainda em execução. Não declarar CI global verde. Auditoria Mobile exige fluxo separado, sem waiver/supressão ou lockfile misturado na FOOD06.
- CL01–CL08 e quadro DRI ratificados nos limites da ficha. Direitos de terceiros não presumidos: registro clínico de referências e ativação permanecem BLOCKED.
- M11 personalizado depende de contrato confiável de restrições. FOOD05 não integrada à base: preservar dependência sem motor paralelo.
- Integração API/BFF, persistência cifrada de análises, banco/RLS, UI, PDF, histórico e R4 integral pendentes por ondas.
- G06 operacional BLOCKED. Sem merge, deploy, migrations externas, Neon/Render/cobrança ou FOOD05-MDL/D18.

Histórico e comandos: `tasks/execucao-pos-320-food06.md`. Ficha, quadro de valores e parecer de fontes permanecem vinculados ao plano.


</details>

</details>


</details>


</details>


</details>


</details>
