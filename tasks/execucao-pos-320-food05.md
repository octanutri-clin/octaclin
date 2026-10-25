# Execução FOOD05 — plano tasks/plan-pos-320-food05.md

Autorização: proprietário “Pode seguir, sol médio”. T01–T18 autorizadas;
produção/infra/migrations externas não. Base e3b47da1, PR446 Draft, árvore limpa.

Ruling: uma PR funcional, commits pequenos — leitores/writers/UI precisam de
integração atômica; divisão3 ou1 já aprovada no plano. Custo: diff final maior,
mitigado com focados/commits e revisão distinta final.
Ruling: scripts de skill cloud não estão disponíveis no filesystem; usar este
ledger e logs /tmp/food05-exec, sem alegar execução de helpers inexistentes.

## Preflight

- T01→T04/T09: DTO leva documento/intenção, nunca fatos confiáveis do cliente.
- T02→T03/T05: razões exatas/half-up e porção0,001–10000g/3 casas.
- T04→T06: prévia sem escrita e save com revalidação/CAS no mesmo escopo.
- T06→T07/T11/T13: ACK devolve referência; pendência não recalcula;
  omissão/null/tombstone não apagam/ressuscitam contexto.
- T08→T10: preferência pessoal não guarda PHI nem altera valores persistidos.
- T10→T11/T12: painel/AbortSignal compartilhado, cancelar não modifica documento.
- T14→T18: banco local/CI não é liberação produtiva.

## Progresso

T01 em execução. Tentativa inicial de shell usou cwd do backend com paths de
root e não criou arquivos; não conta como RED de feature. Corrigido o cwd.

T01: focais23/23 PASS. RED inicial por módulos ausentes (TS2307,0 testes),
seguido de22 PASS; teste adicional pelo pipeline real class-transformer/validator
reproduziu1 RED/22 PASS: instância DTO era recusada como objeto não plano.
Validador adapta somente a raiz e mantém allowlist; repetição23/23 GREEN.
Logs t01-red/t01-green/t01-dto-red/t01-final em /tmp/food05-exec.
Cálculos/casos de base são exercitados em T02/T03; DTO não confere fatos autorizados.
T02: focais de aritmética+micros+DTO55/55 PASS, com4000 vetores Python Fraction
(seed314159,1000/alvo), sem tolerância float. RED por módulo ausente antes da
implementação. Parser decimal existente apenas exportado; sem semântica global nova.
Suite completa/build/CI ainda NOT RUN: focais não equivalem a feature concluída.

T03 focais47/47 PASS (4 suites), com casos energia/macros/base diferente,
zero/ausente, resíduos/edição, limites/avisos, simulação350→300 e comparação
com4000 casos independentes no motor. RED inicial por funções/módulo ausentes.
Nova política decimal é aditiva no motor; defaults legados não mudaram.

T04 prévia focada9/9 PASS. RED por serviço ausente, depois fonte real/preparo/base,
composição de catálogo manipulada ignorada, papel/permissão/tenant/carteira,
revisão vencida e resultado parcial por alternativa verificados. Nenhum save no
harness de leitura. Rotas/provider ainda não registrados; sem superfície liberada.
Ruling: não acrescentar campos à composição canônica de grupos antigos apenas
para preparo — FOOD04 compara snapshots JSON e isso invalidaria referências
legítimas. O resolver FOOD05 enriquece a sua própria projeção autorizada, mantendo
origem/base originais e contratos de grupo intactos. Custo: leitura adicional da
origem sob o lock já obtido, deduplicável por pedido; sem alterar biblioteca.

T05 focais54/54 PASS (4 suites). RED: medida ausente na projeção de prévia
(1 falha/9 PASS) e helper novo inexistente; GREEN após integração com resolução
FOOD01/medidas registradas e conversão exata. Caso real de DTO transformado
adicional reproduziu1 RED/10 PASS no serviço, corrigido sem abrir a allowlist.
Peso ao aplicar quantidade doméstica é recalculado e seu resíduo mostrado;
medida de revisão vencida fica indisponível. Referência preservada de histórico
será integrada/validada junto a T06/T07; não declarar M02 integral ainda.

