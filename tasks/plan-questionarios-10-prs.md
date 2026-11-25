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
