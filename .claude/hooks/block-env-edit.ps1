# Bloqueia edicao de arquivos .env (exceto .env.example).
# Contrato de saida do Claude Code: apenas exit 2 bloqueia por codigo de saida.
# Este hook decide sempre por JSON com exit 0. Quando nao consegue avaliar o
# payload, degrada para "ask" em vez de liberar em silencio (fail-open).

$stdin = [Console]::In.ReadToEnd()

function Send-Decision {
    param([string]$Decision, [string]$Reason)
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = $Decision
            permissionDecisionReason = $Reason
        }
    } | ConvertTo-Json -Compress -Depth 5 | Write-Output
    exit 0
}

try {
    $json = $stdin | ConvertFrom-Json
} catch {
    Send-Decision "ask" "Protecao de .env: payload da ferramenta nao pode ser interpretado. Confirme manualmente que esta escrita nao atinge um arquivo .env."
}

$path = $json.tool_input.file_path
if (-not $path) {
    Send-Decision "ask" "Protecao de .env: 'tool_input.file_path' ausente no payload. Confirme manualmente que esta escrita nao atinge um arquivo .env."
}

# Regex sobre o path bruto: Split-Path pode lancar em caminho malformado,
# e uma excecao aqui produziria exit != 0, que nao bloqueia (fail-open).
$ehEnv = $path -match '(^|[\/])\.env(\.[^\/]+)?$'
$ehExemplo = $path -match '(^|[\/])\.env\.example$'

if ($ehEnv -and -not $ehExemplo) {
    Send-Decision "deny" "Bloqueado: edicao de arquivos .env e proibida pelas regras do projeto (AGENTS.md/CLAUDE.md). Use .env.example ou variaveis de ambiente."
}

exit 0