T06 em consolidação; T07 iniciado pelas projeções e cópia histórica.
- RED de fingerprint: formatação decimal e porção explícita equivalente davam
  identidade diferente; normalização semântica corrigida. Focais45/45 PASS.
- Envelope3:2 RED/2 PASS antes do reader/writer;21/21 PASS após integração,
  preservando formatos1/2 e vínculo pai/filho/identidade.
- Projeção explícita: catálogo/manual vazavam campos internos (2 RED/6 PASS);
  allowlists corrigidas,29/29 PASS com envelopes/resolver.
- Writer:3 RED comportamentais iniciais (intenção ignorada/fingerprint sem
  validação), depois2 RED (fonte inativa e edição legada do SuperAdmin).
  Integração autoriza comandos somente ao responsável; mantém edição ordinária
  legada, snapshots, ACK estável e revisão pendente persistente.
- Regressão publicada:1 FAIL/118 PASS por leitura do cipher editorial ao invés
  dos filhos históricos; corrigido sem recalcular. Serviço completo119/119 PASS
  em t06-save-full-final.log. Não equivale ao backend inteiro nem RLS real.
- Negativos adicionais:2 RED/30 PASS reproduziram composição principal parcial
  aplicável indevidamente e reutilização de UUID de desvinculação em outro filho.
  Corrigidos:36/36 GREEN incluindo envelope (t06-negativos-{red,green}.log).
- Revisar/publicar bloqueiam equivalência pendente; omissão não desvincula,
  replay não ressuscita, fontes aplicadas conservam composição/micros.

Pendências T06/T07: cópia/reabertura; fonte principal preservada na materialização;
prévia com fonte/medida histórica inativa; captura de fatos após troca explícita;
marcador decimal por filho; cópias entre planos/modelos e regressões completas.
T08–T18 ainda não concluídos. Nenhum gate final ou clínico declarado PASS.

T07 parcial:
- Cópia de versão: a primeira tentativa do teste usava revisão anterior à ação
  Revisar e falhou no CAS correto (não é RED da cópia). Corrigido o teste para2,
  RED comprovou referência perdida. Nova versão FOOD05 conserva ciphers/chaves
  editoriais e revisão0 protegida; planos sem FOOD05 mantêm reconstrução legada.
- Fonte congelada na prévia e principal:3 RED/6 PASS incluindo cópia; ajustes
  reutilizam somente contexto autenticado e vínculo editorial correspondente.
  Serviço completo122/122 PASS em t07-save-full-green.log.
- Medida salva:1 RED/12 PASS, prévia dependia da biblioteca atual. Reutilizado o
  resolver FOOD01 com contexto cifrado da versão, sem novas conversões. Novo
  nonce exige autorização atual. Focais e regressões em t07-medida-green.log.
- Typecheck backend executado: PASS (t06-typecheck.log), antes dos últimos ajustes.
  Reexecutar no checkpoint consolidado. Nenhum teste PG/CI/UI concluído ainda.

T07 continuidade: teste RED1 comprovou que composição explicitamente trocada
não era preservada após a fonte ficar inativa. Captura `aplicados` cifrada separa
fatos atuais da matemática original; cálculo/resíduo original continuam imutáveis
com revisão pendente. Focais138/138 PASS (t07-troca-green.log).
Marcador por filho:1 RED comprovou que FOOD05 ainda dizia motor1; corrigido para
nutricao-decimal-v1 somente nos filhos FOOD05, sem trocar motor global legado.
Repetição consolidada em t07-final-green.log.

T07 retomada (24/10): novo ciclo RED/GREEN para cópia FOOD05 de refeição/plano
salvo. DTO fechado aceita apenas referências (IDs de origem, versão e chaves editoriais),
limitadas a200. O browser não recebe nem envia fatos, hashes, contexto cifrado ou
capability. Backend exige papel/profissional atual, revalida acesso ao plano de origem
no mesmo tenant e lock transacional, confere contexto cifrado e associação origem↔chave,
gera nova aplicação/chaves, registra autoria/linhagem cifrada e mantém estado pendente.
Auditoria registra somente contagem/versão destino. Rascunho e snapshot materializado
publicado têm resoluções separadas; publicação não depende de snapshot editorial apagado.
Origem inacessível é recusada antes de persistir; replay da referência na chave destino
é conflito porque já existe contexto.

