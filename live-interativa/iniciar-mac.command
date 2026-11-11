#!/bin/bash
cd "$(dirname "$0")"

# Usa o Node.js do computador. Se não tiver, usa (ou baixa) uma cópia só pra este sistema.
if ! command -v node >/dev/null 2>&1; then
  if [ ! -x "./runtime/node/bin/node" ]; then
    echo ""
    echo "  Node.js não encontrado. Vou baixar uma cópia só pra este sistema."
    echo "  Não instala nada no computador. Precisa de internet, só na primeira vez."
    echo ""
    if ! bash "./scripts/instalar-node.sh"; then
      echo ""
      echo "  Não consegui baixar o Node.js automaticamente."
      echo "  Instale a versão LTS em https://nodejs.org e abra este arquivo de novo."
      read -p "Aperte Enter pra fechar..."
      exit 1
    fi
  fi
  export PATH="$PWD/runtime/node/bin:$PATH"
fi

echo "Conferindo dependências (na primeira vez demora um pouco)..."
npm install --no-audit --no-fund --loglevel=error || { echo "Erro instalando dependências. Confira a internet."; read -p "Enter pra fechar..."; exit 1; }

(sleep 2 && open "http://localhost:3000/painel") &
node server.js
