# Fase 26 - Execucao local assistida

## Objetivo

Evitar novos conflitos de porta/cache no ambiente local e dar um caminho simples para subir, parar e validar a demo do OctaClin com web e API demo.

## Entregas

- `outputs/iniciar-demo-local.ps1`
  - Para processos Node antigos do workspace relacionados a web/API demo.
  - Valida portas `3000` e `3001`.
  - Opcionalmente gera build web.
  - Sobe API demo em `http://localhost:3001`.
  - Sobe web em `http://localhost:3000`.
  - Valida `/login` e `/health`.
- `outputs/parar-demo-local.ps1`
  - Encerra processos Node da web OctaClin e API demo.
- `outputs/verificar-demo-local.ps1`
  - Valida web, API, login BFF, sessao BFF e pacientes BFF.
- API demo aceita `--port`, evitando dependencia de `Start-Process -Environment`.

## Comandos

Subir demo sem rebuild:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\iniciar-demo-local.ps1 -SkipBuild
```

Subir demo com rebuild:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\iniciar-demo-local.ps1
```

Verificar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\verificar-demo-local.ps1
```

Parar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\parar-demo-local.ps1
```

## Credenciais

- API: `http://localhost:3001`
- Tenant: `clinica-carla`
- Email: `admin@octaclin.local`
- Senha: `OctaClin@123`

## Validacao realizada

- `parar-demo-local.ps1`: aprovado.
- `iniciar-demo-local.ps1 -SkipBuild`: aprovado.
- `verificar-demo-local.ps1`: aprovado.
- `node --check outputs/octaclin-backend/scripts/api-demo-local.mjs`: aprovado.
- `node --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`: aprovado.
- `node scripts/smoke-e2e-bff.mjs`: aprovado com `smoke-e2e-bff-ok`.

## Estado atual

- Web ativa: `http://localhost:3000/login`.
- API demo ativa: `http://localhost:3001/health`.
