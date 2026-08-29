# Relatorio de seguranca - PR 39

Data: 2026-08-29
Risco: R5
Escopo: transporte (TLS PostgreSQL) e criptografia de dados sensiveis
Branch: `security/governanca-pr39-transporte-criptografia`
Base: `origin/main` em `d0f8ca6` (merge do PR GitHub `#160`, que integrou o PR 38)

Nenhum banco, provider, secret real, PHI ou PII foi acessado. Nenhuma migration,
recriptografia ou rotacao foi executada. Nao houve acesso a Neon nem alteracao de
variavel no Render.

## 1. Vulnerabilidades comprovadas

### 1.1 Verificacao TLS desabilitada na conexao com o PostgreSQL

Confirmada no codigo antes deste PR, em
`octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`:

```
ssl: process.env.BANCO_SSL === 'true' || sslMode === 'require' ? { rejectUnauthorized: false } : false
```

Os dois caminhos de conexao (por `DATABASE_URL` e por `BANCO_*`) enviavam
`rejectUnauthorized: false`. O canal era cifrado, porem sem validacao de cadeia
nem de hostname: qualquer certificado apresentado pelo endpoint era aceito.

- Classe: CWE-295 (Improper Certificate Validation).
- Fonte: configuracao de ambiente do runtime de producao.
- Sink: handshake TLS do driver `pg`.
- Pre-condicao para exploracao: posicao ativa no caminho de rede entre o runtime
  (Render) e o banco (Neon) — DNS, BGP, proxy intermediario ou endpoint
  substituido por configuracao errada.
- Efeito: leitura e modificacao de todo o trafego SQL, incluindo credencial de
  banco, ciphertext, hashes de indice e dado clinico em claro nas colunas nao
  cifradas.
- Mitigacoes que existiam antes: nenhuma no cliente. TLS sem verificacao nao
  autentica o servidor.

A prova esta em `ssl-postgres.handshake.spec.ts`: contra um servidor TLS
apresentado por uma CA diferente da esperada, a configuracao deste PR falha o
handshake (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), e falha tambem quando o hostname
nao confere. A configuracao legada aceitava ambos os casos, porque
`rejectUnauthorized: false` desativa exatamente essas duas verificacoes.

### 1.2 Chave de criptografia sintetica usada como fallback silencioso

`CriptografiaDadosSensiveis` usava, quando `CRIPTOGRAFIA_CHAVE_AES_256` estava
ausente, a constante `'octaclin-chave-local-desenvolvimento'`, presente no
repositorio. O bootstrap so exigia a variavel quando `NODE_ENV === 'production'`.

- Classe: CWE-321 (Use of Hard-coded Cryptographic Key).
- Efeito: qualquer ambiente que carregue dado real sem `NODE_ENV=production`
  — staging, um worker mal configurado, um restore — cifra com material publico,
  o que equivale a nao cifrar.

### 1.3 Ausencia de validacao estrutural e de dado autenticado adicional

O formato legado `[IV][TAG][CIPHERTEXT]` era fatiado por deslocamento fixo antes
de qualquer verificacao de tamanho. Um valor truncado produzia erro do OpenSSL
com mensagem distinta por causa (IV invalido, tag invalida, tag ausente), o que
serve como oraculo de formato. Nao havia versao, key-id nem AAD: nao existia
caminho de rotacao nem deteccao de troca de chave.

Nao foi encontrado, e nao e afirmado, nenhum caminho de recuperacao de texto
claro contra o AES-256-GCM em si. O IV de 12 bytes e aleatorio por escrita e a
tag e verificada; o problema era de governanca de chave e de formato, nao do
algoritmo.

### 1.4 Mesma chave-base para cifra e para o indice HMAC

`sha256(CRIPTOGRAFIA_CHAVE_AES_256)` era usada diretamente como chave AES **e**
como chave-mae do HMAC do indice cego de busca. Sem separacao de finalidade,
comprometer ou rotacionar uma funcao arrasta a outra.

## 2. Formato legado e formato novo

