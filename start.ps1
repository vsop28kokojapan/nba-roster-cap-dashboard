$ErrorActionPreference = 'Stop'
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
Push-Location $PSScriptRoot
try {
  & $node 'src/update.mjs'
  Start-Process "http://127.0.0.1:4173"
  & $node 'src/server.mjs'
} finally { Pop-Location }
