$ErrorActionPreference = 'Stop'
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$script = Join-Path $PSScriptRoot 'src\update.mjs'
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '06:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'NBA Roster Cap Dashboard Update' -Action $action -Trigger $trigger -Settings $settings -Description 'Daily NBA roster, salary, cap and transaction data update' -Force
Write-Host 'Daily update scheduled for 06:00.'