| | Legado (ate o PR 39) | v1 (a partir do PR 39) |
| --- | --- | --- |
| Layout | `[IV(12)][TAG(16)][CIPHERTEXT]` | `[0x01][len(keyId)=8][keyId(8)][IV(12)][TAG(16)][CIPHERTEXT]` |
| Overhead | 28 bytes | 38 bytes |
| Versao | ausente | byte 0 |
| Identificacao de chave | ausente | key-id de 8 caracteres hex |
| AAD | ausente | cabecalho completo (versao + tamanho + key-id) |
| Chave AES | `sha256(chave_base)` | `HMAC-SHA256(sha256(chave_base), "octaclin-cifra-aes-256-gcm-v1")` |
| Tamanho da tag | implicito (padrao do Node) | fixo em 16 bytes na estrutura e em `authTagLength` |
| Escrita | nunca mais | unico formato escrito |
| Leitura | mantida | mantida |

O key-id e `HMAC-SHA256(chave_de_cifra, "octaclin-key-id-v1")` truncado em 8
caracteres hex. Ele identifica a chave sem revelar material: e uma imagem de MAC
da chave derivada, nao um prefixo dela.

Como o cabecalho inteiro entra como AAD, adulterar a versao ou o key-id invalida
a tag. O payload nunca e interpretado antes da autenticacao.

## 3. Compatibilidade demonstrada

- `descriptografar` tenta primeiro o envelope v1 (apos validacao estrutural) e
  depois o formato legado. Ambos os caminhos sao autenticados; falha nos dois
  produz um unico erro generico.
- Um ciphertext legado cujo primeiro byte seja `0x01` por acaso e descartado pela
  validacao de estrutura (tamanho do key-id, alfabeto hex, tamanho minimo). Se
  ainda assim passasse, a tag GCM reprovaria e a leitura cairia no caminho
  legado.
- O indice cego nao mudou: sem `CRIPTOGRAFIA_CHAVE_INDICE_HMAC`, a derivacao
  permanece byte a byte identica a anterior. O teste
  `mantem o indice HMAC identico ao formato ja gravado` recalcula o hash pela
  formula antiga e compara com a saida atual. Nenhum indice deterministico ja
  gravado foi invalidado.
- `gerarHashBusca` (lookup de email no login) nao foi alterado. Ver riscos
  residuais.

## 4. Arquivos alterados

Novos:

- `octaclin-backend/src/infraestrutura/seguranca/ambiente-execucao.ts`
- `octaclin-backend/src/infraestrutura/seguranca/ambiente-execucao.spec.ts`
- `octaclin-backend/src/infraestrutura/seguranca/criptografia-envelope.spec.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/ssl-postgres.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/ssl-postgres.spec.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/ssl-postgres.handshake.spec.ts`
- `docs/governance/RELATORIO_SEGURANCA_PR39_2026-08-29.md`

Alterados:

- `octaclin-backend/src/infraestrutura/seguranca/criptografia-dados-sensiveis.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts`
- `octaclin-backend/src/main.ts`
- `octaclin-backend/src/main.spec.ts`
- `octaclin-backend/.env.example`
- `VARIAVEIS_AMBIENTE.md`
- `RUNBOOK_PRODUCAO.md`
- `MATRIZ_CONFIABILIDADE_TESTES.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`

Nenhuma migration foi criada. O formato v1 e mais longo que o legado, mas as
colunas envolvidas sao `bytea` sem limite declarado, entao nao ha DDL a aplicar.

## 5. Testes positivos e negativos

Metodo: RED antes da implementacao (4 suites falhando, 3 delas por modulo
inexistente e 10 asserts de criptografia reprovando), GREEN depois.

TLS, resolucao de configuracao (`ssl-postgres.spec.ts`):

- positivos: `BANCO_SSL=true` e `sslmode=require` produzem `rejectUnauthorized: true`;
  CA explicita inline e por arquivo; `servername` explicito; ausencia de TLS
  quando nada o exige; `verify-full` aceito em producao.
- negativos: `BANCO_SSL` fora de `true`/`false`; `sslmode` desconhecido; CA que
  nao e PEM; arquivo de CA ilegivel; CA declarada em duas fontes; `sslmode`
  permissivo (`allow`, `prefer`, `disable`) em staging/producao; TLS ausente em
  staging/producao.
- invariante: uma matriz de sete combinacoes de ambiente, incluindo uma
  tentativa de reativar o antigo opt-in inseguro, confirma que nenhuma
  configuracao produzida pelo modulo entrega verificacao desligada.

