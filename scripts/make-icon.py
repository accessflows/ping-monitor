from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
TILE = (10, 14, 24, 255)
TEAL = (0, 212, 170, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Rounded tile with a soft teal glow behind the mark.
tile = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
tile_draw = ImageDraw.Draw(tile)
tile_draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=220, fill=TILE)

glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
glow_draw.ellipse([212, 332, 812, 732], fill=(0, 212, 170, 120))
glow = glow.filter(ImageFilter.GaussianBlur(140))

img = Image.alpha_composite(img, tile)
img = Image.alpha_composite(img, glow)

# Heartbeat trace.
mark = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
mark_draw = ImageDraw.Draw(mark)
points = [(168, 552), (336, 552), (410, 404), (486, 700), (556, 486), (612, 552), (856, 552)]
mark_draw.line(points, fill=TEAL, width=54, joint="curve")
for x, y in (points[0], points[-1]):
    r = 27
    mark_draw.ellipse([x - r, y - r, x + r, y + r], fill=TEAL)

img = Image.alpha_composite(img, mark)
img.save("src-tauri/icon-source.png")
print("wrote icon-source.png", img.size)
