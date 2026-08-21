# OctaClin - Roadmap de qualidade e seguranca das Fases 248 a 262

Atualizado em 2026-08-21.

Seleção operacional por fase: `MATRIZ_SKILLS_PLUGINS_MODELOS_FASES_243_248_262.md`.

## Objetivo

Este roteiro transforma a melhoria contínua em uma sequência verificável. Ele
não declara o produto pronto por quantidade de fases: cada etapa precisa reduzir
um risco observável, ter critérios de aceite e atualizar o checklist vivo.

O app Expo não é prioridade de produto, mas sua dívida de segurança não pode
ficar indefinidamente no repositório público. A Fase 243 foi concluida como
interrupcao de seguranca antes da sequencia 248-262, sem ativar nem distribuir o
Mobile. O resultado removeu todos os alertas corrigiveis; duas ocorrencias altas
de `image-size` sem patch upstream mantem o NO-GO de distribuicao.

## Ordem recomendada

1. **Interrupção concluida: Fase 243** - ecossistema Expo atualizado de forma
   coordenada, `mobile.sync=false` preservado e cinco PRs automaticos
   substituidos pelo PR da fase.
2. **Fases 248-252** - corrigir estados, consistência visual, dívida de PRs,
   linguagem e descoberta de funcionalidades.
3. **Fases 253-259** - fechar as jornadas essenciais de agenda, paciente,
   prontuário, formulários, portal, comunicação e acesso.
4. **Fases 260-262** - medir estabilidade, repetir a revisão de segurança e
   decidir GO/NO-GO do piloto com evidência.

## Classificação das 15 fases

| Fase | Entrega | Prioridade | Bloqueio |
| --- | --- | --- | --- |
| 248 | Estados e recuperação clínica - concluída em 2026-08-20 | Essencial | Gate aprovado |
| 249 | Densidade e responsividade web - concluida em 2026-08-20 | Importante | Gate aprovado |
| 250 | Fechamento da dívida Mobile e PRs - concluida em 2026-08-20 | Essencial/segurança | Higiene aprovada; Mobile segue bloqueado pelos advisories upstream |
| 251 | Linguagem e microcopy integral - concluida em 2026-08-21 | Importante | Gate aprovado |
| 252 | Navegacao e descoberta por papel - concluida em 2026-08-21 | Essencial | Gate aprovado |
| 253 | Agenda clínica confiável - implementada em 2026-08-21 | Essencial | Rollout bloqueado pela migration 1034 |
| 254 | Lista e cadastro de pacientes | Essencial | Pré-piloto |
| 255 | Prontuário e linha de cuidado | Essencial | Bloqueia piloto |
| 256 | Formulários/check-ins ponta a ponta | Essencial | Pré-piloto |
| 257 | Portal do paciente por tarefas | Essencial | Pré-piloto |
| 258 | Comunicações confiáveis | Essencial | Pré-piloto |
| 259 | Acesso, convite e ativação | Essencial | Pré-piloto |
| 260 | Desempenho, resiliência e diagnóstico | Essencial | Estabilidade pré-piloto |
| 261 | Regressão de segurança e privacidade | Essencial/segurança | Bloqueia piloto |
| 262 | Aceite e prontidão para piloto | Essencial | Bloqueador final |

## Critérios transversais

- Nenhuma fase pode remover ou afrouxar RLS, tenant, permissões ou auditoria
  para simplificar uma tela.
- Dados de testes, screenshots e documentação devem ser sintéticos.
- Estados de carregamento, vazio, erro, sucesso, permissão negada e recuperação
  são parte do aceite, não acabamento posterior.
- Desktop profissional é a prioridade de uso. Web móvel deve permanecer íntegra
  e acessível; o app Expo continua desativado mesmo apos a aceitacao tecnica da
  Fase 243, ate todos os gates de distribuicao serem fechados.
- Correção visual exige screenshots comparáveis, teclado, foco, contraste e
  ausência de sobreposição. Correção funcional exige teste no nível adequado.
- Cada fase atualiza seu `fase-XXX-*.md`, este roteiro quando houver mudança de
  ordem e `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` ao ser concluída.

## Resultado da Fase 251

- `GUIA_VOZ_MICROCOPY.md` consolidou a voz, o glossario e os padroes de
  mensagens em portugues brasileiro.