RED: helper/DTO ausentes inicialmente; depois teste do service sem remapeamento falhou
por não retornar contexto no destino. Após implementação, backend focused `FOOD05`
30 PASS (DTO, resolver, serviço), inclusive origem inacessível e cópia de versão
publicada. Web `test:copia-refeicoes` 14/14 PASS; TypeScript Web `tsc --noEmit` PASS;
backend build/artefato PASS; BFF de planos 62/62 PASS. Validado localmente em
24/10/2026, sem dados de pacientes e sem banco externo.

Playwright da cópia: Desktop Chromium 2/2 PASS e Mobile Chromium 2/2 PASS para
cópia FOOD05 de versão publicada e recusa explícita de salvar como modelo. Um
primeiro comando Playwright não iniciou o editor porque o Turbopack do worktree
detectou symlink de node_modules fora do root; o teste foi repetido com servidor
local Webpack reutilizado. Outra tentativa usou 127.0.0.1, incompatível com os
cookies da fixture localhost; repetição em localhost PASS. Não foram defeitos
funcionais.

PostgreSQL/RLS sintético: adicionada prova que publica a origem, copia para novo
rascunho, verifica nova aplicação pendente e lineage cifrada, revoga o profissional
e confirma 404/rollback para nova cópia. O Testcontainers de imagem
`timescale/timescaledb-ha:pg15` não iniciou nesta execução (daemon retornou 404,
imagem local ausente). Repetida a matriz pelo runner descartável `postgres:15-alpine`:
7 PASS/67 SKIPPED no filtro FOOD05. Isso comprova transação/RLS no PostgreSQL local,
mas omite vector/Timescale e não substitui o gate CI integral.

Limite restante: gravar ou aplicar por modelo continua bloqueado. A biblioteca é
compartilhável na clínica; guardar referências de paciente no conteúdo acessível
a todos não atende minimização, e o fluxo atual entrega refeições ao browser antes
do save. Não implementar transporte da proveniência em modelos até haver aplicação
server-side que reautorize a origem sem expor identificadores clínicos. T07 não está
completo; PostgreSQL/RLS real para cópias, regressões e revisão R4 ainda faltam.

T08 iniciado: testes de contrato, serviço/CAS e migration escritos antes dos
módulos (RED por TS2307,0 testes; não é vulnerabilidade reproduzida). Após código,
21/21 PASS em t08-green.log. Dois campos em profissionais, JSON fechado, sem PHI,
CAS próprio e rollback conservador. Migration1079 registrada;1078 não alterada.
Não executada em banco externo. Provas PostgreSQL/RLS/role seguem para T14;
testes de migration até aqui inspecionam SQL e registro, não provam o banco real.

T08 typecheck inicial detectou3 fixtures legadas sem campos novos do ORM.
Tipagem admite projeções parciais, sem enfraquecer NOT NULL/checks no schema;
repetição t08-typecheck-final.log PASS.
T09 parcial:
- Controller/DTO novos: RED por módulo ausente, depois7/7 PASS.
- Prévia HTTP por allowlist, sem identidade interna/fatos de auditoria. Comparação
  individual não depende da completude de outros itens:1 RED/13 PASS, depois
 21/21 PASS com controlador (t09-comparacao-{red,green}.log).
- Ruling de rota: Next já usa `[id]`; não criar sibling `[pacienteId]`. Checklist
  corrigido. BFF reutiliza os wrappers existentes de sessão, stream limitado,
  no-store e erro sanitizado; não cria proxy/parâmetro de tenant paralelo.
