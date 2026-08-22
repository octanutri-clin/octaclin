# Fase 255 - Prontuario clinico orientado a linha de cuidado

Criado em 2026-08-22. Fase essencial e bloqueadora do pre-piloto, sucessora da
Fase 254.

## Objetivo

Consolidar o prontuario profissional como uma superficie clinica resiliente,
com contexto do paciente sempre identificavel, proxima conduta acionavel e
modulos carregados conforme a area usada. A fase preserva as capacidades ja
entregues nas Fases 180, 193, 235, 236, 237 e 239; nao cria uma segunda fonte
de verdade nem reimplementa os modulos clinicos existentes.

## Diagnostico de partida

- `ProntuarioPaciente` concentra 1.659 linhas, navegacao, carregamento, formularios,
  anexos, materiais, timeline e feedback no mesmo componente.
- A abertura do Resumo aguarda prontuario, biblioteca de materiais, materiais
  enviados e anexos. Uma falha lateral impede a leitura do prontuario inteiro.
- A lista de profissionais pode paginar ate 2.000 registros na abertura, mesmo
  quando o usuario nao acessa o filtro de historico.
- Historico ja possui cursor, filtros server-side e metadados sem conteudo
  clinico descriptografado; ele deve continuar sendo a fonte longitudinal.
- Evolucao e plano alimentar ja protegem alteracoes nao salvas. A decomposicao
  deve manter essa protecao e ampliar o contrato apenas quando houver formulario
  mutavel real.
- Backend, BFF e RLS ja aplicam escopo de tenant, paciente e carteira. A fase
  deve preservar esses controles e provar que nenhuma area nova contorna a
  autorizacao existente.

## Incrementos

### Incremento 1 - fronteiras de componente e resiliência

- Extrair configuracao de areas/subareas e apresentacao da linha do tempo para
  componentes tipados e reutilizaveis.
- Manter o contrato clinico, textos, acoes e permissoes existentes.
- Carregar Materiais e Anexos somente quando as respectivas subareas forem
  abertas; falha em uma delas nao derruba Resumo, Atendimentos ou Avaliacoes.
- Carregar o diretorio de profissionais somente quando a autoria/filtro exigir,
  com estado local de falha nao bloqueante.
- Nao persistir PHI em `localStorage` ou `sessionStorage`.

### Incremento 2 - contexto navegavel e estado por area

- Representar area/subarea na URL por identificadores permitidos, sem PII, para
  deep link, recarga e retorno previsiveis.
- Revalidar permissao antes de aplicar qualquer destino vindo da URL.
- Separar carregamento, vazio, erro e nova tentativa por area.
- Preservar confirmacao de descarte ao trocar area, voltar ou abrir a agenda.

### Incremento 3 - validacao transversal

- Revisar cadeia de autorizacao Professional, SuperAdmin e papel sem permissao.
- Cobrir teclado, foco, leitores de tela, alvos de 44 px e ausencia de overflow
  em desktop e mobile.
- Provar que uma falha de Materiais/Anexos e recuperavel sem ocultar o resumo.
- Provar que filtros e deep links nao permitem abrir uma area sem permissao.
- Executar suites backend/web, authz, Playwright, smoke real e scanner de
  segredos antes da integracao.

## Seguranca e privacidade

- URLs usam apenas UUID opaco do paciente e IDs canonicos de area/subarea.
- Conteudo de evolucao, mensagem, exame, documento ou anexo nao entra em logs,
  query string, armazenamento persistente do navegador ou mensagens de erro.
- A interface nao substitui autorizacao server-side; controles visuais sao uma
  camada adicional, nunca a barreira principal.
- Leituras e mutacoes continuam pelos BFFs autenticados existentes.
- Nenhuma migration esta prevista. Se uma necessidade de schema surgir, o
  incremento para e recebe plano, preflight e aceite operacional separados.

## Criterios de aceite

1. Abrir o Resumo nao solicita biblioteca de materiais nem anexos.
2. Falha em Materiais ou Anexos aparece apenas na subarea correspondente.
3. Area e subarea validas sobrevivem a recarga; destinos sem permissao caem em
   uma area segura.
4. Rascunho clinico nao e perdido silenciosamente em navegacao interna ou
   externa controlada.
5. Professional fora da carteira continua recebendo `NotFound`; somente
   SuperAdmin mantem o contexto transversal ja identificado.
6. A regressao do prontuario passa em desktop 1440 px e mobile 390 px, por
   mouse, toque e teclado, sem dados reais.

## Skills e ferramentas

- Implementacao: `ecc:healthcare-emr-patterns`, `ecc:healthcare-phi-compliance`,
  `ecc:frontend-patterns` e `ecc:frontend-a11y`.
- Revisao: `codex-security:attack-path-analysis` e `codex-security:validation`.
- Ferramentas: Playwright, Chrome DevTools e Penpot quando houver alteracao
  visual material.
- Modelo: GPT-5.6 Sol, raciocinio `high`; revisao de seguranca read-only pode
  usar `xhigh` por concentrar PHI e acoes clinicas persistentes.

## Proxima fase

Fase 256 - Formularios e check-ins ponta a ponta.

## Resultado

Concluida tecnicamente em 2026-08-22, sem migration.

- Configuracao de areas/subareas e timeline foram extraidas do componente
  principal; contratos e rotulos permaneceram tipados.
- Materiais e Anexos carregam somente quando abertos, com erro e nova tentativa
  locais. O diretorio completo de profissionais tambem foi adiado; SuperAdmin
  recebe apenas a busca pontual do responsavel no Resumo.
- Area e subarea usam query string allowlisted por permissao. Destino invalido
  ou proibido e removido da URL antes da renderizacao.
- Tarefa, material, envio, anexo, evolucao e plano alimentar participam da
  confirmacao de descarte. A navegacao por setas restaura o foco ao gatilho
  quando o modal e cancelado.
- Controles de evolucao, tarefa, material, envio e documento acompanham as
  permissoes exigidas pelo backend.
- A revisao de seguranca nao sustentou bypass de tenant ou carteira. As
  necessidades de reduzir PHI no contrato inicial, tornar auditoria duravel e
  cifrar campos livres remanescentes foram registradas nas Fases 260/261 por
  exigirem contratos, estrategia transacional e migrations separados.

Validacoes aprovadas: `test:prontuario:validacao` 44/44, Jest do servico de
pacientes 36/36, `test:authz` 66/66, `test:a11y` 10/10, `test:linguagem` 8/8,
`test:base-visual`, typechecks, builds backend/web e `security:secrets`.