TLS, handshake real (`ssl-postgres.handshake.spec.ts`, CA e certificados
sinteticos gerados em tempo de execucao, validos por um dia, fora do
repositorio):

- positivo: certificado emitido pela CA confiavel, com SAN compativel, e aceito
  (`authorized === true`).
- negativos: servidor apresentado por CA incorreta; hostname incompativel
  (`ERR_TLS_CERT_ALTNAME_INVALID`); ausencia de CA declarada com certificado fora
  do armazenamento padrao.
- a demonstracao original, que reconstruia a configuracao insegura para mostrar
  o handshake completando contra o servidor intruso, foi substituida no hotfix
  descrito na secao 13: reconstruir aquele padrao dentro do PR que o remove
  reintroduzia o achado que os scanners bloqueiam. A recusa efetiva do servidor
  intruso continua provada pelos casos negativos acima.

Criptografia (`criptografia-envelope.spec.ts`):

- positivos: envelope v1 com versao, key-id hex, IV de 12 bytes e tag de 16;
  ida e volta do texto; IV distinto entre escritas do mesmo texto; string vazia e
  multibyte; ciphertext legado ainda legivel; dual-read na rotacao (formato novo
  e legado); default sintetico funcional fora de staging/producao.
- negativos: adulteracao em versao, key-id, IV, tag e conteudo; payload de 0, 1,
  10, 27 e 37 bytes; envelope truncado apos cabecalho valido; ciphertext legado
  adulterado no conteudo e na tag; leitura sem a chave anterior declarada;
  ausencia de chave em staging e producao; chave curta em producao; chave
  anterior invalida em producao; mensagem de erro sem conteudo, sem material de
  chave e sem o ciphertext.
- separacao de finalidade: a chave crua `sha256(base)` **nao** decifra o formato
  novo; a chave derivada por rotulo decifra; o indice permanece identico ao
  formato ja gravado; `CRIPTOGRAFIA_CHAVE_INDICE_HMAC` muda o indice sem afetar a
  cifra.

Ambiente (`ambiente-execucao.spec.ts`): mapeamento de `APP_AMBIENTE`, fallback por
`NODE_ENV`, recusa de valor desconhecido e regra de falha fechada.

Bootstrap (`main.spec.ts`): chave curta e chave anterior igual a atual derrubam a
inicializacao em producao.

TypeORM (`opcoes-typeorm.spec.ts`): `sslmode=require` agora resolve para
`rejectUnauthorized: true`; `sslmode=prefer` em producao impede a inicializacao.

## 6. Resultado dos gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| RED focado | `npx jest` nas 4 suites novas, antes da implementacao | FAIL esperado: 4 suites, 10 testes |
| GREEN focado | idem, apos a implementacao | PASS: 9 suites, 106 testes |
| Suite completa do backend | `pnpm --dir octaclin-backend test` | PASS: 153 suites, 1118 testes; 2 suites e 5 testes skipped |
| Typecheck | `pnpm --dir octaclin-backend typecheck` | PASS |
| Build | `pnpm --dir octaclin-backend build` | PASS, artefato `dist/main.js` validado |
| Lint | — | NA: o repositorio nao tem script de lint no backend nem configuracao ESLint |
| Confiabilidade | `pnpm test:confiabilidade` | PASS: 16 referencias criticas |
| Triagem de seguranca | `pnpm test:triagem-seguranca` | PASS: 5 testes |
| Workflows sem injecao | `pnpm test:workflows-seguros` | PASS |
| Actions imutaveis | `pnpm test:actions-imutaveis` | PASS |
| Scanner de secrets | `pnpm security:secrets` | PASS: nenhum secret identificado |
| Teste do scanner | `pnpm test:security` | PASS |
| `git diff --check` | — | PASS |
| CodeQL, Semgrep, Trivy | workflows do PR | Pendente: executam no PR, resultado deve ser lido no GitHub |
| RLS com testcontainers | `pnpm --dir octaclin-backend test:rls:testcontainers` | SKIPPED: exige Docker, ausente neste ambiente. Nao foi tocado por este PR |
| Redis real | `pnpm --dir octaclin-backend test:abuso:redis-real` | SKIPPED: exige Redis descartavel, ausente neste ambiente. Roda no CI |
| Preflight PowerShell | `pnpm validate` | SKIPPED: os scripts sao `.ps1` e o ambiente e Linux sem PowerShell |

