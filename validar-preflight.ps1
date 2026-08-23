param(
  [switch]$DocsOnly,
  [switch]$Full,
  [switch]$SkipBackendTests,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $raiz 'octaclin-backend'
$web = Join-Path $raiz 'octaclin-web'
$runtimeNodeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$runtimeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'

if ((Test-Path $runtimeNodeBin) -and (Test-Path $runtimeBin)) {
  $env:PATH = "$runtimeNodeBin;$runtimeBin;$env:PATH"
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

function Invoke-Pnpm {
  param(
    [string]$WorkingDirectory,
    [string[]]$Arguments
  )

  Push-Location $WorkingDirectory
  try {
    & pnpm @Arguments
  } finally {
    Pop-Location
  }
}

Push-Location $raiz
try {
  Invoke-Step 'Git diff check' {
    git diff --check
  }

  Invoke-Step 'Scanner local de secrets' {
    node (Join-Path $raiz 'scripts/scan-secrets.mjs')
  }

  Invoke-Step 'Documentacao canonica' {
    & (Join-Path $raiz 'scripts/validar-documentacao.ps1') -RepositoryRoot $raiz
  }

  if (-not $DocsOnly) {
    Invoke-Step 'Backend typecheck' {
      Invoke-Pnpm $backend @('typecheck')
    }

    if (-not $SkipBackendTests) {
      Invoke-Step 'Backend specs de acesso e portais' {
        Invoke-Pnpm $backend @(
          'exec',
          'jest',
          'permissoes.spec.ts',
          'guarda-permissoes.spec.ts',
          'servico-usuarios-cliente.spec.ts',
          'servico-portal-cliente.spec.ts',
          'servico-recuperacao-senha.spec.ts',
          '--runInBand'
        )
      }
    }

    Invoke-Step 'Web typecheck' {
      Invoke-Pnpm $web @('typecheck')
    }

    Invoke-Step 'Web autorizacao de rotas' {
      Invoke-Pnpm $web @('test:authz')
    }

    Invoke-Step 'Web seguranca operacional' {
      Invoke-Pnpm $web @('test:seguranca-operacional')
    }

    if ($Full -and (-not $SkipBuild)) {
      Invoke-Step 'Web build' {
        Invoke-Pnpm $web @('build')
      }

      Invoke-Step 'Web seguranca runtime' {
        Invoke-Pnpm $web @('test:seguranca-runtime')
      }
    }
  }

  Invoke-Step 'Git status' {
    git status --short
  }

  Write-Host ""
  Write-Host 'Preflight OctaClin OK.'
} finally {
  Pop-Location
}
