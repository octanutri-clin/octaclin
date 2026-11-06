# FOOD06 M05/M07 — construtor de envelope factual

> Checkpoint histórico do construtor em memória. Continuidade atual:
> [persistência interna cifrada](food06-persistencia-factual.md). As limitações
> deste incremento original foram preservadas; não representam todo o delta novo.

## Estado e limite da entrega

PR455 Draft, branch docs/food06-contratos-fontes. Base local33b4be0c/remotad8d63d62,
árvore idêntica2d292859, históricos preservados. CI da base41419402009 SUCCESS,
scanners e coleta documental SUCCESS; consulta pública check-runs23total,
22SUCCESS e Provenance do SBOM SKIPPED. Esse verde não valida o delta atual.

**Entregue: construção de envelope imutável em memória. Não há registro durável,
cifragem nova, tabela, migration, API/BFF ou interface neste incremento.** Object.freeze
não equivale a imutabilidade de banco nem a autorização. M05/M07 continuam parciais;
37,5% administrativos,1/12encerrada,7parciais/4pendentes. DRI/direitos/G06 BLOCKED.
Sem merge/deploy/migrations externas/Neon/Render, mesmo após a data de retorno do
proprietário. FOOD05-MDL/D18 não iniciada.

Risco R4 pela futura manipulação de contexto/identidade clínica. Fonte de entrada:
somente carregador server-side autorizado, nunca body HTTP, totais ou hashes do
navegador. Não confundir teste de contrato interno com prova de autorização/RLS.

## Implementado e reuso

- construirAnaliseFactual produz registro factual-v1 a partir de identidade exata,
  revisão de rascunho, seleção/ativação registrada, porções e snapshots salvos.
  Reutiliza o validador interno M07, exportado sem alterar comportamento, PA06,
  cobertura/M04, resolverContextoDietetico e aritmética existentes.
- Projeção por allowlist dos campos computacionais/fonte/preparo. Descarta nomes,
  descrições, referência textual livre customizada, campos desconhecidos e
  alternativas disponíveis. Itens de refeições excluídas não são armazenados.
  Envelope continua interno/protegido, incluindo escopo, contexto e hashes;
  não é projeção autorizada de resposta HTTP.
- Faz cópia independente e congela profundamente o envelope; não congela nem
  modifica a entrada. Sem consulta a catálogo atual, ajuste de porções ou escrita
  em versões antigas. Os totais vêm dos valores de porção congelados PA06.
- Marcadores por dimensão são derivados no servidor dos mesmos dados projetados.
  Gramas usam razões decimais canônicas pelos helpers existentes; ordens de exibição,
  IDs de linhas copiados, rótulos e timestamps acessórios de fonte não alteram
  marcadores. Preparação só normaliza caixa/espaços/NFC, sem equivalência por nome,
  fator de cocção ou conversão inventada. Fonte/hash/normalização e concentrações
  relevantes continuam rastreáveis. Nenhum motor nutricional paralelo.
- Planejamento exige identidade estável documentada de catálogo(base/código/preparo)
  e gramas. Manual/custom/legado sem identidade não recebem identidade inferida por
  nome: fatos continuam disponíveis, planejamento_nao_documentado. Resolver
  identidades autorizadas adicionais na integração futura quando existirem.
- Fonte/concentração incompletas ou snapshot ausente retiram marcador de composição,
  avisando composicao_nao_documentada; não inventam igualdade entre duas ausências.
  Ausência explícita versus chave omitida é canonicalizada apenas no hash como
  estado ausente, nunca zero. Snapshot projetado e cálculo permanecem distintos.
- Coerência de porção conferida com calcularNutrientesParciaisDaPorcao e
  criarSnapshotMicronutrientes existentes. Divergência avisa porcao_divergente e
  omite marcadores; preserva valores congelados, sem reparo automático. Políticas
  atuais4casas(macros)/8casas(micros) podem divergir de escritor histórico legítimo:
  aviso não prova corrupção, erro clínico ou qual parte está correta. Ausência de
  aviso não prova coerência no banco, autorização ou validade clínica.
- Contexto explícito passa pelo resolver existente. Guarda somente data civil e
  contexto resolvido/idade, sem nascimento original ou texto livre. Ausência não
  presume saúde/elegibilidade. Data de auditoria da origem é instante UTC, não
  substituto de timezone clínico. Carregador futuro deve usar fonte canônica do tenant.
- Referências continuam indisponíveis e nenhum marcador de referência numérica é
  inventado. Não ativa DRI ou importa dados; usa apenas snapshots já autorizados.

## Falha fechada e dados incompletos

