# OctaClin Web

Interface operacional usando Next.js 14 App Router, TailwindCSS, componentes compativeis com shadcn/ui e `dnd-kit`.

## Rodar localmente

```bash
npm install
npm run dev
```

## Superficie entregue

- Console administrativo com navegacao entre Questionarios, Comunicacoes, Automacoes, IA, Mobile, Gamificacao, Operacoes, Pacientes e Profissionais.
- Navegacao responsiva com sidebar no desktop, barra sticky em telas menores e item ativo acessivel.
- Reordenacao de perguntas por drag-and-drop.
- Edicao de enunciado, tipo, categoria, peso e obrigatoriedade.
- Painel de configuracao do questionario.
- Campo de regra cron para agendamento.
- Editor de Questionarios integrado aos endpoints reais via BFF, com criacao, edicao, reordenacao e agendamento.
- Layout responsivo orientado a dashboard operacional.
- Login web em `/login` consumindo `POST /auth/login`.
- Rota `/operacoes` integrada aos endpoints reais de confiabilidade do backend.
- `/operacoes` exibe auditoria sensivel com filtros por acao, recurso, usuario e periodo.
- Auditoria operacional registra leituras sensiveis e mutacoes administrativas sem gravar textos, PINs, contatos ou payloads brutos.
- `/operacoes` suporta paginacao e exportacao CSV segura para auditoria e outbox com falha.
- Rotas `/pacientes` e `/profissionais` integradas aos endpoints reais de listagem do backend via BFF.
- Listagens de Pacientes e Profissionais exibem nomes retornados por DTOs backend autorizados.
- Cadastros de Pacientes e Profissionais permitem criacao, edicao e arquivamento via BFF, mantendo tokens em cookies `HttpOnly`.
- Telas de Pacientes, Profissionais e Questionarios exibem feedbacks claros de sucesso/erro para operacoes persistidas.
- Questionarios podem ser arquivados pelo editor alterando o status para `arquivado`.
- Rota `/comunicacoes` integrada aos endpoints reais de canais, templates e mensagens via BFF.
- Console de Comunicacoes permite listar mensagens persistidas, criar canal, criar template e disparar mensagem manual para paciente.
- Rota `/automacoes` integrada aos endpoints reais de regras e avaliacoes via BFF.
- Console de Automacoes permite listar avaliacoes persistidas, criar regra clinica e solicitar avaliacao manual para paciente.
- Rota `/ia` integrada aos endpoints reais de analise de sentimento e reconhecimento alimentar via BFF.
- Console de IA permite listar registros persistidos, analisar texto de paciente e reconhecer alimentos a partir de referencia de midia/imagem.
- Rota `/mobile` integrada aos endpoints reais de diario rapido, upload de midia, acompanhantes e sincronizacao via BFF.
- Console Mobile permite listar registros persistidos, registrar diario, solicitar upload, criar acompanhante e sincronizar lote.
- Rota `/gamificacao` integrada aos endpoints reais de circulos, posts, desafios, ranking e badges via BFF.
- Console de Gamificacao permite listar registros persistidos, criar circulo, publicar post, criar desafio, atualizar ranking e conceder badge.
- Estados de erro, carregamento e listas vazias usam componentes compartilhados de feedback operacional nas telas principais.

## Login

A rota `/login` autentica com `tenantSlug`, email e senha, salva a sessao local e redireciona para `/operacoes`.
A sessao usa cookies `HttpOnly` emitidos pelas rotas BFF do Next.js.
Quando o access token expira ou a API retorna 401, o BFF tenta renovar a sessao via `POST /auth/renovar`.
Em producao HTTPS, defina `OCTACLIN_COOKIE_SECURE=true` para marcar os cookies de sessao como `Secure`. Em `localhost` HTTP, mantenha sem essa variavel.
Para restringir quais backends podem ser informados no campo `API`, defina `OCTACLIN_API_ORIGENS_PERMITIDAS` com origens separadas por virgula, por exemplo `https://api.octaclin.com,https://staging-api.octaclin.com`.
O BFF rejeita URLs de API com protocolo diferente de HTTP/HTTPS, credenciais embutidas, query string ou hash.

Campos do seed demo:

- API: `http://localhost:3001`
- Tenant: `clinica-carla`
- Email SuperAdmin: `admin@octaclin.local`
- Senha: `OctaClin@123`

O campo `API` deve apontar para o backend NestJS. Nao rode a web Next.js na mesma porta configurada como API; se a web estiver em `3000`, mantenha o backend em `3001`.
Se o backend estiver fora do ar ou responder HTML no lugar de JSON, o BFF mostra uma mensagem curta em JSON tratada pela interface, nao o HTML interno de erro do Next.js.

## Operacoes

A rota `/operacoes` consulta apenas endpoints internos `/api/operacoes/*`; tokens nao ficam acessiveis ao JavaScript do navegador.
Usuarios sem cookies de sessao sao redirecionados para `/login?redirect=/operacoes`.
O middleware do Next.js protege rotas administrativas antes da renderizacao client-side quando os cookies de sessao nao existem.

## BFF