- BFF: primeiro comando em cwd incorreto (não é RED funcional). Repetição correta
  reproduziu arquivos ausentes; após rotas, typecheck apontou retorno possivelmente
  undefined; corrigido por discriminação explícita. Caso de falha de conexão
  esperava503, mas contrato canônico sessao-bff.ts retorna502 sanitizado; teste
  ajustado ao contrato comprovado, sem alterar runtime legado.61/61 PASS no harness
  completo (t09-bff-final.log), sem chamadas externas.
- T14 iniciado antecipadamente para conferir fundação antes da UI: reutiliza o
  provisionador FOOD04 somente com filtro --fase-food05; nenhum alvo externo aceito.
  PostgreSQL15 local já disponível. Extensões vector/Timescale são omitidas pelo
  provisionador preexistente; resultado não comprova a cadeia integral oficial.

T14 provas reais:
- Primeira execução provisionou fixture mas imports novos tinham um nível relativo
  errado (TS2307,0 testes); corrigidos, não era falha de isolamento reproduzida.
- Segunda execução:4 PASS/67 SKIPPED por filtro FOOD05. Com matriz ampliada:
 6 PASS/67 SKIPPED em t14-local-final.log; banco e container encerrados pelo runner.
- Provados com serviços reais: CAS concorrente, fingerprint adulterado sem gravação,
  carteira/tenant, rollback depois de falha ao gravar filho, nova versão/histórico,
  pendência que bloqueia publicação, JSON de preferências fechado/CAS, FORCE RLS,
  role sem bypass/owner/DDL, transferência serializada e revogação, desvinculação
  com autoria e replay da referência antiga recusado. Somente dados sintéticos.
- Prova não cobre vector/Timescale nem substitui CI/matriz completa da T14.

Revisão adicional de consumo:2 RED/11 PASS reproduziram falta de autoria da
resolução manual e consumo sem ator na função pura. Corrigidos;17/17 GREEN com
snapshot. Autor do cálculo original não é sobrescrito pelo autor da resolução.
M05/M04 precisão:1 RED/3 PASS demonstrou soma de contribuições arredondadas e
resíduo falsamente zero. Motor existente agora fornece razões exatas; total recebe
um único arredondamento e delta pequeno é explícito.52/52 GREEN com motor/prévia.
BFF+cliente tipado62/62 PASS (t09-api-green.log); autorização de rotas30/30 PASS.
Web typecheck PASS (checkpoint-web-typecheck.log).

Regressão backend primeira execução completa:1 FAIL/3378 PASS/148 SKIPPED;
falha foi o caso de precisão acima, inserido/corrigido durante aquele checkpoint.
Essa execução não é evidência GREEN do HEAD final. Nova execução estável solicitada.
Writer:2 RED comprovaram que flags positivas de nova aplicação eram aceitas;
backend agora recusa novas alternativas já liberadas/preferidas, sem sobrescrever
as decisões legítimas de uma alternativa manual já salva.126/126 PASS no serviço
(t06-flags-{red,green}.log).

## Checkpoint estável de fundação/API — HEAD de código78117bc7

- Backend geral:374 suites PASS/8 SKIPPED;3382 testes PASS/148 SKIPPED,
 3530 totais (checkpoint-backend-final.log), após correções de precisão/flags.
- Build Nest PASS (checkpoint-build-estavel.log); verificador do artefato PASS,
  dist/main.js (checkpoint-artefato.log). Typecheck Web PASS.
- Repetida prova real PG no código estável:6 PASS/67 SKIPPED por filtro,
  t14-head-estavel.log; fixture removida. Não é prova das extensões omitidas.
- BFF62/62 e autorização30/30 permanecem PASS; sem alteração de UI nesta rodada.
- Triagem estática limitada de segredos no patch: sem correspondências para chaves
  OpenAI/privadas e URLs PostgreSQL com senha; não substitui revisão de segurança.
- Migration1078 sem diff; checkout raiz conserva somente a alteração preexistente
  em octaclin-web/next-env.d.ts, que não foi editada nesta worktree.
- Nenhum ambiente externo, merge, deploy ou flag foi alterado. FOOD04 produção
  continua BLOCKED pelo último registro de quota; não revalidada externamente.

