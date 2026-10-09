# Fase 306 — retorno e evasão factuais

## Objetivo e contexto

Completar o Painel de Operação com quatro indicadores agregados: intervalo
observado entre consultas concluídas, pacientes ativos sem consulta futura,
faltas por horário local e tempo de resposta a formulários. Reutilizar a
mediana de até três intervalos adotada na Fase 294. O termo “evasão” é somente
uma referência de auditoria: a interface não diagnostica abandono, não calcula
risco clínico e não inicia contato.

**Modelo/esforço:** GPT-6 Codex disponível nesta sessão, esforço alto. Skills:
planejamento incremental, TDD, NestJS/TypeORM, segurança/tenancy, React/Next.js
e Playwright; `fechar-fase` no fechamento.

**Risco R4:** consultas, vínculos profissionais e envios de formulários são
dados clínicos/operacionais por tenant. O escopo proposto preserva o endpoint
`Client` + `cliente.acessar` do Painel de Operação e expõe apenas agregados,
sem paciente, envio, formulário, profissional individual no novo resumo,
resposta ou conteúdo clínico. Todas as consultas executam dentro de
`ExecutorTenant` e incluem `tenant_id`. Sem migration ou mutação de dados;
rollback por reversão do código.

## Contrato proposto para os indicadores

As escolhas sobre visibilidade, população sem retorno e janela/granularidade
foram solicitadas antes da implementação. Como não houve resposta na janela de
clarificação, a implementação segue as recomendações abaixo; qualquer resposta
posterior do proprietário será incorporada antes do trecho dependente.

1. **Acesso:** extensão do painel agregado existente para `Client` com
   `cliente.acessar`. Não criar rota clínica, exportação, drill-down ou API
   pública nesta fase.
2. **Período:** mês civil selecionado, interpretado no fuso da clínica, para
   faltas e formulários. O estado “sem próxima consulta” é uma fotografia no
   instante da leitura e usa janela móvel dos 90 dias anteriores. O intervalo
   usa consultas concluídas recentes de pacientes com consulta concluída no
   mês selecionado, limitado a até três intervalos por paciente.
3. **Intervalo:** para cada paciente elegível, ordenar consultas concluídas
   por início; usar no máximo os três intervalos mais recentes até sua consulta
   mais recente no mês, ordenando os atendimentos por `fim_em` como na Fase 294.
   Usar dias civis no fuso da clínica. Mediana por paciente e, então, mediana desses valores
   no escopo da clínica, evitando que pacientes com muitas consultas pesem
   mais. Exigir pelo menos duas consultas concluídas; caso contrário, sinalizar
   histórico insuficiente. Exibir também o número de pacientes com histórico
   suficiente e unidade em dias, sem sugestão individual ou previsão.
4. **Sem próxima consulta:** numerador = pacientes `ACTIVE`, não arquivados,
   atribuídos a profissional, com consulta `concluida` iniciada nos
   últimos 90 dias e sem consulta futura em `agendada` ou `reagendada`.
   Denominador = pacientes que satisfazem a mesma elegibilidade e têm ou não
   consulta futura. Retornar contagem e percentual da clínica;
   sem denominador, valor percentual `null`/“Sem dados”. Excluir pacientes
   arquivados, em retenção/eliminação e sem responsável. Atribuições a
   profissional arquivado permanecem no agregado, sem revelar identidade.
   Ausência de próxima consulta não implica atraso, abandono ou
   indicação de contato.
5. **Faltas por horário:** somente consultas `concluida` ou `falta` iniciadas
   no mês selecionado. Converter início ao fuso da clínica; denominador por
   faixa = concluídas + faltas, excluindo canceladas e estados sem desfecho.
   Retornar contagens e taxa de falta. Proposta inicial: faixas locais de duas
   horas e supressão da faixa quando houver menos de cinco desfechos; sem
   ranking nem inferência sobre horário futuro.
6. **Resposta a formulário:** envios com `enviado_em` no mês civil e status
   `respondido`, com `respondido_em >= enviado_em`; duração = diferença entre
   timestamps, agregada por mediana e quantidade de respostas válidas. Envios
   pendentes, expirados, timestamps ausentes ou invertidos ficam fora do
   denominador e não são convertidos em duração zero. Sem respostas válidas,
   mostrar “Sem dados”. A UI explica que a coorte é por data de envio e inclui
   respostas recebidas depois do mês, quando já disponíveis no momento da
   consulta.
