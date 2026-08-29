# Relatorio de seguranca - PR 40

Data: 2026-08-29
Risco: R4
Escopo: sessoes, JWT e rotacao de refresh token
Branch: `security/governanca-pr40-sessoes-tokens`
Base: `origin/main` em `94235ee` (merge do PR GitHub `#161`, que integrou o PR 39)

Nenhum banco, provider, secret real, PHI ou PII foi acessado. Nenhuma migration
foi executada contra Neon, staging ou producao. Nenhuma variavel foi alterada no
Render. Todos os dados usados em teste sao sinteticos.

## 1. Vulnerabilidades comprovadas

Todas confirmadas por leitura do codigo em `94235ee`, antes de qualquer
alteracao.

### 1.1 Fallback publico de segredo JWT, com o mesmo material para os dois tokens

`servico-auth.ts` e `guarda-jwt.ts` usavam, quando a variavel estava ausente:

```
secret: process.env.JWT_SEGREDO ?? 'dev-access-secret'
secret: process.env.JWT_REFRESH_SEGREDO ?? process.env.JWT_SEGREDO ?? 'dev-refresh-secret'
```

- Classe: CWE-321 (Use of Hard-coded Cryptographic Key) e CWE-798.
- O bootstrap so exigia as variaveis quando `NODE_ENV === 'production'`. Em
  staging — que no Render herda `NODE_ENV=production`, mas em qualquer outro
  runtime mal configurado nao — o processo subia assinando com uma constante
  presente no repositorio publico. Quem le o repositorio forja um access token de
  SuperAdmin de qualquer tenant.
- A cadeia `JWT_REFRESH_SEGREDO ?? JWT_SEGREDO` significava que, com apenas uma
  variavel configurada, access e refresh compartilhavam material. Um access token
  vazado em log, referer ou telemetria valia como refresh token.

### 1.2 Verificacao de JWT restrita a assinatura e expiracao

`GuardaJwt` chamava `verifyAsync(token, { secret })` sem mais nada, e usava
`payload.sub`, `payload.tenantId`, `payload.papel` e `payload.permissoes`
diretamente.

- Classe: CWE-347 (Improper Verification of Cryptographic Signature) e
  CWE-345.
- Consequencias verificadas no codigo original:
  - **sem `algorithms`**: a lista de algoritmos aceitos ficava com o padrao do
    `jsonwebtoken`, que aceita a familia inteira. Um token `HS512` assinado com o
    mesmo segredo era aceito;
  - **sem `issuer`/`audience`**: nenhum token declarava `iss` nem `aud`, entao
    nao havia como distinguir um token do OctaClin de um token de qualquer outro
    sistema que viesse a compartilhar o segredo;
  - **sem claim de tipo**: access e refresh tinham payload identico. Com 1.1, um
    refresh token era aceito como access token;
  - **sem validacao de claims**: `papel` vinha do token sem conferencia contra o
    catalogo, e `permissoes` era aceito como array arbitrario do proprio token.

### 1.3 Rotacao sem uso unico, sem atomicidade e sem deteccao de reuso

`renovar` fazia `findOne` do token, checava `revogadoEm`/`expiraEm` em memoria,
marcava `revogadoEm` e salvava.

- Classe: CWE-367 (TOCTOU) e CWE-613 (Insufficient Session Expiration).
- Entre o `findOne` e o `save` havia uma janela: duas renovacoes concorrentes do
  mesmo token liam a mesma linha nao revogada e emitiam **dois** descendentes
  validos, cada um em sua propria familia viva.
- Reusar um refresh token ja revogado devolvia 401 e parava ali. Um token
  roubado e ja usado pelo atacante nao acionava nenhuma resposta: a familia
  continuava valida, e o par legitimo e o atacante coexistiam ate a expiracao de
  30 dias.

### 1.4 Logout e revogacao sem alcance real

- `revogar` marcava somente a linha do `tokenHash` apresentado. O descendente
  emitido na ultima rotacao continuava valido.
- Nao havia consulta de estado de sessao no caminho autenticado. Access tokens
  emitidos antes da revogacao continuavam sendo aceitos por qualquer instancia
  ate expirarem, sem qualquer registro. Nao existia listagem nem encerramento de
  sessoes.
