# Fase 287 — tarefa na próxima revisão do perfil

## Objetivo, fonte e decisão de produto

A seção 15, item 5, da auditoria de produto pede uma tarefa para a data de
`proximaRevisaoEm` do perfil de cadastro. O usuário decidiu que a tarefa deve
aparecer assim que a data for salva, com vencimento nessa data. Este incremento
entrega apenas essa automação; as demais da seção 15 permanecem na fila.

Risco R4: os dados do perfil e a relação paciente/profissional são protegidos
por tenant. O tenant é o da credencial, confirmado pelo `ExecutorTenant`; a
tarefa não transporta detalhes clínicos nem é publicada a terceiros.

## Contrato e experiência

- A entrada continua sendo `PUT` da seção `operacao` do cadastro, com a data
  civil `YYYY-MM-DD` do campo existente. Não se cria endpoint nem parâmetro de
  tenant novo. O título cifrado é `Revisar cadastro do paciente`, categoria
  `tarefa`, prioridade `media`, estado inicial `pendente`.
- Ao salvar uma data, a tarefa surge na lista de acompanhamento do paciente e
  vence no fim do dia civil informado no fuso clínico configurado. A interface
  informa esse efeito ao lado do campo; não promete notificações externas.
- Repetir a mesma data não cria outra tarefa nem reabre uma concluída ou
  cancelada. Alterar a data cancela a tarefa anterior se ainda aberta e cria a
  nova; remover a data cancela a anterior aberta. Tarefas concluídas permanecem
  como histórico. Uma data passada produz tarefa vencida, sem deslocar o prazo.
- A atribuição é ao usuário ativo do profissional responsável pelo paciente,
  não ao colaborador que editou o perfil. Se esse destino não existir, salvar
  uma nova data falha com erro claro e a transação inteira é revertida.
- Tarefas manuais e tarefas de regras genéricas conservam seus próprios IDs e
  estados. A tarefa desta fase usa UUID determinístico de finalidade distinta,
  tenant, paciente e data civil; o UUID não expõe esses valores nem armazena a
  chave em texto. O identificador suporta deduplicação por retry/concorrência.

## Desenho técnico

1. No `ServicoPerfilCadastroPaciente`, manter autorização e escopo existentes.
   Dentro de uma única transação tenant-aware, serializar as edições de operação
   pelo registro do paciente, ler a versão anterior do bloco cifrado, salvar o
   novo bloco e os índices e sincronizar a tarefa. Qualquer falha aborta tudo.
2. Reaproveitar `AcompanhamentoTarefaOrm`, RLS e criptografia já existentes.
   Resolver `ProfissionalOrm` e `UsuarioOrm` por tenant e estado ativo para
   converter o ID de profissional em ID de usuário exigido pela tarefa.
3. Inserir com conflito ignorado pelo ID determinístico; atualizar/cancelar
   apenas tarefa cujo ID, tenant e paciente correspondam. Não alterar uma
   tarefa concluída. Evitar logs com data, nome ou conteúdo do perfil.
4. Em reatribuição de profissional, transferir tarefa de revisão ainda aberta
   ao usuário ativo do novo responsável na mesma transação. A remoção/arquivo
   do paciente precisa conservar o histórico e impedir novas tarefas.
5. Converter data civil para fim do dia no fuso obtido de
   `obterTimezoneClinico`, inclusive deslocamentos de horário de verão, sem
   depender do fuso do servidor. O frontend mantém o valor civil sem conversão.
   Restringir o DTO a `YYYY-MM-DD` válido: `@IsDateString` sozinho admite
   timestamp, que violaria a semântica civil.
6. Atualizar a cópia da interface e reconciliar status, checklist, resumo e
   auditoria. Registrar o plano e a evidência de PR/CI só após existirem.

## Dados existentes e implantação

O proprietário confirmou a reconciliação de `proximaRevisaoEm` já salva antes
da fase. A rotina idempotente opera por tenant explícito, com paginação,
simulação por padrão, filtro de pacientes ativos e sem registrar PHI. Exige
`DATABASE_URL`, `CONFIRMAR_BANCO_BACKFILL` e
`TENANT_ID_RECONCILIACAO_REVISAO_PERFIL`; só grava com
`EXECUTAR_RECONCILIACAO_REVISAO_PERFIL=SIM`. Não será executada contra staging
ou produção sem ambiente, identidade e autorização confirmados. Repetir após
falha é seguro pelo ID determinístico. Deve-se simular, revisar a contagem e
então aplicar por tenant; perfis com destinatário inativo exigem saneamento
antes da execução, sem pular silenciosamente a pendência.
Para operar, definir as variáveis no ambiente seguro do operador e invocar
`pnpm --dir octaclin-backend backfill:revisao-perfil` primeiro sem a variável
de execução, revisar a contagem e repetir com o opt-in literal. A rotina
valida a existência do tenant, exige banco confirmado, usa RLS por transação
e interrompe o lote diante de bloco inválido ou destinatário indisponível.
Contagens são agregadas e não incluem identificadores; uma falha após lotes
anteriores exige nova simulação antes de repetir, porque os lotes confirmados
permanecem gravados. Não rodar junto ao backfill de índices de perfil, que usa
ordem de locks diferente.

