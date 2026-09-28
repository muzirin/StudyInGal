# 批量截取各页面截图，用于视觉检查 / 视觉回归。
#
# 用法：
#   pwsh scripts/capture-screens.ps1 -OutDir .screens
#
# 依赖：先执行 npm run build（或本脚本加 -Build）。

param(
  [string]$OutDir = ".screens",
  [int]$Delay = 3200,
  [switch]$Build,
  [string[]]$Routes = @(
    "/",
    "/library/paper",
    "/companion",
    "/galgame",
    "/tools",
    "/characters",
    "/workshop",
    "/cloud",
    "/xuexitong",
    "/playground",
    "/archive",
    "/settings",
    "/devtools"
  )
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$absOut = (Resolve-Path -LiteralPath $OutDir).Path

# Electron 在设置了 ELECTRON_RUN_AS_NODE 的环境下会退化为纯 Node
$env:ELECTRON_RUN_AS_NODE = $null
$exe = Join-Path $root "node_modules\electron\dist\electron.exe"

if ($Build) {
  npm run build
}

foreach ($route in $Routes) {
  $name = if ($route -eq "/") { "home" } else { ($route.TrimStart("/") -replace "[/\\]", "-") }
  $env:SIG_CAPTURE_PATH = Join-Path $absOut "$name.png"
  $env:SIG_CAPTURE_DELAY = "$Delay"
  $env:SIG_CAPTURE_ROUTE = $route
  Write-Host "capture $route -> $env:SIG_CAPTURE_PATH"
  & $exe . | Out-Null
}

Remove-Item Env:SIG_CAPTURE_PATH -ErrorAction SilentlyContinue
Remove-Item Env:SIG_CAPTURE_DELAY -ErrorAction SilentlyContinue
Remove-Item Env:SIG_CAPTURE_ROUTE -ErrorAction SilentlyContinue

Get-ChildItem -LiteralPath $OutDir -Filter *.png | Select-Object Name, Length | Format-Table -AutoSize
