# FOOD05 T07 — revisão de riscos e contrato de arquitetura

Revisão estática do HEAD `7af23a86`, em 26/10/2026. Escopo: transporte de
proveniência entre plano, modelo reutilizável e plano de destino. Risco R4:
autorização, dados clínicos e persistência cifrada. Este documento não constitui
revisão independente, aprovação clínica ou evidência de execução em banco.
Nenhuma alteração de runtime ou migration faz parte desta rodada.

## Conclusão e evidências

O bloqueio atual de modelos com FOOD05 deve continuar até o contrato abaixo ser
implementado. A solução pode reutilizar armazenamento e writer atuais, sem nova
dependência ou tabela demonstradamente necessária. Copiar o contexto bruto para
o JSON compartilhado não atende à segurança nem à proveniência.

| ID | Evidência no código | Risco e tratamento necessário |
| --- | --- | --- |
| A01 | `ContextoEquivalencia.copiaOrigem` contém paciente/plano/versão e origem inicial; contém também ator e resoluções. `ServicoModelosPlanoAlimentar.obter/obterVersao` devolve refeições ao navegador | Copiar esse contexto para modelos expõe referências clínicas a colegas. Manter contexto interno cifrado e projetar somente campos explicitamente permitidos. Criptografia em repouso não autoriza divulgação após decifragem |
| A02 | `clonarContextoEquivalenciaParaCopia` conserva `estado` do original. O teste de cópia manual obtém pendência porque a identidade manual muda. `fatosSemanticosEquivalencia` conserva a mesma identidade para catálogo | A pendência depende indiretamente das diferenças semânticas; uma cópia de catálogo idêntica pode continuar revisada. Não é prova de exploração executada. Toda nova cópia deve nascer explicitamente `revisao_pendente`, com teste de catálogo idêntico e bloqueio de publicação |
| A03 | `validarRefeicoesModelo` usa `validateSync`, mas só considera `whitelistValidation` | Campos conhecidos com tipos/faixas inválidos não são rejeitados por essa defesa interna. A fronteira HTTP não substitui validação de snapshots. Exigir validação estrutural e semântica completa, com compatibilidade legada explícita e erros genéricos |
| A04 | `salvarEdicaoRascunho` bloqueia destino e depois `resolverCopiasEquivalencia` bloqueia origens na ordem recebida | Cópias recíprocas A→B/B→A podem disputar locks em ordem inversa. Definir ordem global de locks antes de decifrar/copiar; comprovar concorrência em PostgreSQL. Rollback de deadlock não é perda parcial, mas precisa produzir erro recuperável sem retry cego |
| A05 | A cópia identifica a origem por número de versão; um draft permanece mutável sob o mesmo número | A aplicação pode capturar revisão distinta da conferida na tela. Referência deve fixar versão UUID e revisão esperada de draft; publicada usa revisão imutável. Divergência pede nova conferência |
| A06 | Refeições de modelos usam posições, sem identidade persistida de entradas | Remoção/reordenação pode associar um cálculo à alternativa errada. Envelope novo exige identidades estáveis próprias; índices podem servir à UI, nunca como única identidade de proveniência |
| A07 | Modelos e revisões já possuem conteúdo bytea cifrado; migration1060 registra revisões imutáveis e FORCE RLS | Reutilizar essas estruturas. Configuração em migration não prova aplicação ou role efetiva em ambiente externo; prova real continua necessária no gate adequado |

Referências de código: `aplicacao/servico-modelos-plano-alimentar.ts`,
`aplicacao/resolver-equivalencias-edicao.ts`,
`aplicacao/servico-planos-alimentares.ts`,
`dominio/fingerprint-equivalencia.ts`, `aplicacao/snapshot-edicao-grupos.ts`,
`dominio/modelos-plano-alimentar.ts`, todas sob
`octaclin-backend/src/modulos/planos-alimentares/`; e
`octaclin-web/components/pacientes/plano-alimentar-profissional.tsx`.

## Contrato recomendado para implementação

1. **Captura:** requer origem salva, profissional responsável atual, tenant da
   credencial, plano/versão e revisão exata. Cliente transmite referências e
   identidades editoriais; não transmite contexto confiável, autor ou resultados.
   Backend resolve fonte cifrada sob os locks e a autorização existentes.
2. **Envelope de modelo versionado:** leitura compatível com arrays legados;
   formato novo contém refeições, identidades estáveis e mapa interno de
   proveniência. Guardar fatos utilizados, algoritmo/política, fontes/versões,
   frações exatas, porções e resultado original. Histórico permanece imutável.
   Não introduzir dupla escrita em tabelas paralelas.
