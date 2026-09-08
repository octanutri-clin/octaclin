# Relatorio de triagem Semgrep — SQ-3

Data: 2026-09-08  
Repositorio: `octanutri-clin/octaclin`  
Base analisada: `ee9cfedfb731b0a9a2b5fd7c5eeed07db74c437c`

## Resumo executivo

A recaptura sanitizada da `main` registrou tres alertas Semgrep: `#76`, `#82`
e `#83`. A leitura de fonte, controles e sink refutou as tres descricoes de
explorabilidade. Mesmo assim, o SQ-3 remove as construcoes alertadas sem
supressao e adiciona uma regressao negativa no unico caminho de producao.

O inventario do SQ-0 permanece como fotografia historica dos 240 alertas
abertos naquele momento. Este relatorio e a evidencia atual da triagem; o
fechamento dos tres alertas depende do SARIF do GitHub sobre a branch e depois
sobre a `main`.

## Alerta #76 — path traversal em teste de migrations

- Regra:
  `javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal`.
- Fonte: nomes retornados por `readdirSync` para a pasta fixa
  `join(__dirname, 'migracoes')`.
- Sink alertado: `readFileSync(join(pasta, arquivo), 'utf8')` em
  `opcoes-typeorm.spec.ts`.
- Entrada controlavel: inexistente. O codigo roda somente no Jest e enumera a
  propria pasta versionada de migrations.
- Disposicao: refutado como vulnerabilidade exploravel.
- Alteracao: o teste deriva o nome esperado da classe pelo contrato estrito
  `<timestamp>-<NomeClasse>.ts` e deixa de abrir um caminho dinamico. Um nome
  fora do contrato falha fechado.
- Cobertura preservada: a lista de nomes derivados continua sendo comparada
  por igualdade com todas as classes registradas pelo TypeORM.

## Alerta #82 — prototype pollution em leitura de payload

- Regra:
  `javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop`.
- Fonte: `mensagem.payload`, que pode conter dados recebidos do WhatsApp.
- Sink alertado: leitura `(atual as Record<string, unknown>)[chave]` dentro de
  um laco.
- Alcance real: o unico chamador fornecia o caminho constante
  `ultimoStatusMeta.recipientId`; a funcao apenas lia valores e nunca atribuía
  propriedades. Nao existia sink de poluicao de prototipo.
- Disposicao: refutado como prototype pollution, com endurecimento preventivo.
- Alteracao: o leitor generico foi substituido por funcao especifica que aceita
  apenas objeto nao-array e exige `recipientId` como propriedade propria.
- Regressao negativa: um `recipientId` disponivel apenas no prototipo nao pode
  associar uma mensagem a paciente.
- Evidencia TDD RED: antes da alteracao, o teste esperou
  `mensagensAtualizadas === 0` e recebeu `1`.
- Evidencia TDD GREEN: os tres arquivos focados passaram com 39 testes.

O RED demonstra um endurecimento de fronteira real, mas nao reclassifica o
alerta original como prototype pollution: nao houve escrita em prototipo. O
risco evitado e usar propriedade herdada como identificador de associacao.

## Alerta #83 — chave HMAC literal em fixture Jest

- Regra:
  `javascript.lang.security.audit.hardcoded-hmac-key.hardcoded-hmac-key`.
- Fonte: literal sintetico dentro de `processador-webhooks.spec.ts`.
- Sink: `createHmac` no mesmo teste, usado para recalcular a assinatura
  esperada.
- Entrada controlavel e alcance de producao: inexistentes; o valor nao era
  credencial e nao era importado pelo codigo da aplicacao.
- Disposicao: refutado como segredo real.
- Alteracao: a fixture gera 32 bytes aleatorios localmente e usa o mesmo valor
  no mock e na assercao, preservando a prova criptografica sem literal.

## Residuos sem patch

Os alertas Dependabot `#35` e `#36` para `image-size`, ambos no lockfile
Mobile, continuam abertos: os advisories nao publicam versao corrigida. A
excecao `SC-2026-005`, sua data de revisao e o Mobile NO-GO permanecem como
controles. Nao houve supressao ou tentativa de forcar encerramento.

## Evidencia local

- RED focado: 1 teste falhou como esperado, com
  `mensagensAtualizadas` recebido `1` em vez de `0`.
- GREEN focado: 3 suites e 39 testes passaram.
- Suite completa do backend: 175 suites e 1.589 testes passaram; 4 suites e 37
  testes de integracao ficaram `SKIPPED` por dependencias externas.
- Typecheck e build do backend passaram; o artefato `dist/main.js` foi
  validado.
- Matriz de confiabilidade, triagem historica e inventario passaram.
- Validacao documental, scanner local de secrets e `git diff --check`
  passaram.
- Semgrep local: `SKIPPED`, pois Semgrep e Docker nao estao instalados nesta
  maquina. O workflow do PR e o gate autoritativo.

## Criterio de fechamento

- testes focados, suite completa, typecheck, build, documentacao, secrets e
  `git diff --check` verdes;
- workflow Semgrep verde e sem resultados nos tres caminhos;
- demais scanners sem regressao;
- revisao humana e merge;
- recaptura da `main` confirmando o fechamento automatico dos alertas `#76`,
  `#82` e `#83`.

Qualquer resultado novo ou persistente permanece aberto para nova analise; um
check verde isolado nao substitui a leitura dos resultados SARIF.
