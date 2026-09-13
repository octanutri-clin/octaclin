param(
  [Parameter(Mandatory = $true)]
  [string]$StatusPath,
  [Parameter(Mandatory = $true)]
  [string]$ChecklistPath
)

$ErrorActionPreference = 'Stop'

$statusContent = Get-Content -LiteralPath $StatusPath -Raw
$checklistContent = Get-Content -LiteralPath $ChecklistPath -Raw
$phaseLines = [regex]::Matches(
  $checklistContent,
  '(?m)^- \[(?<state>x| )\] Fase (?<number>\d+) - '
)

$completedNumbers = @(
  foreach ($phaseLine in $phaseLines) {
    if ($phaseLine.Groups['state'].Value -eq 'x') {
      [int]$phaseLine.Groups['number'].Value
    }
  }
)
if ($completedNumbers.Count -eq 0) {
  throw 'Checklist nao informa nenhuma fase concluida.'
}

$completed = [int](($completedNumbers | Measure-Object -Maximum).Maximum)
$next = $completed + 1
$nextPending = @(
  foreach ($phaseLine in $phaseLines) {
    if ($phaseLine.Groups['state'].Value -eq ' ' -and
        [int]$phaseLine.Groups['number'].Value -eq $next) {
      $phaseLine
    }
  }
)
if ($nextPending.Count -ne 1) {
  throw "Checklist deve informar exatamente uma Fase $next pendente apos a Fase $completed concluida."
}

$header = [regex]::Match(
  $checklistContent,
  '(?ms)^Atualizado em .*?(?=\r?\n\r?\n|\z)'
).Value
if (-not $header -or $header -notmatch "(?i)\bFase $next\b") {
  throw "Cabecalho do checklist nao informa a Fase $next como fase atual ou proxima."
}

$completedBlock = [regex]::Match(
  $statusContent,
  "(?ms)^- Fase $completed\b.*?(?=^- Fase |\z)"
).Value
if (-not $completedBlock -or $completedBlock -notmatch '(?i)\bconcluida\b') {
  throw "Status nao confirma a Fase $completed como concluida."
}

$nextBlock = [regex]::Match(
  $statusContent,
  "(?ms)^- Fase $next\b.*?(?=^- Fase |\z)"
).Value
if (-not $nextBlock) {
  throw "Status nao informa a Fase $next atual ou proxima."
}

Write-Host "Fases canonicas validadas: $completed concluida; $next pendente."