3. **Fronteiras de divulgação:** leitura da biblioteca retorna refeições e
   referências não secretas de entradas/versão; não retorna paciente, plano de
   origem, cadeia de cópias, ator interno, hashes de comando ou contexto bruto.
   Nome/orientações já editáveis continuam potencialmente sensíveis: não se pode
   prometer anonimização só por excluir UUIDs. Confirmar compartilhamento com a
   clínica e usar os controles existentes para o conteúdo explicitamente compartilhado.
4. **Aplicação:** referência de modelo, versão e entrada é resolvida pelo backend
   na transação do writer existente. Uma referência opaca não concede permissão.
   Validar novamente modelo ativo, escopo pessoal/clínica, paciente/carteira de
   destino e fontes permitidas; aplicar também a política de origem abaixo.
5. **Destino:** nova identidade de aplicação, remapeamento de entradas e
   `revisao_pendente` explícita. Guardar a origem e cálculo original cifrados;
   manter quantidades confirmadas. Novas alternativas sem preferência/liberação.
   Recálculo ou desvinculação exige ação explícita antes de revisão/publicação.
6. **Edição/restauração do modelo:** preservar proveniência por identidade estável,
   mesmo após reordenação; mudança semântica não substitui o cálculo original.
   Remover alternativa remove-a da nova versão, preservando revisões anteriores.
   Restaurar cria nova revisão, sem mudar planos aplicados.
7. **Consistência:** CAS para origem, modelo e destino; chave de aplicação estável
   durante retry/ACK. Pedido repetido não cria novos contextos ou filhos; replay
   em revisão diferente falha. Cancelamento anterior ao envio não persiste;
   timeout após commit exige reconciliação de ACK, não pressuposição de rollback.
8. **Limites:** manter 96KiB no body completo, limites de alternativas/referências,
   16KiB por contexto e 2MiB no mapa interno já existentes. Rejeitar excesso antes
   de trabalho caro; testar também leitura/edição de modelos grandes. Sem dados
   clínicos em logs, URLs, auditoria livre, analytics ou cache persistente.

O novo orquestrador chama o mesmo núcleo transacional do writer. Não abrir uma
segunda transação tenant dentro da primeira, duplicar o motor nutricional ou
adotar o contexto recebido do navegador como fato autoritativo.

## Política de acesso à origem — conflito real a decidir

O T07 vigente exige reautorizar o paciente de origem na aplicação. Essa política
impede que um colega use a proveniência clínica de um modelo compartilhado quando
não tem acesso ao paciente original. O acesso ao modelo, isoladamente, não supera
essa restrição. **Esta revisão mantém essa exigência como padrão vigente.**

Alternativa para uma evolução: ao salvar explicitamente um modelo compartilhado,
criar um artefato matemático independente, com fatos nutricionais permitidos e
sem vínculo clínico utilizável pelo colega. A cadeia clínica original permanece
restrita e cifrada para rastreabilidade; a aplicação usa modelo autorizado e nova
revisão profissional. Isso exige formalizar o que pode ser compartilhado, quais
campos livres podem conter dados de pacientes e a política de acesso à cadeia.
Não é suficiente remover `copiaOrigem` nem expor uma URL/token para a origem.

Recomendação imediata: implementar o contrato restrito já aprovado, exibindo erro
genérico quando a origem não puder ser reautorizada. Se o objetivo for reutilização
por qualquer colega autorizado da clínica sem acesso ao paciente de origem,
ratificar expressamente a alternativa do artefato independente antes de alterar
essa regra. Não apresentar ambas como se fossem o mesmo contrato de segurança.

## Sequência e critérios de saída

| Bloco | Trabalho | Evidência exigida |
| --- | --- | --- |
| B1 | A02/A03, referências exatas de origem, schema e validação de envelope | RED/GREEN de catálogo idêntico, estado pendente, tipos/faixas inválidos, desconhecidos, legado e falha fechada |
| B2 | Captura e writer transacional; autorização e política de origem | Positivos e negativos cross-tenant/carteira, transferência/revogação, modelo pessoal de colega, arquivado, origem modificada; respostas sem referência clínica indevida |
| B3 | Cópia por identidade estável e ACK no editor | Reordenação/remoção/edição/restauração, cancelamento, retry, autosave60s, PA07, snapshots anteriores intactos |
| B4 | Prova PostgreSQL real | Role sem BYPASSRLS, isolamento, CAS de origem/modelo/destino, cópias recíprocas e duas aplicações simultâneas; rollback de todas as alternativas em falha intermediária |
| B5 | Gates finais | Backend/BFF/Web, regressões FOOD04 e planos legados, CI/scanners no HEAD final, revisão R4 com autoria e escopo registrados |