- Um gate AST verifica somente texto visivel e integra o CI, preservando IDs,
  enums, rotas e contratos internos.
- As superficies prioritarias profissionais, publicas e dos portais foram
  revisadas, com `Hoje` e `Painel clinico` como nomenclatura principal.
- Browser, Lighthouse 100 e Playwright em 1440 px e 390 px aprovaram contraste,
  foco, nomes acessiveis e ausencia de overflow; regressao das Fases 248 e 249
  permaneceu verde.
- A sequencia segue para a Fase 252, que reconcilia rotas, permissoes e
  descoberta de capacidades por papel.

## Resultado da Fase 252

- Um catalogo canonico reconciliou as dez rotas do console com grupos, papeis,
  permissoes, atalhos e termos de busca.
- Menu, paleta de comandos e autorizacao deixaram de manter inventarios
  paralelos; Patient e Client permanecem isolados e Operacoes e exclusiva do
  SuperAdmin.
- O menu mobile usa disclosure nativo, exibe a area atual e revela todos os
  grupos por teclado sem overflow.
- Penpot, Chrome DevTools, Lighthouse 100, 4 cenarios da fase e 10 cenarios de
  acessibilidade aprovaram a entrega.
- A sequencia segue para a Fase 253, que fecha confiabilidade, concorrencia e
  recuperacao da agenda interna e Google Calendar.

## Resultado tecnico da Fase 253

- Trava transacional por tenant/profissional eliminou a corrida entre consulta
  e bloqueio manual, preservando a agenda interna sem Google conectado.
- Google ganhou ID de evento deterministico, vinculacao estrita nos eventos de
  entrada e sync token preservado quando qualquer aplicacao falha.
- Email, WhatsApp e Google podem ser reprocessados pela consulta sem duplicar
  mensagem persistida; cancelamento usa estados proprios.
- Agendamento publico considera bloqueios manuais, limita abuso global por IP,
  recupera aprovacao abandonada e preserva dados ao atualizar conflito.
- 87 testes focados, builds, autorizacao, Playwright, acessibilidade, Chrome
  DevTools e preflight SQL em integracao aprovaram a implementacao.
- A sequencia somente avanca para a Fase 254 depois da migration `1034`, merge,
  deploy e smoke sintetico da Fase 253 em producao.

## Auditoria dos PRs abertos em 2026-08-20

### Resultado

| PR | Situação observada | Necessidade | Decisão recomendada |
| --- | --- | --- | --- |
| `#22` | React Native e screens isolados; branch atras; job Mobile falha | Nao serve isoladamente | Encerrado; substituido pelo PR `#84` |
| `#24` | Safe Area Context major isolada; branch atras | Depende da matriz Expo alvo | Encerrado; substituido pelo PR `#84` |
| `#25` | Expo 52 para 57 sozinho; grande troca de lockfile; branch atras | Era a direcao, nao um PR integravel sozinho | Encerrado; substituido pelo PR `#84` |
| `#29` | Expo AV major isolada; branch atras | Dependia do SDK alvo | Encerrado; substituido pelo PR `#84` |
| `#30` | Expo Status Bar major isolada; branch atras | Dependia da matriz Expo alvo | Encerrado; substituido pelo PR `#84` |
| `#6` | Fase 150A de julho, 10 commits, conflitos com `main` | Conteúdo atual possui escopo Mobile/IA mais amplo e 42 testes direcionados aprovados | Encerrado como superado na Fase 250; sem merge/cherry-pick |

O PR `#84` foi aprovado pelos sete jobs do CI `32430036184` e mergeado em
`87b2f6a`. Os cinco PRs automaticos receberam a referencia ao substituto e foram
encerrados. O PR `#6` recebeu a evidencia de reconciliacao e foi encerrado na
Fase 250. Ele estava conflitante, sem revisao e com smoke historico falho; a
implementacao atual valida tenant, paciente, profissional responsavel, midia,
hash, idempotencia, locks e timeout em servicos mais novos. Nao restou PR aberto.

## Triagem dos alertas Dependabot

Fonte: API REST do GitHub, estado `open`, consultada em 2026-08-20. A análise
foi estática: nenhuma aplicação, teste de exploração ou código do produto foi
executado.

- Baseline: **37** alertas em `octaclin-mobile/pnpm-lock.yaml` no GitHub e 38
  vulnerabilidades na auditoria local.
