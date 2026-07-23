$stdin = [Console]::In.ReadToEnd()
try { $json = $stdin | ConvertFrom-Json } catch { exit 0 }

$path = $json.tool_input.file_path
if (-not $path) { $path = $json.tool_response.filePath }
if (-not $path) { exit 0 }
if ($path -notmatch '\.(ts|tsx)$') { exit 0 }

$normalized = $path -replace '\\','/'

if ($normalized -match '/octaclin-backend/') {
    $target = 'octaclin-backend'
} elseif ($normalized -match '/octaclin-web/') {
    $target = 'octaclin-web'
} else {
    exit 0
}

$result = pnpm --dir $target typecheck 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    $msg = ($result | Out-String)
    if ($msg.Length -gt 3000) { $msg = $msg.Substring($msg.Length - 3000) }
    $out = @{
        systemMessage = "Typecheck de $target falhou apos a edicao de $path"
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
            additionalContext = "Typecheck de $target falhou apos editar $path :`n$msg"
        }
    } | ConvertTo-Json -Compress -Depth 5
    Write-Output $out
}
exit 0
