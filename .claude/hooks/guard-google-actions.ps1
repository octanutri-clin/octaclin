$stdin = [Console]::In.ReadToEnd()
try { $json = $stdin | ConvertFrom-Json } catch { exit 0 }

if ($json.tool_name -ne "Bash") { exit 0 }
$cmd = $json.tool_input.command
if (-not $cmd) { exit 0 }

$isGog = $cmd -match '(^|[\s;&|])gog(\.exe)?\s'
$isGmailSkill = $cmd -match 'gmail_skill\.py'

if (-not $isGog -and -not $isGmailSkill) { exit 0 }

$writeReason = $null

if ($isGog -and ($cmd -notmatch '--readonly')) {
    $gogWritePattern = 'gog\b.*\s(gmail\s+(send|reply|reply-all|forward|drafts\s+send|trash|labels\s+(create|delete)|thread\s+modify|batch\s+delete|mark-read|unread|archive)|calendar\s+(create|update|delete|move|respond|subscribe|unsubscribe|create-calendar|delete-calendar|focus-time|out-of-office|working-location)|drive\s+(upload|copy|move|rename|mkdir|delete|share|unshare|bulk|comments\s+(create|reply|resolve|delete))|docs\s+(create|copy|write|insert|delete|clear|update|edit|find-replace|sed|format|insert-table|cell-update|cell-style|insert-image|replace-image|page-layout)|sheets\s+(create|copy|export|update|batch-update|append|clear|insert|delete-dimension|format|merge|unmerge|add-tab|delete-tab|rename-tab|reorder-tab|find-replace|update-note)|slides\s+(create|copy|export|new-slide|add-slide|duplicate-slide|move-slide|delete-slide|insert-text|replace-text|insert-image|style-text|update-notes))\b'
    if ($cmd -match $gogWritePattern) {
        $writeReason = "Comando 'gog' de escrita (Gmail/Calendar/Drive/Docs/Sheets/Slides) sem --readonly."
    }
}

if ($isGmailSkill) {
    $gmailWritePattern = 'gmail_skill\.py\s+(send|draft|mark-read|mark-unread|mark-done|unarchive|star|unstar|logout)\b'
    if ($cmd -match $gmailWritePattern) {
        $writeReason = "Comando gmail_skill.py de escrita (envia/edita email real ou remove conta)."
    }
}

if ($writeReason) {
    $out = @{
        hookSpecificOutput = @{
            hookEventName = "PreToolUse"
            permissionDecision = "ask"
            permissionDecisionReason = "$writeReason Confirme explicitamente antes de executar esta acao real no Google Workspace/Gmail."
        }
    } | ConvertTo-Json -Compress -Depth 5
    Write-Output $out
}
exit 0