Próxima troca proposta: Luna alto para UI T10–T13 com contrato existente, aguardando
mudança manual. T07 cópias/modelos e gates finais exigem retomada/revisão Sol médio;
nenhuma melhoria M01–M08 removida e nenhum gate final declarado PASS.

Fechamento do checkpoint intermediário:
- Typecheck backend explícito PASS (checkpoint-backend-typecheck-estavel.log).
- Lint Web focado inicialmente3 FAIL por `any` nas novas fixtures de transporte;
  substituídos por tipos Parameters, sem mudança de comportamento. Repetição
  t09-web-lint-final.log PASS e BFF repetido62/62 PASS em t09-bff-head-estavel.log.
- UI/Playwright, revisão distinta final e CI do conjunto funcional ainda NOT RUN.
  PR446 mantém Draft: este checkpoint não libera M01–M08 nem autoriza merge.

## Retomada UI — preview individual e integração inicial FOOD04

- Em `PainelEquivalenciaNutriente`, o cálculo continua autoritativo no backend;
  painel oferece alvo, políticas/preferências, M02 medida caseira do alimento,
  diferenças/resíduos e escolha de linhas. Confirmação aguarda fingerprint e
  revisão do rascunho atuais; mudanças explícitas de medida/gramas voltam à API.
- Integrado ao item do editor e à prévia de grupo FOOD04. Grupo oferece modo
  manual existente ou “Calcular por nutriente”; opções calculadas conservam
  `origemGrupo`, `equivalencia`, porção/unidade e referência de medida caseira ao
  passar pelo callback do editor. Conflitos por mesma identidade e porção diversa
  exigem checkbox explícito; principal e original do grupo não mudam. O painel
  fica bloqueado quando editor/rascunho/revisão não está apto para preview.
- Playwright sintético desktop PASS: preview de alternativa selecionada, medida
  caseira e flags; regressão de aplicação manual FOOD04; integração de cálculo
  através do grupo e autosave, preservando os dois metadados. Testes executados
  individualmente/serialmente para evitar conflito do artifact writer Playwright.
- Playwright sintético mobile PASS: preview individual e medida caseira; cálculo
  FOOD04 por grupo, confirmação seletiva e persistência da origem + intenção.
- Web `tsc --noEmit` PASS após integração. ESLint focado PASS, 0 erros e 8 avisos
  preexistentes no grande `plano-alimentar-profissional.tsx`, fora do novo painel/
  adaptador. `git diff --check` PASS.
- O Next dev gera imports de rota em `next-env.d.ts`; após desligar o servidor o
  arquivo foi restaurado a HEAD; nenhum delta funcional mantido nele.
- Limite naquele checkpoint intermediário: aquela integração não fechava M07/T13. O status/projeção de
  equivalências já existe na API profissional, mas o frontend ainda precisa
  carregar/apresentar `revisao_pendente`, histórico reproduzível e ações de
  recálculo/desvinculação explícitas. Não marque M07 como concluído.
- Cópias entre planos/modelos (T07) ainda exigem remapeamento seguro server-side
  da proveniência cifrada, sem transportar contextos/capacidades pela BFF ou
  browser. Não se declarou essa lacuna resolvida.
- Esta verificação não é revisão independente, não executa a matriz CI integral,
  gates R4, build completo da PR nem confirma comportamento em produção. Draft
  permanece. Sem commit/push, migrations externas, flags ou deploy.

## Retomada FOOD05 — T13 projeção/revisão no editor

- O editor tipou e apresenta o mapa `equivalenciasAplicadas` recebido do backend
  (projeção profissional allowlisted, rota privada `no-store`, tenant/paciente/plano
  conferidos no serviço). Cada alternativa vinculada mostra estado e detalhe
  reproduzível do cálculo salvo: algoritmo, nutriente, porção principal/efetiva,
  descrição/preparo, fonte/revisão, valores-base, alvo, obtido, delta e delta%.
  A ausência/falha da projeção fica explícita; não é tratada como ausência de contexto.
