# Relatorio de seguranca - PR 46 - OAuth e integracoes externas

Data: 2026-08-31

Branch: `security/governanca-pr46-oauth-integracoes`

Pull request GitHub: `#173`

## 1. Objetivo e limite

Este PR endurece os fluxos Google Calendar, Gmail API, SMTP e WhatsApp Meta
sem executar operacao em producao e sem alterar contratos de dados, migrations
ou permissoes clinicas. O escopo segue o PR 46 do programa de hardening.

Nao foram usados dados reais, tokens reais, contas reais ou endpoints de
producao nos testes. Todas as respostas de providers sao sinteticas.

## 2. Caminhos de ataque revisados

| Caminho | Risco anterior | Controle implementado | Evidencia |
| --- | --- | --- | --- |
| OAuth iniciado em um navegador e concluido em outro | CSRF/login confusion e vinculacao indevida de agenda | ticket inicial de uso unico, cookie host-only HttpOnly/Secure/SameSite=Lax e hash do binding dentro do state assinado | state de outro navegador e rejeitado antes de persistir credencial |
| State adulterado, expirado ou repetido | callback forjado e replay | HMAC dedicado, validacao antes do parse, expiracao, nonce atomico no Redis e consumo unico | adulteracao, expiracao e segundo uso sao rejeitados |
| Interceptacao do authorization code | troca do code fora do cliente que iniciou o fluxo | PKCE S256, verifier aleatorio guardado no Redis e enviado somente ao token endpoint | challenge e verifier sao provados nos testes |
| Callback/redirect configurado de forma hostil | open redirect e exfiltracao | origens HTTPS sem credenciais, path, query ou fragmento; loopback recusado em ambiente fechado | URLs inseguras e retorno externo sao rejeitados |
| Endpoint OAuth configuravel | SSRF e desvio de credencial | endpoint canonico Google em runtime; somente dominio `.test` sintetico no ambiente de teste | URL de metadata/loopback falha antes de `fetch` |
| Redirect HTTP de provider | desvio para host nao autorizado | `redirect: error` e timeout de 15 segundos nos fetches externos | opcoes verificadas em testes unitarios |
| Webhook Google adulterado | reconciliacao de recurso de outro canal/profissional | validacao de channel, token, resource ID, expiracao, profissional e numero da mensagem antes de enfileirar | resource ID incorreto e canal expirado sao rejeitados |
| Evento Google de outra consulta | mutacao de consulta nao vinculada | binding server-side entre `googleEventId`, consulta, tenant e profissional preservado | suite de agenda rejeita evento de outro recurso |
| Segmentos de URL Meta manipulados | URL externa ou path inesperado | versao e phone number ID aceitam somente formatos estritos | configuracao invalida falha antes de enviar |
| Erro de provider retornado ao dominio | vazamento de body, token ou detalhe externo | mensagem sanitizada contendo apenas status HTTP | teste prova ausencia do body sintetico |
| SMTP apontado para rede interna | SSRF por canal SMTP | `allowInternalNetworkInterfaces=false` em staging/producao, independentemente da variavel | configuracao permissiva e neutralizada em ambiente fechado |

### Correcao apos analise estatica do PR #173

O primeiro ciclo remoto abriu sete comentarios: tres Semgrep para open redirect
e quatro comentarios CodeQL que agregavam cinco anotacoes. A triagem encontrou:

- os tres redirects ja tinham origem fixa/validada, mas o fluxo de consentimento
  ganhou um sanitizer final que aceita somente
  `https://accounts.google.com/o/oauth2/v2/auth`; as tres excecoes Semgrep sao
  locais, especificas para a regra e documentadas no sink;
- o cookie temporario passou a declarar `httpOnly: true` e `secure: true`
  literalmente no setter e no clear, sem spread ou ramo inseguro;
- o digest do binding passou de SHA-256 simples para HMAC-SHA256;
- as anotacoes `js/insufficient-password-hash` eram falsos positivos: HMAC
  autentica state/binding aleatorio e nao deriva senha. As sintaxes
  `codeql[query-id]` e `lgtm[query-id]` nao foram honradas pelo pipeline
  JavaScript deste repositorio. Os alertas 132, 133 e 139 devem ser encerrados
  no GitHub como falso positivo, com esta evidencia, sem alterar o algoritmo
  correto para satisfazer uma heuristica de senha inaplicavel.

Teste negativo adicional prova que uma URL fora de `accounts.google.com` e
rejeitada antes de emitir o cookie.

## 3. Implementacao

- O endpoint autenticado `/agenda/google/conectar` nao cria mais o state final.
  Ele entrega um ticket curto e de uso unico para `/agenda/google/iniciar`.
- O inicio publico consome o ticket, cria o binding do navegador e PKCE, grava
  apenas material temporario no Redis e redireciona ao Google.
