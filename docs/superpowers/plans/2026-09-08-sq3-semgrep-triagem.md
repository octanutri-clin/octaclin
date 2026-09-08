# SQ-3 — triagem e eliminacao dos alertas Semgrep

## Objetivo

Eliminar os tres alertas Semgrep restantes com alteracoes pequenas e
verificaveis, preservando a intencao dos testes e endurecendo a leitura de
payloads WhatsApp sem dispensas manuais nem supressoes no codigo.

## Estado observado no mesmo ciclo

- Base: `main` no merge `ee9cfed` do PR `#213`.
- Recaptura sanitizada apos o merge: 216 Code Scanning, 2 Dependabot e 0
  Secret Scanning, totalizando 218 alertas abertos.
- Distribuicao do Code Scanning: 20 web, 20 backend, 173 IA e 3 Semgrep.
- Alertas Semgrep:
  - `#76`: caminho dinamico em teste de registro de migrations;
  - `#82`: leitura generica de caminho aninhado em payload WhatsApp;
  - `#83`: segredo HMAC sintetico e literal em teste Jest.
- Os dois alertas Dependabot de `image-size` permanecem abertos porque nao ha
  versao corrigida publicada.

## Classificacao e decisao

### Alerta #76

Refutado como path traversal exploravel: o nome vem de `readdirSync` sobre a
pasta de migrations determinada por `__dirname`, dentro de um teste Jest. Nao
ha entrada de requisicao nem caminho de producao. O teste sera simplificado
para derivar o nome esperado da classe a partir do contrato estrito do nome do
arquivo, removendo a leitura por caminho dinamico sem perder a prova de que
toda migration foi registrada.

### Alerta #82

Refutado como prototype pollution: o laco somente le propriedades e o unico
chamador fornece um caminho constante; nao existe atribuicao ao objeto nem
sink de escrita em prototipo. A abstracao generica sera removida mesmo assim.
Uma funcao especifica lera somente `ultimoStatusMeta.recipientId` como
propriedade propria, impedindo que valor herdado seja usado para associar uma
mensagem a um paciente.

### Alerta #83

Refutado como segredo real: a string existe somente numa fixture Jest e
representa simultaneamente a saida do mock e a entrada usada para calcular a
assinatura esperada. A fixture passara a gerar o valor com `randomBytes`,
mantendo a verificacao criptografica sem literal semelhante a credencial.

## TDD e implementacao

### RED

- Adicionar regressao que fornece `recipientId` somente pelo prototipo de
  `ultimoStatusMeta`.
- Provar que a implementacao atual associa indevidamente essa mensagem.

### GREEN

- Substituir o leitor generico por leitura especifica e fail-closed de
  propriedade propria.
- Fazer a regressao passar.
- Remover o caminho dinamico do teste de migrations.
- Substituir o segredo literal do teste de webhook por valor aleatorio local.

## Evidencia versionada

Um relatorio SQ-3 registrara, para cada alerta, fonte, sink, alcance, decisao e
controle adotado. O codigo nao recebera `nosemgrep`, exclusao de regra nem
comentario de supressao. A ausencia dos resultados no SARIF apos o merge sera
a evidencia de fechamento no GitHub.

## Gates locais

- testes focados dos tres arquivos alterados;
- suite completa do backend;
- `pnpm --dir octaclin-backend typecheck`;
- `pnpm --dir octaclin-backend build`;
- `pnpm validate:docs`;
- `pnpm security:secrets`;
- `git diff --check`.

## Gates da PR

- CI, CodeQL, Semgrep, Trivy e Dependency Review verdes;
- zero resultado Semgrep nos tres caminhos alterados;
- os 213 resultados Trivy devem permanecer inalterados;
- os dois alertas Dependabot sem patch permanecem abertos;
- revisao e threads resolvidas;
- merge humano;
- recaptura pos-merge esperada: 213 Code Scanning, 2 Dependabot e 0 Secret
  Scanning, totalizando 215 alertas abertos.

## Risco e rollback

Risco R2: a leitura mais estrita pode deixar de associar payload que dependa de
propriedade herdada. Isso e desejavel para dados recebidos e e coberto pela
regressao negativa, enquanto payloads JSON normais continuam com propriedades
proprias. O rollback e reverter os commits do SQ-3; nao ha alteracao de schema,
provider, ambiente nem dado persistido.

## Fora de escopo

- dispensar alertas manualmente;
- alterar regras ou configuracao do Semgrep;
- atualizar dependencias;
- tratar os achados Trivy sem versao corrigida;
- alterar deploy ou producao.
