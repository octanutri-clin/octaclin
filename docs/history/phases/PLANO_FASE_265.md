# Plano da Fase 265 - prioridade de acompanhamento explicavel

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-17 somente para definicao do contrato de produto e
arquitetura. Nenhum codigo de producao, migration, job ou configuracao externa
faz parte deste primeiro incremento.

O PR 55 continua pendente como gate externo para venda publica. O proprietario
decidiu adiar sua contratacao para evitar custo neste momento. Isso nao converte
o pentest em `PASS`, nao concede GO de seguranca e nao bloqueia trabalho de
produto independente. O PR 56 continua reservado para uma futura distribuicao
do aplicativo nativo.

## 2. Problema observado

`pacientes.score_risco` e `pacientes.status_adesao` nascem com valores padrao e
podem ser digitados manualmente. Mesmo sem uma origem calculada ou explicacao,
esses campos ja influenciam lista de pacientes, prontuario, dashboard, filas de
retorno e o gatilho planejado `paciente.risco_alto`.

O nome atual permite uma interpretacao clinica que o produto nao consegue
sustentar. O calculo nao deve diagnosticar, prescrever, substituir triagem
profissional nem usar IA. A capacidade proposta mede somente **prioridade de
acompanhamento operacional**, com sinais objetivos de engajamento que o sistema
ja registra.

## 3. Decisao proposta para aceite humano

### 3.1 Semantica

- Nome visivel novo: **Prioridade de acompanhamento**.
- Finalidade: ordenar trabalho da equipe e explicar por que um paciente merece
  contato ou revisao mais cedo.
- Nao finalidade: estimar gravidade clinica, prognostico, diagnostico, urgencia
  medica ou risco de vida.
- A classificacao nunca executa mensagem, tarefa, conduta ou alteracao clinica
  automaticamente.
- O paciente nao recebe o score bruto; o portal continua sem expor
  `scoreRisco`.

### 3.2 Formula inicial recomendada

Janela de observacao: 90 dias. Resultado: inteiro entre 0 e 100, com versao da
formula registrada em cada calculo.

| Sinal objetivo | Pontos | Limite | Explicacao exibivel |
| --- | ---: | ---: | --- |
| Falta em consulta nos ultimos 90 dias | 30 por falta | 60 | `faltas_recentes` |
| Sem consulta futura e ultima consulta concluida ha mais de 60 dias | 25 | 25 | `sem_retorno_programado` |
| Formulario obrigatorio vencido ha mais de 7 dias | 10 | 10 | `formulario_vencido` |
| Ultimo registro de habitos dos ultimos 30 dias com adesao declarada abaixo de 50% | 15 | 15 | `adesao_declarada_baixa` |

O total e limitado a 100. Faixas existentes ficam preservadas no primeiro
rollout: baixa de 0 a 39, media de 40 a 69 e alta de 70 a 100.

Os sinais usam apenas datas, status e valores estruturados que ja existem.
Ficam proibidos no calculo inicial: diagnostico, texto livre, exames, medidas
antropometricas, medicacoes, conteudo de mensagens, inferencia estatistica e
qualquer modelo de IA.

### 3.3 Override humano

- Somente papel e permissao que hoje podem editar o paciente podem solicitar
  override; o servico deve revalidar tenant e escopo profissional.
- O override exige faixa escolhida, codigo de motivo fechado e justificativa
  curta. A justificativa e dado clinico protegido e nao entra em log comum.
- O override tem expiracao obrigatoria, com maximo inicial de 90 dias.
- O valor calculado continua sendo atualizado em paralelo e visivel para quem
  tem permissao, mas o valor efetivo informa que esta sob override.
- Criar, alterar, expirar ou remover override gera auditoria com ator, paciente,
  instante, faixa anterior/nova, codigo de motivo e versao da formula, sem
  copiar texto clinico para metadata.
- Expirado o override, o valor efetivo volta ao calculado sem apagar o historico.

## 4. Contrato tecnico proposto

Implementar em incrementos separados, cada um em branch e PR proprios:

1. **265.1 - Dominio puro e explicacao**
   - calculador deterministico, sem banco e sem efeitos;
   - versao literal da formula;
   - testes de limite, janela, combinacao, cap em 100 e ausencia de sinais;
   - nenhuma integracao com dashboard ou automacoes.
2. **265.2 - Persistencia e RLS**
   - migration aditiva para estado calculado, versao, instante e override;
   - historico append-only protegido por tenant e `FORCE ROW LEVEL SECURITY`;
   - rollback limitado: consumidores podem voltar a ignorar os campos, mas o
     historico ja criado nao deve ser apagado automaticamente;
   - migration executada somente fora de banda com role owner, apos ensaio em
     banco descartavel.
3. **265.3 - Recalculo idempotente**
   - servico e job no worker, sem efeito externo;
   - claim/lock existente, tenant explicito e idempotencia por paciente,
     versao da formula e janela;
   - falha preserva o ultimo valor valido e fica observavel sem incluir PHI.
4. **265.4 - Leitura e override auditado**
   - DTO minimo com valor efetivo, calculado, faixa, fatores fechados, versao,
     data do calculo e estado do override;
   - UI troca o rotulo ambiguo `Risco` por `Prioridade de acompanhamento`;
   - testes positivos e negativos cross-tenant/cross-profissional;
   - nenhum gatilho de automacao habilitado.

`paciente.risco_alto`, executor de automacoes e qualquer efeito automatico
continuam fora desta fase ate os incrementos PB-02/PB-03 correspondentes. O
campo legado `score_risco` nao deve ser sobrescrito antes de existir migration,
compatibilidade de leitura e rollback aprovados.

## 5. Gates antes de codigo

- [ ] Proprietario aceita explicitamente a semantica de prioridade operacional,
  e nao risco clinico.
- [ ] Proprietario aceita pesos, janelas e faixas da formula inicial.
- [ ] Revisao de seguranca confirma que fatores e justificativa nao vazam PHI
  em logs, auditoria, filas ou respostas sem permissao.
- [ ] Desenho da migration confirma RLS/FORCE RLS, role owner e rollback.
- [ ] Matriz de testes cobre tenant, profissional, override, expiracao,
  idempotencia e formula versionada.

O merge deste plano registra a proposta e a sequencia, mas nao substitui o
aceite explicito dos dois primeiros itens.

## 6. Validacao deste incremento

- `NA` - testes de aplicacao: nenhum codigo de producao foi alterado.
- `NA` - migration e banco: nenhuma migration foi criada ou executada.
- `PENDENTE` - revisao/aceite humano da semantica e da formula.
- Obrigatorios antes do push: validacao documental, `git diff --check` e
  `pnpm security:secrets`.
