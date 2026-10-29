# FOOD07 — execução técnica

## T01 — PASS técnico local, 28/10/2026

Código: `bdb816f8`, base documental `ea2bd1d5`, PR Draft #452, branch `docs/pos320-food07-planning`. Nenhuma alteração de banco, endpoint HTTP, portal ou operação externa nesta tarefa. T02–T07 e G06 não foram aprovados por esta evidência.

### Ambiente e integridade

Node **22.23.4**, pnpm **11.25.0** (versão/integridade do `packageManager`), TypeScript **6.0.3** do lockfile. Node/pnpm obtidos das distribuições oficiais e conferidos por SHA256/SHA512, isolados em `/tmp/octaclin-food07-tools`, sem trocar runtime global ou engines. Backend instalado com `install --frozen-lockfile --prefer-offline`; zero mudanças de dependências/lockfiles/políticas. Sem symlink para outra worktree.

### RED observado e GREEN

1. Teste funcional chamou `contarItensReceita` com ingredientes válidos e base desconhecida: esperava rejeição sanitizada, mas **não lançou erro**. RED real, não falta de ferramenta.
2. Asserções dos novos contratos de normalização/leitura/porcionamento/DTOs falharam antes de seus exports existirem; testes deliberadamente não importaram módulos inexistentes nem aceitaram TypeError como validação. Isso verifica ausência da API, não é apresentado como divergência numérica calculada.
3. Testes adicionais reproduziram rejeição indevida da precisão de catálogo/notação exponencial e aceitação de etiqueta que ficava vazia na normalização HMAC. Corrigidos com RED/GREEN, preservando a restrição manual legada.
4. GREEN final: **270 testes T01** — 63 metadados/leitura, 176 porcionamento, 31 DTOs. Sem mocks do cálculo. Inclui grade de 120 combinações equivalentes entre bases, identidade/fator um, half-up, independência de prévias, limites anteriores ao arredondamento e ausência de resultado parcial.

### Oráculo independente

`scripts/research/food07/gerar-oraculo-porcionamento.py` usa `fractions.Fraction` e `decimal.Decimal` com `ROUND_HALF_UP`, não importa TypeScript. Fixture em `dominio/fixtures/porcionamento-receita-oraculo.json`: **21 casos sintéticos**, reproduzidos por `--check`, incluindo 1/1,5/2,5 porções, frações periódicas e empate half-up. SHA256 da fixture: `f24508220649e07cbda86047435c7f0302fc2bfc483589788c1a800329b242cc`. Hash identifica dados sintéticos, não comprova validação clínica.

### Comandos executados

Todos os comandos Node/pnpm abaixo foram executados com os binários isolados acima (não o fallback Node24/pnpm11.19 do host):

| Verificação | Comando lógico | Resultado |
| --- | --- | --- |
| Baseline anterior ao código | Jest receitas/modelos/medidas/micronutrientes | PASS, 133 testes |
| RED inicial | `pnpm --dir octaclin-backend exec jest --runInBand --runTestsByPath src/modulos/planos-alimentares/dominio/metadados-receita.spec.ts` | FAIL esperado: base inválida aceita |
| Domínio/DTO e regressões focadas intermediárias | `pnpm --dir octaclin-backend exec jest --runInBand --testPathPatterns='metadados-receita|porcionamento-receita|dtos-receitas-metadados|servico-receitas-nutricionais|modelos-plano-alimentar|medidas-caseiras|micronutrientes'` | PASS, 409 testes antes dos dois últimos casos de borda |
| Oráculo | `python3 scripts/research/food07/gerar-oraculo-porcionamento.py --check` | PASS, 21 casos reproduzidos |
| Suíte completa final | `pnpm --dir octaclin-backend test --runInBand --json --outputFile=<temporário local>` | PASS dos executados: 3.514 testes, zero falhas; 142 skipped |
| Typecheck final | `pnpm --dir octaclin-backend typecheck` | PASS |
| Build | `pnpm --dir octaclin-backend build` | PASS, artefato `dist/main.js` validado |
| Higiene | `git diff --check`; `node scripts/scan-secrets.mjs` | PASS |