As duas suites skipped da suite completa sao as integracoes pre-existentes de
Redis e de RLS, que exigem Docker. Nenhuma delas foi alterada por este PR.
SKIPPED nao e PASS.

## 7. Riscos residuais

1. `gerarHashBusca` continua sendo SHA-256 sem chave sobre o email normalizado.
   E o indice de lookup do login, de convites e de profissionais. Um vazamento do
   banco permite enumeracao offline de emails por dicionario. Trocar por HMAC com
   chave dedicada exige backfill coordenado de varias tabelas e nao cabe no
   escopo deste PR. Deve entrar como item proprio no PR 40 ou seguinte.
2. Nenhum dado ja gravado foi recriptografado. O parque continua sendo lido no
   formato legado ate que cada registro seja reescrito pelo fluxo normal da
   aplicacao. Nao existe, hoje, inventario de quantas linhas ainda estao no
   formato legado.
3. A separacao de finalidade da chave do indice existe como opcao
   (`CRIPTOGRAFIA_CHAVE_INDICE_HMAC`), mas por padrao o material continua sendo
   derivado da mesma chave-base, para nao invalidar os indices gravados. A
   separacao real depende do backfill descrito na secao 9.
4. As chaves vivem em variavel de ambiente do provider. Nao ha KMS, HSM nem
   envelope encryption com chave mestra externa. O key-id no formato v1 e o
   pre-requisito para isso, nao a solucao.
5. `APP_AMBIENTE` e novo e ainda nao esta configurado em nenhum ambiente. Ate que
   seja definido como `staging`, o staging continua sendo tratado pelo fallback de
   `NODE_ENV`. Ver secao 8.
6. Rollback de codigo apos escritas no formato v1 torna esses registros
   ilegiveis pela versao anterior (falha fechada, sem perda de dado). Ver secao 10.
7. Este PR nao prova o estado de producao. Prova o comportamento do codigo.

## 8. Variaveis operacionais a configurar depois do merge

Nenhuma delas foi criada, lida ou alterada neste PR. Todas exigem acao humana
separada no provider.

| Variavel | Quando | Efeito |
| --- | --- | --- |
| `APP_AMBIENTE` | Recomendada em staging e producao | Declara o ambiente real. Sem ela, `NODE_ENV=production` no Render faz staging e producao serem tratados igual |
| `BANCO_SSL_CA` ou `BANCO_SSL_CA_ARQUIVO` | Somente se o banco nao usar CA publica | Ancora explicita da cadeia. O Neon usa CA publica; a expectativa e que nao seja necessaria |
| `BANCO_SSL_SERVERNAME` | Somente com proxy/pooler cujo hostname difira do certificado | Nome usado na verificacao de hostname e no SNI |
| `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` | Somente durante uma rotacao | Habilita dual-read. Remover ao fim da janela |
| `CRIPTOGRAFIA_CHAVE_INDICE_HMAC` | Somente com backfill planejado | Separa o material do indice cego. Sem backfill, invalida a busca por PII |

Ponto de atencao para o deploy: depois deste PR, o runtime em producao **exige**
TLS. Se a `DATABASE_URL` de producao nao tiver `sslmode=require` (ou
`verify-ca`/`verify-full`) e `BANCO_SSL` nao for `true`, o processo falha ao
iniciar. Isso e intencional — falha fechada —, mas precisa ser conferido antes do
deploy. Conferir tambem que a chave `CRIPTOGRAFIA_CHAVE_AES_256` configurada tem
pelo menos 32 bytes: abaixo disso o bootstrap passa a recusar iniciar.

## 9. Rotacao e migracao do formato legado

Dual-read / new-write, sem operacao de banco:

1. Gerar a nova chave fora do repositorio e do chat.
2. Definir `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` com o valor atual.
3. Definir `CRIPTOGRAFIA_CHAVE_AES_256` com o novo valor.
4. Reiniciar. A leitura tenta a chave atual e depois a anterior; a escrita usa
   somente a atual. O key-id muda e passa a aparecer nos registros novos.