Rotas internas:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/sair`
- `GET /api/operacoes/resumo`
- `GET /api/operacoes/outbox/falhas`
- `GET /api/operacoes/outbox/falhas/paginada`
- `GET /api/operacoes/outbox/falhas/exportar.csv`
- `POST /api/operacoes/outbox/:id/reprocessar`
- `GET /api/operacoes/mobile/sincronizacoes`
- `GET /api/operacoes/auditoria`
- `GET /api/operacoes/auditoria/paginada`
- `GET /api/operacoes/auditoria/exportar.csv`
- `GET /api/pacientes`
- `POST /api/pacientes`
- `PATCH /api/pacientes/:id`
- `DELETE /api/pacientes/:id`
- `GET /api/profissionais`
- `POST /api/profissionais`
- `PATCH /api/profissionais/:id`
- `DELETE /api/profissionais/:id`
- `GET /api/categorias-pergunta`
- `POST /api/categorias-pergunta`
- `GET /api/questionarios`
- `POST /api/questionarios`
- `PATCH /api/questionarios/:id`
- `GET /api/questionarios/:id/perguntas`
- `POST /api/questionarios/:id/perguntas`
- `PATCH /api/questionarios/:id/perguntas/:perguntaId`
- `PATCH /api/questionarios/:id/perguntas/ordem`
- `POST /api/agendamentos-questionario`
- `GET /api/comunicacoes/canais`
- `POST /api/comunicacoes/canais`
- `GET /api/comunicacoes/templates`
- `POST /api/comunicacoes/templates`
- `GET /api/comunicacoes/mensagens`
- `POST /api/comunicacoes/mensagens`
- `GET /api/automacoes/regras`
- `POST /api/automacoes/regras`
- `GET /api/automacoes/avaliacoes`
- `POST /api/automacoes/avaliacoes`
- `GET /api/ia/sentimento`
- `POST /api/ia/sentimento`
- `GET /api/ia/reconhecimento-alimentar`
- `POST /api/ia/reconhecimento-alimentar`
- `GET /api/mobile/diario-rapido`
- `POST /api/mobile/diario-rapido`
- `GET /api/mobile/midias/uploads`
- `POST /api/mobile/midias/uploads`
- `GET /api/mobile/acompanhantes`
- `POST /api/mobile/acompanhantes`
- `POST /api/mobile/sincronizacao/lote`
- `POST /api/gamificacao/circulos`
- `GET /api/gamificacao/circulos`
- `POST /api/gamificacao/circulos/:id/membros`
- `POST /api/gamificacao/posts`
- `POST /api/gamificacao/desafios`
- `GET /api/gamificacao/desafios`
- `POST /api/gamificacao/desafios/progresso`
- `GET /api/gamificacao/desafios/:id/ranking`
- `POST /api/gamificacao/badges`
- `GET /api/gamificacao/badges`
- `POST /api/gamificacao/badges/concessoes`

## Smoke E2E do BFF

Com backend, banco e seed demo ativos, execute:

```bash
E2E_WEB_URL=http://localhost:3000 \
E2E_API_URL=http://localhost:3001 \
npm run smoke:e2e:bff
```

No PowerShell:

```powershell
$env:E2E_WEB_URL="http://localhost:3000"
$env:E2E_API_URL="http://localhost:3001"
npm run smoke:e2e:bff
```

O smoke valida sessao ausente antes do login, login via BFF, cookies `HttpOnly`, listagens de pacientes/profissionais com DTOs descriptografados e eventos de auditoria sensivel.
Com a API demo local (`npm run mock:api` no backend), tambem valida paginas protegidas com marca, shell e titulos esperados, criacao/edicao/arquivamento de profissionais e pacientes, criacao/publicacao/arquivamento de questionario, perguntas, reordenacao, agendamento, comunicacoes, automacoes, IA, mobile, gamificacao e operacoes.

Alias:

```bash
npm run smoke:demo
```

Fallback sem npm no PATH:

```bash
node scripts/smoke-e2e-bff.mjs
```

## Smoke de UI

O smoke de UI valida o contrato de telas protegidas sem executar mutacoes: login, redirecionamento sem sessao, shell do console, menu, titulos e ausencia de erros brutos.

```bash
npm run smoke:ui
```

Fallback sem npm no PATH:

```bash
node scripts/smoke-ui-regression.mjs
```

## Smoke visual

O smoke visual usa Playwright para autenticar pela tela real, percorrer as 9 rotas protegidas em desktop/mobile, validar titulos, menu, ausencia de overflow horizontal e anexar screenshots.

Instale o Chromium local do Playwright uma vez:

```bash
npx playwright install chromium
```

Execute:

```bash
npm run smoke:visual
```

Para subir a demo local completa no Windows, use `outputs/iniciar-demo-local.ps1` a partir da raiz do workspace gerado.

## Testes Automatizados

O backend possui specs focadas para contratos de dominio e servico em Comunicacoes, Automacoes, IA, Mobile, Gamificacao e Operacoes. Para rodar a suite focada da Fase 41:

```powershell
cd outputs/octaclin-backend
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/jest/bin/jest.js src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts src/modulos/automacoes/aplicacao/servico-automacoes.spec.ts src/modulos/ia/aplicacao/servico-ia.spec.ts src/modulos/mobile/aplicacao/servico-mobile.spec.ts src/modulos/gamificacao/aplicacao/servico-gamificacao.spec.ts --runInBand
```