Relatórios brutos ficaram somente no diretório temporário da tarefa. Logs da suíte incluem avisos sintéticos deliberados de erros/antimalware; não são evidência de ClamAV ou de ambiente produtivo.

### Skips e limites — não converter em PASS

A suíte final teve 365 suítes aprovadas e 8 integralmente skipped; uma suíte de pesquisa também contém quatro testes skipped. Total **142**:

| Arquivo/superfície | Quantidade skipped | Motivo |
| --- | --- | --- |
| `rls-isolamento-tenant.integracao.spec.ts` | 67 | Gate PostgreSQL/Testcontainers não habilitado localmente |
| `piloto-gamificacao.integracao.spec.ts` | 32 | Gate PostgreSQL/Testcontainers não habilitado |
| `rascunhos318.integracao.spec.ts` | 14 | Gate PostgreSQL/Testcontainers não habilitado |
| `sessoes-rotacao.integracao.spec.ts` | 17 | Prova externa/descartável não configurada |
| `1720000001078-GruposSubstituicoes.integracao.spec.ts` | 4 | Gate específico PostgreSQL não habilitado |
| `1720000001077-FavoritosAlimentosProfissional.integracao.spec.ts` | 1 | Gate específico PostgreSQL não habilitado |
| `consulta-badges-pg.integracao.spec.ts` | 1 | Gate PostgreSQL não habilitado |
| `servico-protecao-abuso.redis.integracao.spec.ts` | 2 | Redis real não habilitado |
| `validacao-rev11-investigacao.spec.ts` | 4 | Grades/oráculos locais opcionais OMS não fornecidos; classificadores não ativados |

T01 é domínio puro e não necessita banco. Essas ausências não provam RLS, concorrência ou Redis e não encerram G02/G04. R4 final FOOD07, CI do novo HEAD e UX B/C permanecem pendentes; sem interface FOOD07 nesta tarefa.

### Contratos preservados / decisões de engenharia

- Legado sem metadados continua sem base/rendimento inferidos. Omissão preserva; `null` só remove campos permitidos na alteração.
- Aritmética BigInt racional, fator reduzido serializado em strings, único half-up final de três casas. Fonte não é mutada; valores fora do limite exato bloqueiam a operação inteira antes do arredondamento.
- Concentrações não são escaladas nem preenchidas com zero. Precisão do catálogo é preservada; cadastro manual mantém os quatro indicadores obrigatórios e precisão legada. Medidas/identidades/flags existentes e instruções não são reescritas pelo cálculo.
- Leitor validado e projeção pública são helpers ainda **não conectados às leituras HTTP**; conexão reader-first e testes de fronteira pertencem às tarefas seguintes. Não alegar que o portal atual já foi corrigido por existir helper.
- Os DTOs são definidos/reexportados, mas **não estendem os DTOs de criação/edição HTTP existentes nesta tarefa**. Conectar somente junto da persistência atômica em T02 evita aceitar metadados e descartá-los silenciosamente. Ajuste de sequência técnico documentado, sem retirar requisito.
- O domínio recebe conteúdo original explícito. A garantia server-side de resolver novamente receita/versão e não aceitar prévia como fonte depende de T03/T04; não inventar capability ou proveniência FOOD05.

## Continuidade

T02 passa a ser a próxima tarefa em execução: writer/reader cifrados, CAS, índice derivado HMAC, consulta antes de paginação e migration aditiva, com provas reais descartáveis. Conferir numeração livre acima da 1079 reservada pela #446 e permissões reais antes de implementar schema. Sem aplicação externa.

Correção Mobile isolada em `fix/mobile-deepmerge-prototype`, worktree própria; investigação e testes não pertencem a esta PR. Nenhum waiver ou gate global verde atribuído por esta entrega. Papéis UX seguem referência explícita #451/0d3382b6, B/C quando houver interface. #446/G06 preservados; sem FOOD05-MDL/FOOD08, merge, deploy ou operação produtiva.

