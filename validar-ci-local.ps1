param(
  [switch]$SkipBackendBuild,
  [switch]$SkipBackendTests,
  [switch]$SkipWebBuild,
  [switch]$SkipMobile,
  [switch]$SkipVisual,
  [switch]$SkipDemo
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $raiz 'octaclin-backend'
$web = Join-Path $raiz 'octaclin-web'
$mobile = Join-Path $raiz 'octaclin-mobile'
$node = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

if (-not (Test-Path $node)) {
  $nodeComando = Get-Command node -ErrorAction Stop
  $node = $nodeComando.Source
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name"
  $inicio = Get-Date
  & $Action
  $duracao = [Math]::Round(((Get-Date) - $inicio).TotalSeconds, 1)
  Write-Host "OK: $Name ($duracao s)"
}

function Invoke-Node {
  param(
    [string]$WorkingDirectory,
    [string[]]$Arguments
  )

  Push-Location $WorkingDirectory
  try {
    & $node @Arguments
  } finally {
    Pop-Location
  }
}

function Invoke-PowerShellFile {
  param(
    [string]$Path,
    [string[]]$Arguments = @()
  )

  & powershell -ExecutionPolicy Bypass -File $Path @Arguments
}

$specsFocadas = @(
  'src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts',
  'src/modulos/automacoes/aplicacao/servico-automacoes.spec.ts',
  'src/modulos/ia/aplicacao/servico-ia.spec.ts',
  'src/modulos/mobile/aplicacao/servico-mobile.spec.ts',
  'src/modulos/gamificacao/aplicacao/servico-gamificacao.spec.ts'
)

try {
  Invoke-Step 'Backend typecheck' {
    Invoke-Node $backend @('node_modules/typescript/bin/tsc', '--noEmit')
  }

  if (-not $SkipBackendBuild) {
    Invoke-Step 'Backend build' {
      Invoke-Node $backend @('node_modules/@nestjs/cli/bin/nest.js', 'build')
    }
  }

  if (-not $SkipBackendTests) {
    Invoke-Step 'Backend specs focadas' {
      Invoke-Node $backend (@('node_modules/jest/bin/jest.js') + $specsFocadas + @('--runInBand'))
    }
  }

  Invoke-Step 'Web typecheck' {
    Invoke-Node $web @('node_modules/typescript/bin/tsc', '--noEmit')
  }

  if (-not $SkipWebBuild) {
    Invoke-Step 'Web build' {
      Invoke-Node $web @('node_modules/next/dist/bin/next', 'build')
    }
  }

  if (-not $SkipMobile) {
    Invoke-Step 'Mobile typecheck' {
      Invoke-Node $mobile @('node_modules/typescript/bin/tsc', '--noEmit')
    }
  }

  if (-not $SkipDemo) {
    Invoke-Step 'Demo local reiniciar' {
      Invoke-PowerShellFile (Join-Path $raiz 'parar-demo-local.ps1')
      Invoke-PowerShellFile (Join-Path $raiz 'iniciar-demo-local.ps1') @('-SkipBuild')
    }

    Invoke-Step 'Demo local healthcheck' {
      Invoke-PowerShellFile (Join-Path $raiz 'verificar-demo-local.ps1')
    }

    Invoke-Step 'Smoke UI' {
      Invoke-Node $web @('scripts/smoke-ui-regression.mjs')
    }

    Invoke-Step 'Smoke E2E BFF' {
      Invoke-Node $web @('scripts/smoke-e2e-bff.mjs')
    }

    if (-not $SkipVisual) {
      Invoke-Step 'Playwright instalar Chromium' {
        Invoke-Node $web @('node_modules/@playwright/test/cli.js', 'install', 'chromium')
      }

      Invoke-Step 'Smoke visual Playwright' {
        Invoke-Node $web @('node_modules/@playwright/test/cli.js', 'test')
      }
    }
  }

  Write-Host ""
  Write-Host 'CI local OctaClin OK.'
} catch {
  Write-Host ""
  Write-Error "CI local OctaClin falhou: $($_.Exception.Message)"
  exit 1
}
