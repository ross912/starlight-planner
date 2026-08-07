#!/usr/bin/env python3
"""星光手帐 App 图标生成：暖色渐变圆角方底 + 发光五角星 + 小星光"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
RADIUS = 232  # macOS 圆角比例 ~22.6%

# ---------- 1. 暖色渐变底 ----------
top = np.array([255, 240, 214], dtype=float)    # 奶油
mid = np.array([255, 192, 105], dtype=float)    # 暖杏
bot = np.array([255, 138, 60], dtype=float)     # 暖阳橙
ys = np.linspace(0, 1, S)[:, None]
c = np.where(ys < 0.5, top + (mid - top) * (ys / 0.5), mid + (bot - mid) * ((ys - 0.5) / 0.5))
grad = np.repeat(c[:, None, :], S, axis=1).astype(np.uint8)
base = Image.fromarray(grad, 'RGB').convert('RGBA')

# 顶部柔和高光
hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(hl)
d.ellipse([-S * 0.2, -S * 0.45, S * 1.2, S * 0.35], fill=(255, 255, 255, 70))
hl = hl.filter(ImageFilter.GaussianBlur(60))
base = Image.alpha_composite(base, hl)

# ---------- 2. 圆角蒙版 ----------
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=255)

canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
canvas.paste(base, (0, 0), mask)
clip = lambda im: Image.composite(im, Image.new('RGBA', (S, S), (0, 0, 0, 0)), mask)

# ---------- 3. 星星几何 ----------
def star_points(cx, cy, r_out, r_in, points=5, rot=-90):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / points)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

CX, CY = S / 2, S / 2 - 14
STAR = star_points(CX, CY, 300, 126)

# 底部投影（小而靠下，避免发闷）
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).polygon([(x, y + 34) for x, y in STAR], fill=(200, 100, 25, 85))
shadow = shadow.filter(ImageFilter.GaussianBlur(18))
canvas = Image.alpha_composite(canvas, clip(shadow))

# 外层光晕
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).polygon(STAR, fill=(255, 246, 220, 200))
glow = glow.filter(ImageFilter.GaussianBlur(58))
canvas = Image.alpha_composite(canvas, clip(glow))

# 星形本体（上白下金的微渐变）
sg = np.zeros((S, S, 4), dtype=np.uint8)
sg_top = np.array([255, 253, 246], dtype=float)
sg_bot = np.array([255, 224, 160], dtype=float)
sg_col = (sg_top + (sg_bot - sg_top) * ys).astype(np.uint8)
sg[..., :3] = np.repeat(sg_col[:, None, :], S, axis=1)
sg[..., 3] = 255
star_img = Image.fromarray(sg, 'RGBA')
star_mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(star_mask).polygon(STAR, fill=255)
star_layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
star_layer.paste(star_img, (0, 0), star_mask)
canvas = Image.alpha_composite(canvas, clip(star_layer))

# ---------- 4. 小星光点缀 ----------
def sparkle(cx, cy, r, alpha=235):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    pts = star_points(cx, cy, r, r * 0.32, points=4)
    ImageDraw.Draw(layer).polygon(pts, fill=(255, 252, 240, alpha))
    halo = layer.filter(ImageFilter.GaussianBlur(r * 0.45))
    return Image.alpha_composite(halo, layer)

for (sx, sy, sr) in [(238, 262, 46), (800, 250, 34), (822, 660, 40), (210, 640, 30), (700, 800, 26)]:
    canvas = Image.alpha_composite(canvas, clip(sparkle(sx, sy, sr)))

# 整体边缘一丝内描边，提升质感
edge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(edge).rounded_rectangle([1, 1, S - 2, S - 2], radius=RADIUS, outline=(255, 255, 255, 90), width=3)
canvas = Image.alpha_composite(canvas, edge)

out = '/Users/midongkeji/Documents/kimi/workspace/warm-planner/branding/icon-1024.png'
canvas.save(out)
print('saved', out)