5. Recriptografar os registros antigos por procedimento deliberado e autorizado
   (nao coberto por este PR).
6. So depois de 5 remover `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR`.

Identificar o formato de um registro: o primeiro byte da coluna cifrada e `0x01`
no formato v1 e aleatorio (primeiro byte do IV) no legado. Uma contagem confiavel
precisa considerar que ~1/256 dos registros legados comecam com `0x01` por acaso;
o criterio completo e `byte[0] = 0x01 AND byte[1] = 8 AND bytes[2..9] em [0-9a-f]
AND length >= 38`. Essa consulta e leitura pura e ainda assim exige aceite humano
e ambiente identificado.

Separar o material do indice cego, quando for decidido:

1. Definir `CRIPTOGRAFIA_CHAVE_INDICE_HMAC`.
2. Executar `pnpm --dir octaclin-backend backfill:indices-busca` contra o
   ambiente alvo, com aceite humano.
3. Ate a conclusao do backfill a busca por PII fica inconsistente. Nao habilitar
   a variavel sem a janela combinada.

## 10. Rollback

Este PR nao tem migration e nao altera dados existentes.

- Rollback de codigo: reimplantar o commit anterior.
- **Nao descartar a chave legada.** `CRIPTOGRAFIA_CHAVE_AES_256` continua sendo a
  mesma variavel e o mesmo valor; o formato v1 deriva a chave de cifra a partir
  dela. Remover ou trocar a variavel no rollback torna tudo ilegivel.
- Registros gravados no formato v1 durante a janela nao sao lidos pela versao
  anterior: ela os interpreta como legado, a tag reprova e a leitura falha. E
  falha fechada, nao corrupcao — o ciphertext permanece integro e volta a ser
  legivel ao reimplantar a versao nova. `lerPayloadMensagem` ja degrada para
  metadados sem conteudo nesse caso; os demais caminhos propagam erro.
- Se o rollback precisar durar, a alternativa e reimplantar a versao nova em vez
  de recriptografar.
- Variaveis novas podem permanecer configuradas: a versao anterior as ignora.

## 11. Skills

Presentes no repositorio (`.agents/skills` e `.claude/skills`) e relevantes para
este PR: `security-review`, `test-driven-development`, `typeorm`,
`postgresql-table-design`, `nestjs-best-practices`, `database-migration`,
`requesting-code-review`.

Efetivamente carregada nesta sessao: `security-review`, aplicada sobre o diff
proprio. Ela produziu um achado que mudou o codigo — ver secao 12.

`test-driven-development` nao foi carregada como arquivo; o ciclo RED -> GREEN
foi executado com capacidade nativa e esta registrado na secao 5.
`database-migration` nao foi usada porque nenhuma migration se mostrou
necessaria. As demais nao foram carregadas.

## 12. Achado da revisao de seguranca sobre o proprio diff

A primeira versao deste PR expunha `BANCO_SSL_SERVERNAME` apenas como
`servername` nas opcoes SSL. A leitura de `pg/lib/connection.js` mostrou que
`upgradeToSSL` faz `Object.assign(options, self.ssl)` e **depois** sobrescreve
`options.servername` com o host da conexao sempre que ele nao e um IP. A
variavel seria, portanto, um no-op silencioso — exatamente o tipo de
configuracao TLS aceita sem efeito que este PR deveria eliminar.

Correcao aplicada: quando `BANCO_SSL_SERVERNAME` esta definido, a configuracao
tambem instala um `checkServerIdentity` que delega para `tls.checkServerIdentity`
do proprio Node com o nome declarado. O `pg` preserva essa funcao. O teste de
handshake passou a reproduzir a sobrescrita do `pg` antes de conectar, de modo
que a prova corresponde ao que o driver realmente executa.

Nenhum outro achado de alta confianca foi identificado no diff. Registrado como
limitacao conhecida, ja listada na secao 7: a chave-base continua sendo derivada
por um unico SHA-256 do valor da variavel de ambiente. Isso e adequado para
material de alta entropia (o formato documentado e base64 de 32 bytes) e nao
para uma senha escolhida por pessoa; a validacao de tamanho minimo em
staging/producao reduz, mas nao elimina, esse risco.