- Para `revisao_pendente`, ação “Recalcular equivalência” reabre o painel com o
  nutriente e alternativa originais selecionados; precisa carregar a prévia atual e
  clicar “Confirmar recálculo”. A ação “Desvincular equivalência” pede confirmação,
  envia identidade anterior/fingerprint de resolução e salva sem alterar a porção.
  A validação final permanece no backend; snapshots publicados não são editados.
- Testes sintéticos novos/verificados: detalhe e recálculo pendente com confirmação
  desktop/mobile; desvinculação confirmada/cancelada e porção preservada desktop/mobile.
  Preferências pessoais M08: atualização CAS de casas decimais/comparação, sem gravar
  o plano, desktop/mobile.
  Regressões focadas desktop: prévia individual, aplicação manual FOOD04 e cálculo
  FOOD05 originado em grupo; mobile: prévia individual e cálculo FOOD04 por grupo.
  Resultado dos cenários focados: PASS. Uma tentativa de teste desktop expirou na
  navegação fria enquanto a compilação Next levou 18,7s (limite do helper 15s); o
  mesmo teste isolado passou depois do cache aquecido. Uma repetição em lote teve
  timeout semelhante e passou isolada. Registrar como instabilidade de compilação
  local, não como teste green da primeira tentativa.
- TypeScript Web `tsc --noEmit`: PASS após integração. ESLint focado: 0 erros; 8
  avisos preexistentes em `plano-alimentar-profissional.tsx`. `git diff --check`: PASS.
- Build Web: `next build --webpack` PASS (compile, TypeScript, 194 páginas,
  otimização e traces). Dois avisos preexistentes de API Node `process.cwd` na
  cadeia Edge Runtime. `next build` padrão/Turbopack BLOCKED pelo ambiente: symlink
  `node_modules` aponta para fora da raiz; não alterei o symlink/dependências.
  Next dev desligado e `next-env.d.ts` restaurado; sem mudança residual gerada.
- T07 e parte de T13 seguem BLOQUEADOS: API de versão publicada não correlaciona
  `chaveCliente` com a identidade relacional de cada alternativa, e modelos não têm
  contrato de proveniência. Cópias não podem transportar o contexto cifrado como
  capability nem remover vínculo silenciosamente. Exigir solução server-side segura
  antes de habilitar cópia de planos FOOD05 e antes de encerrar T13.
- Salvaguarda parcial adicionada nesta retomada: a projeção profissional da alternativa
  retorna somente `equivalenciaAplicada`, derivado do snapshot cifrado e omitido quando
  a resposta não pede equivalências. Não expõe contexto, fingerprints nem capabilities.
  Salvar plano como modelo, duplicar plano, copiar refeição salva e duplicar refeição local
  agora recusam converter uma alternativa FOOD05 para manual enquanto o formato de
  destino não preservar sua proveniência. Testes focados do serviço backend, cópia pura
  (14/14) e Playwright desktop sintético (1/1) passaram; o rascunho não foi alterado.
  Isto reduz perda silenciosa, mas não conclui T07: a cópia de cálculos continua
  bloqueada até haver contrato de proveniência de ponta a ponta.
- Não repetidos neste checkpoint: suite geral backend/build, PostgreSQL/RLS, CI da PR,
  Axe global, segurança R4 independente. Sem commit/push, merge, migration externa,
  deploy, ativação ou uso de dados reais.

## Retomada — proteção de proveniência em cópias e fechamento de verificações locais

- `equivalenciaAplicada` só aparece na projeção profissional solicitada; é um
  booleano derivado do snapshot cifrado e fica omitido para equivalência já
  desvinculada. Não transporta fingerprints ou contexto cifrado. A projeção do
  paciente explicitamente remove esse campo; teste de allowlist PASS.
- Escrita como modelo, duplicação de plano, cópia de refeição publicada e cópia
  local agora recusam a conversão para substituição manual quando há vínculo FOOD05.
  O alerta não envia requisição nem altera rascunho. Ainda não se preserva a
  proveniência nos formatos de cópia; bloqueio é uma salvaguarda deliberada e T07
  continua parcial/BLOCKED.