- Classe: CWE-613.

### 1.5 Redefinicao de senha nao encerrava as sessoes abertas

`ServicoRecuperacaoSenha.redefinirSenha` trocava o `senhaHash` e marcava o token
de redefinicao como usado. Nada mais.

- Classe: CWE-613 (Insufficient Session Expiration).
- Quem ja tinha uma sessao aberta com a senha antiga — inclusive um atacante com
  refresh token roubado — continuava dentro depois que a vitima redefinia a
  senha. A troca de senha, que e a acao de recuperacao mais comum depois de uma
  suspeita de comprometimento, nao produzia efeito nenhum sobre o acesso do
  atacante.
- Encontrado na revisao de seguranca do proprio diff deste PR, ao verificar
  todos os caminhos que emitem ou deveriam encerrar sessao.

### 1.6 Duracao informada ao cliente desconectada da configuracao

`emitirParTokens` devolvia `expiraEmSegundos: 15 * 60` fixo, enquanto a
assinatura usava `JWT_EXPIRA_EM`. Com `JWT_EXPIRA_EM=5m`, o BFF gravava o cookie
de access token com 900 s de validade para um token que morria em 300 s, e so
renovava depois que o backend ja tinha recusado a requisicao.

## 2. Modelo de sessao e familia

Uma **sessao** e a familia de refresh tokens criada por um login. Ela existe como
linha propria em `sessoes_usuario`, e nao como agrupamento derivado de
`refresh_tokens`, por dois motivos concretos: revogar a familia inteira passa a
ser uma escrita em uma linha, e o guarda precisa de uma leitura indexada por
chave primaria por requisicao em vez de um agregado.

| Conceito | Onde vive | Observacao |
| --- | --- | --- |
| Sessao / familia | `sessoes_usuario.id` | Viaja nos tokens como claim `sid` |
| Token individual | `refresh_tokens.token_hash` | Somente SHA-256 do token; nunca o token |
| Identidade do token | claim `jti` | Novo a cada emissao, para access e refresh |
| Referencia exposta na API | derivada | `HMAC-SHA256(JWT_SEGREDO, "octaclin-referencia-sessao-v1:<id>")`, 32 hex |

A referencia publica existe porque a API precisa de um identificador enderecavel
para "encerrar esta sessao" sem devolver ao navegador o `sid` que viaja dentro do
token. Ela e imagem de um MAC com rotulo de finalidade: identifica a linha sem
revelar material. Nao ha coluna nova para isso — o casamento e feito comparando a
referencia contra as sessoes do proprio usuario, que sao poucas e ja estao
filtradas por tenant e usuario.

`familia_token`, coluna que ja existia, passa a receber o mesmo valor de
`sessao_id`. Ela permanece porque remover uma coluna `not null` em uso seria
destrutivo e esta fora do escopo de uma migration aditiva.

### Claims

| Claim | Access | Refresh |
| --- | --- | --- |
| `sub`, `tenantId`, `sid`, `jti`, `tipo`, `iat`, `exp` | sim | sim |
| `papel`, `emailHash`, `permissoes` | sim | **nao** |
| `iss`, `aud` | sim | sim |
| algoritmo | HS256 fixo | HS256 fixo |
| segredo | `JWT_SEGREDO` | `JWT_REFRESH_SEGREDO` |

O refresh token nao carrega papel nem permissoes de proposito: ele so precisa
apontar para a sessao, e papel e permissoes sao relidos do banco a cada rotacao.
Uma mudanca de papel deixa de ficar congelada dentro de um token de 30 dias.

`validarClaimsToken` devolve **somente** as claims conhecidas. Claim extra
injetada no payload nao chega ao contexto autenticado.

## 3. Rotacao e deteccao de reuso

O consumo do refresh token e uma unica escrita condicional dentro da transacao de
tenant:

```
update refresh_tokens set consumido_em = :agora
 where tenant_id = ... and usuario_id = ... and sessao_id = ... and token_hash = ...
   and consumido_em is null and revogado_em is null and expira_em > :agora
```

Duas renovacoes concorrentes do mesmo token disputam a mesma linha. A segunda
transacao fica bloqueada no lock de linha e, em `READ COMMITTED`, so reavalia a
condicao depois do commit da primeira — quando `consumido_em` ja nao e nulo.
`affected` volta 0 e nenhum segundo descendente e emitido.

