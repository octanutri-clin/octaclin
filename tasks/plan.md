# Handoff — Fase 318: planejamento e análise de gaps

Branch `docs/fase-318-planejamento`, worktree
`/workspace/octaclin/.worktrees/docs-fase-318-planejamento`, base main8ea67a08
(merge407). Checkout principal e sua alteração em next-env.d.ts preservados.

## Autorização e próxima ação

Só planejamento/análise autorizados. Não iniciar código, testes de implementação,
benchmark, downloads, migrations, provider ou ativação. D01–07 confirmadas; planejamento consolidado. Próxima etapa proposta: desenvolvimento
técnico protegido com mocks/sintéticos, mediante autorização expressa. Chamadas
pagas, teste real com chave e ativação precisam de gates/orçamento correspondentes.
Não abrir PR documental isolada; integrar estes documentos à futura PR única.

## Decisões e contratos

D01: pré-consulta e rascunho de evolução, sem orientação nesta fase.
D02 revisada: API externa com chave própria do nutricionista; OpenAI, chave individual
não compartilhada e integração habilitada pela clínica confirmadas. Substitui local CPU; nenhuma chamada paga
ou transferência clínica autorizada ao agente. Pesquisa/testes somente sintéticos.
D03: apenas responsável atual gera/confirma no console; manual legado preservado.
D04: contexto mínimo selecionado e revisão jurídica/privacidade pela equipe;
revisão ainda não concluída. D05: rascunho somente na tela, limpar ao sair/trocar.
D06: proprietário/equipe revisarão30casos, ainda não executados. D07: catálogo
aprovado com padrão econômico e limites. Sem pergunta de produto pendente.


- [Plano, evidências, limites e gates](../docs/history/phases/PLANO_FASE_318.md).
- [T00–T12, arquivos, dependências e critérios](todo-fase-318.md).
- [Contrato técnico BYOK](../docs/product/CONTRATO_OPENAI_BYOK_FASE_318.md).
- [30casos para revisão humana](../docs/product/CORPUS_REVISAO_FASE_318.md).
- Modelos/baseline reais: fases271/272/274 e código pacientes/IA/FastAPI.
- Gate legado ia.clinica não libera318; não copiar persistência/ORM do legado.
- Inferência fora de lock; contexto/identidade revalidados no retorno e
  confirmação, inclusive transferência A→B→A e resposta tardia.
- Prévia com fontes/datas/limites; revisão humana não é assinatura digital.
- Evolução privada/cifrada, título180/conteúdo6000; não prometer replay seguro
  sem desenhar/testar contrato idempotente; não alterar manual por consequência.
- Termos/privacidade da API OpenAI, preços e qualidade clínica não presumidos.
- Adaptador OpenAI no backend; não repassar BYOK ao FastAPI legado.
- PoC pode concluir NO-GO; baseline permanece caminho completo para profissional.

## Continuidade

316 permanece stand-by. 317 integrada407/CI main38324741937 PASS consultado nesta
rodada; ativação global não executada pelo agente, preflight processo/providers
pendente. Aceites/autorização já recebidos mantidos. Não habilitar flags aqui.
314 classificadores permanecem bloqueados; medidas factuais autorizadas não são
protocolo de IA. Handoff313 antigo preservado em plan-fase-313.md.

## Modelos e execução

GPT-6.1 Sol médio para análise/contratos/segurança e integraçãoR4. Luna alto pode
preparar fixtures e UI com contrato fechado; não recomendado sozinho para fase
inteira. Se houver transição, avisar modelo alvo e pausar para troca manual.
Não houve troca nem delegação. Execução futura nativa, sem reabrir planejamento
por preferência; novas decisões só para lacunas demonstradas.

## Verificações desta etapa

Inspeção de Git/worktrees/diff, contratos/código e GitHub407/CI main. Não rodados
benchmarks/testes de implementação318; CI317 não prova318. Diff/secrets/links documentais conferidos ao concluir; consulta de páginas públicas
OpenAI200, sem chamadasAPI. Nenhum resultado clínico ou modelo ratificado pelo agente.