## Rollback e estado da revisão

Bloquear captura/aplicação nova antes de reverter writer. Manter leitor compatível
com envelope novo e antigo; rollback para binário que só lê arrays não é seguro
depois da primeira gravação do formato novo. Não apagar snapshots nem desfazer
schema1079 como rollback desta funcionalidade. Deploy gradual só pode habilitar
o writer quando todos os leitores compatíveis estiverem disponíveis.

PASS: revisão estática do escopo e identificação dos contratos reutilizáveis.
BLOCKED: T07 funcional, fechamento R4 independente e merge como FOOD05 concluída.
SKIPPED: testes de implementação nesta rodada documental, PostgreSQL, migrations,
deploy e ambientes externos. Achados A02–A05 exigem reprodução direcionada; não
há alegação de teste RED/GREEN ou exploração executada nesta revisão.

## Ratificação D15–D18 do proprietário — 27/10/2026

- **D15:** toda nova cópia recebe `revisao_pendente`, identidade nova e fingerprint
  do novo estado; cálculo original e linhagem permanecem cifrados. Um histórico
  existente não é recalculado nem reescrito. Resolver pendência exige ação explícita.
- **D16:** validar integralmente os modelos em todas as fronteiras, inclusive
  snapshots, campos conhecidos opcionais e limites. Inválido falha fechado sem
  persistência. A01/A02/A03 não autorizam descartar proveniência para contornar erro.
- **D17:** ratificada a reautorização do paciente original para operações dependentes
  de sua proveniência clínica. Compartilhamento de modelo não concede esse acesso.
  Bloqueio explícito atual de modelos FOOD05 continua obrigatório.
- **D18:** direção futura aprovada conceitualmente: artefato matemático genérico,
  sem dados identificáveis de paciente, com resolução de fontes e novo cálculo no
  destino, nova aplicação e confirmação profissional. Exige proposta técnica e
  autorização de execução próprias. Não incorporar contexto clínico ao artefato nem
  implementar essa arquitetura nesta correção.

Esta ratificação resolve a decisão de política acima; não conclui o T07 nem os
respectivos testes/gates. A04/A05 e demais critérios integrados continuam pendentes.

## Reavaliação após as correções D15/D16 — 27/10/2026

| Achado | Estado no HEAD `c7df3bfe` | Evidência e limite |
| --- | --- | --- |
| A01 — contexto clínico em modelo compartilhado | Contido pelo bloqueio explícito | O fluxo FOOD05 por modelo continua recusado no frontend e no serviço. D17 proíbe remover proveniência ou conceder acesso à origem via compartilhamento. Não há novo contrato de aplicação server-side. |
| A02 — cópia idêntica herda revisão | Corrigido | `clonarContextoEquivalenciaParaCopia` atribui `revisao_pendente` explicitamente, gera identidade nova e refaz fingerprint. RED/GREEN cobre catálogo idêntico, planos/pacientes, repetição e recálculo. |
| A03 — validação parcial do modelo | Corrigido | Serviço rejeita todos os erros do class-validator e valida campos fornecidos fora do caminho principal do DTO; aplica limite/estrutura e falha genericamente em snapshots corrompidos. Specs cobrem criação, edição, leitura, versão, restauração e legado válido. |
| A04 — ordem de locks | Aberto | Cópias recíprocas ainda precisam de ordem global determinística e teste PostgreSQL de concorrência. |
| A05 — revisão mutável da origem | Aberto | Referência por número não fixa revisão exata de rascunho entre prévia e aplicação; exigir revisão esperada/CAS e reconferência. |
| A06 — identidade de itens de modelo | Aberto e ligado a D17 | Modelos usam posições sem identidade persistente. FOOD05 continua bloqueado em modelos; qualquer futura integração precisa de identidades estáveis e contrato aprovado, sem transportar proveniência pelo browser. |
| A07 — RLS e rollout | Sem nova alteração de schema nesta correção | No HEAD `c7df3bfe`, o job Backend NestJS e seu passo PostgreSQL/RLS descartável concluíram PASS. Isso comprova a execução automatizada indicada pelo CI, não aplicação de migrations externas nem prontidão de produção. |

