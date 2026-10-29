# ORYZO 安装脚本（Windows）
# 用法：在仓库根目录运行  .\install.ps1
$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
$pkgPath = Join-Path $profileDir 'package.json'
$pluginPath = (Join-Path $PSScriptRoot 'plugin') -replace '\\', '/'

if (-not (Test-Path $pkgPath)) {
  Write-Host "找不到 profile：$pkgPath" -ForegroundColor Red
  Write-Host "请先启动一次 DSH 桌面端，让它生成 profile。" -ForegroundColor Yellow
  exit 1
}

Copy-Item $pkgPath "$pkgPath.bak" -Force
$json = Get-Content $pkgPath -Raw | ConvertFrom-Json

if (-not $json.dependencies) { $json.dependencies = [pscustomobject]@{} }
$json.dependencies | Add-Member -NotePropertyName 'dsh-plugin-oryzo' -NotePropertyValue ("link:" + $pluginPath) -Force

if (-not $json.dsh.profile.bundles) { $json.dsh.profile.bundles = @() }
if ($json.dsh.profile.bundles -notcontains 'dsh-plugin-oryzo') {
  $json.dsh.profile.bundles += 'dsh-plugin-oryzo'
}

$json | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8
Write-Host "已写入 profile（备份在 package.json.bak）" -ForegroundColor Green
Write-Host "插件路径：$pluginPath"
Write-Host "请完全退出并重启 DSH 桌面端。" -ForegroundColor Green