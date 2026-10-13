# Handoff — Fase 318: planejamento e análise de gaps

Branch `feature/fase-318-ia-rascunhos`, worktree
`/workspace/octaclin/.worktrees/docs-fase-318-planejamento`, base main8ea67a08
(merge407). Checkout principal e sua alteração em next-env.d.ts preservados.

## Autorização e próxima ação

Em2026-10-13 o proprietário autorizou prosseguir com implementação técnica,
mocks, fixtures e testes sintéticos conforme o contrato preparado. Branch
feature/fase-318-ia-rascunhos; gates clínicos/contratuais continuam bloqueados.
Nenhuma chamada paga, envio de dados reais, migration externa, merge, deploy ou
ativação está autorizado. Uma PR de entrega técnica, Draft enquanto houver gates.
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

## Histórico das verificações do planejamento

Inspeção de Git/worktrees/diff, contratos/código e GitHub407/CI main. No planejamento não rodados
benchmarks/testes de implementação318; CI317 não prova318. Diff/secrets/links documentais conferidos ao concluir; consulta de páginas públicas
OpenAI200, sem chamadasAPI. Nenhum resultado clínico ou modelo ratificado pelo agente.

## Execução técnica — estado atual

Backend318, credenciais cifradas/CAS, gates, fontes, adaptador, prova efêmera,
confirmação transacional/idempotente e auditoria implementados. Migration1071
aditiva cobre invalidação monotônica em pacientes/profissionais/usuários;1070
intocada. BFF allowlist e UI no prontuário/integrações/configuração da clínica.
Ledger: `docs/history/phases/reviews/fase-318/EXECUCAO.md`. Testes de fornecedor
exclusivamente mock; nenhum modelo ou contrato ratificado. Gates G01/G02/G05
BLOCKED. Terminar provas/CI e revisão antes de concluir T11; T12 exige autorização.

## Followup após408 — correções de uso e piloto ainda bloqueado

Base4aeb5297. Usuário pediu revisão do500 Metas e Adesão, clareza da tela de
Integrações, identificação de profissional e backlog de Perfil. Desenvolvimento
e testes das correções autorizados; nenhum deploy/flag/migration externa executado.

- SQL legado badges: Raw gerava BadgeOrm.regraConquista sem quoting; PostgreSQL
  reportou missing FROM-clause. Teste gera SQL TypeORM sem conectar ao banco: RED,
  correção mantém tenant/exclusão317, GREEN. Prova real nova só CI descartável.
- Estado cadastral OpenAI deriva de direitos===true no backend e projeção BFF.
  UI não infere permissão de estado ausente; não muda aprovação contratual/global.
- Drawer mostra IDs já recebidos pelo DTO profissional autorizado; sem novo
  acesso, inferência por nome, armazenamento de dados pessoais ou edição de perfil.
- Perfil completo: pendência documentada e ligada ao roadmap, sem escopo novo.
- Piloto sintético continua exigindo isolamento server-side e alvo comprovado;
  não ativar direitos/catálogo clínicos para contornar o cadastro bloqueado.

Finalizar regressões, navegador desktop/mobile, build/typecheck/lint, revisão
R4 com autoria e PR única de followup. APIs/código só são considerados corrigidos
em produção após revisão/merge/deploy próprio, não por testes locais.

## Continuidade técnica do piloto após409

Branch feature/fase-318-revisao-sintetica, baseb9535170. IDs do titular recebidos
por canal da sessão; não versionados. Grant/flag/revisão de custódia continuam
pendentes, sem dados reais ou chamadas pagas. Implementação do corpus30casos,
composição factual, serviço/prova/quota, BFF fechado, chave individual reutilizada
e UI de revisão sintética. Nenhuma migration. R4 e evidências no ledger
`docs/history/phases/reviews/fase-318/PILOTO_SINTETICO_EXECUCAO.md`.
Checkout ativo para entrega: /tmp/octaclin-f318-entrega por ENOSPC do disco
principal; worktree original preservada, sem novo escritor nela. Não fazer
merge/deploy/configuração externa/ativação sem autorização correspondente.
