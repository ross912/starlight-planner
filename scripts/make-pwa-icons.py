#!/usr/bin/env python3
"""星光手帐 手机端 App 图标：全幅暖色渐变（无圆角，交给系统裁切）+ 星星 + 星光
输出 apple-touch-icon(180)、android icon(192/512)"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
OUT_DIR = '/Users/midongkeji/Documents/kimi/workspace/warm-planner/public/icons'

top = np.array([255, 240, 214], dtype=float)
mid = np.array([255, 192, 105], dtype=float)
bot = np.array([255, 138, 60], dtype=float)
ys = np.linspace(0, 1, S)[:, None]
c = np.where(ys < 0.5, top + (mid - top) * (ys / 0.5), mid + (bot - mid) * ((ys - 0.5) / 0.5))
grad = np.repeat(c[:, None, :], S, axis=1).astype(np.uint8)
canvas = Image.fromarray(grad, 'RGB').convert('RGBA')

# 顶部高光
hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(hl).ellipse([-S * 0.2, -S * 0.45, S * 1.2, S * 0.35], fill=(255, 255, 255, 70))
hl = hl.filter(ImageFilter.GaussianBlur(60))
canvas = Image.alpha_composite(canvas, hl)

def star_points(cx, cy, r_out, r_in, points=5, rot=-90):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / points)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

# 星星（占画布约 50%，留足安全区，适配圆形/圆角裁切）
CX, CY = S / 2, S / 2 - 10
STAR = star_points(CX, CY, 255, 107)

shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).polygon([(x, y + 28) for x, y in STAR], fill=(200, 100, 25, 85))
shadow = shadow.filter(ImageFilter.GaussianBlur(16))
canvas = Image.alpha_composite(canvas, shadow)

glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).polygon(STAR, fill=(255, 246, 220, 200))
glow = glow.filter(ImageFilter.GaussianBlur(48))
canvas = Image.alpha_composite(canvas, glow)

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
canvas = Image.alpha_composite(canvas, star_layer)

def sparkle(cx, cy, r, alpha=235):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon(star_points(cx, cy, r, r * 0.32, points=4), fill=(255, 252, 240, alpha))
    halo = layer.filter(ImageFilter.GaussianBlur(r * 0.45))
    return Image.alpha_composite(halo, layer)

for (sx, sy, sr) in [(270, 300, 38), (770, 290, 30), (780, 630, 34), (260, 620, 26), (680, 740, 24)]:
    canvas = Image.alpha_composite(canvas, sparkle(sx, sy, sr))

# 不透明全幅底（iOS 要求无透明通道）
master = canvas.convert('RGB')

import os
os.makedirs(OUT_DIR, exist_ok=True)
for size in (180, 192, 512):
    img = master.resize((size, size), Image.LANCZOS)
    p = f'{OUT_DIR}/icon-{size}.png'
    img.save(p)
    print('saved', p)
