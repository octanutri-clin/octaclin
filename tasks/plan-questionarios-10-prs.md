# Dez implementações de questionários — plano aprovado em 23/11/2026

Autorização: “Implement the proposed plan”. PRs575/582 não contam entre estas10.
FOOD06 é responsabilidade do Claude, sem alteração dessas worktrees/contratos.
Base inicial main989f4d5c. Sem merge/deploy/produção ou migration externa.

## Decisões

Jornada completa; conferência opcional mantendo envio direto; índice na mesma
página; delta neutro sem julgamento clínico; busca/resumos da página; três CSV
(visíveis/consulta/questionário) com limite1000 explícito; comparação conservadora
por ID estável; pausar só novos envios e retomar próxima ocorrência futura.
Preservar zero/falso, ausência, snapshots e autorização. Reutilizar componentes,
DTOs, validadores, rascunho800ms, uploads e fila/idempotência/ACK existentes.

## Commits por entrega

Cada linha é uma PR com implementação utilizável; RED é commit local, nunca
push isolado. Último commit inclui gates/evidências, sem PR apenas documental.

| PR lógica | Resultado | Fase A — commits locais | Fase B — commits locais | Dependência |
| --- | --- | --- | --- | --- |
|01|Delta neutro|C1 testesRED; C2 apresentação factual|C3 regressões/UX/evidências|main|
|02|Envios/Resumo em abas|C1 testesRED contexto/filtros; C2 painéis reutilizados|C3 teclado/contagens/UX|01|
|03|Resumo navegável de erros do paciente|C1 testesRED obrigatórias/zero/falso; C2 resumo e vínculo campo|C3 foco/anexos/rascunho/UX|02|
|04|Índice de seções|C1 testesRED seções/sem seção; C2 índice estável|C3 integração com pendências/reflow/UX|03|
|05|Conferência opcional|C1 testesRED última edição/revisão; C2 conferência sem submissão|C3 uploads/confirmar/idempotência; C4 offline/ACK/UX|04|
|06|Checklist do editor|C1 testesRED regrasexistentes; C2 prévia autorizada sem gravação|C3 checklist/foco/edições; C4 conflitos/segurança/revisão|05|
|07|Completude histórica|C1 testesRED snapshots/ausências; C2 projeção autorizada|C3 leitura individual/legado; C4 RLS/imutabilidade/revisão|06|
|08|Paginação e três CSV|C1 testesRED/índices; C2 consulta/resumo da página; C3 exportações autorizadas|C4 BFF/console; C5 PostgreSQL/RLS/limites/revisão|07|
|09|Pausar/retomar recorrências|C1 testesRED; C2 revisão/pausadoEm/migration/APIs|C3 locks/worker/idempotência; C4 console; C5 concorrência/RLS/rollback/revisão|08|
|10|Comparar dois retornos|C1 testesRED identidade/semântica; C2 comparação autorizada|C3 UI desktop/mobile; C4 revogação/histórico/revisão|07/08/09|

## Critérios fechados

01: aumentou/diminuiu/sem alteração/sem comparação, sem cores de valor clínico;
números e unidades não recalculados.
02: Envios inicial, filtros e leitura preservados, sem novas consultas;
agregados identificam alcance e não fingem refletir a busca textual.
03: todas obrigatórias pendentes após tentativa, resumo focalizado, link ao
campo, sem retirar respostas/anexos, validação backend preservada.
04: índice se mais de uma seção, todas perguntas visíveis, nomes personalizados
preservados, IDs DOM seguros, sem wizard/URL clínica/storage novo.
05: abrir revisão não submete; autosave legítimo continua; voltar/editar preserva
último valor/anexos; bloquear confirmação em uploads; sucesso só ACK, offline
pendente explícito, sem nova URL de arquivo.
06: prévia recebe versão esperada/edição pendente, valida IDs do próprio
questionário; erros estruturados por campo; não salva, altera regras clínicas
nem remove validações; conflito preserva edição local.
07: usar snapshot real; ausência de snapshot = completude desconhecida; nunca
usar versão atual como denominador antigo; projetar allowlist, sem histórico
reescrito/comprovante de revisão criado pela simples leitura.
08:25 padrão,25/50/100, máximo100, ordenação dataDESC/IDdesempate, datas ausentes
explícitas; cursor validado sem autoridade; fuso clínico servidor; fim inclusivo;
busca/resumo só página; exportar consulta/questionário ignora busca local e
reautoriza todo conjunto antes de carregar valores; >1000 exige refinar;
nenhum leitor integral legado para montar página. Migration só índices isolados.
09: adicionar revisao/pausadoEm; diferenciar inativo legado/encerrado/pausa;
CAS e confirmação; preservar envios; revalidar carteira; locks globais iguais
no worker/comandos; atomicidade envio/próxima execução; sem recuperação dos
horários perdidos, edição de cron, exclusão ou notificação nova.
10: mesmo paciente/questionário; ID estável; mudanças relevantes de enunciado,
tipo/unidade/escala/opções/config impedem comparação, motivos explícitos;
visual puro não impede; cópias não pareadas por nome; sem snapshot não inferir;
anexos mínimos pelo fluxo autorizado; sem diagnóstico.

