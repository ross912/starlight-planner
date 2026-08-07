#!/usr/bin/env python3
"""星光手帐 Android 图标：
- 传统 mipmap（全幅图标，48~192px）
- 自适应图标（background 全幅渐变 + foreground 星星居中留安全区）"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RES = '/Users/midongkeji/Documents/kimi/workspace/starlight-android/app/src/main/res'

def gradient(w, h):
    top = np.array([255, 240, 214], dtype=float)
    mid = np.array([255, 192, 105], dtype=float)
    bot = np.array([255, 138, 60], dtype=float)
    ys = np.linspace(0, 1, h)[:, None]
    c = np.where(ys < 0.5, top + (mid - top) * (ys / 0.5), mid + (bot - mid) * ((ys - 0.5) / 0.5))
    return Image.fromarray(np.repeat(c[:, None, :], w, axis=1).astype(np.uint8), 'RGB').convert('RGBA')

def star_points(cx, cy, r_out, r_in, points=5, rot=-90):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / points)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def make_foreground(size):
    """透明底：星 + 星光，内容约占 62%（自适应安全区）"""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cx, cy = size / 2, size / 2 - size * 0.01
    star = star_points(cx, cy, size * 0.26, size * 0.26 * 0.42)

    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(star, fill=(255, 240, 210, 190))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.045))
    im = Image.alpha_composite(im, glow)

    sg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sg).polygon(star, fill=(255, 250, 238, 255))
    im = Image.alpha_composite(im, sg)

    for (fx, fy, fr) in [(0.26, 0.30, 0.045), (0.74, 0.29, 0.035), (0.75, 0.62, 0.04), (0.27, 0.62, 0.03), (0.66, 0.72, 0.028)]:
        sp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(sp).polygon(star_points(size * fx, size * fy, size * fr, size * fr * 0.32, points=4), fill=(255, 252, 240, 235))
        im = Image.alpha_composite(im, sp.filter(ImageFilter.GaussianBlur(size * 0.006)))
    return im

def make_full(size):
    """全幅图标（传统 mipmap 用）：渐变底 + 星星"""
    base = gradient(size, size)
    fg = make_foreground(int(size * 1.55)).resize((size, size), Image.LANCZOS)
    return Image.alpha_composite(base, fg)

# 1) 自适应图标层（xxxhdpi 432px 即可，系统自动缩放）
back = gradient(432, 432)
fore = make_foreground(432)
os.makedirs(f'{RES}/mipmap-xxxhdpi', exist_ok=True)
back.convert('RGB').save(f'{RES}/mipmap-xxxhdpi/ic_launcher_background.png')
fore.save(f'{RES}/mipmap-xxxhdpi/ic_launcher_foreground.png')

os.makedirs(f'{RES}/mipmap-anydpi-v26', exist_ok=True)
with open(f'{RES}/mipmap-anydpi-v26/ic_launcher.xml', 'w') as f:
    f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')

# 2) 传统 mipmap（旧机型兜底）
for dpi, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    os.makedirs(f'{RES}/mipmap-{dpi}', exist_ok=True)
    make_full(512).resize((px, px), Image.LANCZOS).convert('RGB').save(f'{RES}/mipmap-{dpi}/ic_launcher.png')
    print('saved', dpi, px)

print('done')
