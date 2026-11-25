#!/bin/sh
# Deriva o lettering usado no cabeçalho da logo oficial, sem redesenhar ou deformar.
set -eu
cd "$(dirname "$0")/.."
mkdir -p public/images/pwa
source_logo=public/images/brand/pereirao-768.png
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

# Mesmo recorte exibido no cabeçalho: letras brancas e sublinhado ciano.
magick "$source_logo" -crop 690x155+40+333 +repage -fuzz 12% -transparent white "$tmp_dir/crop.png"
magick "$tmp_dir/crop.png" -crop 690x105+0+0 +repage -alpha extract \
  -background black -gravity north -extent 690x155 "$tmp_dir/letters-mask.png"
magick -size 690x155 xc:white "$tmp_dir/letters-mask.png" -alpha off \
  -compose copyopacity -composite "$tmp_dir/letters.png"
magick "$tmp_dir/crop.png" -crop 690x50+0+105 +repage -alpha extract \
  -background black -gravity south -extent 690x155 "$tmp_dir/underline-mask.png"
magick -size 690x155 xc:'#5bd5e6' "$tmp_dir/underline-mask.png" -alpha off \
  -compose copyopacity -composite "$tmp_dir/underline.png"
magick -size 690x155 xc:none "$tmp_dir/letters.png" -composite "$tmp_dir/underline.png" -composite "$tmp_dir/wordmark.png"

make_icon() {
 size="$1"; width="$2"; target="$3"
 magick -size "${size}x${size}" xc:'#061A3C' \
   \( "$tmp_dir/wordmark.png" -resize "${width}x" \) \
   -gravity center -composite "$target"
}
make_icon 192 164 public/images/pwa/pereirao-v2-192.png
make_icon 512 438 public/images/pwa/pereirao-v2-512.png
# Lettering dentro do círculo seguro exigido para ícones maskable.
make_icon 512 354 public/images/pwa/pereirao-v2-maskable-512.png
make_icon 180 152 public/images/pwa/pereirao-v2-apple-180.png
