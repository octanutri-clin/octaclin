# FOOD06 M07 — comparação factual de versões: fundamento interno

> CI deste fundamento encerrado: remotod8d63d62, run41419402009SUCCESS.
>22checksSUCCESS/ProvenanceSKIPPED; sem fechar M07 inteira.
>Próximo incremento: [construtor de envelope](food06-construtor-registro-factual.md),
>com CI próprio. Pendências de CI abaixo são históricas.

## Estado

PR455 Draft, branch docs/food06-contratos-fontes. Base local96e3345b e remota
b9ed65bc com árvore idêntica7ab48202, preservadas. CI da base concluído no
run41398826715: Backend, Web, Mobile, AI, Demo e PRGate SUCCESS; PostgreSQL real
com role sem BYPASSRLS/Testcontainers e scanners SUCCESS. Consulta REST pública
aos check-runs neste ciclo:23checks,22SUCCESS e Provenance do SBOM SKIPPED.
Isso encerra tecnicamente M09 nos critérios existentes, não direitos/DRI/G06,
M07 ou FOOD06 inteira. As falhas PA07 anteriores continuam históricas; correção
com72unitários/162browser e R4 delimitada, agora com CI próprio aprovado.

M07 recebe somente fundamento interno neste incremento, sem rota, UI, registro
persistente, migration, catálogo, referência numérica ou dependência nova.
Risco R4 por futuro uso de contexto e identidade clínica; nenhum ambiente externo
foi consultado ou modificado para dados clínicos. Não é prova de autorização HTTP.
Sem merge, deploy, Neon/Render ou escrita externa. FOOD05-MDL não iniciada.

## Contrato e reuso

- compararVersoesFactuais recebe dois estados congelados resolvidos pelo servidor,
  cada um com tenant/paciente internos, plano/versão exatos, número, status e
  instante canônico registrado. Rascunho exige revisão editorial positiva/exata;
  não resolve silenciosamente a versão mais recente. Publicação não aceita
  revisão de rascunho. O instante UTC é registro de auditoria, não data civil
  clínica; não calcula idade nem substitui timezone do tenant. Escopos divergentes, plano incoerente, datas malformadas e
  refeições duplicadas são rejeitados com erro genérico sem conteúdo clínico.
- O cálculo é exatamente compararCenariosFactuais→PA06/M04: porções congeladas,
  não multiplica quantidade nem consulta composição atual, alternativas disponíveis
  não entram, flags registradas de seleção/ativação são respeitadas. Montagem
  futura deve usar a seleção histórica documentada, não a ativação atual do plano.
- A comparação se refere ao total de cada versão separadamente. Não soma versões,
  normaliza períodos, afirma equivalência diária, consumo real ou adequação DRI.
  A confirmação de mesmo dia continua sendo requisito das comparações diárias;
  não retirar totais factuais autorizados por opinião das personas.
- Antes/depois, deltas/percentuais e limites reaproveitam precisão decimal e
  cobertura existentes. Parcial/desconhecido/incompatível impede delta completo
  do nutriente afetado; zero conhecido permanece zero. Mudança numérica não é
  automaticamente mudança de cobertura nem melhora nutricional.
- Quatro dimensões documentais: planejamento, composição/fonte, referência e
  contexto. Contrato interno de marcadores versionados food06-bases-v1 com hash
  SHA256; ausente/malformado→nao_documentada, esquema desconhecido→incompativel.
  Hexadecimal normalizado evita diferença apenas visual. Igualdade significa
  marcadores documentados iguais, não prova de conteúdo coerente ou causa.
- Atribuição causal permanece nao_estabelecida, inclusive com dimensão alterada.
  Cobertura antes/depois compara estado, contagens e causas por nutriente, sem
  confundir subtotal diferente com qualidade/completude diferente.
