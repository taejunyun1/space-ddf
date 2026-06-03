#!/usr/bin/env bash
set -euo pipefail

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install WebP tools before generating previews." >&2
  exit 1
fi

entries=(
  "src/assets/show/water-photo-automat/img1.jpg|src/assets/previews/show/water-photo-automat.webp"
  "src/assets/show/absolute/img1.jpg|src/assets/previews/show/absolute.webp"
  "src/assets/show/dohoon/img1.jpg|src/assets/previews/show/dohoon.webp"
  "src/assets/show/doyoung/img1.jpg|src/assets/previews/show/doyoung.webp"
  "src/assets/show/jungkang/img1.jpg|src/assets/previews/show/jungkang.webp"
  "src/assets/show/junhyung/poster.jpg|src/assets/previews/show/junhyung.webp"
  "src/assets/show/swiss-pavilion/img1.jpg|src/assets/previews/show/swiss-pavilion.webp"
  "src/assets/show/technically/img1.jpg|src/assets/previews/show/technically.webp"
  "src/assets/show/subeom/img1.jpg|src/assets/previews/show/subeom.webp"
  "src/assets/show/fragile/img1.jpg|src/assets/previews/show/fragile.webp"
  "src/assets/show/pingpong-2022/img1.jpg|src/assets/previews/show/pingpong-2022.webp"
  "src/assets/show/lost-topophilia/img1.jpg|src/assets/previews/show/lost-topophilia.webp"
  "src/assets/show/hugging-world/img1.jpg|src/assets/previews/show/hugging-world.webp"
  "src/assets/show/make-it-slow/img1.jpg|src/assets/previews/show/make-it-slow.webp"
  "src/assets/show/kahye/img1.jpg|src/assets/previews/show/kahye.webp"
  "src/assets/show/seokwoo/img1.jpg|src/assets/previews/show/seokwoo.webp"
  "src/assets/show/jihye/img1.jpg|src/assets/previews/show/jihye.webp"
  "src/assets/show/suwa/img1.jpg|src/assets/previews/show/suwa.webp"
  "src/assets/project/open-portfolio-2025/img1.jpg|src/assets/previews/project/open-portfolio-2025.webp"
  "src/assets/project/tech-workshop-2025/img.jpg|src/assets/previews/project/tech-workshop-2025.webp"
  "src/assets/project/community-chat-2025/img1.jpg|src/assets/previews/project/community-chat-2025.webp"
  "src/assets/project/peer-up-2023/poster.jpg|src/assets/previews/project/peer-up-2023.webp"
  "src/assets/project/peer-up-2024/poster.png|src/assets/previews/project/peer-up-2024.webp"
  "src/assets/project/artwall/img1.jpg|src/assets/previews/project/artwall.webp"
)

max_dimension=1000
quality=72

for entry in "${entries[@]}"; do
  source="${entry%%|*}"
  destination="${entry##*|}"

  mkdir -p "$(dirname "$destination")"

  width="$(sips -g pixelWidth "$source" | awk '/pixelWidth:/ { print $2 }')"
  height="$(sips -g pixelHeight "$source" | awk '/pixelHeight:/ { print $2 }')"
  cwebp_args=(-quiet -q "$quality" -metadata none)

  if (( width > max_dimension || height > max_dimension )); then
    if (( width >= height )); then
      cwebp_args+=(-resize "$max_dimension" 0)
    else
      cwebp_args+=(-resize 0 "$max_dimension")
    fi
  fi

  if ! cwebp "${cwebp_args[@]}" "$source" -o "$destination" 2>/dev/null; then
    temporary="$(mktemp "${TMPDIR:-/tmp}/space-ddf-preview.XXXXXX.png")"
    sips -s format png "$source" --out "$temporary" >/dev/null
    cwebp "${cwebp_args[@]}" "$temporary" -o "$destination"
    rm -f "$temporary"
  fi
done

echo "Generated ${#entries[@]} previews."