## T02 — persistência e consulta, checkpoint local

Código validado: `dc9620c0` (diff intencional, sem dependências novas).

Este checkpoint substitui “T02 próxima/em preparação” quanto ao trabalho local. T01 continua no código `bdb816f8`; não reclassificar seus testes históricos como testes deste delta. PR #452 continua Draft, base main `2f24fcb1` reconferida por `git ls-remote`. Nenhuma alteração em #446/#451, nenhuma dependência/lockfile/engine modificada.

### Mudanças e fronteiras

- Metadados no conteúdo cifrado; índice de etiquetas HMAC por tenant na mesma transação. Omissão em clientes antigos preserva metadados; remoção explícita mantém o contrato. GET/list/edição validam conteúdo/índice, falham com erro sanitizado em drift, sem reparar/escrever durante leitura.
- Consulta usa o escopo existente e `ArrayContains` parametrizado antes de count/offset; ordenação estável. Só a página retornada é decifrada. Serviço valida shape/unknown keys/null/protótipos antes da transformação do DTO. Endpoint de consulta/prévia e BFF permanecem nas tarefas seguintes.
- Migration **1080** criada/registrada, aditiva (`text[]` default vazio, constraint, GIN), sem editar migrations antigas nem importar1079 da #446. Número reconferido livre na main; nenhuma tabela paralela, nova permissão ou DDL runtime.
- Antecipação mínima de T04: conectar a allowlist pública no novo snapshot e na leitura do portal era necessário antes do writer T02, pois a resposta anterior retornava JSON completo. Tags/base internas ficam fora do portal; rendimento/tempo permitidos. Snapshot inválido é rejeitado **antes** de registrar primeira leitura. Sem alteração de consentimentos, canais, retirada/reenvio ou regra de versão ativa310. Compartilhamento porcionado/instruções/hash semântico ainda NOT RUN.
- Compatibilidade de leitores/escritores: voltar ao writer antigo após novos metadados pode perdê-los em edição. O `down` recusa exclusão destrutiva; rollback futuro exige código que preserve os novos campos. Deploy/rollout continua sujeito a G06; não alegar compatibilidade de rollback somente de código.

### RED/GREEN funcional

1. Serviço não preservava/persistia metadados nem índice; testes de omissão, limpeza, consulta/visibilidade e CAS adicionados antes da correção.
2. Asserções de registro/estrutura provaram ausência da1080; PostgreSQL preparado executou consulta de schema e falhou pela coluna inexistente. Erros iniciais de tipagem de fixture não contaram como RED.
3. Projeção pública: rodada limpa teve **3 FAIL / 1 PASS**, por exposição de etiquetas no portal/snapshot e aceitação de snapshot inválido com write; corrigido. Erros de mock/setup anteriores não são evidência funcional.
4. Revisão independente de T02 encontrou P2: campos opcionais `null` legitimamente persistidos pelos DTOs antigos eram recusados pelo novo leitor. Reprodução **4 FAIL**, cobrindo domínio, serviço e portal. Correção normaliza apenas opcionais válidos em memória, inclusive substituições aninhadas; não altera fonte/ciphertext nem transforma ausência em zero. Campos obrigatórios, composição manual obrigatória e metadados inválidos continuam bloqueados. Compatibilidade Unicode também preserva contagem por caracteres do DTO legado.
5. GREEN após correção P2: **277/277** testes focados de domínio/porcionamento/serviço/projeção/migration. A suíte de projeção contém agora **5/5** casos; não confundir com os quatro anteriores ao P2.

### PostgreSQL descartável real

Comando: `RLS_TESTCONTAINERS=true pnpm --dir octaclin-backend exec jest --runInBand src/infraestrutura/banco-dados/migracoes/1720000001080-MetadadosReceitasNutricionais.integracao.spec.ts`, Node22.23.4/pnpm11.25.0, socket Docker local explicitamente escolhido, sem contexto/TLS remoto.

