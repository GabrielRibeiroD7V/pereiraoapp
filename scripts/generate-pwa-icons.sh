#!/bin/sh
# Deriva ícones da logo oficial, sem redesenhar ou deformar. macOS/sips, geração opcional.
set -eu
cd "$(dirname "$0")/.."
mkdir -p public/images/pwa
source_logo=public/images/brand/pereirao-768.png
make_icon() {
 size="$1"; artwork="$2"; target="$3"
 sips --resampleHeightWidthMax "$artwork" "$source_logo" --out "$target" >/dev/null
 sips --padToHeightWidth "$size" "$size" --padColor FFFFFF "$target" --out "$target" >/dev/null
}
make_icon 192 168 public/images/pwa/icon-192.png
make_icon 512 448 public/images/pwa/icon-512.png
# O retângulo da marca inteira cabe dentro do círculo seguro de raio 40%.
make_icon 512 328 public/images/pwa/maskable-512.png
make_icon 180 158 public/images/pwa/apple-touch-icon.png
