#!/usr/bin/env python3
"""把用户选定图片处理成全套图标：
- 自动裁掉白边，角部补深色 → 全幅方图（opaque，iOS/安卓用）
- 圆角透明版（macOS 用）
- 安卓自适应图标两层（background 深色 + foreground 居中 72%）
"""
import os
import numpy as np
from PIL import Image, ImageDraw

BASE = '/Users/midongkeji/Documents/kimi/workspace/warm-planner'
SRC = f'{BASE}/branding/icon-src.png'
BRAND = f'{BASE}/branding'
PWA = f'{BASE}/public/icons'
ARES = '/Users/midongkeji/Documents/kimi/workspace/starlight-android/app/src/main/res'
RADIUS = 232  # /1024

im = Image.open(SRC).convert('RGBA')
arr = np.array(im.convert('RGB'))

# 1) 找到深色内容包围盒（裁白边）
dark = arr.mean(axis=2) < 240
ys, xs = np.where(dark)
bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
crop = im.crop(bbox)
print('裁切包围盒:', bbox, '→', crop.size)

# 2) 角部白色替换为夜空深色（取顶部暗色条带的中位色）
a = np.array(crop.convert('RGB')).copy()
top = a[: int(a.shape[0] * 0.08)]
top_dark = top[top.mean(axis=2) < 120]
sky = np.median(top_dark, axis=0).astype(np.uint8) if len(top_dark) else np.array([22, 18, 30], dtype=np.uint8)
white_mask = a.mean(axis=2) > 235
a[white_mask] = sky
full = Image.fromarray(a, 'RGB')

# 居中裁方（防御：理论上已是方形）
w, h = full.size
side = min(w, h)
full = full.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
full1024 = full.resize((1024, 1024), Image.LANCZOS)
full1024.save(f'{BRAND}/icon-full-1024.png')
print('全幅方图 saved')

# 3) 圆角透明版（macOS）
rounded = full1024.convert('RGBA')
mask = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=RADIUS, fill=255)
out = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
out.paste(rounded, (0, 0), mask)
out.save(f'{BRAND}/icon-1024.png')
print('圆角版 saved')

# 4) PWA / favicon（不透明全幅）
os.makedirs(PWA, exist_ok=True)
for size in (180, 192, 512):
    full1024.resize((size, size), Image.LANCZOS).save(f'{PWA}/icon-{size}.png')
print('PWA 图标 saved')

# 5) 安卓：传统 mipmap（全幅） + 自适应两层
for dpi, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    os.makedirs(f'{ARES}/mipmap-{dpi}', exist_ok=True)
    full1024.resize((px, px), Image.LANCZOS).save(f'{ARES}/mipmap-{dpi}/ic_launcher.png')

bg = Image.new('RGB', (432, 432), tuple(int(x) for x in sky))
os.makedirs(f'{ARES}/mipmap-xxxhdpi', exist_ok=True)
bg.save(f'{ARES}/mipmap-xxxhdpi/ic_launcher_background.png')
fg = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
inner = full1024.resize((311, 311), Image.LANCZOS)  # 72% 安全区
fg.paste(inner, (60, 60))
fg.save(f'{ARES}/mipmap-xxxhdpi/ic_launcher_foreground.png')
print('安卓图标 saved')
print('done')