**6/6 PASS após correção P2.** Instância PostgreSQL15-alpine descartável, banco `food07_test`, dados sintéticos, armazenamento tmpfs. Role owner apenas monta schema; `food07_runtime` é não owner, NOSUPERUSER/NOBYPASSRLS, sem DDL. Fixture executa migration1033 real + campos legados mínimos1066 +1080 registrada; não é aplicação de toda1066/ledger produtivo.

| Prova | Evidência/asserts |
| --- | --- |
| Schema/legado | Default vazio/constraint/GIN; ciphertext e versão antigos idênticos |
| RLS/role | FORCE RLS real, tenant ausente/errado sem linhas; DDL runtime negado |
| Cifra/escopo | Conteúdo cifrado/índice derivado, omissão preservada, pessoal de outro profissional/tenant404 |
| Paginação | 102 receitas, filtro antes de count/offset, página5 correta; HMAC distinto por tenant |
| CAS concorrente | Owner segura lock; duas sessões runtime comprovadamente aguardando; uma vence, outra rejeita, versão2 |
| Rollback | Falha tardia real em auditoria; cifra/índice/versão iguais ao estado anterior |

O primeiro teste de concorrência esgotou a espera da barreira porque `pg_stat_activity` usava snapshot da transação observadora. Corrigida **somente a observação** com `pg_stat_clear_snapshot`, prazo reduzido de5s para2s; nenhum timeout ampliado nem assert removido. Reexecutado isoladamente e no conjunto.

### Revisão independente

Revisor `/root/food07_t02_boundary_review`, instância independente, somente leitura. Primeira análise encontrou o P2 de compatibilidade. Re-revisão da correção executou **99/99 testes** em três suítes de domínio/serviço/portal, reproduziu os exemplos originais e casos negativos, sem novos achados. Não repetiu PostgreSQL/build/gates amplos; não é R4 integral FOOD07, nem validação com usuários reais. Personas B/C aguardam UI real.

### Gates amplos e CI históricos

- Launcher oficial `pnpm --dir octaclin-backend test:rls:testcontainers`: FOOD04/FOOD07 **10 PASS**. Outras duas suítes, **99 casos**, falharam no setup: imagem `timescale/timescaledb-ha:pg15` indisponível. Resultado global FAIL/BLOCKED infraestrutura, não regressão funcional demonstrada, não PASS. Não substituí Timescale por PostgreSQL puro nem alterei gates para mascarar a ausência. CI do novo HEAD deverá comprovar os cenários restantes.
- CI do HEAD T01/documental `ce6ec296`: run40742525365 Backend/Web/Demo/governança/operação/AI PASS; Mobile FAIL em auditoria e PR Gate FAIL. Scanners associados PASS. Não é CI verde global nem evidência do delta T02.
- Correção Mobile fica na PR Draft **#453**, HEAD `12ae0b6f`: comportamento/testes independentes corrigidos, porém run40778341744 Mobile audit e PR Gate FAIL. Backend/Web/AI/Demo skipped por impacto; scanners PASS. Nenhum waiver/exceção/severidade alterado. Não importar esse patch implicitamente para FOOD07.

### Limites restantes

T03–T07 continuam pendentes, exceto allowlist mínima de T04 descrita acima. R4 integral, UX B/C, UI/BFF/prévia e envios porcionados não são aprovados por T02. Espaço local limitado (~237MB), sem limpeza de arquivos alheios ou instalação extra para contornar ambiente. G06 permanece BLOCKED; zero DDL externo, merge/deploy ou mudança de infraestrutura/cobrança.

### Verificações finais T02 após o P2

| Verificação | Resultado |
| --- | --- |
| `pnpm --dir octaclin-backend test --runInBand --json --outputFile=<temporário>` | **3.544 PASS, 148 skipped, zero falhas**; 367 suítes PASS/9 integralmente skipped |
| `pnpm --dir octaclin-backend typecheck` | PASS, Node22.23.4 |
| `pnpm --dir octaclin-backend build` | PASS, `dist/main.js` validado |
| `python3 scripts/research/food07/gerar-oraculo-porcionamento.py --check` | PASS, 21 casos reproduzidos |
| `pnpm test:migracoes-fora-de-banda` | PASS, 13/13 |
| `git diff --check`; `pnpm security:secrets` | PASS |

