# FOOD07 — matriz de aceite e decisões UX

## Estado e fonte da aprovação

Em 28/10/2026, na mensagem **“Aprovação das sugestões UX da FOOD07 e continuidade da PR #451”**, o proprietário aprovou os três conjuntos enumerados e autorizou a implementação do escopo. Isso não aprova outras sugestões implicitamente, não libera produção e não transforma personas em validação clínica.

Plano vigente: [plan-pos-320-food07.md](plan-pos-320-food07.md). Checklist: [todo-pos-320-food07.md](todo-pos-320-food07.md). Q1–Q3/S1–S3 permanecem válidas. Estado observado29/10/2026, T04 código `f45d5132`: T01–T04 têm evidência técnica local no [registro](execucao-pos-320-food07.md); T05–T07, UI e UX B/C continuam pendentes. Aprovação do requisito não é aprovação irrestrita da jornada nem CI global verde.

Piloto histórico, preservado sem reescrita: [PR #451](https://github.com/octanutri-clin/octaclin/pull/451), commit `0d3382b6d29dbaa297227cd648021daf61117ea4`, diretório `docs/agents/ux/reports/FOOD07-A-2026-10-28/`. Fonte avaliada no piloto: `9dd9bd6d`. Os relatórios são estáticos e sínteses editoriais de duas instâncias reais, não pesquisa com usuários ou UI executada.

## Requisitos e provas por superfície

| IDs | Decisão humana atual | Critério objetivo | Tarefa / prova esperada | Execução |
| --- | --- | --- | --- | --- |
| NUX-01 | APROVADO | Energia e quatro indicadores (energia/proteína/carboidrato/gordura) rotulados como totais para a quantidade solicitada, sobre pesos efetivos; ausências permanecem desconhecidas por indicador | T01/T03 domínio + T06 tela; 1/1,5/2,5 porções nas duas bases, nutriente ausente e arredondamento | PASS backend T01/T03; UI T06 NOT RUN |
| NUX-02 | APROVADO | Antes/depois explica reinterpretação, não conversão; confirmar mantém números; cancelar não muda base/itens | T06 interação e CAS T02 | CAS backend PASS T02; interação T06 NOT RUN |
| NUX-04 | APROVADO | Origem quando houver captura, receita/versão, base, quantidade e destino presentes na conferência; não inferir base | T06 cadastro/captura/aplicação e resposta tardia/PA07 | Resposta/base backend PASS; jornada T06 NOT RUN |
| NUX-05 | APROVADO | Lote de até dez com resumo por item; corrigir linha preserva as demais; falha impede envio parcial | T04 transação/rollback + T06 formulário/lote | Rollback/lote backend PASS T04; UI T06 NOT RUN |
| NUX-03, PUX-01 | APROVADO | Instruções pré-preenchidas e editáveis só na cópia; quantidades ao lado; conferência explícita por receita porcionada; nenhuma reescrita automática | T04 DTO/serviço/snapshot cifrado/idempotência + T05 BFF + T06 UI | PASS backend T04; BFF/UI NOT RUN |
| NUX-03, PUX-01 — segurança | APROVADO | Mesma chave/texto diferente dá 409, sem novas entregas; snapshot e biblioteca anteriores intactos; texto e confirmação não aparecem em logs/auditoria | T04 PostgreSQL/RLS, rollback, replay após edição da biblioteca e agendamento | PASS local T04/PG19; CI/R4 integral pendentes |
| PUX-02 | APROVADO | “Os ingredientes abaixo já estão nas quantidades para X porções”; rendimento original secundário; sem segunda multiplicação | T06 portal nos três exemplos, com/sem rendimento conhecido | Payload de porções PASS T04; UI T06 NOT RUN |
| PUX-03 | APROVADO | Medida/peso agrupados somente se conversão daquela preparação for confiável; sem densidade inferida | T01/T06 conversão disponível/ausente/incompatível | Preservação quantitativa PASS T01; UI T06 NOT RUN |
| PUX-05 | APROVADO | pt-BR, precisão interna intacta, ingrediente/número/unidade associados; teclado, texto/zoom 200%, responsividade e avaliação assistiva proporcionais | T06 Playwright desktop/mobile/Axe, foco; teste assistivo real identificado ou limitação explícita, sem falso PASS | NOT RUN |
| PUX-04 | APROVADO com limite de segurança | Mensagem genérica e retorno à lista; 404 indistinguível sem revelar existência/status de receita de outro paciente | T04/T05 negativo authz + T06 mensagem/ação | Negativos backend PASS; BFF/mensagem UI NOT RUN |
| NUX-06 | Preservar semântica já existente | Reenvio imediato substitui cópia ativa anterior; agendado substitui ao ativar; versões anteriores não viram múltiplas cópias ativas | T04 regressão Fase 310/worker/portal | PASS T04/worker real descartável; portal UI NOT RUN |
| PUX-06 | BACKLOG, não requisito desta entrega | Só avaliar continuidade após login se auditoria Fase 310 comprovar gap; sem redirect novo nesta fase | Fora de T01–T07; futuro planejamento próprio | NOT RUN / fora do escopo |

## Cenário sintético comum

Receita inteira rende 4 porções: A 500 g + B 200 g. Cadastro equivalente por porção: A 125 g + B 50 g. Solicitações:

| Porções solicitadas | A | B | Energia total | Proteínas | Carboidratos | Gorduras |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 125 g | 50 g | 150 kcal | 13,5 g | 16,5 g | 3 g |
| 1,5 | 187,5 g | 75 g | 225 kcal | 20,25 g | 24,75 g | 4,5 g |
| 2,5 | 312,5 g | 125 g | 375 kcal | 33,75 g | 41,25 g | 7,5 g |

Composições sintéticas por 100 g: A = 100 kcal, 10 g proteínas, 10 g carboidratos, 2 g gorduras; B = 50 kcal, 2 g proteínas, 8 g carboidratos, 1 g gorduras. Uma medida de A corresponde a 125 g **apenas neste cadastro**. Não transferir essa conversão a outros alimentos. Em teste de ausência, retirar um indicador e esperar “—” somente nele, sem total fictício.

Texto original: “Misture 500 g de A com 200 g de B”; preparo 20 minutos. Para o envio de 1,5 porções, profissional adapta a cópia para “Misture 187,5 g de A com 75 g de B” e confirma conferência; receita da biblioteca segue com texto original, tempo não é escalado. Os testes não atribuem compreensão automática de texto livre ao backend.

## Diagnóstico original de planejamento — histórico, implementações no registro

1. **Snapshot:** `{nome,conteudo,versao}` já é cifrado; instruções personalizadas ficam em `conteudo.instrucoes` da cópia, contexto mínimo interno versionado registra comando e conferência. Sem tabela extra para texto. Leitura pública passa por allowlist antes do writer novo; versões antigas não são reescritas.
2. **Idempotência:** comparação atual cobre receita/versão/canais/agendamento, não texto/porções. Extensão aprovada exige hash canônico e replay usando comando congelado, não biblioteca viva. Payload antigo sem personalização continua compatível; mesma chave antiga não pode ganhar personalização.
3. **Texto livre:** garantia universal de contradição não é tecnicamente demonstrável. Conferência explícita por item porcionado é obrigatória independentemente de heurística. Editar texto/porções/prévia invalida aceite local; backend rejeita falta de confirmação e prévia stale. Não substituir revisão profissional por um regex nem tratar booleano como prova de correção clínica.
4. **Nutrientes:** DTO legado de composição manual exige energia e três macros; exibir ausência em uma projeção de prévia não autoriza persistir composição inválida ou flexibilizar esse DTO. Usar fontes existentes e resumo parcial sem completar com zero.
5. **Rollback:** depois de gravar contexto novo, backend antigo que retorna snapshot cru não é rollback seguro. Usar reader/writer compatível ou correção adiante; preservar histórico cifrado. G06 separado, sem operação externa.

Não foi identificada incompatibilidade que exija nova decisão de produto. Se evidência nova exigir alterar esses contratos, relatar antes da alteração. Migration1080 criada/registrada e testada somente em ambiente descartável/CI; nenhuma aplicação externa. Conferir numeração e compatibilidade antes de futura integração.

## Etapas das personas e conclusão

- A: avaliações independentes concluídas na #451; requisitos enumerados agora aprovados pelo proprietário.
- B: NOT RUN; fornecer interface real, cenários acima e papéis do commit pinado, sem dados reais. Registrar fonte/telas/interações; leitura de código não prova teste visual.
- C: NOT RUN; após testes técnicos, revisar jornadas e fechamento dos IDs acima, mantendo sugestões novas em backlog para decisão.
- D: consultar decisões/relatórios relevantes na fase seguinte. A configuração #451 ainda não integrada não é presumida presente nesta branch.

Aceite técnico FOOD07 exige T01–T07 e gates G01–G05 comprovados no HEAD, incluindo regressões e R4 independente com limitações. G06 permanece BLOCKED operacional e não é suprido por CI. Sem FOOD05-MDL/D18, merge, deploy, migrations externas ou mudanças de infraestrutura.
