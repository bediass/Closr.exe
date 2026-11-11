#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js não está instalado."
  echo "  Baixe a versão LTS em https://nodejs.org , instale e abra este arquivo de novo."
  echo ""
  read -p "Aperte Enter pra fechar..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando dependências pela primeira vez, aguarde..."
  npm install
fi

(sleep 2 && open "http://localhost:3000/painel") &
node server.js
