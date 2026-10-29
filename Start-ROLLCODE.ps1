param([ValidateSet('desktop', 'web', 'build', 'test')][string]$Mode = 'desktop')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskLocalBun = Join-Path $PSScriptRoot '.tools/bun-windows-x64'
if (Test-Path (Join-Path $taskLocalBun 'bun.exe')) { $env:PATH = "$taskLocalBun;$env:PATH" }
$taskLocalRust = Join-Path $PSScriptRoot '.tools/rustup'
if (Test-Path (Join-Path $taskLocalRust 'toolchains')) {
    $env:RUSTUP_HOME = $taskLocalRust
    $env:CARGO_HOME = Join-Path $PSScriptRoot '.tools/cargo'
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { throw 'Install Bun 1.4.2 or newer, then rerun this script.' }
switch ($Mode) {
    'desktop' { bun run rollcode:desktop }
    'web' { bun run rollcode }
    'build' { bun run rollcode:build }
    'test' { bun run --cwd apps/examples/desktop-app test:rollcode }
}
exit $LASTEXITCODE