Zero conhecido é preservado nos nutrientes. Base de origem/gramas precisam ser
positivas, como no produtor. Arrays esparsos, accessors, objetos incompatíveis,
quantidades inválidas e esquema nutricional não suportado são recusados ao preparar
este registro. A consulta factual existente não é alterada: recusar a gravação de
um esquema não reproduzível não recalcula nem remove as medidas/totais anteriores.
Falta legítima de composição continua desconhecida/parcial, sem virar zero.
Há limites50refeições/10.000itens compatíveis com o núcleo, sem alteração de engines.
Erros são genéricos; limites técnicos de precisão existentes continuam explícitos.

## TDD e evidências

- Histórico antes do reinício:12REDfuncionais/5PASS →56GREEN(construtor17+M0739).
  Arquivos temporários dessa execução foram perdidos no reinício; delta preservado.
- Reprodução atual de fontes:5FAIL/19PASS →63GREEN (24construtor+39M07).
- R4 encontrou P2 arrays esparsos e P2 base/porção zero. Reproduzidos com RED,
  junto da lacuna de coerência:4FAIL/25PASS. Corrigidos →112focados PASS.
- Dois probes do revisor viraram testes persistentes: getter sem execução e
  precisão histórica preservada com aviso. Foco114PASS; backend4.001PASS/180SKIPPED.
- Última lacuna de hash: chave ausente versus ausente explícito:1RED/31PASS.
  Ajuste só na canonicalização do marcador:115/115focados finais (32construtor+
  39M07+44M04/cobertura); backend final4.002PASS/180SKIPPED,382suítesPASS/9SKIPPED.
- Typecheck Node22.23.4 PASS; build Nest final e artefato dist/main.js PASS após
  o último ajuste. Diff-check PASS. Sem alteração de dependência.
- R4 independente food06_constructor_r4: P2 corrigidos, favorável após correções;
 68testes próprios+6probes sintéticos PASS; complementos finais estáticos sobre
 testes persistentes e canonicalização de ausência, sem suítes adicionais próprias.
 Revisor não editou. Sem aceite de toda FOOD06, banco ou validação clínica humana.
- UX A M07 permanece aplicável: docs/agents/ux/reports/FOOD06-M07-A/. Nenhuma
  jornada/interface nova; B/C ficam pendentes até interface utilizável, sem alegar
  execução visual, personas adicionais ou testes com usuários reais nesta rodada.
- PostgreSQL/RLS/API/Web/Playwright novos NOT RUN: nenhum acesso SQL ou superfície
  HTTP nova. Provas da base pertencem à base, não a este envelope em memória.
- CI/scanners do novo HEAD ainda pendentes. SKIPPED não é aprovado.

## Recuperação do ambiente

Executor reiniciado, arquivos locais preservados, sem reset/clean/rebase/descartes.
Node padrão24 incompatível; recuperado Node22.23.4 oficial em /tmp, SHA256 conferido:
1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce.
Sem reinstalação de dependências ou alteração de engines. Reinício não é falha
funcional comprovada nem autoriza assumir PASS para teste interrompido.

## Persistência: inspeção e próxima ação concreta

PlanoAlimentarVersaoOrm tem snapshots cifrados de cálculo/totais/edição/apresentação
vinculados à própria versão e campos mutáveis do rascunho. Não registra múltiplas
análises deliberadas de revisões/contextos sem alterar a publicação ou outro fluxo.
DocumentoEmitidoOrm é documento renderizado emitido ao paciente, com contrato de
emissão/cancelamento/envio; não é registro técnico FOOD06. Reutilizá-lo sem um novo
contrato criaria acoplamento com entrega ao paciente, fora deste escopo.

A inspeção não comprovou armazenamento existente compatível para o registro M05.
Próximo incremento: repositório append-only cifrado e serviço de gravação/leitura,
reutilizando crypto/auditoria/ExecutorTenant. Confirmar estado atual de main e
migrações antes de escolher número (última na branch inspecionada1080, não prova de
aplicação ou disponibilidade do número seguinte). Justificar migration aditiva se
necessária, desenvolver/testar somente em PostgreSQL descartável.

Gates obrigatórios: autorização por tenant/paciente/carteira e fontes/proveniência,
identidade/revisão exata na transação, CAS, idempotência/replay e ordem de locks;
envelope cifrado com vínculo ao registro/escopo, schema e leitores versionados;
FORCE RLS/role runtime, testes negativos e rollback sem apagar história. Não aceitar
registro bruto, totais ou bases fornecidos pelo cliente. Registro em memória não
substitui essas provas. Não habilitar cópias por modelos ou contornar D17/FOOD05.

Depois: API/BFF/paginação/interface, UX B/C e revisão independente próprias.
Rollback atual é só remoção de código não ligado ao runtime; nenhum dado gravado.
