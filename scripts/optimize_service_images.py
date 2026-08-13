"""Create responsive WebP variants for LocalConnect service photography."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "frontend" / "assets" / "services"
WIDTHS = (480, 960)


def optimize(source: Path) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        for width in WIDTHS:
            target_width = min(width, image.width)
            target_height = round(image.height * target_width / image.width)
            resized = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
            output = source.with_name(f"{source.stem}-{width}.webp")
            resized.save(output, "WEBP", quality=82, method=6)
            print(f"{output.relative_to(ROOT)}: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    for source_file in sorted(SOURCE_DIR.glob("*.png")):
        optimize(source_file)