## Sequência de implementação

1. Fechar decisão sobre dados existentes e revisar este plano para lacunas.
2. Implementar sincronização transacional e conversão de data.
3. Tratar reatribuição e microcopy do cadastro.
4. Implementar backfill aprovado, sem executá-lo em ambiente externo.
5. Reconciliar documentos canônicos, revisar diff e risco, abrir uma única PR.

## Critérios de aceite e gates

- Escopo de tenant e profissional preservado; paciente arquivado/eliminado não
  gera tarefa; colaborador autorizado não vira destinatário por acidente.
- Criar, repetir, trocar e remover data apresentam o comportamento acima;
  conclusão humana não é reaberta; rollback cobre falha de destino ou gravação.
- A data exibida é a mesma data civil salva, inclusive em mudança de fuso.
- Sem migration ou alteração da tabela, sem envio de e-mail/WhatsApp e sem
  exposição de PHI em logs/telemetria. CI e revisão cruzada são gates antes de
  merge; status `SKIPPED` não conta como aprovação.

## Rollback e limite de reversão

Reverter o código interrompe a geração futura. Tarefas já criadas são dados
persistentes e não devem ser apagadas em rollback automático; correção dessas
linhas exigirá procedimento tenant-aware aprovado e auditável. O backfill é
separado da publicação de código e exige opt-in explícito.

## Revisão crítica do plano, realizada antes do código

| Lacuna encontrada | Resolução incorporada |
| --- | --- |
| `@IsDateString` admite timestamp além de data civil | Exigir formato exato e validar dia real, inclusive ano bissexto. |
| Campo vazio do formulário poderia virar `''` | `removerCamposVazios` já o omite; ausência da data no bloco substituído significa remoção e cancelamento da tarefa aberta. |
| `profissionalResponsavelId` é ID de `ProfissionalOrm`, enquanto `profissionalId` da tarefa é ID de `UsuarioOrm` | Resolver os dois por tenant e exigir usuário ativo antes de criar ou transferir. |
| Retry ou saves concorrentes poderiam duplicar tarefas | Bloquear a linha do paciente na edição da operação e usar ID determinístico com inserção idempotente. |
| Reabertura acidental após ação humana | Mesma data conserva qualquer status existente; mudança/remoção afeta somente tarefas abertas. |
| Reatribuição do paciente poderia deixar tarefa aberta com antigo profissional | Sincronizar a atribuição no fluxo de reatribuição, sem alterar tarefa concluída; falhar a transação se o novo responsável não for elegível. |
| Fuso do servidor poderia deslocar o vencimento civil | Calcular fim do dia no fuso clínico e guardar instante UTC em `timestamptz`. |
| Importar o gerador de ID do módulo de automações criaria dependência invertida | Mover o utilitário para infraestrutura compartilhada e manter reexportação compatível no caminho antigo. |
| Tarefas de perfis antigos exigem decisão de rollout | Proprietário confirmou. Rotina opt-in por tenant, dry-run e aplicação fora de banda; nenhuma execução externa implícita. |
| Bloco cifrado antigo inválido ou destino inativo poderia ser ignorado em simulação | Leitura estrita e verificação do destinatário também no modo simulado; falha genérica sem expor dados. |
| Backfill de índices legado usa ordem de locks diferente | Runbook proíbe execução concorrente das duas rotinas. |

O plano foi revisado antes do código. A autorização de executar a rotina em
ambiente externo permanece gate operacional separado da autorização do PR.

## Evidência local antes da PR

- Node 22.23.3: typecheck backend e frontend aprovados.
- Jest backend direcionado: 3 suítes/104 casos de pacientes e revisão;
  3 suítes/23 casos de automações e fuso, todos aprovados.
- `pnpm security:secrets` e `git diff --check` aprovados.
- Matriz de confiabilidade válida; lint Web terminou sem erros, com 62 avisos
  que permanecem para triagem separada.
- Backfill e provas PostgreSQL/RLS reais não foram executados localmente. CI e
  revisão cruzada permanecem pendentes até a PR.
