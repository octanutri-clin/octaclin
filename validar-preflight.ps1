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

  Invoke-Step 'Documentos obrigatorios' {
    $obrigatorios = @(
      'AGENTS.md',
      'RESUMO_FASES_CONCLUIDAS.md',
      'CHECKLIST_FASES_FUTURAS_PRODUCAO.md',
      'STATUS_ATUAL_PROJETO.md',
      'HANDOFF-TECNICO-OCTACLIN.md',
      'MAPA_ROTAS_PERMISSOES.md',
      'TESTES_E_VALIDACOES.md',
      'PREFLIGHT_PRODUCAO.md',
      'RUNBOOK_PRODUCAO.md',
      'VARIAVEIS_AMBIENTE.md',
      'RUNBOOK_ROTACAO_SECRETS.md',
      'RUNBOOK_BACKUP_RESTORE.md',
      'RUNBOOK_SUPORTE.md',
      'CHECKLIST_GO_LIVE.md'
    )

    foreach ($arquivo in $obrigatorios) {
      if (-not (Test-Path (Join-Path $raiz $arquivo))) {
        throw "Documento obrigatorio ausente: $arquivo"
      }
    }
  }

  Invoke-Step 'Marcadores de continuidade' {
    Select-String -Path 'CHECKLIST_FASES_FUTURAS_PRODUCAO.md' -Pattern 'Fase 94 - Preflight de producao' | Out-Null
    Select-String -Path 'STATUS_ATUAL_PROJETO.md' -Pattern 'Fase 95' | Out-Null
    Select-String -Path 'PREFLIGHT_PRODUCAO.md' -Pattern 'Proximo passo recomendado' | Out-Null
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

    if ($Full -and (-not $SkipBuild)) {
      Invoke-Step 'Web build' {
        Invoke-Pnpm $web @('build')
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