## Gates e entrega

Uma tarefa/um escritor/branch; branches dependentes empilhadas explicitamente,
com base de PR apontando à anterior quando ainda não integrada, nunca merge
implícito da575/582. Cada PR Draft, teste local antes de único push; nenhum
push para main. Novas escritas após revisão somente por achado concreto.
Node22; TDD RED/GREEN funcional; lint/typecheck/linguagem/segredos e regressões
afetadas; PostgreSQL descartável/role runtime/RLS para fronteiras de banco;
UXA/B/C/D, pacienteNA apenas quando justificável; revisão independente estática
não substitui testes. Não considerar SKIPPED comoPASS. CI do HEAD exato pendente
até comprovação. Registrar execução em execucao-questionarios-10-prs.md.

Fora: condições entre perguntas, busca global, agregados globais paginados,
novos canais, FOOD08/FOOD05-MDL, alteração de DRI e português dinâmico restante.


## Continuidade das entregas09–10 — decisão D09-01 aprovada

Há oito implementações publicadas (#583–#590), não oito merges. Na consulta desta
rodada todas estavamOPEN: #583/#584Ready, demaisDraft; #584–#589comSUCCESS
agregado doHEAD, #583fb978fa e #59070deb06comCIpendente. Backend590jáSUCCESS.
Não confundir agregadoSUCCESS com execução de checksSKIPPED ou integração com
mainposterior. Estado vivo continua noGitHub; este é um checkpoint porHEAD.

### D09-01 — reconfirmação dos agendamentos antigos

Decisão vigente do proprietário: **exigir reconfirmação dos antigos**. A resposta
anterior de adiar foi expressamente retirada antes desta escolha. Não representa
recusa vigente nem autoriza manter envios automáticos sem referência verificável.

- Ausência de ator comprovável bloqueia somente novas gerações até reconfirmação
  explícita de pessoa atualmente autorizada ao questionário e ao paciente.
- Preservar envios, links, rascunhos e respostas existentes; aplicar os controles
  de acesso/expiração já vigentes, sem revogar links apenas por esta transição.
- Nos novos agendamentos registrar ator autorizado e revalidar identidade ativa,
  papel, permissões efetivas e escopo a cada geração. Não usar JWT congelado.
- Reconfirmar registra autorização agora; não atribui criação histórica à pessoa
  que reconfirmou, não faz backfill de autoria e não herda permissão pelo dono
  do questionário quando o ator da equipe tem outro escopo autorizado vigente.
- Autorização da execução e estado operacional são distintos: reconfirmar não
  desfaz pausa deliberada nem reativa envio único encerrado. Não criar catch-up.
- A referência técnica ao ator da execução deve ter nome/semântica próprios;
  compatibilidade de FKs por tenant, desativação/eliminação de usuários e auditoria
  será conferida antes da migration. Reutilizar auditoria existente, sem texto
  clínico nem metadados fora do catálogo. Sem nova tabela de comando por hábito.

### Entrega09 — plano de commits e gates

Base: incorporar explicitamente a versão final08 (incluindo70deb06) na branch09,
preservandoC1db4dbbc. Essa atualização local da base não é merge daPRna main.
Confirmar branch/worktree/diff e rodar baseline afetado antes deC2.

|Etapa/commit|Escopo fechado|Prova de encerramento|
|---|---|---|
|C1 feito:db4dbbc|Estados ativo/pausado/inativo legado/encerrado e próxima ocorrência futura, mesmo resolverCron existente|9RED→76GREEN e typecheck históricos dessecommit; não é09funcionalmente entregue|
|C2a|Mapear auth/auditoria/retenção de ator; testesRED de schema aditivo para revisão, pausa e referência ao ator da execução|FKs/tenant/legados sem autor/rollback seguro em banco descartável; índice/ID de migration livre e registroTypeORM conferidos|
|C2b|Serviço/API de lista e comandos pausar/retomar/reconfirmar, confirmação explícita e revisão esperada|DTO/limites/allowlist; negativos tenant/paciente/papel/carteira; CAS e replay sem efeitos duplicados; preservar criação existente|
|C3a|Worker reautoriza ator e recursos; mesma ordem determinística de locks dos comandos; reler estado/vencimento após lock|Duas execuções não geram dois envios; pausa/reconfirmação não recuperam horários perdidos; envio+avanço atômicos|
|C3b|Provas PostgreSQL runtime/FORCERLS e falha intermediária|Barreiras controladas worker×worker, pausa×worker, transferência/revogação×worker; rollback sem envio órfão nem avanço parcial|
|C4a|BFF e console com estados claros, prévia de paciente/questionário/cadência/fuso/próxima ocorrência e reconfirmação individual|Erro/conflito preserva trabalho; não confundir reconfirmar com retomar; dados mínimos e respostas privadas|
|C4b|Regressões desktop/mobile/teclado/zoom/axe e UXB|Links/rascunhos já enviados sobrevivem à pausa e à reconfirmação pendente/concluída; sucesso só apósACK atual; descartar retorno tardio|
|C5|RevisãoR4 independente, UX C/D, documentação eCI doHEAD|Achados resolvidos; SKIPPED explícitos; PR09 própriaDraft utilizável, base08; sem merge/deploy ou migrationexterna|

Não editarCron, excluir agendamentos, reconfirmar em lote, criar canais/avisos
novos ou enviar notificações adicionais nesta entrega. Ausência de ocorrência
futura deve ser textual; nunca inventar data nem reativar um encerrado.

### Entrega10 — plano de commits e gates

Comparação profissional, somente dois retornos autorizados do mesmo paciente e
questionário. Reutilizar snapshots/leitores07/08 e apresentação neutra01.
A dependência funcional é07/08;09 é a base de integração da sequência aprovada,
não um novo requisito para o paciente acessar respostas já enviadas.

|Etapa/commit|Escopo fechado|Prova de encerramento|
|---|---|---|
|C1a|Matriz de compatibilidade por ID estável e definição histórica; testesRED|Zero/falso/ausência; estrutura histórica ausente; mudanças de enunciado/tipo/unidade/escala/opções/config versus visual puro|
|C1b|Domínio de comparação determinística e motivos estruturados|Sem pareamento por nome; nenhuma diferença numérica para dados incompatíveis/desconhecidos; sem diagnóstico ou modelo atual substituindo passado|
|C2a|Serviço/API autorizam os dois retornos no mesmo contexto, antes de conteúdo|Sem paciente/tenant cruzado, sem autorização implícita por IDs; reusar leitores e locks existentes, sem transações aninhadas nem consultas integrais|
|C2b|PostgreSQL/RLS e provas de revogação/concorrência|Transferência/revogação após seleção; históricos preservados; leitura não marca revisado nem modifica registros|
|C3a|BFF mínimo e seleção de até2 retornos em memória, inclusive entre páginas|Resumo identificável do par, remoção individual, limpar ao trocar paciente/questionário; rejeitar terceiro; sem cache/storage clínico novo|
|C3b|Comparação lado a lado desktop/empilhada mobile e motivos por campo|Datas ouSemdata; valores originais autorizados; delta neutro; ausência/incompatibilidade/estrutura indisponível distinguíveis; anexos pelo acesso existente|
|C4a|Browser/regressões/UXB-C|Teclado/zoom/axe, cancelar/voltar sem perda, respostas tardias não substituem seleção atual; nenhuma nova exposição no portal|
|C4b|R4 independente, regressões afetadas, docs/CI doHEAD|PR10 própriaDraft utilizável sobre09; não herdar verde de outroSHA nem apresentar revisão estática como teste executado|

Não criar relatório/exportação novos, interpretação clínica, acesso do paciente
à comparação ou sincronização dos históricos. Não prever migration10 sem lacuna
comprovada; se necessária, registrar justificativa e testar só em banco descartável.

### UX A/D e modelo

Revisões independentes de planejamento em
`docs/agents/ux/reports/QST10-09-10-AD-2026-11-23/`. São opiniões de personas
simuladas com brief, sem UI/testes humanos. Detalhes de clareza dentro das regras
aprovadas viram critérios verificáveis; novas funcionalidades continuam propostas.

Recomendação: Solalto para autorização/worker/concorrência09 e fronteiras de
segurança10; Solmédio para interface, documentação e ajustes delimitados após
contratos estabilizados. Nenhuma troca manual de modelo foi realizada.

## Checkpoint de implementação10 — 25/11/2026

| Incremento | Evidência | Estado no checkpoint |
| --- | --- | --- |
| C1 domínio | 842672e; correçãoP2bbc7698;35testes | Implementado/PASS focal |
| C2 consulta autorizada | 61c5587;63PG/10HTTP, locks/revogação/snapshot | Implementado/PASS focal |
| C3 BFF/console | 55a420c;26BFF/28browserprodução local/build | Implementado/PASS focal |
| C4 revisão e regressões | R4integral estática favorável, UXB/C/D,5685backendPASS/434SKIPPED | Evidências locais eauthzglobalPASS registrados; CI10 pendente |

Escopo aprovado preservado. Não classificar gate pendente/SKIPPED comoPASS nem
abrir nova implementação por este registro. Detalhes/histórico e próxima ação
em `questionarios-10-comparacao-handoff.md`; resultados posteriores naPR própria.