Os 148 skipped da suíte default são os142 já descritos em T01 mais6 da nova integração1080 sob flag. Estes6 foram executados separadamente com PostgreSQL real e passaram; isso não remove os demais skips nem o bloqueio amplo de Timescale. Não somar testes sobrepostos como provas distintas. CI do commit T02 ainda não concluído neste registro.

## T03 — prévia autorizada, PASS local específico

Código validado e commitado: `5e20b279`.

Implementados serviço de prévia, rotas privadas POST de consulta/porcionamento e registro de provider; reader autorizado reutiliza o EntityManager tenant-aware do chamador. A prévia não grava/audita nem aceita tenant, composição, fator ou resultado do cliente. Versão stale retorna409; pessoal alheio/outra clínica/arquivada mantém404 e permissão ausente403. O fingerprint canônico é comparação de conteúdo, nunca autorização/capability.

Fontes: resolução bulk de alimentos+fonte em **um statement JOIN**, SQL parametrizado e allowlist, apenas fontes ativas com direitos aprovados. Não alterar grants do catálogo global. Fonte ausente/revogada/inválida impede a prévia inteira. Concentração parcial conhecida permanece parcial; alternativas não contam como itens consumidos nos totais. Respostas incluem denominador das porções, preparo/fonte/versão, peso efetivo, avisos e totais por indicador; sem etiquetas/ciphertext/contexto clínico. Prévia parcial não enfraquece os requisitos vigentes de materialização/publicação do plano.

### RED/GREEN e revisão específica

| Evidência | RED observado | Correção e GREEN |
| --- | --- | --- |
| Rotas | Duas asserções de handlers/metadata falharam por rotas inexistentes; testes executaram sem erro de import/setup | POST leitura privada, guards/permissões herdados, no-store; teste de metadados não equivale a teste HTTP ponta a ponta |
| Catálogo/micros | Micronutriente do cadastro era conservado como override de catálogo na prévia | Removido somente da projeção; plano continua resolvendo micros pelo ID, receita/snapshots intactos. Teste cruzado preserva manual |
| P1 do revisor | PostgreSQL real: UPDATE=false, FOR SHARE42501; chamada da prévia falhou “permission denied for table alimentos_composicao” | JOIN sem lock no catálogo, sem grants novos; caso real aprovado |
| P2 do revisor | Comparação com métodos reais do plano: prévia1234,5001 versus plano1235, com100 itens sintéticos de10.000g | Reuso do normalizador escalar/porção/soma do motor existente, quatro casas; prévia/plano1235. Precisão da fonte persistida permanece intacta; composição bruta participa do fingerprint |
| Idempotência do reader | `lerConteudoReceita(lerConteudoReceita(JSON))` falhava no Jest por prototype do structuredClone nativo em outro realm | Clone JSON somente depois da validação, sem relaxar protótipos/unknown keys; leitura repetível e sem mutação |

Erros iniciais de tipagem de fixture, export de tipo privado e expectativa403 em vez do404 canônico não foram tratados como vulnerabilidade nem RED funcional. Corrigidos antes das provas finais. `LocalIngrediente` foi exportado de forma aditiva para permitir declaração dos tipos públicos. Nenhuma alteração de engines, setup Jest, dependências ou segurança para contornar o ambiente.

Revisor `/root/food07_t02_boundary_review`, somente leitura: encontrou P1/P2 e reavaliou correções, **437/437 testes em oito suítes**,175 comparações matemáticas próprias, sem achado novo no delta. Não executou PostgreSQL/build e não é R4 integral FOOD07. A primeira aprovação parcial de235 testes não encerrava os achados; substituída pela re-revisão após correção.

### Prova real ampliada

