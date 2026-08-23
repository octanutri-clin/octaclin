param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryRoot
)

$ErrorActionPreference = 'Stop'

function Assert-RequiredPattern {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Pattern,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  if (-not (Select-String -LiteralPath $Path -Pattern $Pattern -Quiet)) {
    throw "Marcador obrigatorio ausente ($Description): $Path"
  }
}

function Get-NormalizedUtf8Sha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($Path))
  $normalized = $text.Replace("`r`n", "`n").TrimEnd("`n")
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized))
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Get-PackageScripts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Directory
  )

  $packagePath = Join-Path $Directory 'package.json'
  if (-not (Test-Path -LiteralPath $packagePath)) {
    throw "package.json ausente para comando pnpm em: $Directory"
  }

  $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  $scripts = @{}
  if ($null -ne $package.scripts) {
    foreach ($property in $package.scripts.PSObject.Properties) {
      $scripts[$property.Name] = $true
    }
  }

  return $scripts
}

function Resolve-PnpmWorkingDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseDirectory,
    [Parameter(Mandatory = $true)]
    [string]$DirectoryArgument
  )

  $cleanArgument = $DirectoryArgument.Trim('"', "'")
  if ([System.IO.Path]::IsPathRooted($cleanArgument)) {
    return [System.IO.Path]::GetFullPath($cleanArgument)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $BaseDirectory $cleanArgument))
}

function Assert-PnpmCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandLine,
    [Parameter(Mandatory = $true)]
    [string]$CurrentDirectory,
    [Parameter(Mandatory = $true)]
    [string]$SourceDescription
  )

  $tokens = [regex]::Matches($CommandLine.Trim(), '(?:"[^"]*"|''[^'']*''|\S+)') |
    ForEach-Object { $_.Value }

  if ($tokens.Count -lt 2 -or $tokens[0] -ne 'pnpm') {
    return
  }

  $workingDirectory = $CurrentDirectory
  $index = 1
  while ($index -lt $tokens.Count -and $tokens[$index].StartsWith('-')) {
    $option = $tokens[$index]
    if ($option -in @('--dir', '-C')) {
      if ($index + 1 -ge $tokens.Count) {
        throw "Opcao $option sem diretorio em $SourceDescription"
      }
      $workingDirectory = Resolve-PnpmWorkingDirectory $CurrentDirectory $tokens[$index + 1]
      $index += 2
      continue
    }

    if ($option -match '^--dir=(.+)$') {
      $workingDirectory = Resolve-PnpmWorkingDirectory $CurrentDirectory $Matches[1]
      $index++
      continue
    }

    if ($option -in @('--filter', '-F', '--package')) {
      $index += 2
      continue
    }

    $index++
  }

  if ($index -ge $tokens.Count) {
    throw "Comando pnpm incompleto em $SourceDescription"
  }

  $command = $tokens[$index]
  $builtInCommands = @(
    'add', 'audit', 'create', 'deploy', 'dlx', 'env', 'exec', 'fetch', 'import',
    'init', 'install', 'link', 'list', 'outdated', 'pack', 'patch',
    'patch-commit', 'prune', 'publish', 'rebuild', 'remove', 'run', 'setup',
    'store', 'unlink', 'update', 'why'
  )

  $scriptName = $command
  if ($command -eq 'run') {
    if ($index + 1 -ge $tokens.Count) {
      throw "pnpm run sem script em $SourceDescription"
    }
    $scriptName = $tokens[$index + 1]
  } elseif ($command -in $builtInCommands) {
    return
  }

  $scripts = Get-PackageScripts $workingDirectory
  if (-not $scripts.ContainsKey($scriptName)) {
    $relativeDirectory = $workingDirectory
    if ($workingDirectory.StartsWith($RepositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      $relativeDirectory = $workingDirectory.Substring($RepositoryRoot.Length).TrimStart('\', '/')
      if ([string]::IsNullOrWhiteSpace($relativeDirectory)) {
        $relativeDirectory = '.'
      }
    }
    throw "Script pnpm inexistente '$scriptName' em $relativeDirectory ($SourceDescription)"
  }
}

function Assert-PnpmCommandsInDocument {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $path = Join-Path $RepositoryRoot $RelativePath
  $insideCodeBlock = $false
  $directoryStack = [System.Collections.Generic.Stack[string]]::new()
  $documentDirectory = $RepositoryRoot
  $currentDirectory = $documentDirectory
  $lineNumber = 0

  foreach ($line in Get-Content -LiteralPath $path) {
    $lineNumber++

    # Runbooks podem declarar o diretorio operacional usado pelos blocos seguintes.
    if (-not $insideCodeBlock -and $line -match '`Root Directory`:\s*`([^`]+)`') {
      $documentDirectory = Resolve-PnpmWorkingDirectory $RepositoryRoot $Matches[1]
      $currentDirectory = $documentDirectory
    }

    if ($line -match '^\s*```') {
      $insideCodeBlock = -not $insideCodeBlock
      if (-not $insideCodeBlock) {
        $directoryStack.Clear()
        $currentDirectory = $documentDirectory
      }
      continue
    }

    if (-not $insideCodeBlock) {
      foreach ($inlineCommand in [regex]::Matches($line, '`(?<command>pnpm\s+[^`]+)`')) {
        Assert-PnpmCommand $inlineCommand.Groups['command'].Value $RepositoryRoot "$RelativePath`:$lineNumber (inline)"
      }
      continue
    }

    if ($line -match '^\s*Push-Location\s+(.+?)\s*$') {
      $directoryStack.Push($currentDirectory)
      $currentDirectory = Resolve-PnpmWorkingDirectory $currentDirectory $Matches[1]
      continue
    }

    if ($line -match '^\s*Pop-Location\s*$') {
      if ($directoryStack.Count -gt 0) {
        $currentDirectory = $directoryStack.Pop()
      }
      continue
    }

    if ($line -match '^\s*pnpm\s+') {
      Assert-PnpmCommand $line.Trim() $currentDirectory "$RelativePath`:$lineNumber"
    }
  }
}

$RepositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)

