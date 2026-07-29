param(
  [Parameter(Mandatory = $true)]
  [string]$BancoOrigem,

  [Parameter(Mandatory = $true)]
  [string]$BancoDestino,

  [ValidateSet('completo', 'backup', 'restore', 'validar', 'limpar')]
  [string]$Etapa = 'completo'
)

$ErrorActionPreference = 'Stop'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'

function Assert-PostgresCommand {
  param([string]$Nome)

  $caminho = Join-Path $pgBin "$Nome.exe"
  if (-not (Test-Path $caminho)) {
    throw "Cliente PostgreSQL ausente: $caminho"
  }
  return $caminho
}

function Substituir-BancoNaUrl {
  param(
    [string]$ConnectionString,
    [string]$BancoEsperado,
    [string]$NovoBanco
  )

  $uri = [Uri]$ConnectionString
  if ($uri.AbsolutePath.Trim('/') -ne $BancoEsperado) {
    throw "A connection string deve apontar para o banco dedicado '$BancoEsperado'."
  }

  $resultado = $ConnectionString -replace ([Regex]::Escape("/$BancoEsperado") + '(?=\\?|$)'), "/$NovoBanco"
  if ($resultado -eq $ConnectionString) {
    throw 'Nao foi possivel substituir o banco na connection string.'
  }
  return $resultado
}

function Obter-Contagens {
  param(
    [string]$Psql,
    [string]$ConnectionString,
    [string[]]$Tabelas
  )

  $consultas = @($Tabelas | ForEach-Object {
    "SELECT '$($_)' AS chave, count(*)::text AS total FROM public.$_"
  })
  $consultas += "SELECT '__politicas_rls' AS chave, count(*)::text AS total FROM pg_policies WHERE schemaname = 'public'"
  $consultas += "SELECT '__usuarios_autenticaveis' AS chave, count(*)::text AS total FROM public.usuarios WHERE senha_hash IS NOT NULL"
  $sql = $consultas -join ' UNION ALL '
  $saida = @(& $Psql --dbname $ConnectionString --tuples-only --no-align --field-separator '|' --set ON_ERROR_STOP=1 --command $sql)
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha na validacao SQL pos-restore.'
  }

  $resultado = @{}
  foreach ($linha in $saida | Where-Object { $_.Trim() -ne '' }) {
    $partes = $linha.Split('|', 2)
    if ($partes.Count -ne 2) { throw 'Saida SQL de validacao invalida.' }
    $resultado[$partes[0]] = $partes[1]
  }
  return $resultado
}

$destino = (Get-Clipboard -Raw).Trim()
if ($destino -notmatch '^postgres(?:ql)?://') {
  throw 'A area de transferencia nao contem uma connection string PostgreSQL.'
}

$origem = Substituir-BancoNaUrl -ConnectionString $destino -BancoEsperado $BancoDestino -NovoBanco $BancoOrigem
$pgDump = Assert-PostgresCommand 'pg_dump'
$pgRestore = Assert-PostgresCommand 'pg_restore'
$psql = Assert-PostgresCommand 'psql'
$diretorioTemporario = Join-Path $env:TEMP "octaclin-restore-$BancoDestino"
$arquivoDump = Join-Path $diretorioTemporario 'producao.dump'

if ($Etapa -eq 'limpar') {
  if (Test-Path $arquivoDump) { Remove-Item -LiteralPath $arquivoDump -Force }
  if (Test-Path $diretorioTemporario) { Remove-Item -LiteralPath $diretorioTemporario -Force }
  Write-Output 'DUMP_TEMPORARIO_REMOVIDO'
  return
}

try {
  if ($Etapa -eq 'completo' -or $Etapa -eq 'backup') {
    New-Item -ItemType Directory -Path $diretorioTemporario -Force | Out-Null
    Remove-Item -LiteralPath $arquivoDump -Force -ErrorAction SilentlyContinue
    # Neon gerencia a extensao TimescaleDB no destino; os metadados dela nao devem ser restaurados.
    & $pgDump --format=custom --no-owner --no-acl --exclude-extension=timescaledb --file $arquivoDump $origem
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou com exit code $LASTEXITCODE" }

    $itensDump = @(& $pgRestore --list $arquivoDump)
    if ($LASTEXITCODE -ne 0 -or $itensDump.Count -eq 0) {
      throw 'A validacao estrutural do dump falhou.'
    }
    if ($Etapa -eq 'backup') {
      Write-Output "BACKUP_OK itens_dump=$($itensDump.Count)"
      return
    }
  }

  if ($Etapa -eq 'completo' -or $Etapa -eq 'restore') {
    if (-not (Test-Path $arquivoDump)) { throw 'Dump temporario ausente para a etapa de restore.' }
    & $pgRestore --clean --if-exists --no-owner --no-acl --dbname $destino $arquivoDump
    if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou com exit code $LASTEXITCODE" }
    if ($Etapa -eq 'restore') {
      Write-Output 'RESTORE_ETAPA_OK'
      return
    }
  }

  $tabelasCriticas = @(
    'tenants', 'usuarios', 'pacientes', 'profissionais', 'questionarios',
    'envios_questionario', 'respostas_checkin', 'resposta_valores', 'agenda_consultas', 'mensagens_notificacao',
    'outbox_eventos', 'user_action_logs', 'consentimentos_lgpd'
  )

  $contagensOrigem = Obter-Contagens -Psql $psql -ConnectionString $origem -Tabelas $tabelasCriticas
  $contagensDestino = Obter-Contagens -Psql $psql -ConnectionString $destino -Tabelas $tabelasCriticas
  foreach ($tabela in $tabelasCriticas + '__politicas_rls' + '__usuarios_autenticaveis') {
    if ($contagensOrigem[$tabela] -ne $contagensDestino[$tabela]) {
      throw "Contagem divergente na tabela critica $tabela."
    }
  }
  Write-Output "VALIDACAO_OK tabelas_criticas=$($tabelasCriticas.Count) politicas_rls=$($contagensDestino['__politicas_rls']) usuarios_autenticaveis=$($contagensDestino['__usuarios_autenticaveis'])"
} finally {
  if ($Etapa -eq 'completo' -and (Test-Path $diretorioTemporario)) {
    Remove-Item -LiteralPath $diretorioTemporario -Recurse -Force
  }
}
