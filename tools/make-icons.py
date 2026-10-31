"""Generate the PWA icons (pixel-art robot shopkeeper on neon purple). Run: python3 tools/make-icons.py"""
from PIL import Image, ImageDraw

def art(size, pad):
    g = 32  # logical pixel grid
    img = Image.new('RGB', (g, g), '#1a1040')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 26, 31, 31], fill='#ff4fd8')
    d.rectangle([7, 4, 24, 22], fill='#e8ecff')
    d.rectangle([9, 8, 22, 16], fill='#150d30')
    d.rectangle([11, 10, 14, 13], fill='#3affd0')
    d.rectangle([17, 10, 20, 13], fill='#3affd0')
    d.rectangle([14, 1, 17, 4], fill='#ffd84a')
    d.rectangle([9, 22, 22, 28], fill='#ff4fd8')
    d.rectangle([13, 23, 18, 27], fill='#ffd0f0')
    inner = int(size * (1 - 2 * pad))
    out = Image.new('RGB', (size, size), '#1a1040')
    out.paste(img.resize((inner, inner), Image.NEAREST), ((size - inner) // 2,) * 2)
    return out

art(192, 0.0).save('icons/icon-192.png')
art(512, 0.0).save('icons/icon-512.png')
art(512, 0.12).save('icons/icon-maskable-512.png')