Mesma instância descartável PostgreSQL15/`food07_test`/role runtime da T02, agora **8/8 PASS**. Seis provas T02 preservadas, mais:

1. Prévia manual mantém bytes/versão/índice e contagem de auditoria; edição posterior invalida versão; arquivamento do vínculo profissional nega acesso pessoal com404.
2. Catálogo com **apenas SELECT**, criado depois dos grants DML da fixture tenant-aware, não herda UPDATE. Asserção direta de FOR SHARE continua42501, enquanto prévia funciona com JOIN e mesmos grants. Fixture do catálogo é mínima, não execução de todo schema/ledger produtivo.

Foco autor após correções: **398/398 testes em11 suítes**, incluindo domínio, DTO, rotas, serviço, cálculos e modelos legados. Não somar com os437 da revisão, pois há sobreposição. Suíte completa/typecheck/build do delta ainda precisam do registro final abaixo.

### CI T02 observado após envio

HEAD documental `4c5a8fc97c5579f1b952e70412868f5e2228294f`, run40782726575, job Backend123148242537: migration1080 aplicada **no PostgreSQL de CI**, suíte principal **3.640 PASS/52 skipped**, Redis real2/2, launcher Testcontainers/RLS **109/109 PASS em4 suítes**, incluindo a1080 com6 casos. Isso supera a lacuna ampla do setup local **para aquele HEAD**, não comprova T03 ainda local nem produção. Web/AI/governança/operação/rollout e scanners associados PASS; Mobile audit FAIL, smoke ainda em acompanhamento naquele momento. Não declarar CI global verde.

### Próximo passo autorizado

Concluir commit/push/CI próprios de T03 e seguir T04: compartilhamento porcionado com instruções específicas, identidade semântica/replay, snapshots, agendamento e concorrência. Revalidar fonte/versão/fingerprint na confirmação; a prévia é uma leitura pontual, sem reserva do catálogo para uma ação posterior. BFF/UI/UX B/C e R4 final permanecem pendentes. G06 BLOCKED; zero operação externa.

### Verificações finais T03

Node22.23.4/pnpm11.25.0, após as correções e re-revisão: suíte backend completa **3.577 PASS/150 skipped/zero falhas**,369 suítes PASS/9 integralmente skipped; typecheck e build/artefato PASS; guardas de controladores PASS; diff/segredos PASS. Os150 skipped são os142 legados identificados em T01 mais8 da integração1080 default; esses8 foram executados separadamente com PostgreSQL real. Não aprovar os142 restantes por equivalência. Oráculo T01 permanece21 casos reproduzidos; nenhuma troca de política quantitativa.

As alterações no motor preexistente são extrações mínimas da normalização escalar, validação e soma para evitar divergência da prévia: sem mudar quatro casas, fórmulas, requisitos dos DTOs ou totais legados. Cálculo parcial é helper explícito para leitura, não autorização para salvar composição manual incompleta. Nenhuma dependência/migration adicional além da1080 já documentada; CI próprio T03 ainda pendente neste registro.

## T04 — envio porcionado, PASS técnico local específico (29/10/2026)

Código validado: `f45d5132`.

Branch/PR preservadas: `docs/pos320-food07-planning`/#452 Draft, retomada do HEAD `ff6cde0e`. Fonte normativa: contratos S1–S3/NUX-03/PUX-01 e tarefa T04 do plano. Sem novas decisões de produto, dependências, migrations ou operação externa.

### Ambiente recuperado

Os temporários `/tmp/octaclin-food07-tools` não estavam presentes nesta retomada; a primeira tentativa nem iniciou o Jest e **não conta como RED**. Reutilizado Node **22.21.1** existente em `/workspace/.toolchains/food01`, dentro das engines. pnpm **11.25.0** recuperado do registry oficial com SHA512 comparado ao `packageManager` e ao `dist.integrity`, isolado em `/tmp`, sem reinstalar dependências do backend, alterar engines, symlinks entre worktrees ou políticas. Docker/imagem PostgreSQL15 local disponíveis. Espaço restrito (~237MB); nenhum trabalho alheio apagado.

