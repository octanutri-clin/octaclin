param(
  [int]$WebPort = 3000,
  [int]$ApiPort = 3001
)

$ErrorActionPreference = 'Stop'

$web = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$WebPort/login" -TimeoutSec 10
$api = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$ApiPort/health" -TimeoutSec 10

$body = @{
  apiUrl = "http://localhost:$ApiPort"
  tenantSlug = 'clinica-carla'
  email = 'admin@octaclin.local'
  senha = 'OctaClin@123'
} | ConvertTo-Json

$login = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:$WebPort/api/auth/login" `
  -Method POST `
  -ContentType 'application/json' `
  -Body $body `
  -SessionVariable sessao `
  -TimeoutSec 10

$session = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$WebPort/api/auth/session" -WebSession $sessao -TimeoutSec 10
$pacientes = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$WebPort/api/pacientes" -WebSession $sessao -TimeoutSec 10

Write-Host "Web /login: $($web.StatusCode)"
Write-Host "API /health: $($api.StatusCode) $($api.Content)"
Write-Host "Login BFF: $($login.StatusCode)"
Write-Host "Sessao BFF: $($session.StatusCode)"
Write-Host "Pacientes BFF: $($pacientes.StatusCode)"
Write-Host 'Demo local OK.'
