# Fase 229 - Fechamento de seguranca operacional

Data: 2026-08-13

## Objetivo

Fechar os controles operacionais que antecedem a primeira conta real sem
registrar valores de secrets: configuracao fail-closed do BFF, protecao de
mutacoes contra requisicoes cross-site, headers globais, dependencias,
permissoes de automacao e destinatarios de notificacoes.

## Implementacao

- O BFF recusa producao sem `OCTACLIN_COOKIE_SECURE=true` e sem uma allowlist
  HTTPS de origens da API.
- Mutacoes em `/api/**` exigem `Origin` valido. O navegador precisa informar
  `Sec-Fetch-Site: same-origin`; quando Fetch Metadata nao existe, a origem e
  comparada com a URL, host/protocolo encaminhados e allowlist web explicita.
- Todas as respostas web recebem CSP, HSTS, `nosniff`, bloqueio de frames,
  politica de referrer e restricao de camera, microfone e geolocalizacao.
- `Collaborator` recebe apenas eventos operacionais de mensagem, solicitacao de
  agenda e falha de envio. Resposta de formulario clinico permanece com
  `SuperAdmin` e profissional responsavel.
- Dependabot semanal cobre Actions, backend, web, mobile e servico de IA. Os
  workflows mantem permissao padrao de conteudo somente leitura.

## Evidencias sem secrets

- Backend de producao: `/health/detalhado` respondeu `ok`; banco, migrations,
  Redis, email, WhatsApp e Google Calendar responderam `ok` antes do deploy.
- GitHub: permissao padrao dos workflows e `read`; aprovacao de PR por workflow
  desabilitada; environment `production-backup` identificado sem leitura de
  valores protegidos.
- Scanner de secrets aprovado. Nenhuma credencial foi impressa ou versionada.
- `pnpm audit --prod --audit-level=high`: web e backend aprovados.
- Backend completo: 122 suites e 831 testes aprovados; typecheck e build
  aprovados. Web: lint, typecheck, build e 35 testes de autorizacao aprovados.
- Playwright direcionado: 40/40 jornadas de agenda, formularios, questionarios,
  portal e concorrencia aprovadas em desktop/mobile. A CSP permite
  `unsafe-eval` somente no `next dev`; o smoke do build confirma sua ausencia
  em producao.
- Mobile nao foi declarado limpo: o Expo SDK 52 traz `tar@6.2.1` pela CLI com
  alerta critico e outras dependencias transitivas antigas. Como Mobile nao
  integra a oferta inicial, sua publicacao continua bloqueada pela Fase 241,
  que devera atualizar SDK por versoes suportadas e repetir o audit.

## Gates locais

```powershell
pnpm --dir octaclin-web test:seguranca-operacional
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:seguranca-runtime
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm security:secrets
```

O smoke de runtime sobe o build em porta efemera, exige os seis headers,
confirma que a mutacao same-origin alcanca a rota e que cross-site ou ausencia
de `Origin` retornam `403`.

## Aceite de producao

- [x] CI `31724869285` verde no commit `5674fa5`.
- [x] Deploy web `Live` no mesmo commit, com Node 22 e instalacao explicita das
  dependencias necessarias ao build.
- [x] Os seis headers estao presentes em `/login`; a CSP de producao nao inclui
  `unsafe-eval`.
- [x] POST same-origin invalido alcancou a rota e retornou `400`, enquanto
  origem externa e ausencia de `Origin` retornaram `403`.
- [x] O login sintetico permaneceu funcional no smoke do CI, executado sobre
  `next start` com a configuracao fail-closed de producao.

O aceite remoto foi concluido em 2026-08-13 sem usar ou registrar credenciais.

Os demais bloqueadores do `CHECKLIST_GO_LIVE.md` continuam obrigatorios antes
de liberar clientes reais.