- Testes: `test-copia-refeicoes-plano.mjs` 14/14 PASS; suites completas do serviço de
  planos e projeção paciente 139/139 PASS; Playwright
  sintético desktop e mobile: bloqueio de cópia de refeição e bloqueio ao salvar modelo
  2/2 em cada projeto PASS. Typecheck Web PASS; typecheck backend PASS; build backend PASS; build Web
  `next build --webpack` PASS, compile, TS e 194 páginas. ESLint focado sem erros e
  8 avisos preexistentes no componente editor.
- RLS/PostgreSQL descartável: BLOCKED antes da inicialização do banco: Testcontainers
  recebeu HTTP 404 do Docker para `timescale/timescaledb-ha:pg15` (“No such image”).
  Não houve conexão a staging/produção nem tentativa de substituir a imagem.
- Playwright tentou inicialmente executar com o dev-server padrão/Turbopack e foi
  BLOCKED pelo symlink de `node_modules` fora da raiz; o mesmo gate, servido por
  Next webpack já iniciado e reutilizado, passou. `next-env.d.ts` foi restaurado
  após o build/dev e `git diff --check` PASS.
- Não executados neste checkpoint: suite integral, CI GitHub, PostgreSQL/RLS real,
  Playwright global/Axe global e revisão R4 independente. Sem commit/push/merge,
  migration externa, deploy ou ativação. FOOD04 produção continua com o bloqueio
  operacional anteriormente documentado (HTTP 402), sem nova consulta externa.

## Revalidação — invalidação de prévia concorrente

- TDD para mudança de entrada durante uma prévia: o teste segurou a segunda resposta
  HTTP depois de trocar a medida caseira. A versão anterior da interface ainda permitia
  confirmar durante a janela de atualização (RED reproduzido). A correção vincula cada
  prévia à assinatura dos fatos usados no pedido, invalida a aplicação imediatamente
  quando essa assinatura muda e só permite confirmar a resposta que corresponde aos
  dados correntes.
- O teste Playwright sintético foi repetido e ficou GREEN em desktop e mobile. A suíte
  focalizada de FOOD05/PA07 passou 14/14 nos dois projetos, incluindo FOOD04, recálculo,
  preferências, desvinculação e bloqueios de cópia que perderiam proveniência.
- Web `tsc --noEmit`: PASS. `next build --webpack`: PASS, 194 páginas. ESLint focado:
  0 erros e 8 avisos preexistentes no editor grande. `test:copia-refeicoes`: 14/14 PASS;
  `git diff --check`: PASS. Build/dev não deixou alteração gerada em `next-env.d.ts`.
- Ambiente de execução usou Node 24.19.0 embora o projeto declare Node 22; pnpm reportou
  aviso de engine. O build e testes concluíram, mas a validação com a versão de runtime
  declarada continua recomendável no CI.
- Continuam fora desta evidência: PostgreSQL/RLS real (bloqueado pela imagem ausente do
  Testcontainers, anotada acima), CI GitHub, revisão R4 independente e smoke global.

## CI da PR — falha de fixture corrigida

- O primeiro CI do HEAD `dc7e177c` executou PostgreSQL real, migrações, suite backend,
  Redis e RLS. RLS da FOOD05 passou; a suite de integração da migration 1078 falhou
  porque sua fixture criava `profissionais` sem as colunas da migration aditiva 1079,
  mas o ORM atual já as seleciona. O erro observado foi `column
  ProfissionalOrm.preferencias_equivalencia does not exist` em `identidadeBiblioteca`.
- A fixture agora aplica a migration 1079 depois da 1078 no Testcontainers descartável,
  sem editar migration histórica nem tocar ambientes externos. HEAD atual
  `bb513d1d` foi executado no GitHub Actions, run `40124900107`: Backend NestJS,
  PostgreSQL/migrations, Redis/idempotência e RLS concluíram PASS; Web Next.js,
  Mobile Expo, AI FastAPI, governança, rollout seguro, operação de lançamento e
  scanners Dependency Review, Semgrep, CodeQL e Trivy também concluíram PASS.