7. **Trava de 30 dias:** nenhum contato é produzido por esta fase. A métrica
   não lê nem altera a trava de contato existente; qualquer ação de recall
   continua sujeita às regras e revalidações da Fase 294.

## Revisão de gaps e tratamento

| Gap/riscos encontrados | Tratamento no plano |
| --- | --- |
| “Sem retorno” poderia ser exibido como evasão, atraso ou alerta clínico. | Nomear como “sem consulta futura”; definir coorte explícita e deixar claro que é contagem operacional, sem diagnóstico ou ação. |
| População sem denominador estável ou pacientes novos sem histórico confundiriam a taxa. | Numerador/denominador da coorte de ativos atribuídos com consulta concluída recente; estado explícito sem dados. |
| Pacientes com mais consultas dominariam o intervalo agregado. | Limitar a três intervalos recentes por paciente, obter mediana individual e depois mediana das medianas. Contar a base elegível. |
| Horário do servidor poderia deslocar faltas para a faixa errada. | Derivar faixa em SQL com timezone validado da clínica; cobrir mudança de dia e fuso em teste. |
| Células pequenas poderiam expor rotina operacional e produzir taxas instáveis. | Faixas de duas horas e supressão com menos de cinco desfechos, conforme escolha a confirmar. |
| Latência baseada em respostas do mês selecionaria apenas quem respondeu dentro do mesmo mês e enviesaria o resultado. | Coorte por `enviado_em` no mês; considerar respostas posteriores já registradas; excluir timestamps inválidos. |
| Consultas agendadas/reagendadas/canceladas poderiam ser contadas como comparecimento ou ausência. | Denominador de faltas usa exclusivamente estados com desfecho; consulta futura aceita somente `agendada`/`reagendada`; canceladas excluídas. |
| Expor paciente, formulário, IDs ou texto excederia a exceção operacional do `Client`. | Somente totais da clínica para as métricas novas. Sem agrupamento por profissional, drill-down, exportação, lista, identificador ou dado de resposta. |
| Consultas sem tenant explícito ou fora de RLS poderiam cruzar clínicas. | SQL parametrizado sempre limita `tenant_id`, executado por `ExecutorTenant`; provas negativas e integração PostgreSQL/RLS em CI. |
| Volume histórico poderia gerar carregamento excessivo. | Agregar no PostgreSQL, usar limites temporais e apenas colunas necessárias; revisar índices existentes e explicar qualquer decisão sem migration. |
| Uma suposta solução poderia enviar lembretes ou alterar regras da Fase 294. | Escopo somente leitura; sem worker, outbox, mensagem ou alteração da trava de 30 dias. |

## Etapas de implementação

1. Confirmar o contrato após resposta do proprietário e revisar índices das
   tabelas `agenda_consultas`, `pacientes` e `envios_questionario`.
2. Escrever testes de serviço e observar RED para os denominadores, medianas,
   timezone, ausência de histórico, supressão de célula e fronteira de tenant.
3. Implementar SQL agregado tenant-scoped no serviço existente, sem retornar
   chaves de paciente ou formulário; validar status elegíveis e limites de
   período.
4. Expor os campos agregados no DTO existente e apresentar seções acessíveis no
   painel, com fórmulas, bases, período/fuso, loading, erro, vazio e “sem dados”.
5. Adicionar regressão Playwright desktop/mobile e atualizar fixtures do painel.
6. Reconciliar plano, checklist, status, roadmap, auditoria e matriz de
   confiabilidade no mesmo PR; registrar evidência do merge da Fase 305.
7. Revisar SQL, autorização e diff; executar testes focados/full necessários,
   typecheck, lint, Playwright pertinente, preflight de documentação,
   `git diff --check` e `pnpm security:secrets`. PostgreSQL/RLS real e CI
   continuam gates; `SKIPPED` não equivale a PASS.

## Aceite

- Cada métrica tem população, janela, fórmula, timezone, denominador e estado
  sem histórico documentados e reproduzíveis.
- Nenhuma resposta contém paciente, envio, resposta, pergunta ou conteúdo
  clínico; nenhuma coorte cruza tenant.