## 13. Hotfix dos alertas de scanner abertos pelo proprio PR

O primeiro push do PR 39 (`bee645f`) reprovou dois checks de code scanning:

- **CodeQL**: 2 alertas novos, ambos de severidade alta;
- **Semgrep OSS**: 18 alertas novos, sendo 3 errors e 15 warnings.

Os checks so publicam contagem e anotacoes. Para triar com evidencia
reproduzivel em vez de leitura de tela, o Semgrep foi executado localmente com o
repositorio de regras publico (`semgrep/semgrep-rules`, commit `40b8c63`), ja
que a rede desta sessao nao alcanca `semgrep.dev` para resolver `--config auto`.

Depois do hotfix, os threads de review do `github-advanced-security` foram
resolvidos automaticamente e passaram a expor a lista completa, que confirma a
triagem e corrige duas atribuicoes feitas antes por inferencia. Distribuicao
real dos 20 alertas:

| Ferramenta | Regra | Qtd | Arquivo |
| --- | --- | --- | --- |
| CodeQL | Disabling certificate validation | 1 | `ssl-postgres.ts` |
| CodeQL | Disabling certificate validation | 1 | `ssl-postgres.handshake.spec.ts` |
| Semgrep | `gcm-no-tag-length` (ERROR) | 1 | `criptografia-dados-sensiveis.ts` |
| Semgrep | `gcm-no-tag-length` (ERROR) | 2 | `criptografia-envelope.spec.ts` |
| Semgrep | `bypass-tls-verification` (WARNING) | 3 | `ssl-postgres.ts`, `ssl-postgres.spec.ts`, `ssl-postgres.handshake.spec.ts` |
| Semgrep | `path-join-resolve-traversal` (WARNING) | 12 | `ssl-postgres.handshake.spec.ts` |

Duas correcoes em relacao ao que este relatorio afirmava antes de a lista estar
disponivel:

1. `detect-non-literal-fs-filename` **nao** estava no conjunto `auto` do CI. Ela
   apareceu somente na reproducao local, onde as regras de `javascript/` foram
   carregadas por inteiro. Os 15 warnings do CI eram 3 de
   `bypass-tls-verification` e 12 de `path-join-resolve-traversal`.
2. Os 2 warnings que a reproducao local nao havia coberto eram mais ocorrencias
   de `path-join-resolve-traversal` no mesmo arquivo, nao regras diferentes. A
   reproducao local cobriu todas as classes de achado, com contagem menor dentro
   de uma delas.

### 13.1 `gcm-no-tag-length` - 3 errors (ERROR, CWE-310)

Locais: `criptografia-dados-sensiveis.ts` (producao) e duas construcoes de
decifra em `criptografia-envelope.spec.ts`.

Quando `createDecipheriv` recebe um modo GCM sem `authTagLength`, o Node aceita
qualquer tag valida para GCM: 4, 8 ou de 12 a 16 bytes. Uma tag de 4 bytes pode
ser forjada com cerca de 2^32 tentativas.

Triagem honesta: **o padrao e procedente, o caminho nao era alcancavel neste
codigo.** O envelope v1 reserva um slot fixo de 16 bytes, `lerEnvelopeVersionado`
exige o comprimento minimo que garante esse slot cheio, e `abrirGcm` recusa
explicitamente `tag.length !== 16` nos dois formatos. Nao havia como entregar uma
tag curta pela superficie de dados.

Ainda assim o alerta foi corrigido, e nao dispensado: `authTagLength: 16` passou
a ser informado em `createCipheriv` e `createDecipheriv`. A garantia deixa de
depender apenas de uma checagem manual a dezenas de linhas de distancia, que um
refactor futuro poderia remover, e passa a existir tambem na API. O valor 16 e o
padrao do GCM, entao nenhum ciphertext muda de bytes e a compatibilidade com o
formato legado e com o v1 ja gravado e integral.

Testes acrescentados: buffers de 16, 20, 24 e 26 bytes, que no layout legado
deixariam exatamente uma tag de 4, 8, 12 e 14 bytes, sao recusados.

### 13.2 `bypass-tls-verification` e os 2 alertas altos do CodeQL