Quando `affected` nao e 1, o servico le a linha para decidir o que aconteceu:

| Estado da linha | Interpretacao | Acao |
| --- | --- | --- |
| `consumido_em` ou `revogado_em` preenchido | reuso | revoga a familia inteira, audita, 401 |
| existe, apenas expirada | token velho | 401, familia preservada |
| nao existe | token nao pertence a este banco | 401, familia preservada |

Um token apenas expirado **nao** e tratado como roubo. Foi uma decisao explicita:
tratar expiracao como evidencia de ataque produziria revogacoes em massa sem
sinal real.

A revogacao por reuso encerra a sessao (`motivo_revogacao = 'reuso_detectado'`) e
revoga todos os refresh tokens da familia, incluindo o descendente que o atacante
ou o par legitimo acabou de receber. A auditoria grava
`auth.sessao.reuso_detectado` com o id da sessao e a marca de deteccao — sem
token, sem hash, sem material derivado.

**Politica documentada para a corrida legitima.** Uma renovacao concorrente real
— duas requisicoes do mesmo navegador chegando juntas — cai nesta mesma regra e
encerra a sessao. Isso e o que o escopo do PR pediu ("a reutilizacao deve revogar
a familia conforme politica documentada") e e a recomendacao do OAuth 2.0
Security BCP. O custo e um logout ocasional; a alternativa (janela de tolerancia)
enfraquece exatamente a deteccao que este PR existe para criar. Ver riscos
residuais.

## 4. Access token depois da revogacao

O escopo pedia explicitamente para nao declarar logout global enquanto access
tokens continuassem aceitos em silencio. A menor solucao segura e comprovavel
foi implementada: `GuardaJwt` consulta `sessoes_usuario` a cada requisicao
autenticada, por chave primaria, dentro do contexto de tenant.

- Custo: uma leitura indexada por requisicao, no mesmo padrao transacional que a
  aplicacao ja usa para respeitar RLS.
- Beneficio: a revogacao vale imediatamente, inclusive para access tokens que
  ainda nao expiraram, e vale **entre instancias**, porque a fonte de verdade e o
  Postgres e nao estado em memoria.
- Provado em `sessoes-rotacao.integracao.spec.ts`: a instancia A faz logout, e a
  instancia B — outra `DataSource`, sem nada compartilhado alem do banco —
  recusa o access token que aceitava um instante antes.

Nao foi usado cache em processo: um cache reintroduziria exatamente a janela de
staleness que o teste acima existe para eliminar.

### Redefinicao de senha

`redefinirSenha` passa a chamar `ServicoSessoes.revogarTodas` depois que a
transacao de troca de senha confirma, com motivo `senha_redefinida`. Todas as
sessoes vivas do usuario caem, incluindo os access tokens ainda nao expirados,
pela mesma leitura de sessao do guarda. A chamada fica fora da transacao de
proposito: uma falha na revogacao nao deve reverter uma senha ja trocada, e o
escopo por tenant e usuario ja garante que nada alem do parque do proprio usuario
e afetado. Se a redefinicao falha, nenhuma sessao e tocada.

## 5. Migration e RLS

`1720000001036-CriarSessoesUsuario`, o proximo numero realmente disponivel apos
`1720000001035`.

Aditiva:

- cria `sessoes_usuario` com `unique (tenant_id, id)`, FK composta para
  `usuarios (tenant_id, id)` com `on delete cascade`, `check` do vocabulario de
  `motivo_revogacao` (`logout`, `encerrada_pelo_usuario`, `encerrada_outras`,
  `reuso_detectado`, `senha_redefinida`) e `check` de coerencia entre
  `revogado_em` e o motivo;
- `enable` e `force row level security` mais policy `isolamento_tenant_sessoes_usuario`
  por `app.tenant_id`, no mesmo formato das demais tabelas;
- `alter table refresh_tokens add column if not exists sessao_id uuid` e
  `consumido_em timestamptz`, ambas anulaveis, com FK composta
  `(tenant_id, sessao_id)`;
- indices `idx_sessoes_usuario_ativas` (tenant, usuario, revogacao, expiracao),
  `idx_refresh_tokens_sessao` (familia/sessao) e `idx_refresh_tokens_ativos`
  (parcial, tokens nao consumidos e nao revogados).

Nao remove coluna, nao recria tabela, nao apaga linha. Os refresh tokens ja
gravados permanecem com `sessao_id` e `consumido_em` nulos e expiram por
`expira_em`. Nenhum token em claro entra no banco: `refresh_tokens.token_hash`
continua sendo SHA-256 do token, e `sessoes_usuario` nao tem coluna de token,
hash, IP ou user-agent.

`down` desfaz exatamente o que criou, na ordem inversa, sem tocar em
`refresh_tokens` alem das duas colunas e da FK que adicionou.

**Nenhuma migration foi aplicada em Neon, staging ou producao.** O `up`/`down`
so foi exercitado pelo teste de SQL e roda em Postgres real no CI.

### Privacidade

`sessoes_usuario` guarda apenas `criado_em`, `ultima_atividade_em`, `expira_em`,
`revogado_em` e `motivo_revogacao`. IP e user-agent nao sao persistidos: eles
melhorariam o reconhecimento visual de um acesso estranho, mas sao dado pessoal
adicional cujo beneficio nao justificou a coleta neste PR. Fica registrado como
decisao, nao como esquecimento.

`ultima_atividade_em` e atualizado na rotacao do refresh token, nao a cada
requisicao — uma escrita por requisicao autenticada seria desproporcional. Na
pratica a granularidade e a do TTL do access token.

## 6. API e interface

Endpoints autenticados por `GuardaJwt`:

| Metodo | Rota | Efeito |
| --- | --- | --- |
| `GET` | `/auth/sessoes` | Lista somente as sessoes do proprio usuario |
| `DELETE` | `/auth/sessoes/:referencia` | Encerra uma sessao propria |
| `POST` | `/auth/sessoes/encerrar-outras` | Encerra todas menos a atual |
| `POST` | `/auth/sair` | Passa a encerrar a sessao inteira |

A listagem devolve exatamente seis campos: `referencia`, `criadaEm`,
`ultimaAtividadeEm`, `expiraEm`, `estado` (`ativa`/`revogada`/`expirada`) e
`atual`. Nao devolve id de sessao, familia, token, hash, `usuarioId` nem
`tenantId`. `referencia` e validada por `@Matches(/^[0-9a-f]{32}$/)` no DTO.

Escopo: tenant e usuario vem sempre do token, nunca do corpo ou da URL. Uma
referencia que nao pertence ao usuario autenticado devolve 404, sem distinguir
"nao existe" de "nao e sua".

BFF: `app/api/auth/sessoes/*`, tres rotas que reusam
`requisitarBackendAutenticado`, com `Cache-Control: no-store` e 401 antes de
tocar o backend quando nao ha sessao. Nenhum fluxo novo de sessao foi criado.

Interface: `/conta/sessoes`, uma pagina e um componente, alcancavel pelo menu da
conta que ja existia. Sem redesign, sem MFA, sem tocar no PR 41.
`decidirAcessoRota` passa a liberar `/conta` para qualquer papel autenticado —
paciente e cliente tambem precisam poder encerrar os proprios acessos.

Cookies do BFF permanecem HttpOnly, `SameSite=lax`, `Secure` conforme
`OCTACLIN_COOKIE_SECURE` e `path=/`. O `maxAge` do cookie de renovacao deixou de
ser 30 dias fixos e passa a acompanhar `renovacaoExpiraEmSegundos` devolvido pelo
backend; `expiraEmSegundos` passa a refletir `JWT_EXPIRA_EM` real.

## 7. Arquivos alterados

Novos (backend):

- `octaclin-backend/src/modulos/auth/dominio/claims-token.ts` e `.spec.ts`
- `octaclin-backend/src/modulos/auth/infraestrutura/configuracao-jwt.ts` e `.spec.ts`
- `octaclin-backend/src/modulos/auth/infraestrutura/sessao-usuario.orm.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-sessoes.ts` e `.spec.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/sessoes-rotacao.integracao.spec.ts`
- `octaclin-backend/src/modulos/auth/apresentacao/guarda-jwt.spec.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001036-CriarSessoesUsuario.ts` e `.spec.ts`

Novos (web):

- `octaclin-web/app/api/auth/sessoes/route.ts`
- `octaclin-web/app/api/auth/sessoes/[referencia]/route.ts`
- `octaclin-web/app/api/auth/sessoes/encerrar-outras/route.ts`
- `octaclin-web/app/conta/sessoes/page.tsx`
- `octaclin-web/components/conta/sessoes-ativas.tsx`
- `octaclin-web/scripts/sessoes-bff.spec.ts` e `octaclin-web/scripts/test-sessoes-bff.mjs`
- `octaclin-web/tests/visual/sessoes-conta.spec.mjs`

Alterados (backend):

- `src/modulos/auth/aplicacao/servico-auth.ts` e `.spec.ts`
- `src/modulos/auth/aplicacao/servico-recuperacao-senha.ts` e `.spec.ts`
- `src/modulos/auth/apresentacao/guarda-jwt.ts`
- `src/modulos/auth/apresentacao/controlador-auth.ts`
- `src/modulos/auth/aplicacao/dtos.ts`
- `src/modulos/auth/dominio/usuario-autenticado.ts`
- `src/modulos/auth/infraestrutura/refresh-token.orm.ts`
- `src/modulos/auth/modulo-auth.ts`
- `src/infraestrutura/banco-dados/opcoes-typeorm.ts`
- `src/main.ts` e `src/main.spec.ts`
- `.env.example`

Alterados (web):

- `lib/server/sessao-bff.ts`
- `lib/server/autorizacao-rotas.ts`
- `lib/auth-api.ts`
- `components/app/portal-shell.tsx`
- `scripts/autorizacao-rotas.spec.ts`
- `package.json`

Documentacao e gates:

- `docs/governance/RELATORIO_SEGURANCA_PR40_2026-08-29.md`
- `docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `MATRIZ_CONFIABILIDADE_TESTES.md` e `scripts/test-matriz-confiabilidade.mjs`
- `RUNBOOK_PRODUCAO.md`
- `VARIAVEIS_AMBIENTE.md`

## 8. TDD e testes negativos

Metodo: RED antes da implementacao, GREEN depois. O primeiro ciclo rodou com as
suites de `configuracao-jwt` e `claims-token` falhando por modulo inexistente; o
segundo, com a suite da migration; o terceiro, com `servico-sessoes`.

`configuracao-jwt.spec.ts` (17): segredo efemero por finalidade em local, ausencia
recusada em staging e em producao, segredo curto recusado, access igual a refresh
recusado, ausencia de heranca de `JWT_SEGREDO`, mensagem de erro sem material do
segredo, emissor/audiencia padrao e configuraveis, opcoes de assinatura e de
verificacao, conversao real de duracao.

`claims-token.spec.ts` (18): access aceito, refresh minimo aceito, access como
refresh recusado, refresh como access recusado, ausencia de `tipo`, ausencia e
tipo errado de `sub`/`tenantId`/`sid`/`jti`, papel fora do catalogo, papel
ausente, todos os papeis validos, `permissoes` fora do formato, `iat`/`exp`
ausentes, payload que nao e objeto, claim desconhecida descartada.

`guarda-jwt.spec.ts` (16, com `JwtService` real assinando tokens de verdade):
access valido aceito; sem Bearer; refresh como access; token assinado com o
segredo de renovacao; `alg: none` montado a mao; `HS512`; outro emissor; outra
audiencia; expirado; corpo adulterado com assinatura original; sem `sid`; sem
tenant; papel invalido; sessao revogada em outra instancia; claim desconhecida
nao propagada; segredos distintos.

`servico-auth.spec.ts` (24): protecao de abuso antes de tudo; falha de senha;
sessao independente por login; tipo/sessao/emissor/audiencia/jti distintos entre
access e refresh; refresh sem papel, permissoes e emailHash; persistencia apenas
do hash; duracoes reais de access e renovacao; duracao invalida recusada;
verificacao com a lista de algoritmos; access como refresh recusado; assinatura
invalida; consumo condicional e atomico; um unico descendente; reuso de token
consumido e de token revogado revogando a familia; token apenas expirado e token
inexistente **nao** revogando a familia; sessao revogada; usuario desativado;
escopo de tenant/usuario na busca; logout encerrando a sessao inteira; logout
recusando token que nao e de renovacao; escopo do usuario nas operacoes de sessao;
recusa quando o contexto nao identifica a sessao.

`servico-recuperacao-senha.spec.ts` (2 novos): redefinir a senha encerra todas as
sessoes do usuario com motivo `senha_redefinida`; redefinicao que falha nao
encerra sessao nenhuma.

`servico-sessoes.spec.ts` (10): referencia publica nao contem o id nem prefixo
dele, e estavel e distinta; listagem com exatamente seis campos e sessao atual
marcada; listagem sem id, tenant, usuario, token, hash ou familia; classificacao
de revogada e expirada; consulta restrita a tenant e usuario; encerramento por
referencia; referencia de outro usuario recusada com 404; encerrar outras
preservando a atual; auditoria de reuso sem material sensivel.

`1720000001036-CriarSessoesUsuario.spec.ts` (7): RLS habilitada e forcada, FK
composta no tenant, aditividade sobre `refresh_tokens` sem drop nem truncate,
vinculo por `(tenant_id, sessao_id)`, indices de familia/sessao/ativos, ausencia
de coluna de token, IP ou user-agent, e `down` reversivel.

`sessoes-rotacao.integracao.spec.ts` (16, Postgres real, duas `DataSource`
independentes representando duas instancias): rotacao unica com descendente
valido; duas rotacoes concorrentes sem dois descendentes validos, com a familia
revogada por `reuso_detectado`; reuso de token consumido revogando a familia e
invalidando o descendente; auditoria gravada sem token nem hash; access aceito
com sessao ativa; logout em uma instancia derrubando access token valido lido pela
outra; logout encerrando a sessao inteira; encerrar-outras preservando a atual;
usuario nao lista nem encerra sessao de outro usuario do mesmo tenant; tenant
divergente nao alcanca a sessao mesmo com o id correto; RLS isolando
`sessoes_usuario` e negando tudo sem contexto; `relrowsecurity` e
`relforcerowsecurity` verdadeiros; token nunca gravado em claro; refresh tokens
legados preservados; indices presentes; entidade registrada no `DataSource`;
`revogarTodas` encerrando o parque do usuario sem tocar em outro usuario do mesmo
tenant, com o access token recusado pela outra instancia em seguida.

`sessoes-bff.spec.ts` (5): rotas recusam sessao ausente sem tocar o backend;
metodo, caminho e `Authorization` corretos com a referencia codificada na URL;
listagem sem token e com `no-store`; cookies HttpOnly, `SameSite=lax`, `Secure` e
com validade coerente (`maxAge` de access = TTL do access, de refresh = TTL do
refresh); fallback de 30 dias quando o backend nao informa a duracao.

`sessoes-conta.spec.mjs` (5 x 2 projetos): listagem com metadados minimos e sessao
atual marcada, sem nenhuma sequencia de 32 hex nem identificador tecnico no DOM;
encerramento de sessao especifica com recarga da lista; encerrar outras; falha do
BFF sem vazar detalhe interno; navegacao pelo menu da conta.

`autorizacao-rotas.spec.ts`: `/conta/sessoes` liberada para os cinco papeis, sem
abrir outras areas para paciente e cliente.

## 9. Resultado dos gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| RED focado | `npx jest` nas suites novas, antes da implementacao | FAIL esperado (modulos inexistentes) |
| GREEN focado | idem, apos a implementacao | PASS |
| Suite completa do backend | `npx jest --runInBand` | PASS: 158 suites, 1218 testes; 3 suites e 22 testes skipped (as integracoes de Redis, de RLS e a nova de sessoes, todas dependentes de Docker ou Postgres externo) |
| Typecheck backend | `pnpm --dir octaclin-backend typecheck` | PASS |
| Build backend | `pnpm --dir octaclin-backend build` | PASS, `dist/main.js` validado |
| Lint backend | — | NA: o backend nao tem script de lint nem configuracao ESLint |
| Typecheck web | `pnpm --dir octaclin-web typecheck` | PASS |
| Lint web | `pnpm --dir octaclin-web lint` | PASS: 0 errors, 53 warnings, todos pre-existentes ou do mesmo padrao ja usado no repositorio |
| Build web | `pnpm --dir octaclin-web build` | PASS; as quatro rotas novas aparecem no manifesto |
| BFF e authz | `pnpm --dir octaclin-web test:authz` | PASS: 87 testes, incluindo os 5 novos de sessao |
| Playwright de sessoes | `pnpm --dir octaclin-web test:sessoes` (desktop + mobile) | PASS: 10 testes |
| Acessibilidade | `pnpm --dir octaclin-web test:a11y` | PASS: 264 testes |
| Confiabilidade | `pnpm test:confiabilidade` | PASS: 20 referencias criticas (16 antes) |
| Triagem de seguranca | `pnpm test:triagem-seguranca` | PASS: 5 testes |
| Workflows sem injecao | `pnpm test:workflows-seguros` | PASS: 6 testes |
| Actions imutaveis | `pnpm test:actions-imutaveis` | PASS: 9 testes |
| Matriz de acessibilidade | `pnpm test:a11y:matriz` | PASS: 20 testes |
| Scanner de secrets | `pnpm security:secrets` | PASS: nenhum secret identificado |
| Teste do scanner | `pnpm test:security` | PASS |
| `git diff --check` | — | PASS |
| **Concorrencia, RLS e multi-instancia em Postgres real** | `sessoes-rotacao.integracao.spec.ts` (17 testes) | **SKIPPED neste ambiente**: nao ha Docker (`docker` nao existe no PATH) nem Postgres local, e as variaveis `RLS_PROVA_BANCO_*` nao estao definidas. A suite roda no job `Backend NestJS` do CI, que provisiona Postgres real, aplica as migrations e exporta essas variaveis. **SKIPPED nao e PASS** |
| RLS pre-existente com Testcontainers | `pnpm --dir octaclin-backend test:rls:testcontainers` | SKIPPED: exige Docker, ausente neste ambiente. Nao foi tocado por este PR |
| Redis real | `pnpm --dir octaclin-backend test:abuso:redis-real` | SKIPPED: exige Redis descartavel, ausente neste ambiente. Roda no CI |
| Preflight PowerShell | `pnpm validate` | SKIPPED: os scripts `.ps1` nao foram executados nesta sessao |
| CodeQL, Semgrep, Trivy | workflows do PR | Pendente: executam no PR; o resultado deve ser lido no GitHub |

As tres suites skipped da suite completa do backend sao as integracoes
pre-existentes de Redis e de RLS mais a nova de sessoes, todas dependentes de
Docker ou de Postgres externo.

**A prova central de concorrencia nao foi executada neste ambiente.** Ela esta
escrita, tipada e registrada como gate obrigatorio na matriz, e depende do job de
backend do CI para produzir evidencia. Ate esse job passar, a propriedade "duas
rotacoes concorrentes nao geram dois descendentes validos" esta demonstrada por
construcao e por teste unitario do caminho condicional, nao por execucao contra
Postgres.

## 10. Riscos residuais

1. **Corrida legitima de renovacao encerra a sessao.** Duas renovacoes
   simultaneas do mesmo refresh token sao indistinguiveis de um reuso e derrubam
   a familia. O BFF renova em um unico ponto e o access token de 15 minutos torna
   a corrida rara, mas ela e possivel com requisicoes paralelas do mesmo
   navegador. Mitigacao disponivel, se o proprietario decidir: uma janela de
   tolerancia de poucos segundos antes de classificar como roubo — uma alteracao
   de uma condicao, ao custo de reduzir a deteccao.
2. **Uma leitura de banco por requisicao autenticada.** E o preco de fazer a
   revogacao valer imediatamente e entre instancias. Nao ha cache. Se o volume
   exigir, a proxima alternativa segura e um cache com TTL menor que a janela de
   revogacao aceitavel — nao um cache indefinido.
3. **A sessao nao tem prazo absoluto.** Cada rotacao estende `expira_em` por mais
   um `JWT_REFRESH_EXPIRA_EM`, preservando o comportamento anterior. Uma sessao
   continuamente ativa nunca expira sozinha. Um limite absoluto e desejavel e nao
   entrou aqui para nao misturar mudanca de politica com correcao de seguranca.
4. **Deploy invalida todos os tokens em circulacao.** Consequencia direta e
   aceita da validacao nova. Precisa de janela combinada. Ver
   `RUNBOOK_PRODUCAO.md`.
5. **`gerarHashBusca` continua sendo SHA-256 sem chave** sobre o email
   normalizado, risco residual herdado do PR 39 (secao 7.1 daquele relatorio).
   Continua fora de escopo: trocar por HMAC exige backfill coordenado de varias
   tabelas. Permanece aberto para um PR proprio.
6. **`familia_token` virou coluna espelho** de `sessao_id`. Nao e um risco de
   seguranca, e divida de schema a ser resolvida quando um PR puder remover
   coluna com seguranca.
7. **A referencia publica de sessao muda se `JWT_SEGREDO` rotacionar.** Sem
   impacto: e um identificador de visualizacao, nao persistido.
8. **A revogacao na troca de senha e best-effort quanto a ordem.** Ela roda apos
   o commit da troca. Se o processo morrer entre os dois passos, a senha esta
   trocada e as sessoes antigas sobrevivem ate expirarem. A alternativa —
   revogar dentro da mesma transacao — trocaria essa janela estreita pelo risco
   de reverter uma senha ja trocada. O usuario tem o encerramento manual em
   `/conta/sessoes` como recurso.
9. **Este PR nao prova o estado de producao.** Prova o comportamento do codigo.

## 11. Acoes operacionais pendentes

Todas exigem acao humana no provider, fora deste PR. Nenhuma foi executada.

| Acao | Quando | Consequencia de nao fazer |
| --- | --- | --- |
| Definir `JWT_REFRESH_SEGREDO` distinto de `JWT_SEGREDO`, com 32+ bytes, em staging e producao | Antes do deploy | O backend nao sobe |
| Conferir que `JWT_SEGREDO` tem 32+ bytes | Antes do deploy | O backend nao sobe |
| Aplicar `1720000001036-CriarSessoesUsuario` fora de banda com a role owner | Antes do deploy | Toda renovacao e todo acesso autenticado falham |
| Combinar a janela de reentrada com a equipe | Antes do deploy | Usuarios caem sem aviso |
| Definir `JWT_EMISSOR`/`JWT_AUDIENCIA` (opcional) | Se quiser separar staging de producao | Nenhuma: o padrao ja funciona, desde que igual em todas as instancias |

## 12. Rollback

- **Codigo:** reimplantar o commit anterior.
- **Migration:** pode permanecer aplicada. As colunas novas sao anulaveis e a
  versao anterior as ignora. Reverter (`down`) so e necessario para desfazer o
  schema e apaga as sessoes gravadas; nao ha dado clinico envolvido.
- **Tokens:** os emitidos pela versao nova nao sao aceitos pela antiga e
  vice-versa. Falha fechada, sem perda de dado; todos entram de novo.
- **Variaveis:** `JWT_REFRESH_SEGREDO`, `JWT_EMISSOR` e `JWT_AUDIENCIA` podem
  permanecer configuradas — a versao anterior as ignora, exceto
  `JWT_REFRESH_SEGREDO`, que ela ja usava quando presente.

## 13. Skills

Presentes no repositorio (`.agents/skills` e `.claude/skills`) e pertinentes:
`security-review`, `test-driven-development`, `jwt-authentication`,
`nestjs-best-practices`, `typeorm`, `postgresql-table-design`,
`database-migration`, `playwright-best-practices`, `requesting-code-review`.

Efetivamente carregadas como arquivo nesta sessao: **nenhuma**. O ciclo
RED -> GREEN -> REFACTOR, a analise de caminho exploravel, o desenho da migration
com RLS e os testes de Playwright foram executados com capacidade nativa e estao
registrados nas secoes 8 e 9. Registrado como limitacao, conforme a secao 4.2 do
programa de hardening: nao e afirmado uso de skill que nao foi carregada.

## 14. Limites respeitados

Nenhum merge, deploy, migration externa ou alteracao em Render/Neon foi
executado. O PR 41 nao foi iniciado: MFA, reautenticacao privilegiada e protecao
de enrolment permanecem fora deste escopo.
