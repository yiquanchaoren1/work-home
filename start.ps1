$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskUrl = $null
function Get-LocalState([string]$url) {
    $taskJson = & curl.exe --noproxy '*' --silent --max-time 2 "$url/api/state" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $taskJson) { return $null }
    try { return ($taskJson | ConvertFrom-Json) } catch { return $null }
}
foreach ($taskPort in @(4317, 4318)) {
    $taskResponse = Get-LocalState "http://127.0.0.1:$taskPort"
    if ($taskResponse.revision -and ($taskResponse.features -contains 'ui-refresh-v1')) { $taskUrl = "http://localhost:$taskPort"; break }
}
if (-not $taskUrl) {
    $taskPort = if (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue) { 4318 } else { 4317 }
    if (Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue) { throw "端口 $taskPort 已被其他服务占用，无法启动工作间。" }
    $env:PORT = [string]$taskPort
    $taskUrl = "http://localhost:$taskPort"
    $taskNode = (Get-Command node.exe).Source
    Start-Process -FilePath $taskNode -ArgumentList @('server.mjs') -WorkingDirectory $taskRoot -WindowStyle Hidden
    for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
        Start-Sleep -Milliseconds 250
        $taskResponse = Get-LocalState $taskUrl
        if ($taskResponse.revision -and ($taskResponse.features -contains 'ui-refresh-v1')) { break }
    }
    if (-not $taskResponse.revision -or -not ($taskResponse.features -contains 'ui-refresh-v1')) { throw '本机工作间服务未能启动。请在项目目录运行 npm.cmd start 查看错误。' }
}
Start-Process $taskUrl
