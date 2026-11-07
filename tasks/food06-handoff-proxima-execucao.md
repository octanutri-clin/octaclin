# FOOD06 — próxima execução: I01/M01 (reconstrução)

Use este handoff curto depois do [guia completo do Claude](CLAUDE_CODE_INICIO_E_HANDOFF_FOOD06_M01.md).
O guia contém a entrada no projeto, ordem de leitura, comandos e FT01–FT20.
Esta reconstrução documental não executa a tarefa funcional.

## Objetivo e ponto preservado

Completar fontes factuais por micronutriente em API/tabela/detalhes/relatório,
reutilizando snapshots autorizados e preservando matemática/histórico. Base de
código137aa547; branch `feat/food06-m01-rastreabilidade-recuperacao`, worktree sob
`/workspace/octaclin/.worktrees/food06-m01-rastreabilidade-recuperacao`.
O HEAD contém o guia e estes relatórios; reconfirmar SHA/Git/PR antes de agir.

A implementação M01 anterior foi perdida no TEMP sem commit/push. Não existe
patch recuperado. Este é o ponto exato: implementação e validação do incremento
devem ser reconstruídas; não reiniciar M01–M12, planejamento ou toda a auditoria.
Não reutilizar PASS/R4 do código perdido como prova de arquivos novos.

## Pré-requisitos

1. Um escritor ativo, Git inventariado e nenhuma alteração de outro agente tocada.
2. Ler AGENTS/contratos e os seis relatórios reconstruídos conforme o guia; eles
   não são os arquivos originais de cfaa42f5. PR455 continua Draft.
3. Medir espaço e dependências: havia877MiB livres após checkout; Node22/pnpm do
   manifest, sem instalações compartilhadas alteradas ou requisitos relaxados.
4. Confirmar que o HEAD remoto não mudou. Main e worktree004eab71 são protegidas.

## Escopo fechado / decisão técnica

Diagnosticar de onde vêm valores/fontes: cobertura E01 e resumo M08 E08 já existem.
A lacuna é o vínculo factual dos metadados congelados com contribuintes conhecidos
de cada nutriente. Se só há origem geral do registro, apresentá-la com essa limitação.
Fonte específica/versão ausente continua desconhecida. Não consultar catálogo vivo
para preencher histórico. Reutilizar seletores, classificação e projeções.

Propor mudança mínima aditiva por superfície; campo opcional ou projeção negociada
somente se necessário e compatível. Uma projeção backend autoritativa; nenhum motor
ou interpretação paralela no BFF/React/PDF. Preservar limites de grupos, metadados,
volume e formatos1/2 do relatório. Sem nova tabela, migration ou DRI.

Arquivos candidatos: `dominio/cobertura-dietetica.ts`, `calculo-combinado.ts`,
`aplicacao/fontes-relatorio-factual.ts`, `projecao-registro-factual.ts`,
`servico-planos-alimentares.ts` e projeções/contratos existentes; Web leitores e
componentes `micronutrientes-factuais`, `contribuicoes-micronutrientes`,
`relatorio-factual`; specs correspondentes. Não implica alterar todos esses arquivos.

## Provas e critérios de aceite

- RED funcional para lacunas reais; setup inválido não é RED. GREEN foco e regressões
  que demonstram mesma matemática, zero/ausência/incompatibilidade e legados.
- FT01–FT20 do guia: fontes múltiplas, incerteza, histórico após catálogo alterado,
  receita fracionária, alternativa escolhida, repetições, agrupamento limitado,
  mesma revisão nas superfícies, campos extras rejeitados e nenhuma DRI liberada.
- Autorização/tenant/carteira/revogação e exportação: prova real descartável/runtime
  RLS quando aplicável. Mocks não substituem banco. Falta de ambiente é BLOCKED.
- Browser desktop/mobile, teclado/foco/zoom/axe; PDF real se mudar apresentação.
  Não alegar AT humana/PDF acessível integral sem execução correspondente.
- Typechecks/builds/lint/linguagem/segredos/diff-check proporcionais; CI do novo HEAD
  separado de CI137aa547. R4/UX do incremento com identidade/limitações honestas.

Reavaliar C1/C2/C3 individualmente com evidência anterior versus nova, código,
testes pendentes e impedimentos. Não promover M01 automaticamente; preservar50%
administrativos até conclusão efetiva pelos critérios. M02/M03/M05/M08 recebem
somente impactos comprovados, sem encerramento por inferência.

## Interrupção, exclusões e entrega

Interromper parte que exija proveniência inventada, reescrita clínica, migration,
contrato incompatível, fonte sem direito, nova exposição/permissão, dependência
arquitetural não prevista ou edição de trabalho paralelo. Sem M11/M12/MDL/DRI,
produção, deploy, merge ou migrations externas.

O proprietário autorizou publicar este conjunto documental e o guia. Isso não
autoriza push automático do futuro código: reconfirmar a autorização específica
de sincronização no contexto da próxima execução. Manter PR455 existente, sem nova
PR paralela para o incremento.

Criar `tasks/food06-m01-rastreabilidade-fontes.md` com diagnóstico, diff, RED/GREEN,
FTs, commits, evidências/limitações, M01-C1/C2/C3 e próximo passo. Commit local
intencional antes de troca de agente; nunca depender apenas de `/tmp` ou conversa.