- O callback valida configuracao, cookie, assinatura, expiracao, nonce e PKCE
  antes da troca do code e da persistencia do refresh token.
- O cookie temporario e removido com os mesmos atributos de path e sem
  `maxAge`/`expires`, conforme o contrato de `clearCookie`.
- Google Calendar, Gmail API e Meta usam timeout e recusam redirect HTTP.
- O helper local de obtencao do refresh token Gmail passou a usar PKCE e
  callback de uso unico.
- O token endpoint Google deixa de ser uma URL arbitraria em ambientes reais.
- O webhook de watch Google valida recurso, canal, profissional e expiracao.

## 4. TDD e validacoes

### RED

Os testes direcionados falharam antes da implementacao por ausencia do ticket
de inicio, binding de navegador, PKCE, consumo atomico, validacao do recurso do
watch, restricao de endpoint/redirect e bloqueio de rede interna SMTP.

### GREEN

- PASS - 6 suites direcionadas de agenda e comunicacoes: 61/61 apos a
  correcao dos alertas estaticos.
- PASS - suites direcionadas finais de controller e URLs: 19/19.
- PASS - backend Jest completo: 167 suites e 1333 testes executados com sucesso.
- PASS - `pnpm typecheck` no backend.
- PASS - `pnpm build` no backend e validacao de `dist/main.js`.
- PASS - `node --check octaclin-backend/scripts/gmail-oauth-token.mjs`.
- PASS - `pnpm test:confiabilidade`: 20 referencias criticas.
- PASS - `pnpm validate:docs`, `pnpm security:secrets` e
  `pnpm test:security`.
- PASS - `pnpm --dir octaclin-backend audit --prod`: nenhuma vulnerabilidade
  conhecida.
- PASS - `git diff --check` antes da consolidacao documental.
- FAIL conhecido, fora do diff - Gitleaks generico marcou seis fixtures e
  placeholders sinteticos ja presentes no commit-base. Nenhum fingerprint foi
  criado ou alterado por este PR; o scanner canonico do repositorio passou.
- SKIPPED - 4 suites e 32 testes de integracao dependentes de ambiente na
  execucao completa, conforme marcacao preexistente da propria suite.
- SKIPPED - OAuth, envio e webhook reais em Google, Gmail, Meta e SMTP, pois o
  PR proibe producao e nao havia staging/provider descartavel autorizado.
- NA - migrations, banco, Redis real, Render e alteracoes no frontend.

Os gates serao repetidos no diff final antes do push.

## 5. Compatibilidade operacional

- Nenhuma variavel nova e exigida.
- `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` continua obrigatoria e dedicada.
- `GOOGLE_CALENDAR_TOKEN_URI` e `GMAIL_TOKEN_URI` so podem apontar para o
  endpoint canonico Google fora de testes.
- O redirect URI registrado no Google permanece
  `/agenda/google/callback`; nao ha alteracao no Google Cloud Console.
- O cookie de binding sempre usa `Secure`; desenvolvimento OAuth tambem precisa
  executar em contexto seguro aceito pelo navegador.
- Conexoes Google ja persistidas permanecem validas.
- Um consentimento iniciado antes do deploy nao possui o novo binding/PKCE e
  deve ser reiniciado depois do deploy.
- Redis precisa oferecer `SET` com `NX`/TTL, `GET` e `DEL`, ja usados pelo
  cliente atual.
- Relays SMTP privados deixam de ser alcancaveis em staging/producao. Isso e
  intencional e deve ser revisto somente com egress proxy/allowlist explicita.

## 6. Rollback

O rollback consiste em reverter este PR. Nao ha migration nem transformacao de
dados. Refresh tokens ja armazenados nao mudam de formato. Consentimentos em
andamento devem ser reiniciados tanto no rollout quanto no rollback.

## 7. Riscos residuais

- Providers reais nao foram exercitados neste PR; um smoke controlado em
  staging continua necessario antes de liberar o incremento.
- O ticket de inicio trafega na query do backend, mas e aleatorio, curto e de
  uso unico. Logs e observabilidade ainda devem continuar redigindo query
  strings sensiveis.
- A protecao SMTP bloqueia rede interna, mas um relay publico comprometido
  continua sendo uma fronteira externa e exige credencial de menor privilegio.
- Validacao DNS/IP contra rebinding nao foi adicionada porque os endpoints de
  fetch OAuth ficaram canonicos; nao se deve reintroduzir endpoint arbitrario.
- A prova integral ASVS e o pentest de staging permanecem nos PRs 54-55.

## 8. Resultado

O escopo do PR 46 foi implementado e validado localmente com providers
sinteticos no PR GitHub `#173`. O incremento permanece aguardando checks e
review/merge humanos.
PR 47 nao esta autorizado ate esse aceite.
