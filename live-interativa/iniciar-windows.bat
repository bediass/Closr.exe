@echo off
chcp 65001 >nul
title Live Interativa
cd /d "%~dp0"

rem Usa o Node.js do computador. Se nao tiver, usa (ou baixa) uma copia so pra este sistema.
where node >nul 2>nul
if errorlevel 1 (
  if not exist "%~dp0runtime\node\node.exe" (
    echo.
    echo  Node.js nao encontrado. Vou baixar uma copia so pra este sistema.
    echo  Nao instala nada no Windows. Precisa de internet, so na primeira vez.
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-node.ps1"
    if errorlevel 1 (
      echo.
      echo  Nao consegui baixar o Node.js automaticamente.
      echo  Instale a versao LTS em https://nodejs.org e abra este arquivo de novo.
      echo.
      pause
      exit /b 1
    )
  )
  set "PATH=%~dp0runtime\node;%PATH%"
)

echo Conferindo dependencias - na primeira vez demora um pouco...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo.
  echo  Deu erro instalando as dependencias. Confira a internet e abra de novo.
  pause
  exit /b 1
)

start "" http://localhost:3000/painel
node server.js
pause