O CI do HEAD exato também concluiu PASS para CodeQL, Semgrep, Trivy, Dependency
Review, Web e governança. O Demo local smoke ainda estava em execução na última
consulta. Esses resultados não são revisão R4 independente. T07 permanece parcial
até A04/A05 e os demais testes de integração serem fechados; D17 mantém bloqueada
a aplicação FOOD05 por modelos, e D18 exige proposta e autorização próprias.

## Proposta técnica D18 — pendente de autorização de execução

### Contrato

Separar o **modelo matemático genérico** do `ContextoEquivalencia` clínico. O
artefato reutilizável conteria somente uma versão de schema, alimento de origem e
alternativas por referências de catálogo permitidas, nutriente-alvo e política de
cálculo. Não guardaria paciente, plano, ator, cálculo aplicado, dados cifrados de
origem, hashes/capabilities clínicas ou snapshots individuais de composição.

Ao aplicar, o backend deverá carregar a revisão exata do artefato, revalidar o
acesso do profissional ao modelo e ao paciente/plano destino, resolver cada
referência contra o catálogo e a fonte nutricional atualmente autorizados, e
calcular a prévia no contexto do destino. Alteração/indisponibilidade da fonte,
versão do modelo ou revisão do rascunho invalida a prévia. A confirmação do
profissional usa fingerprint e CAS do destino, cria UUID de aplicação próprio,
persiste somente a nova proveniência clínica cifrada sob o paciente destino e
aplica o resultado pelo writer FOOD05 existente. A confirmação vale para esse
destino; nenhuma quantidade calculada para outro paciente é copiada. O retorno da
API não contém referência ou identidade clínica de uma aplicação de origem.

### Persistência e contratos existentes

Recomendação inicial: envelope versionado no conteúdo cifrado e imutável das
revisões de modelo que já existem; manter leitores de arrays legados e adicionar
um discriminador explícito e allowlist para o artefato genérico. Criar endpoints
de leitura/prévia/confirmação próprios que projetem apenas o DTO genérico e o
resultado calculado para o profissional autorizado; não ampliar a resposta ampla
de modelos para transportar contexto clínico. Reutilizar `ExecutorTenant`, RLS,
permissões de biblioteca, motor FOOD05, writer transacional, auditoria redigida,
snapshots e política de publicação.

Não parece necessária migration: conteúdo e revisões já guardam envelopes JSON
cifrados em `bytea`. Antes de implementar, comprovar que todos os leitores e
escritores conseguem distinguir a versão sem ambiguidade e que rollback pode
preservar leitura de versões antigas. Se essa prova falhar, propor migration
aditiva e plano de rollout separado. Nenhuma migration externa está autorizada.

### Riscos e controles

| Risco | Controle proposto |
| --- | --- |
| Uma referência de alimento permite acessar outra clínica ou fonte não licenciada | Resolver no backend por tenant/escopo e allowlist de fonte ativa; não confiar em valores nutricionais enviados pelo navegador |
| Modelo muda entre prévia e confirmação | Fixar `modeloId + numero/revisao` e rejeitar por CAS se a revisão divergir |
| Rascunho destino muda ou muda a autorização | Revalidar carteira, paciente, versão e revisão dentro da transação de confirmação |
| Retry duplica aplicação | UUID/ACK idempotente por intenção confirmada; mesma chave repetida retorna mesmo resultado ou conflito explícito |
| Envelope genérico recebe proveniência clínica por mass assignment | DTO discriminado estrito, allowlist recursiva e testes negativos de IDs/contextos/capabilities |
| Mudança de catálogo altera resultado histórico | Congelar fatos efetivamente utilizados apenas no novo snapshot clínico destino; nunca atualizar aplicações históricas |
| Modelo compartilhado expõe contexto clínico por projeção, auditoria ou cache | DTO independente, logs/auditoria redigidos, sem cache persistente; testes de projeção e isolamento |

### Testes necessários para aprovação futura

- Leitura de modelos legados e envelope genérico v1, versões imutáveis e restauração.
- Rejeição de IDs de paciente/plano, contexto cifrado, ator e campos desconhecidos
  em todas as fronteiras do novo envelope.
- Fonte permitida, inativa, removida, alterada e de escopo/tenant incompatível;
  recálculo usa a composição resolvida no destino, nunca snapshot de outro paciente.
- Acesso negado ao modelo e ao destino, transferência/revogação de carteira,
  conflito de revisão, paciente de outro tenant e resposta sem dados de origem.