- Contagens/taxas coincidem com casos sintéticos e testes negativos provam
  exclusão dos estados inválidos.
- Nenhum contato automático, mutação ou migration é introduzido.
- UI acessível e responsiva explica as métricas sem linguagem de diagnóstico,
  previsão ou ranking.
- PR e CI passam nos gates aplicáveis; migrations/deploy não são parte desta
  fase.

## Revisão final de lacunas antes de codificar

O roadmap exigia população, denominadores, janela e histórico insuficiente;
este plano define regras explícitas para todos. A extensão do `Client` foi
mantida dentro do contrato agregado já aprovado para o painel, sem qualquer
dado individual. Para reduzir exposição e evitar subdivisões pequenas, os
quatro indicadores novos são totais do tenant; só a distribuição de faltas por
horário tem grupos, com supressão de bases pequenas. A mediana em duas etapas
evita que pacientes com mais consultas dominem o indicador. O tempo de resposta
usa coorte por envio no mês, evitando viés de exigir resposta dentro do próprio
mês. A fase não interfere na fila clínica individual de “sem retorno” existente,
nem altera os contatos da Fase 294. Essas decisões eliminam os gaps de
contrato. A implementação e as verificações locais estão concluídas; conferir
os resultados e limites na seção seguinte antes de abrir o PR.

## Execução e reconciliação local

Implementados os quatro agregados no endpoint existente do Painel de Operação,
com dados tenant-scoped, projeção sem identificadores, apresentação responsiva
e linguagem não diagnóstica. A mediana de intervalos da Fase 294 foi extraída
para helper de domínio compartilhado mantendo o timezone padrão anterior e
habilitando fuso explícito da clínica nesta fase. A integração RLS foi ampliada
com fixtures sintéticas para dois tenants; sem executar em banco real neste
ciclo.

| Verificação | Resultado | Evidência/limite |
| --- | --- | --- |
| Backend: testes focados | PASS | 2 suítes, 10 testes; a suíte de integração RLS foi ignorada pela configuração local (19 testes `SKIPPED`). |
| Backend: suíte completa | PASS | 258 suítes aprovadas, 4 ignoradas; 2.340 testes aprovados e 44 ignorados. |
| Backend: typecheck | PASS | `pnpm --dir octaclin-backend typecheck`. |
| Backend: production build | PASS | `pnpm --dir octaclin-backend build`; production artifact guard passed. |
| Web: typecheck | PASS | `pnpm --dir octaclin-web typecheck`. |
| Web: production build | PASS | `pnpm --dir octaclin-web build`; Node 24 emitted existing Edge Runtime/deprecation warnings, build completed. |
| Web: lint completo | PASS | 0 erros e 63 avisos existentes no projeto. |
| Web: lint focado | PASS | ESLint nos componentes, tipos, BFF e spec visual alterados, sem avisos. |
| Web: BFF e linguagem | PASS | `test:painel-operacao:bff` (6 testes) e `test:linguagem` (8 verificações). |
| Playwright da Fase 306 | PASS | Testes visuais focados desktop/mobile, 2/2. |
| Redação da auditoria | PASS | `pnpm test:redacao-auditoria`, 24 testes. |
| Scanner de secrets | PASS | `pnpm security:secrets`, nenhum secret real identificado. |
| Preflight documental | PASS | `pnpm validate:docs`, incluindo validação do checklist canônico e do diff. |
| Node 22 | SKIPPED | Ambiente local Node 24.19; CI com Node 22 é a evidência autoritativa. |
| PostgreSQL/RLS local | SKIPPED | A suíte foi ignorada pelo setup local; a integração real permanece gate obrigatório do CI. |
| Demo Local Smoke/PR Gate | PENDENTE | Rodam no PR; não foram iniciados neste ciclo. |
| PR/CI | PENDENTE | Nenhum PR da Fase 306 aberto ainda. |
| Migration/deploy/produção | NA | Não houve alteração de schema nem operação externa. |

O PR #379 foi confirmado integrado em `main`; a documentação agora corrige o
estado anterior da Fase 305 no checklist e na reconciliação da seção 15. A
Fase 306 segue ativa, a Fase 307 permanece próxima na ordem aprovada e nenhum
item condicional da auditoria foi reclassificado como feito sem prova.
