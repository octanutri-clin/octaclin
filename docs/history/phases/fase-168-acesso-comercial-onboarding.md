# Fase 168 - Acesso comercial e onboarding

Status: concluida e validada em producao em 2026-07-30.

## Objetivo

Transformar login e recuperacao de senha em jornadas comerciais, removendo
configuracoes tecnicas do fluxo cotidiano sem enfraquecer a separacao por
tenant.

## Entregue

- Login com apenas email e senha, sem valores demo preenchidos.
- Recuperacao de senha com apenas email.
- URL do backend e tenant resolvidos pelo BFF por variaveis somente do
  servidor.
- Falha fechada em producao quando `OCTACLIN_BACKEND_URL` ou
  `OCTACLIN_TENANT_SLUG` estiver ausente.
- Validacao de payloads malformados ou incompletos antes de chamar o backend.
- Mensagens comerciais sem orientar o usuario a configurar API.
- Hierarquia visual, foco, alvos de toque e estados de erro/sucesso revisados.
- Primeiro acesso por convite e aceites legais existentes preservados como
  onboarding oficial de pacientes e profissionais.

## Configuracao

O servico web precisa destas variaveis em producao:

```text
OCTACLIN_BACKEND_URL=https://backend-do-ambiente
OCTACLIN_TENANT_SLUG=slug-da-organizacao
OCTACLIN_API_ORIGENS_PERMITIDAS=https://backend-do-ambiente
OCTACLIN_COOKIE_SECURE=true
```

O tenant permanece necessario no contrato interno do backend, mas deixa de
ser informado livremente pelo navegador. Cada frontend atende a organizacao
configurada no ambiente.

## Limite deliberado

Esta fase nao criou um seletor multiempresa nem inferiu tenant apenas pelo
email, pois o mesmo email pode existir em mais de um tenant. Quando o produto
precisar de uma unica web compartilhada entre varias organizacoes, o fluxo
deve resolver a organizacao por convite ou endereco comercial confiavel antes
do envio das credenciais.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "login do console" --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs -g "login" --reporter=list
```

Em producao, o servico web recebeu:

```text
OCTACLIN_BACKEND_URL=https://octaclin-backend-producao.onrender.com
OCTACLIN_TENANT_SLUG=octaclin-admin
```

O deploy `5558a4d` ficou `Live` no Render. O smoke funcional confirmou que a
tela possui somente email e senha e que o BFF alcanca o backend configurado:
credenciais sinteticas invalidas retornaram `Credenciais invalidas`, sem erro
de configuracao.

## Proxima fase

Fase 169 - Disponibilidade e feed completo da agenda.
