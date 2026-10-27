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
