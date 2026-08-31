# Relatorio de seguranca - PR 47 - Fluxos de IA

Data: 2026-08-31

Branch: `security/governanca-pr47-ia`

Pull request GitHub: `#174`

## 1. Objetivo e limite

Este PR endurece os fluxos de analise de sentimento e reconhecimento alimentar
contra entrada e saida abertas, prompt/tool injection, exfiltracao, abuso de
volume e acao clinica automatica. O escopo segue o PR 47 do programa de
hardening.

O servico FastAPI atual usa somente heuristica lexical local. Ele nao chama
provider externo, nao possui ferramentas e nao recebe URL assinada da imagem.
Nenhum dado real, provider real, migration, banco, deploy ou operacao de
producao foi usado nesta validacao.

## 2. Caminhos de ataque revisados

| Caminho | Risco anterior | Controle implementado | Evidencia |
| --- | --- | --- | --- |
| Campo livre usado como instrucao | prompt/tool injection pelo `contexto` | DTO aninhado, allowlist por operacao e Pydantic com `extra=forbid` | campo `ferramenta` e rejeitado antes do fetch e pelo FastAPI |
| Resposta do servico contendo acao | tool injection e execucao indireta | schema de saida fechado nos dois servicos | `tool_calls` e campo arbitrario em alimento sao recusados e nada e persistido |
| Segredo do ambiente pedido no texto | exfiltracao por prompt hostil | motor local sem acesso a ferramenta/provider e resposta tipada | segredo sintetico nao aparece na resposta adversarial |
| Imagem clinica enviada por URL | exposicao de URL assinada e acesso desnecessario | remocao de `imagem_url`; somente hash validado e observacao limitada atravessam a fronteira | corpo do fetch e teste FastAPI provam ausencia da URL |
| Resposta sem revisao humana | sugestao tratada como decisao clinica | literal `revisao_humana_obrigatoria=true`, persistencia pendente e alerta inicialmente falso | resposta sem contrato e rejeitada; alerta so pode surgir apos decisao humana |
| Edicao humana em JSON aberto | persistencia de payload arbitrario | schema exato por tipo de sugestao e limite de tamanho | chave desconhecida, formato incorreto e edicao junto de aceite sao recusados |
| Paciente fora do tenant/carteira | vazamento de PHI entre clinicas/profissionais | `ExecutorTenant`, filtros de tenant e validacao da carteira antes do fetch | paciente fora do escopo retorna `NotFound` e o FastAPI nao e chamado |
| Abuso distribuido entre usuarios | custo/volume agregado sem teto | limite por tenant alem do limite por usuario | teto da clinica bloqueia antes de executar a analise |
| Redirect do servico interno | desvio de credencial em redirecionamento HTTP | `redirect: error`, timeout e resposta limitada a 512 KiB | opcoes e erros sanitizados cobertos por Jest |
| Configuracao parcial | uso acidental de endpoint local/default | URL e token obrigatorios, ambos falham fechados | ausencia isolada de cada variavel retorna indisponibilidade antes do fetch |

## 3. Implementacao

- Entradas HTTP e FastAPI passaram a aceitar somente contexto conhecido por
  operacao.
- Saidas de sentimento e alimento passaram a ter chaves, tipos, limites e
  sinalizador de revisao humana obrigatoria validados estritamente.
- A URL assinada de imagem deixou de ser criada e enviada ao servico que nao a
  consumia; o reconhecimento local recebe apenas hash e observacao limitada.
- Conteudo editado pelo profissional passou a ter schema fechado por tipo.
- O modulo nao injeta mais o servico de storage, reduzindo a capacidade
  desnecessaria da fronteira de IA.
- O backend nao usa mais URL default para o FastAPI e recusa redirects.
- Rate limit agregado por tenant complementa os limites por usuario.
- Nenhuma acao ou tool call da resposta e executada. A sugestao nasce pendente,
  e o alerta permanece falso ate revisao humana explicita.

## 4. TDD e validacoes

### RED

Os testes adversariais falharam antes da implementacao por aceitacao de
contexto e saida abertos, envio de URL assinada, configuracao default do servico
e ausencia de limite agregado por tenant.

### GREEN

- PASS - Jest direcionado de IA: 2 suites e 23/23 testes.
- PASS - FastAPI: 9/9 testes, incluindo prompt hostil, campos extras, token e
  hash invalido.
- PASS - backend Jest completo: 167 suites e 1.342 testes.
- PASS - `pnpm --dir octaclin-backend typecheck`.
- PASS - `pnpm --dir octaclin-backend build`; `dist/main.js` validado.
- PASS - `pnpm test:confiabilidade`: 20 referencias criticas.
- PASS - `pnpm validate:docs`, `pnpm security:secrets` e
  `pnpm test:security`.
- PASS - `pnpm --dir octaclin-backend audit --prod`: nenhuma vulnerabilidade
  conhecida.
- PASS - `pip-audit -r octaclin-ai-service/requirements.txt`: nenhuma
  vulnerabilidade conhecida.
- PASS - `git diff --check`.
- SKIPPED - 4 suites e 32 testes de integracao dependentes de ambiente na
  execucao completa, conforme marcacao preexistente da propria suite.
- SKIPPED - provider externo e dados reais: nao existem no servico atual e sao
  proibidos neste PR.
- NA - migrations, Postgres, Redis real, frontend, Render e producao.

## 5. Compatibilidade operacional

- Nenhuma variavel nova e exigida.
- Para habilitar IA, `IA_SERVICE_URL` e `IA_SERVICE_TOKEN` devem existir
  juntas; nao ha mais fallback para `localhost`.
- O FastAPI e o backend precisam ser publicados no mesmo incremento porque o
  contrato agora rejeita campos extras e exige `revisao_humana_obrigatoria`.
- O reconhecimento atual continua sendo uma heuristica baseada em observacao;
  ele nunca processou os bytes da imagem. Ligar visao computacional ou provider
  externo exige novo threat model, base legal, minimizacao e autorizacao.
- Sugestoes existentes no banco continuam legiveis; nao ha alteracao de schema.

## 6. Rollback

O rollback consiste em reverter este PR e publicar backend e FastAPI em versoes
compativeis entre si. Nao ha migration nem transformacao de dados. A feature
flag `ia.clinica` deve permanecer desabilitada durante qualquer divergencia de
versao entre os dois servicos.

## 7. Riscos residuais

- O texto de sentimento pode conter dado clinico porque e a entrada funcional
  da analise. Hoje ele fica na fronteira local; enviar esse texto a terceiros
  permanece proibido sem decisao especifica.
- O FastAPI nao faz reconhecimento visual real. A UI deve manter linguagem de
  sugestao e revisao, sem prometer inferencia da imagem.
- Rate limit depende da atomicidade ja fornecida pelo servico de protecao de
  abuso; o PR nao altera sua implementacao.
- Nao houve smoke em staging nem deploy coordenado dos dois servicos.
- Provas ASVS integrais e pentest permanecem nos PRs 54-55.

## 8. Resultado

O escopo do PR 47 foi implementado e validado localmente na branch
`security/governanca-pr47-ia`, PR GitHub `#174`. O incremento aguarda checks
remotos, review e merge humanos. O PR 48 nao esta autorizado ate esse aceite.