### Implementação / decisões de engenharia

- `porcionamentos` opcional por receita: quantidade/fingerprint/conferência obrigatória, instruções opcionais até4.000 caracteres. DTO e serviço validam tipos, campos desconhecidos, IDs/duplicações/limites/protótipos/getters. Omissão conserva o modo de quantidades cadastradas.
- Prévia refeita no EntityManager da operação e versão/fingerprint conferidos antes de gravar. Texto normalizado somente CRLF→LF/NFC; omissão usa original conferido, vazio remove só daquela cópia. Não há reescrita numérica/heurística que prometa compreender linguagem livre. Conferência explícita obrigatória para cada item porcionado.
- Contexto interno versionado no ciphertext atual: hash do pedido, instrução original para replay por omissão, razão/porções/base/rendimento, quantidades originais e fontes congeladas. Sem tabela/coluna adicional, identificadores clínicos no navegador ou contexto do paciente na biblioteca.
- Hash canônico inclui autor autenticado, paciente, receitas/versões/modos/porções/fingerprint/texto efetivo/conferência, canais normalizados e agendamento explícito; exclui horário dinâmico de “agora”. Chave pertence ao lote inteiro: consulta pelo prefixo UUID parametrizado encontra também tentativas que trocam todos os IDs. Prefixo validado não aceita curingas. Replay reautoriza carteira/receitas/consentimentos atuais e compara contexto congelado, sem recalcular por edição posterior da biblioteca.
- Shares antigos sem contexto mantêm replay compatível do contrato310; personalização na mesma chave retorna409, sem preencher hashes ou reescrever bytes. Agendamento futuro é exigido apenas para uma nova intenção; retry válido após a data conserva o ACK.
- Ordem de locks: intenção, paciente, preferência, receitas ordenadas por UUID, compartilhamentos. Paciente e consentimento são conferidos transacionalmente; atualização de consentimento usa o mesmo lock de paciente. Nenhuma transação aninhada ou grant ampliado no catálogo.
- Leitor único valida snapshots antigos/novos em listagens e detalhe, antes de primeira leitura/auditoria. Projeção pública explicita porções recebidas e que ingredientes já estão ajustados; não retorna hash/contexto/fontes/quantidades originais/tags. Conferência interna da matemática evita aceitar razão/quantidades corrompidas.
- Reenvio310 imediato substitui a versão ativa; agendado só na ativação. Worker não foi reescrito, não recalcula a biblioteca e mantém avisos externos genéricos. Snapshot anterior e biblioteca permanecem intactos.

### RED/GREEN e achado de concorrência

1. Rodada RED limpa: **3 falhas funcionais** — envio ignorava porções/texto específico, mesma chave aceitava porção diferente e instrução null era aceita. Erros iniciais de tipagem do harness não contaram como RED.
2. GREEN inicial8/8, depois matriz **48/48** de serviço/fronteira: 1/1,5/2,5, texto vazio/limite/NFC/CRLF, desconhecidos/null/duplicações, fingerprint/versão stale, carteira/tenant/origem pessoal, troca integral de IDs, replay após editar biblioteca, legado sem hash, lote misto, agendamento, retirada sem reativação, projeções e snapshots inválidos.
3. A matriz detectou duas expectativas afetadas pelo rollback simulado do harness (referências substituídas) e uma tentativa de gerar nova prévia já stale no próprio setup; corrigido **somente o harness/teste**, não removidos asserts do produto. Rollback simulado de unidade não é prova de PostgreSQL.
4. PostgreSQL real reproduziu falha adicional na retirada: durante transferência não commitada, retornava **sucesso/retirado**, quando deveria aguardar o vínculo e negar404 ao antigo responsável. A ausência de lock também foi observada. Correção mínima: descobrir referência sem lock, bloquear/conferir paciente, reler/bloquear share; mesma ordem do envio. GREEN real comprova espera e404, estado ativo/ciphertext intactos. Não houve evidência de incidente em produção, nem mudança de quem pode retirar.

