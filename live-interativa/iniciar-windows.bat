@echo off
chcp 65001 >nul
title Live Interativa
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org , instale e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo Conferindo dependencias (na primeira vez demora um pouco)...
call npm install --no-audit --no-fund --loglevel=error

start "" http://localhost:3000/painel
node server.js
pause
