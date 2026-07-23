$stdin = [Console]::In.ReadToEnd()
try { $json = $stdin | ConvertFrom-Json } catch { exit 0 }

$path = $json.tool_input.file_path
if (-not $path) { exit 0 }

$fileName = Split-Path $path -Leaf
if ($fileName -match '^\.env(\..+)?$' -and $fileName -ne '.env.example') {
    $out = @{
        hookSpecificOutput = @{
            hookEventName = "PreToolUse"
            permissionDecision = "deny"
            permissionDecisionReason = "Bloqueado: edicao de arquivos .env e proibida pelas regras do projeto (AGENTS.md/CLAUDE.md). Use .env.example ou variaveis de ambiente."
        }
    } | ConvertTo-Json -Compress -Depth 5
    Write-Output $out
}
exit 0
