# Guia rapido - Demo local OctaClin

## Subir

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\iniciar-demo-local.ps1 -SkipBuild
```

## Acessar

- Web: `http://localhost:3000/login`
- API: `http://localhost:3001`
- Tenant: `clinica-carla`
- Email: `admin@octaclin.local`
- Senha: `OctaClin@123`

## Verificar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\verificar-demo-local.ps1
```

## Smoke completo

```powershell
cd outputs\octaclin-web
node scripts\smoke-e2e-bff.mjs
```

## Parar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\outputs\parar-demo-local.ps1
```
