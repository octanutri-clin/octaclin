param(
  [string]$DiretorioBackup = 'backups',
  [switch]$RestoreTeste
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeNodeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$runtimeBin = 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback'

if ((Test-Path $runtimeNodeBin) -and (Test-Path $runtimeBin)) {
  $env:PATH = "$runtimeNodeBin;$runtimeBin;$env:PATH"
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando obrigatorio ausente no PATH: $Name"
  }
}

function Invoke-Checked {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name falhou com exit code $LASTEXITCODE"
  }
  Write-Host "OK: $Name"
}

Push-Location $raiz
try {
  Assert-Command 'node'
  Assert-Command 'pg_dump'
  Assert-Command 'pg_restore'

  if ($RestoreTeste -and $env:CONFIRMAR_RESTORE_TESTE -ne 'SIM') {
    throw 'Para restore de teste, defina CONFIRMAR_RESTORE_TESTE=SIM e RESTORE_DATABASE_URL apontando para banco dedicado.'
  }

  $env:OCTACLIN_BACKUP_DIR = $DiretorioBackup
  $planoJson = node (Join-Path $raiz 'scripts/backup-restore-plan.mjs')
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao gerar plano de backup/restore.'
  }

  $plano = $planoJson | ConvertFrom-Json
  $diretorioResolvido = Join-Path $raiz $DiretorioBackup
  New-Item -ItemType Directory -Path $diretorioResolvido -Force | Out-Null

  $arquivoBackup = Join-Path $raiz $plano.caminhoBackup
  $argumentosBackup = @('--format=custom', '--no-owner', '--no-acl', '--file', $arquivoBackup, $env:DATABASE_URL)
  Invoke-Checked 'Backup PostgreSQL custom format' 'pg_dump' $argumentosBackup

  $argumentosValidacao = @('--list', $arquivoBackup)
  Invoke-Checked 'Validacao estrutural do dump' 'pg_restore' $argumentosValidacao

  if ($RestoreTeste) {
    if (-not $env:RESTORE_DATABASE_URL) {
      throw 'RESTORE_DATABASE_URL e obrigatoria para restore de teste.'
    }
    $argumentosRestore = @('--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', $env:RESTORE_DATABASE_URL, $arquivoBackup)
    Invoke-Checked 'Restore em banco dedicado de teste' 'pg_restore' $argumentosRestore
  }

  Write-Host ""
  Write-Host "Backup gerado: $arquivoBackup"
  if ($RestoreTeste) {
    Write-Host 'Restore de teste executado em banco dedicado.'
  } else {
    Write-Host 'Restore de teste nao executado. Use -RestoreTeste com RESTORE_DATABASE_URL dedicado e CONFIRMAR_RESTORE_TESTE=SIM.'
  }
} finally {
  Pop-Location
}
