from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FAVICON = ROOT / "src" / "assets" / "favicon"
IMAGES = ROOT / "src" / "assets" / "images"

BG = (19, 16, 16, 255)
WHITE = (255, 255, 255, 255)
SHADOW = (90, 88, 88, 255)
LINE = (180, 180, 180, 255)

OUTER = [(64, 64), (235, 64), (256, 236), (277, 64), (448, 64), (296, 468), (216, 468)]
INNER = [(190, 140), (256, 340), (322, 140), (305, 140), (256, 220), (207, 140)]
SHADOW_POLY = [(147, 307), (256, 468), (365, 307), (303, 307), (256, 392), (209, 307)]


def mark(size: int) -> Image.Image:
    image = Image.new("RGBA", (512, 512), BG)
    draw = ImageDraw.Draw(image)
    draw.polygon(OUTER, fill=WHITE)
    draw.polygon(INNER, fill=BG)
    draw.polygon(SHADOW_POLY, fill=SHADOW)
    if size == 512:
        return image
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")


def save_ico(path: Path) -> None:
    icon = mark(256).convert("RGBA")
    icon.save(path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        Path(r"C:\Windows\Fonts\consolab.ttf"),
        Path(r"C:\Windows\Fonts\consola.ttf"),
        Path(r"C:\Windows\Fonts\CascadiaMono.ttf"),
        Path(r"C:\Windows\Fonts\courbd.ttf"),
    ):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def social() -> Image.Image:
    width, height = 1200, 630
    image = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(image)
    inset = 36
    draw.rectangle([inset, inset, width - inset, height - inset], outline=LINE, width=2)
    mark_size = 220
    logo = mark(mark_size)
    image.alpha_composite(logo, ((width - mark_size) // 2, 118))
    title = font(64)
    subtitle = font(24)
    title_text = "VPS Code"
    subtitle_text = "AI coding agent for your VPS"
    title_box = draw.textbbox((0, 0), title_text, font=title)
    subtitle_box = draw.textbbox((0, 0), subtitle_text, font=subtitle)
    draw.text(((width - (title_box[2] - title_box[0])) / 2, 360), title_text, font=title, fill=WHITE)
    draw.text(((width - (subtitle_box[2] - subtitle_box[0])) / 2, 444), subtitle_text, font=subtitle, fill=LINE)
    return image


def main() -> None:
    save_png(mark(96), FAVICON / "favicon-96x96.png")
    save_png(mark(96), FAVICON / "favicon-96x96-v3.png")
    save_png(mark(180), FAVICON / "apple-touch-icon.png")
    save_png(mark(180), FAVICON / "apple-touch-icon-v3.png")
    save_png(mark(192), FAVICON / "web-app-manifest-192x192.png")
    save_png(mark(512), FAVICON / "web-app-manifest-512x512.png")
    save_ico(FAVICON / "favicon.ico")
    save_ico(FAVICON / "favicon-v3.ico")
    share = social()
    save_png(share, IMAGES / "social-share.png")
    save_png(share, IMAGES / "social-share-black.png")
    print("rendered brand assets")


if __name__ == "__main__":
    main()
