param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$bundledPythonPath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPythonPath) {
    $pythonExecutable = $bundledPythonPath
} else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) { throw 'Python 3.10 or later is required.' }
    $pythonExecutable = $pythonCommand.Source
}
& $pythonExecutable (Join-Path $PSScriptRoot 'scripts\serve.py') --port $Port
exit $LASTEXITCODE