- Saída reconstrói identidade por allowlist e nunca projeta escopo, marcadores,
  hashes ou contexto clínico. Objetos de saída testados são independentes das
  entradas. Erros/limites matemáticos da PA06 não viram zero/NaN/Infinity.

## Limitações que bloqueiam a integração completa M07

O construtor canônico NÃO foi implementado. Deverá derivar marcadores exclusivamente
no servidor a partir do conteúdo autorizado exato: porções/seleção no planejamento;
fonte/preparo/base/unidade/forma/concentrações na composição; conjunto/regras na
referência; confirmações e população no contexto. Não aceitar hashes ou totais do
navegador, não incluir campos apenas visuais e não presumir coerência pelo formato
SHA256. Hash não é autorização, capability, revisão editorial ou prova causal.

A checagem de igualdade de escopo deste domínio NÃO autoriza o paciente. Serviço
futuro precisa revalidar carteira, tenant, paciente, origem, versão/revisão exata,
permissões e fonte dentro da transação, com locks e projeções. Registro de análise
imutável/contexto/referências M05, cifragem, retenção, autorização/RLS, paginação,
API/BFF e interface permanecem pendentes. Não marcar M07-C1/C2 integrais como PASS.
Sem análise histórica registrada, não afirmar reprodução de uma análise DRI anterior.
Direitos bloqueados não foram contornados. Referência comum não foi habilitada.

## TDD e verificações reais

- RED funcional:17FAIL/10PASS,27testes compilados, função existente ainda sem
  comportamento. Nenhum erro de import/setup foi utilizado como RED.
- GREEN inicial:71/71 (27M07+44prévia/cobertura). Expansão negativa exigiu cast
  explícito de payload inválido na fixture TS; erro de compilação não foi RED
  funcional nem foi resolvido alterando types/engines do produto.
- GREEN final:83/83,39M07+44prévia/cobertura, zero skipped. Quatro dimensões,
  ausência/esquema/getters, rascunhos/revisões, cross-scope, datas, fonte congelada,
  parcial/zero/ausências, esquema nutricional desconhecido, seleção e imutabilidade.
- Backend completo Node22.23.4:3.970PASS/180SKIPPED,381suítesPASS/9SKIPPED.
  SKIPPED preservados para integração/provider não habilitados; não são RLS PASS.
- Typecheck, build Nest e verificação dist/main.js PASS. Diff-check PASS.
- Revisão independente food06_m09_r4 delimitada a M07: favorável,83testes próprios
  e diff-check; sem escrita, DB/API/UI ou validação clínica humana. Destacou
  explicitamente a dependência do construtor e do registro imutável.
- UX A complementar por duas instâncias com papéis PR451/0d3382b6, sem ferramentas,
  imagens/interação ou pacientes reais. Relatório FOOD06-M07-A; B/C ainda não
  aplicáveis ao fundamento sem interface, obrigatórias nas integrações futuras.
- Nenhum teste novo Web/Playwright/PostgreSQL local: delta somente domínio sem
  integração/runtime exposto.162browser/72Web unitários e RLS do CI da base são
  evidências dos respectivos commits, não execução nova deste fundamento.
- CI/scanners do novo HEAD ainda pendentes; não herdar o verde da base.

## Próxima ação / rollback

Revisar diff/segredos e publicar somente delta intencional na mesma PR Draft,
com igualdade de árvore e expected_sha, sem reset/rebase/force. Conferir CI do
novo HEAD. Depois: construtor exato/registro imutável M05–M07, justificar schema
somente após verificar armazenamento existente; desenvolver/testar apenas em banco
descartável. API/UI devem ter gates próprios e revisão independente.
Rollback deste núcleo é remoção de código não ligado ao runtime, sem dado gravado
ou migration. Não atualizar snapshots publicados nem ativar comparações clínicas.

Progresso administrativo pelo método fixo:37,5% =1concluída (M09),7parciais,
4pendentes. Não é percentual de esforço, prazo ou prontidão assistencial.