- O run concluiu com `success`: Smoke visual Playwright, testes de estados/recuperação,
  densidade/responsividade, linguagem e jornada de microcopy finalizaram PASS; o
  `PR Gate` também concluiu PASS. O conjunto Playwright local focalizado FOOD05/PA07
  passou 14/14 em desktop e mobile.
- A verificação da projeção pós-desvinculação em RLS foi corrigida para consultar o
  GET profissional do rascunho, onde `equivalenciaAplicada` é projetado; os dados
  editoriais/autosave não carregam esse marcador de leitura.
- A spec unitária da migration 1079 passou 2/2 e o build backend validou `dist/main.js`.
  A integração PostgreSQL/RLS foi repetida no GitHub e passou no run acima. O Docker
  local ainda não consegue iniciar a imagem Testcontainers deste ambiente.
- O run não representa revisão independente R4, liberação de T07, validação da
  FOOD04 em produção, nem autorização para migration externa, deploy ou ativação.
- Resultado final conferido no GitHub Actions para o run `40124900107`, HEAD
  `bb513d1d`: todos os jobs concluídos com `success`. O registro descreve apenas esse
  HEAD; qualquer atualização posterior da PR exige seus próprios checks.

## FOOD05 T07 — limite do envelope de cópia (24/10/2026)

Revisão do caminho de cópia encontrou que o limite de 96 KiB cobria somente o
documento editorial. As referências fechadas de proveniência seguem como campos do
mesmo pedido HTTP; portanto um documento válido perto do teto podia fazer o envelope
ultrapassar o parser Nest de 100 KB. O limite de 200 referências não impedia esse
caso.

- RED: teste DTO com documento estruturalmente válido e referências de tamanho máximo
  aceitou o pedido, apesar do envelope serializado exceder 96 KiB.
- GREEN: o validador do documento também mede o objeto completo de `SalvarEdicaoPlanoDto`
  em UTF-8 e rejeita envelopes acima de 96 KiB. Mantém margem em relação ao parser
  global de 100 KB; não muda rotas, persistência nem limites de conteúdo clínico.
- Validação posterior: DTO, serviço de planos e resolver focal — 155/155 PASS;
  `pnpm build` do Nest e verificação do artefato `dist/main.js` — PASS;
  `git diff --check` — PASS.
- Commit `571d93a` enviado à mesma PR Draft #446. CI do novo HEAD ainda precisa concluir;
  revisão R4 independente e T07 para modelos continuam pendentes. Nenhuma migration,
  consulta externa, merge, deploy ou ativação foi realizada.

## CI PR #446 — falhas de governança e smoke corrigidas (25/10/2026)

No run `40135661731` do HEAD `571d93a`, backend, Web, Mobile, AI FastAPI e scanners
passaram. Governança e Demo local smoke falharam, fazendo o PR Gate reprovar.

- Governança: o gate de redação apontou `quantidadeEquivalencias` e `versaoDestino`
  na auditoria da cópia FOOD05 sem justificativas na allowlist. Foram incluídas
  justificativas de que são apenas contagem e ordinal da versão destino; nenhum
  identificador, composição ou fato clínico é gravado. `pnpm test:redacao-auditoria`
  passou 24/24.
- Smoke visual: quatro casos desktop/mobile da Fase 269 falharam porque a fixture
  interceptava o resumo do plano de origem, mas não o novo GET da versão salva exata.
  A fixture passou a responder esse endpoint com a versão sintética já definida.
  Playwright focal passou 4/4 em desktop e mobile usando servidor Webpack local.
  Turbopack local não iniciou por symlink de `node_modules` fora do filesystem root;
  essa limitação do ambiente não reproduziu o erro funcional.
- Backend, Web, Mobile e scans do run falho já estavam PASS. PR Gate precisa rodar
  novamente sobre o novo HEAD. O relatório documental atual permanece apenas na
  worktree até a sincronização desse commit.