Locais dos tres literais `{ rejectUnauthorized: false }` introduzidos pelo PR:
o opt-in local em `ssl-postgres.ts`, o teste que o cobria em
`ssl-postgres.spec.ts` e o teste que demonstrava a vulnerabilidade legada em
`ssl-postgres.handshake.spec.ts`.

Os 2 alertas altos do CodeQL (`Disabling certificate validation`) apontavam
`ssl-postgres.ts` e `ssl-postgres.handshake.spec.ts` — os dois contextos em que
o valor chega de fato a uma API TLS. A terceira ocorrencia, dentro de um
`toEqual`, nao e sink e nao gerou alerta do CodeQL, apenas o warning do Semgrep.
Isso foi confirmado na lista de threads resolvidos; antes era hipotese.

Correcao: **o opt-in `BANCO_SSL_PERMITIR_INSEGURO` foi removido do produto.**
Ele era uma adicao propria deste PR, nao um requisito, e existia para o caso de
laboratorio local com certificado autoassinado — caso que ja e melhor atendido
por `BANCO_SSL_CA`, que ancora a cadeia em vez de aceitar qualquer certificado.
Com a remocao, a propriedade do modulo passa a ser absoluta e mais simples de
revisar: **nao existe configuracao, em nenhum ambiente, que produza verificacao
desligada.**

O teste que demonstrava o comportamento legado tambem saiu. Reconstruir a
configuracao insegura dentro do PR que a elimina reintroduz exatamente o padrao
que o programa de hardening quer proibir, e o que ele provava era o
comportamento do Node, nao do OctaClin. No lugar entrou uma invariante, que tem
valor de regressao maior: uma matriz de sete combinacoes de ambiente — incluindo
uma tentativa explicita de reativar o antigo opt-in — confirma que toda
configuracao produzida mantem a verificacao ligada.

Nenhum padrao foi mascarado: nao ha `nosemgrep`, supressao de CodeQL nem
renomeacao para escapar de assinatura. Os literais deixaram de existir porque o
comportamento que eles expressavam deixou de existir.

### 13.3 `path-join-resolve-traversal` - 12 warnings

Todos em `ssl-postgres.handshake.spec.ts`. A regra e de taint e sua fonte e
**parametro de funcao**: `gerarAutoridade(pasta, prefixo, hostname)` recebia o
diretorio e o prefixo por parametro, e eles fluiam para `join` e para
`readFileSync`. A reproducao local, que carregou tambem
`detect-non-literal-fs-filename` (ausente do conjunto `auto`), mostrou o mesmo
fluxo pela outra ponta.

Triagem: falso positivo quanto a exploracao — os caminhos vinham de
`mkdtempSync(tmpdir())`, sem entrada externa. Mas a correcao nao precisou de
supressao: a funcao passou a criar o proprio diretorio temporario internamente e
a usar nomes de arquivo literais, e os PEMs passaram a ser lidos da saida padrao
do `openssl` em vez de `readFileSync`. Sem parametro na origem, nao ha taint, e
o teste ficou mais simples: o `openssl req -x509 -CA` do OpenSSL 3 dispensou o
CSR e o arquivo de extensoes.

### 13.4 `generic-api-key` - 1 info

`ROTULO_KEY_ID` foi renomeado para `ROTULO_IDENTIFICADOR_CHAVE`. A regra do
gitleaks casa identificadores com "key" atribuidos a string. O **valor**
`'octaclin-key-id-v1'` nao mudou, porque ele participa da derivacao do key-id:
mudar a string mudaria todos os key-ids gravados. O novo nome tambem fica
coerente com `ROTULO_CIFRA` e `ROTULO_INDICE`.

### 13.5 Resultado

Reproducao local apos o hotfix, mesmas regras e mesmos arquivos: **0 achados**
(antes: 3 errors, 13 warnings, 1 info).

Confirmado no CI sobre o head `0f228d0`: **CodeQL e Semgrep OSS passaram com 0
alertas novos**, os 20 threads do `github-advanced-security` foram resolvidos
automaticamente, e os 15 checks do PR ficaram verdes com `mergeable_state`
`clean`. Nenhuma migration, recriptografia ou operacao em provider foi executada
no hotfix. A variavel
`BANCO_SSL_PERMITIR_INSEGURO` deixou de existir e foi removida de
`.env.example`, `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md`.
