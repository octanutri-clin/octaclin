# Relatorio de seguranca - PR 45 - Browser, BFF e cabecalhos

Data: 2026-08-30

Branch: `security/governanca-pr45-browser-bff`

Risco: R4. Este PR nao executa migration, deploy ou operacao em producao.

## 1. Escopo

O PR endurece a fronteira Internet -> web/BFF sem alterar autenticacao,
tenancy, contratos clinicos ou integracoes externas:

- CSP bloqueante com nonce diferente por resposta;
- remocao de `unsafe-inline` de `script-src` em producao e desenvolvimento;
- `unsafe-eval` restrito ao servidor de desenvolvimento do Next;
- cache privado e `no-store` em paginas, redirects e BFF;
- validacao negativa de CSRF, CORS, XSS e redirects;
- allowlist CORS do backend limitada a origens HTTP(S) canonicas e HTTPS em
  producao, exceto loopback;
- headers COOP, CORP e `X-Permitted-Cross-Domain-Policies`;
- preservacao dos cookies HttpOnly, Secure e SameSite e da arquitetura BFF.

## 2. RED -> GREEN

RED comprovado antes da correcao:

- a CSP estatica continha `script-src 'unsafe-inline'`;
- scripts inline nao possuam nonce por resposta;
- `/dashboard` redirecionado nao declarava `no-store`;
- destino `/\\ataque.example/roubo` era aceito pelo sanitizador anterior;
- `CORS_ORIGINS` aceitava `null`, caminho, credencial e HTTP publico em
  producao;
- a primeira politica de producao com `strict-dynamic` bloqueou um chunk
  legitimo do Next em Chromium.

GREEN:

- nonce imprevisivel gerado por resposta e encaminhado ao renderizador Next;
- todo script inline de bootstrap observado em `next start` usa o mesmo nonce;
- `script-src` de producao aceita somente `'self'` e o nonce, sem
  `unsafe-inline`, `unsafe-eval` ou `strict-dynamic`;
- o navegador nao reporta violacao de CSP durante hidratacao;
- mutacao same-origin alcanca o BFF e mutacao cross-site e sem origem e
  recusada;
- payload XSS permanece texto e nao cria elemento nem executa handler;
- redirect absoluto, protocol-relative, com barra invertida, API, controle ou
  separador codificado cai no destino seguro;
- respostas BFF e paginas protegidas recusadas declaram `no-store` e nao
  publicam ACAO.

## 3. Decisoes tecnicas

O nonce exige renderizacao por requisicao no App Router. O `RootLayout` le
`headers()` para impedir que paginas com HTML sensivel sejam pre-renderizadas
com um nonce reutilizado. O build confirmou as paginas como dinamicas. O custo
aceito e retirar cache HTML compartilhado e aumentar trabalho do servidor,
coerente com um SaaS clinico autenticado.

`strict-dynamic` foi removido depois de evidencia real em `next start`: o Next
carrega um chunk do proprio host sem nonce e Chromium o bloqueia quando
`strict-dynamic` desativa allowlists por host. A politica final conserva
`'self'` e nonce, remove a execucao inline irrestrita e nao quebra o runtime.

## 4. Validacoes executadas

- PASS - web `test:seguranca-operacional`: 10/10.
- PASS - web `test:authz`: todos os contratos do agregador aprovados.
- PASS - web `test:apis-dinamicas`: 100 arquivos.
- PASS - web `test:seguranca-browser`: 10/10 em desktop e mobile.
- PASS - web `test:pwa`: contrato estatico e 6/6 Playwright.
- PASS - web `smoke:visual`: 572 PASS, 2 SKIPPED, 0 FAIL em 14,1 min.
- PASS - web typecheck.
- PASS - web lint: 0 erros e 52 warnings conhecidos.
- PASS - web build Next 16.3.2; paginas dinamicas e manifest estatico.
- PASS - web `test:seguranca-runtime` contra `next start`.
- PASS - backend `src/main.spec.ts`: 20/20.
- PASS - backend typecheck.
- PASS - backend build e verificacao de `dist/main.js`.
- NA - backend lint: o pacote nao define script de lint.
- SKIPPED - 2 cenarios `producao-readonly`: dependem de credenciais externas e
  nao foram declarados PASS.

O host local usa Node 24.18.0 e o repositorio declara Node >=22 <23. Os comandos
passaram, mas a evidencia canonica final continua sendo o CI em Node 22.

## 5. Fatos novos e riscos residuais

- `style-src-attr 'unsafe-inline'` permanece porque ha 19 estilos dinamicos de
  geometria/progresso. Blocos `<style>` em producao continuam exigindo nonce.
- `connect-src https: wss:` permanece amplo porque uploads diretos usam URLs
  HTTPS assinadas e providers externos. Restringir por provider depende do PR
  46 e da configuracao canonica das integracoes.
- a suite ampla emitiu avisos preexistentes de chaves React duplicadas e uma
  fixture que aciona o error boundary do prontuario; 572 cenarios passaram,
  mas esses avisos nao sao classificados como PASS de qualidade.
- a convencao `middleware.ts` esta depreciada no Next 16. A migracao para
  `proxy.ts` nao foi feita por ser refactor fora do escopo.
- OAuth state, callbacks, URLs externas e binding com providers permanecem
  integralmente no PR 46.

## 6. Estado

Implementacao e validacao local concluidas. Pendente: checks e review/merge
humano. O PR 46 nao esta autorizado antes desse aceite.
