#!/bin/bash
# Baixa uma cópia do Node.js só pra este sistema (pasta runtime/node), sem instalar no computador.
set -e
cd "$(dirname "$0")/.."

case "$(uname -s)" in
  Darwin) so=darwin ;;
  Linux) so=linux ;;
  *) echo "Sistema não suportado: $(uname -s)"; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arq=arm64 ;;
  x86_64|amd64) arq=x64 ;;
  *) echo "Processador não suportado: $(uname -m)"; exit 1 ;;
esac

base="https://nodejs.org/dist/latest-v22.x"
echo " Procurando a versão certa do Node.js..."
shas="$(curl -fsSL "$base/SHASUMS256.txt")"
linha="$(echo "$shas" | grep -E "node-v[0-9.]+-$so-$arq\.tar\.gz$" | head -1)"
[ -n "$linha" ] || { echo "Não achei o Node.js pra este computador."; exit 1; }
esperado="$(echo "$linha" | awk '{print $1}')"
arquivo="$(echo "$linha" | awk '{print $2}')"

echo " Baixando $arquivo (uns 30-40 MB, só na primeira vez)..."
tmp="$(mktemp -d)"
curl -fL --progress-bar "$base/$arquivo" -o "$tmp/$arquivo"
if command -v shasum >/dev/null 2>&1; then real="$(shasum -a 256 "$tmp/$arquivo" | awk '{print $1}')"; else real="$(sha256sum "$tmp/$arquivo" | awk '{print $1}')"; fi
[ "$real" = "$esperado" ] || { echo "O arquivo baixado veio corrompido. Tente de novo."; rm -rf "$tmp"; exit 1; }

echo " Extraindo..."
mkdir -p runtime
rm -rf runtime/node
tar -xzf "$tmp/$arquivo" -C runtime
mv "runtime/${arquivo%.tar.gz}" runtime/node
rm -rf "$tmp"
echo " Node.js pronto!"
