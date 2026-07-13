$ErrorActionPreference = 'Stop'

Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -like '*outputs\octaclin-web*next*' -or
    $_.CommandLine -like '*outputs\octaclin-backend\scripts\api-demo-local.mjs*'
  } |
  ForEach-Object {
    Write-Host "Parando processo $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

Write-Host 'Demo local parada.'