### PostgreSQL/RLS real — 19/19 PASS

Comando com `RLS_TESTCONTAINERS=true`, socket Docker local e Node22: Jest da integração1080. Banco **`food07_test` descartável**, owner apenas para fixture/migrations; runtime não owner, NOSUPERUSER/NOBYPASSRLS, sem DDL. Nesta rodada a fixture ensaia **1033 +1066 real +1080 registrada**, substituindo os campos1066 mínimos usados em T02/T03. Parent tables continuam fixtures sintéticas; não é ensaio do ledger integral/produção.1066 real cobre FKs, índices, FORCE RLS e trigger de snapshot imutável; catálogo global continua SELECT-only.

As oito provas anteriores foram preservadas, mais11:

| Prova T04 | Resultado observado |
| --- | --- |
| Cifra/projeção/imutabilidade | Porções/texto corretos; UPDATE de snapshot negado pelo trigger; portal sem contexto; tenant alheio sem linhas; biblioteca idêntica |
| Idempotência concorrente | Duas sessões realmente esperando, uma criação física de share/entrega, mesmo ACK |
| Lotes recíprocos | Pacientes distintos, ordem de IDs inversa, ambos aguardam mesma primeira receita sob barreira; ambos concluem sem deadlock, quatro shares |
| Edição concorrente | Versão alterada entre prévia e lock;409 e zero share |
| Transferência concorrente | Revalida novo responsável após lock;404 e zero share |
| Consentimento concorrente | Revogação de e-mail confirmada sob lock;403 e zero share |
| Falha tardia no segundo item | Rollback do lote inteiro, inclusive restauração do ativo anterior e seus bytes |
| Worker agendado | Data de elegibilidade da fixture simula vencimento; ativa cópia congelada/substitui anterior sem recalcular biblioteca nem chamar provider externo |
| Retirada concorrente | RED/GREEN descrito acima; antigo responsável negado após transferência |
| Fonte atual/composição | Envio válido de catálogo; composição posterior/fonte inativa invalidam novas confirmações; snapshot válido anterior intacto |
| Legado real | Snapshot sem hash mantém replay/leitura e bytes, não permite upgrade de modo |

Não foram executadas chamadas externas, dados reais, DDL de staging/produção ou alterações nas migrations anteriores. Não confundir owner da fixture com a role runtime efetivamente usada pelas operações.

### Verificações finais

- Suíte backend completa Node22: **3.620 PASS,161 skipped,zero falhas**;370 suítes PASS/9 integralmente skipped. Os161 incluem19 casos de integração sob flag, executados separadamente acima, e142 skips legados já discriminados em T01. Não aprovar os142 por equivalência.
- Typecheck e build backend/artefato: **PASS**. Guardas de controladores11/11, diff/segredos e oráculo21: PASS. Imagem Timescale local reconferida indisponível; gate amplo fica para CI, sem substituir a imagem para esconder setup.
- CI do HEAD anterior `ff6cde0e`, run40784685792: Backend/Web/Demo/AI/governança/operação/rollout PASS; scanners associados PASS. Mobile audit e PR Gate FAIL. Esses resultados não aprovam T04 ainda não enviada. Não alterar #451/#453/#446 para ocultar a falha.
- R4 integral FOOD07, UX B/C e UI ainda pendentes. Parecer específico anterior T03 não é revisão deste novo writer. CI do novo HEAD deve ser consultado após push.

### Sequência e rollback

T05 BFF/tipos é a próxima tarefa autorizada; T06 UI/portal e personas B, T07 regressões/personas C/R4 integral/CI. Não declarar FOOD07 concluída por T04. Novos snapshots exigem leitores compatíveis antes do writer; rollback para backend antigo que devolve JSON cru pode expor contexto, portanto manter reader/writer compatível ou corrigir adiante, sem descartar histórico. G06 BLOCKED; nenhuma autorização de merge/deploy/migrations externas/infra/cobrança foi inferida.
