param(
  [int]$WebPort = 3000,
  [int]$ApiPort = 3001,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$web = Join-Path $raiz 'octaclin-web'
$backend = Join-Path $raiz 'octaclin-backend'
$work = Join-Path (Split-Path -Parent $raiz) 'work'
$node = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

if (-not (Test-Path $node)) {
  $nodeComando = Get-Command node -ErrorAction Stop
  $node = $nodeComando.Source
}

if (-not (Test-Path $work)) {
  New-Item -ItemType Directory -Path $work | Out-Null
}

function Stop-OctaClinProcess {
  param([string]$Needle)

  Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*$Needle*" } |
    ForEach-Object {
      Write-Host "Parando processo antigo $($_.ProcessId): $Needle"
      Stop-Process -Id $_.ProcessId -Force
    }
}

function Test-PortOpen {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(250, $false)) {
      $client.Close()
      return $false
    }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    $client.Close()
    return $false
  }
}

Stop-OctaClinProcess 'outputs\octaclin-web'
Stop-OctaClinProcess 'outputs\octaclin-backend\scripts\api-demo-local.mjs'
Start-Sleep -Milliseconds 500

if (Test-PortOpen $WebPort) {
  throw "A porta web $WebPort ainda esta ocupada por outro processo."
}

if (Test-PortOpen $ApiPort) {
  throw "A porta API $ApiPort ainda esta ocupada por outro processo."
}

if (-not $SkipBuild) {
  Write-Host 'Gerando build web...'
  Push-Location $web
  try {
    & $node '.\node_modules\next\dist\bin\next' build
  } finally {
    Pop-Location
  }
}

$apiOut = Join-Path $work "octaclin-api-demo-$ApiPort.out.log"
$apiErr = Join-Path $work "octaclin-api-demo-$ApiPort.err.log"
$webOut = Join-Path $work "octaclin-web-next-$WebPort.out.log"
$webErr = Join-Path $work "octaclin-web-next-$WebPort.err.log"

Write-Host "Subindo API demo em http://localhost:$ApiPort"
Start-Process -FilePath $node `
  -ArgumentList @((Join-Path $backend 'scripts\api-demo-local.mjs'), '--port', "$ApiPort") `
  -WorkingDirectory $backend `
  -WindowStyle Hidden `
  -RedirectStandardOutput $apiOut `
  -RedirectStandardError $apiErr

Write-Host "Subindo web em http://localhost:$WebPort"
Start-Process -FilePath $node `
  -ArgumentList @((Join-Path $web 'node_modules\next\dist\bin\next'), 'start', '-p', "$WebPort") `
  -WorkingDirectory $web `
  -WindowStyle Hidden `
  -RedirectStandardOutput $webOut `
  -RedirectStandardError $webErr

Start-Sleep -Seconds 3

$webHealth = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$WebPort/login" -TimeoutSec 10
$apiHealth = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$ApiPort/health" -TimeoutSec 10

Write-Host "Web: http://localhost:$WebPort/login ($($webHealth.StatusCode))"
Write-Host "API: http://localhost:$ApiPort/health ($($apiHealth.StatusCode))"
Write-Host 'Credenciais: API=http://localhost:3001 | Tenant=clinica-carla | Email=admin@octaclin.local | Senha=OctaClin@123'
