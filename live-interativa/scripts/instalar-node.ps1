# Baixa uma cópia do Node.js só pra este sistema (pasta runtime\node), sem instalar no Windows.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'runtime'
$base = 'https://nodejs.org/dist/latest-v22.x'
$arq = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'win-arm64' } else { 'win-x64' }

Write-Host ' Procurando a versao certa do Node.js...'
$shas = (Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content
$linha = ($shas -split "`n") | Where-Object { $_ -match "node-v[0-9.]+-$arq\.zip\s*$" } | Select-Object -First 1
if (-not $linha) { throw 'Nao achei o Node.js pra este computador.' }
$partes = $linha.Trim() -split '\s+'
$esperado = $partes[0].ToLower()
$arquivo = $partes[1]
$pasta = $arquivo -replace '\.zip$', ''

Write-Host " Baixando $arquivo (uns 30 MB, so na primeira vez)..."
$zip = Join-Path $env:TEMP $arquivo
Invoke-WebRequest "$base/$arquivo" -OutFile $zip -UseBasicParsing

$real = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($real -ne $esperado) { Remove-Item $zip -Force; throw 'O arquivo baixado veio corrompido. Tente de novo.' }

Write-Host ' Extraindo...'
New-Item -ItemType Directory -Force $destino | Out-Null
$final = Join-Path $destino 'node'
if (Test-Path $final) { Remove-Item $final -Recurse -Force }
Expand-Archive $zip -DestinationPath $destino -Force
Rename-Item (Join-Path $destino $pasta) 'node'
Remove-Item $zip -Force
Write-Host ' Node.js pronto!'