- Prévia cancelada sem escrita; confirmação, replay e retry idempotentes; duas
  confirmações concorrentes e rollback integral em falha intermediária no
  PostgreSQL real com role runtime e FORCE RLS.
- Confirmação só após conferência explícita do profissional, política de revisão,
  publicação, autosave, snapshots FOOD04 e regressões dos arrays legados.

### Proposta de aceitação

D18 pode ser implementada em PR própria depois de aprovar este contrato, comprovar
direitos e escopo das referências do catálogo e fechar A04–A06. Estimativa de
impacto: novos DTOs/rotas, integração com o writer existente, testes de banco e
ampliação discriminada do validador; sem nova tabela/migration prevista. Esta
proposta não altera o bloqueio D17, não libera FOOD05 por modelos e não completa
T07. A execução depende de autorização específica.

## Decisão definitiva do proprietário — divisão T07-A/T07-B (27/10/2026)

Esta decisão substitui a recomendação anterior deste parecer de que aplicação por modelo seria necessária para concluir a FOOD05 principal.

- **T07-A / FOOD05:** cópias entre planos e refeições autorizados, com proveniência cifrada, reautorização atual, nova identidade, `revisao_pendente`, remapeamento, revisão exata, ordem de locks, CAS, idempotência e rollback. D15/D16 preservados como correções técnicas; A04/A05 permanecem abertos até evidência abaixo.
- **T07-B / FOOD05-MDL:** identidade estável de itens/modelos, artefato matemático independente de pacientes, resolução e cálculo no destino. D18 é direção de produto, não execução autorizada. A06 é transferido para T07-B e fica aberto, contido pelo bloqueio D17.
- **D17:** aplicação de FOOD05 por modelos continua bloqueada no backend e na interface. Acesso a modelo compartilhado não autoriza leitura/proveniência do paciente original; não remover, mascarar ou converter proveniência silenciosamente.

### A04 — implementação e critério de prova

O runtime agora constrói manifesto de todos os pacientes/planos envolvidos, ordena UUIDs em forma canônica, bloqueia primeiro pacientes e depois planos; destino recebe lock de escrita e origens de leitura. A operação permanece em uma transação tenant. A ordenação pura tem teste para reciprocidade, consolidação e identidade ambígua. Isso é evidência unitária, não prova de banco. T07-A/T14 ficam bloqueados até teste concorrente controlado de serviço em PostgreSQL descartável, com role runtime/RLS, chamadas A→B e B→A simultâneas, confirmação de ambas ou conflito recuperável, nenhuma linha parcial e cenário de falha/rollback. Sem retry cego.

### A05 — contrato de revisão exata

A referência inclui `versaoIdOrigem` obrigatório. Draft exige `rascunhoRevisaoOrigemEsperada` e rejeita ausente/divergente dentro da transação, após autorização atual; versão publicada aceita ausência de revisão mutável, mas exige o UUID exato. O browser também compara UUID, número, status, `updatedAt` e revisão do draft entre seleção e confirmação. Se qualquer um divergir, deve obter nova conferência em vez de aplicar dados antigos. Testes focados incluem versão trocada, revisão stale e ausência para draft. A prova PostgreSQL ainda deve cobrir stale no save, preservação da revisão/snapshot destino e transferência/revogação.

Não há migration nova neste desenho: revisão editorial e UUID já existem. O comportamento de versões legadas sem UUID deve ser rejeitado nas operações FOOD05; compatibilidade de leitura histórica não concede capacidade de cópia.

### Reavaliação do status

| ID | Estado atual nesta correção | Saída requerida |
| --- | --- | --- |
| A01 | Contido por D17 | Segue bloqueio de modelo; ver T07-B |
| A02/D15 | Corrigido tecnicamente | Preservar testes/histórico; gate integrado final |
| A03/D16 | Corrigido tecnicamente | Preservar testes/histórico; gate integrado final |
| A04 | Implementação + unit tests; integração pendente | PostgreSQL/RLS recíproco, atomicidade, rollback, R4 |
| A05 | DTO/service/browser + focados; integração pendente | PostgreSQL stale/revogação/transferência, nenhuma escrita e R4 |
| A06 | Aberto, transferido para T07-B | D17 impede caminho; projeto FOOD05-MDL separado |
| A07 | Sem mudança estrutural nesta correção | Confirmar gates no HEAD; produção separada e não autorizada |