- Severidade: **1 crítico**, **26 altos** e **10 médios**.
- Escopo informado pelo GitHub: `runtime` para os 37.
- Backend, web e serviço de IA: nenhum alerta Dependabot aberto nessa coleta.

| Pacote | Alertas | Severidade | Avaliação |
| --- | --- | --- | --- |
| `tar` | 1-6, 14-18 e 22 | 1 crítico, altos e médios | Presença confirmada via Expo CLI; prioridade máxima da atualização |
| `@xmldom/xmldom` | 7-11 | Altos | Presença confirmada via configuração/prebuild Expo |
| `postcss` | 12, 20, 21 e 27 | Altos e médios | Presença confirmada na cadeia Metro/Expo |
| `uuid` | 13 | Médio | Presença confirmada em dependências transitivas |
| `fast-uri` | 19 e 28 | Altos | Presença confirmada via AJV |
| `brace-expansion` | 23-26 | Altos | Presença confirmada via minimatch |
| `undici` | 29-31 | Médios | Presença confirmada via Expo CLI |
| `js-yaml` | 32-33 | Altos | Presença confirmada em ferramentas transitivas |
| `nanoid` | 34 e 37 | Altos | Presença confirmada em navegação/PostCSS |
| `image-size` | 35-36 | Altos, sem patch direto indicado | Presença confirmada via Metro; resolver pela atualização do ecossistema |

Veredito da triagem: a dívida de dependências era **confirmada**. A explorabilidade contra o
SaaS web implantado fica como **não demonstrada/necessita revisão**, porque o
lockfile afetado pertence ao app nativo não distribuído e vários caminhos são
de build. O repositório público aumenta a visibilidade do atraso, mas não cria
sozinho um caminho de ataque ao backend ou à web. O risco permanece relevante
para builds, estações de desenvolvimento e uma futura distribuição Mobile.

### Resultado da Fase 243

- Expo 52 foi elevado incrementalmente ate o 57; a matriz final e Expo 57.0.15,
  React Native 0.86.2 e React 19.2.3.
- Todos os alertas corrigiveis foram removidos. A auditoria local atual retorna
  somente `GHSA-w3rx-r6r6-pgpr` e `GHSA-5p2g-fcmc-qvqq`, sem versao corrigida.
- O gate do CI admite temporariamente apenas esse conjunto imutavel e reprova
  qualquer aviso novo, divergente ou silenciado.
- A API do GitHub, consultada apos o merge, confirmou 2 alertas abertos, ambos
  altos e ambos no pacote `image-size`.
- O Mobile permanece desativado e nao distribuivel. Audit zerado, autenticacao,
  protecao do SQLite, captura real de midia e builds assinados continuam gates
  obrigatorios de uma futura retomada.

### Revalidacao da Fase 250

- A API do GitHub continua com exatamente dois alertas abertos, ambos altos:
  `GHSA-w3rx-r6r6-pgpr` e `GHSA-5p2g-fcmc-qvqq`.
- Ambos afetam `image-size <=2.0.2`, nao possuem primeira versao corrigida e o
  npm registra `2.0.2` como `latest`; portanto, nao existe bump reparador.
- A cadeia instalada permanece `metro@0.84.4 > image-size@1.2.1`.
- Doctor, typecheck, alinhamento, auditoria controlada, bundles das tres
  plataformas e 42 testes direcionados de Mobile/IA foram aprovados.
- A higiene de PRs foi concluida, mas `mobile.sync=false` e o NO-GO de
  distribuicao permanecem ate os advisories e demais gates Mobile serem fechados.

## Política de dependências após a Fase 250

- Crítico: triagem em 1 dia útil e correção ou contenção com prazo explícito.
- Alto: plano em até 7 dias; sem acúmulo silencioso.
- Médio: tratar no ciclo mensal ou antes se houver caminho exposto.
- Atualizações acopladas por framework entram em um PR coordenado, nunca como
  merges automáticos independentes.
- PR automático atrás da `main` ou superado deve receber destino explícito;
  não pode permanecer aberto como backlog sem dono.
- Antes de liberar Mobile: zero alerta crítico/alto sem exceção formal, build
  suportado, Expo Doctor, typecheck, testes offline e revisão de permissões.