$requiredDocuments = @(
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'DECISOES_ARQUITETURA.md',
  'MATRIZ_CONFIABILIDADE_TESTES.md',
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
  'RUNBOOK_STAGING_DADOS.md',
  'RUNBOOK_PILOTO_INTERNO.md',
  'PILOTO_INTERNO_CONTROLE.md',
  'RUNBOOK_PRODUCAO_ISOLADA.md',
  'PRODUCAO_ISOLADA_CONTROLE.md',
  'CHECKLIST_GO_LIVE.md',
  'docs/governance/DECISAO_FINAL_GOVERNANCA_AGENTES_OCTACLIN.md'
)

foreach ($relativePath in $requiredDocuments) {
  if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $relativePath))) {
    throw "Documento obrigatorio ausente: $relativePath"
  }
}

$decisionPath = Join-Path $RepositoryRoot 'docs/governance/DECISAO_FINAL_GOVERNANCA_AGENTES_OCTACLIN.md'
Assert-RequiredPattern $decisionPath '^> \*\*Status:\*\* APROVADO PARA IMPLEMENTA' 'decisao aprovada'

$claudePath = Join-Path $RepositoryRoot 'CLAUDE.md'
# SHA-256 das sete linhas aprovadas, em UTF-8, com LF e sem quebra final.
$expectedClaudeBridgeHash = '89cb215b97ce0411488f63faeb80696b3c9dcdf12f8f7438134ae8d3a4bb74bf'
if ((Get-NormalizedUtf8Sha256 $claudePath) -cne $expectedClaudeBridgeHash) {
  throw 'CLAUDE.md divergiu da bridge canonica aprovada.'
}

$statusPath = Join-Path $RepositoryRoot 'STATUS_ATUAL_PROJETO.md'
$checklistPath = Join-Path $RepositoryRoot 'CHECKLIST_FASES_FUTURAS_PRODUCAO.md'
$statusContent = Get-Content -LiteralPath $statusPath -Raw
$checklistContent = Get-Content -LiteralPath $checklistPath -Raw

$statusMatch = [regex]::Match(
  $statusContent,
  '(?ms)^- Fase (?<completed>\d+) concluida.*?A proxima fase oficial e a Fase (?<next>\d+)\.'
)
if (-not $statusMatch.Success) {
  throw 'STATUS_ATUAL_PROJETO.md nao informa fase concluida e proxima fase oficial no Snapshot.'
}

$checklistMatch = [regex]::Match(
  $checklistContent,
  '(?ms)^Atualizado em .*?conclusao da Fase (?<completed>\d+) e a Fase (?<next>\d+) como proxima\s+fase oficial\.'
)
if (-not $checklistMatch.Success) {
  throw 'CHECKLIST_FASES_FUTURAS_PRODUCAO.md nao informa fase concluida e proxima fase oficial no cabecalho.'
}

$statusCompleted = [int]$statusMatch.Groups['completed'].Value
$statusNext = [int]$statusMatch.Groups['next'].Value
$checklistCompleted = [int]$checklistMatch.Groups['completed'].Value
$checklistNext = [int]$checklistMatch.Groups['next'].Value

if ($statusCompleted -ne $checklistCompleted -or $statusNext -ne $checklistNext) {
  throw "Status e checklist divergem: status=$statusCompleted->$statusNext; checklist=$checklistCompleted->$checklistNext."
}

if ($statusNext -ne ($statusCompleted + 1)) {
  throw "Sequencia de fases invalida no status: $statusCompleted->$statusNext."
}

Assert-RequiredPattern $checklistPath "(?m)^- \[ \] Fase $statusNext - " "proxima fase $statusNext pendente"

$activeCommandDocuments = @(
  'README.md',
  'AGENTS.md',
  'TESTES_E_VALIDACOES.md',
  'PREFLIGHT_PRODUCAO.md',
  'RUNBOOK_PRODUCAO.md',
  'RUNBOOK_ROTACAO_SECRETS.md',
  'RUNBOOK_BACKUP_RESTORE.md',
  'RUNBOOK_SUPORTE.md',
  'RUNBOOK_STAGING_DADOS.md',
  'RUNBOOK_PILOTO_INTERNO.md',
  'RUNBOOK_PRODUCAO_ISOLADA.md',
  'CHECKLIST_GO_LIVE.md',
  'MATRIZ_CONFIABILIDADE_TESTES.md'
)

foreach ($relativePath in $activeCommandDocuments) {
  Assert-PnpmCommandsInDocument $relativePath
}

Write-Host 'Documentacao canonica e comandos pnpm validados.'