T07-A pode receber PASS individual após as provas e revisão independente. O T07 original não recebe PASS integral enquanto T07-B estiver pendente. R4 independente, CI atualizado e testes integrais T14 ainda não concluídos.


### Ajuste de A04 após revisão do padrão de locks — 27/10/2026

A primeira proposta de bloquear todos os pacientes como leitura e promover o destino depois poderia deadlockar em cópias recíprocas entre dois pacientes: cada transação retém leitura nos dois pacientes e tenta promover seu destino distinto para escrita. A implementação foi ajustada para adquirir desde o primeiro passo `pessimistic_write` no paciente de destino e `pessimistic_read` nos demais, sempre por UUID crescente; depois, mesma ordem para planos, destino write/origem read. O teste de integração foi alterado para usar dois pacientes distintos atribuídos ao mesmo profissional e deve verificar que uma cópia vence enquanto a concorrente encerra com conflito de revisão recuperável, sem deadlock/efeito parcial. A prova PostgreSQL ainda está bloqueada pelo setup local; não declarar A04/T14 PASS.

### R4 independente complementar — proveniência da revisão exata (27/10/2026)

O revisor independente não encontrou vulnerabilidade confirmada, mas apontou que A05 validava a revisão editorial no momento da confirmação sem gravar a revisão usada na proveniência cifrada. Isso dificultaria reproduzir qual estado de um rascunho mutável foi a origem da cópia. A implementação foi ampliada para gravar `rascunhoRevisaoOrigem` na proveniência imediata e na origem inicial da linhagem, quando a fonte é draft. O campo é opcional para preservar leitura dos snapshots históricos e validado quando presente. Fontes publicadas seguem identificadas por UUID imutável, sem inventar revisão editorial.

A revisão também exigiu o cenário concorrente inverso: edição da origem vence o lock antes da tentativa de cópia, que deve então rejeitar revisão obsoleta sem alterar o destino. O teste foi adicionado com barreira e espera observável. A R4 permanece aberta até revisar esse delta e executar as duas ordens de concorrência no PostgreSQL/RLS descartável.

Na revisão seguinte, foi identificado que linhagem legada sem revisão inicial poderia herdar incorretamente a revisão do draft intermediário. A clonagem agora usa a revisão direta da proveniência legada para inicializar a linhagem apenas quando conhecida; se a origem inicial já existe mas não tem revisão, mantém esse dado como desconhecido. Uma aplicação sem linhagem anterior ainda inicializa com a revisão atual do draft. Há teste unitário de cópia em cadeia legado; a revisão final desse ajuste e a prova PostgreSQL continuam pendentes.

### Fechamento da revisão estática independente dos deltas A04/A05 — 27/10/2026

Após a correção dos fixtures de integração, o revisor independente fez nova leitura somente estática do commit `643076ba`. Confirmou que os cenários partem do documento atual do destino, preservam suas equivalências e acrescentam o item copiado com novas chaves; não encontrou achados adicionais no fixture ou no caminho de serviço relacionado. O revisor não executou testes. Este fechamento encerra somente a revisão estática dos deltas A04/A05; não fecha prova PostgreSQL/RLS, T07-A, T14 nem revisão de todos os requisitos FOOD05.

### Revisão estática dos ajustes pós-CI `403bbc11` — 27/10/2026

O reviewer independente confirmou o documento base do destino stale como proveniente do mesmo paciente/avaliação e sem substituições, e a ampliação do timeout A05 para 120s sem afrouxar assertions. Sem novos achados estáticos. Não executou testes; a evidência PostgreSQL segue pendente no próximo CI.

### Revisão estática da divisão dos cenários A05 — 27/10/2026

O revisor confirmou que a prova agora isola as duas ordens: copy-first termina a cópia e depois permite editar a origem; edit-first avança a origem para revisão 2 e exige 409 para a cópia com revisão 1, sem escrita no destino. Os limites de 90s não alteram assertions. Sem achados adicionais; revisor não executou testes. A validação final depende do próximo PostgreSQL/RLS CI.

### Revisão estática do fixture A05 após timeout — 27/10/2026

Após o CI `40532192140` exceder 90s no cenário edit-first, o fixture foi reduzido para reutilizar o paciente e criar um segundo plano/draft como destino. A revisão R4 independente estática confirmou que o rascunho de origem continua sendo editado primeiro, a cópia espera o lock e então compara a revisão esperada 1 com a revisão atual 2; o destino deve permanecer em revisão 1. Não foram encontrados achados adicionais. O revisor não executou testes; a validação PostgreSQL/RLS continua pendente.
