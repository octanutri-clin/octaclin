param(
  [int]$Porta = 3028
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$web = Join-Path $raiz 'octaclin-web'
$runtimeNodeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$runtimeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback'

if ((Test-Path $runtimeNodeBin) -and (Test-Path $runtimeBin)) {
  $env:PATH = "$runtimeNodeBin;$runtimeBin;$env:PATH"
}

function Stop-ServidorPorta {
  param([int]$PortaAlvo)

  $conexoes = Get-NetTCPConnection -LocalPort $PortaAlvo -State Listen -ErrorAction SilentlyContinue
  if (-not $conexoes) {
    return
  }

  $conexoes |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -and $_ -gt 0 } |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

$saida = Join-Path $env:TEMP "octaclin-next-$Porta.out.log"
$erro = Join-Path $env:TEMP "octaclin-next-$Porta.err.log"
Remove-Item $saida, $erro -ErrorAction SilentlyContinue
Stop-ServidorPorta -PortaAlvo $Porta

$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$processo = Start-Process `
  -FilePath $pnpm `
  -ArgumentList @('exec', 'next', 'dev', '-p', "$Porta") `
  -WorkingDirectory $web `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $saida `
  -RedirectStandardError $erro

try {
  $pronto = $false
  for ($tentativa = 0; $tentativa -lt 90; $tentativa++) {
    try {
      $resposta = Invoke-WebRequest -Uri "http://localhost:$Porta" -UseBasicParsing -TimeoutSec 2
      if ($resposta.StatusCode -lt 500) {
        $pronto = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $pronto) {
    Get-Content $saida -ErrorAction SilentlyContinue
    Get-Content $erro -ErrorAction SilentlyContinue
    throw "Servidor Next nao ficou pronto na porta $Porta."
  }

  $env:E2E_WEB_URL = "http://localhost:$Porta"
  & pnpm --dir $web test:e2e:criticas
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($processo -and -not $processo.HasExited) {
    Stop-Process -Id $processo.Id -Force -ErrorAction SilentlyContinue
  }
  Stop-ServidorPorta -PortaAlvo $Porta
}
