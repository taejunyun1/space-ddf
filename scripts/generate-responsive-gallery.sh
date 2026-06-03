#!/usr/bin/env bash
set -euo pipefail

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install WebP tools before generating gallery images." >&2
  exit 1
fi

mapfile -t entries < <(
  node -e "for (const entry of require('./scripts/content-asset-entries')) console.log(entry.kind + '/' + entry.slug)"
)

target_dimensions=(720 1280)
quality=76
generated=0

for entry in "${entries[@]}"; do
  source_dir="src/assets/${entry}"
  destination_dir="public/img/responsive/${entry}"

  mkdir -p "$destination_dir"

  for source in "$source_dir"/*; do
    [[ -f "$source" ]] || continue

    lower_source="$(printf '%s' "$source" | tr '[:upper:]' '[:lower:]')"

    case "$lower_source" in
      *.jpg|*.jpeg|*.png|*.webp) ;;
      *) continue ;;
    esac

    width="$(sips -g pixelWidth "$source" | awk '/pixelWidth:/ { print $2 }')"
    height="$(sips -g pixelHeight "$source" | awk '/pixelHeight:/ { print $2 }')"
    base="$(basename "$source")"
    base="${base%.*}"
    previous_width=0

    for target in "${target_dimensions[@]}"; do
      if (( width >= height )); then
        output_width=$(( width > target ? target : width ))
      else
        output_width=$(( height > target ? (width * target + height / 2) / height : width ))
      fi

      if (( output_width <= previous_width )); then
        continue
      fi

      destination="${destination_dir}/${base}-${output_width}w.webp"
      cwebp_args=(-quiet -q "$quality" -metadata none)

      if (( width > target || height > target )); then
        if (( width >= height )); then
          cwebp_args+=(-resize "$target" 0)
        else
          cwebp_args+=(-resize 0 "$target")
        fi
      fi

      if ! cwebp "${cwebp_args[@]}" "$source" -o "$destination" 2>/dev/null; then
        temporary="$(mktemp "${TMPDIR:-/tmp}/space-ddf-responsive.XXXXXX.png")"
        sips -s format png "$source" --out "$temporary" >/dev/null
        cwebp "${cwebp_args[@]}" "$temporary" -o "$destination" >/dev/null
        rm -f "$temporary"
      fi

      previous_width="$output_width"
      generated=$((generated + 1))
    done
  done
done

node scripts/write-responsive-manifest.js

echo "Generated ${generated} responsive gallery files."
