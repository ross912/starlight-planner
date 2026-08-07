#!/usr/bin/env python3
"""星光手帐 图标方向：黑暗中一点星光（无星形，只有一点光）
A 居中柔光 / B 偏上微光 / C 极小亮点"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = '/Users/midongkeji/Documents/kimi/workspace/warm-planner/branding/icon-candidates'
os.makedirs(OUT, exist_ok=True)

S = 1024
RADIUS = 232
BG = '#16121D'  # 深夜黑（微暖紫）

def glow_layer(cx, cy, core_r, glow_r, core_color=(255, 244, 222), glow_alpha=110):
    """一点光：亮核 + 径向柔和光晕"""
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # 光晕：高斯核 + 模糊
    halo = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
                                 fill=(255, 226, 170, glow_alpha))
    halo = halo.filter(ImageFilter.GaussianBlur(glow_r * 0.75))
    layer = Image.alpha_composite(layer, halo)
    # 亮核
    ImageDraw.Draw(layer).ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r],
                                  fill=(*core_color, 255))
    return layer

def make(file, cx_rel, cy_rel, core_r, glow_r, glow_alpha):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=BG)
    im = Image.alpha_composite(im, glow_layer(S * cx_rel, S * cy_rel, core_r, glow_r, glow_alpha=glow_alpha))
    # 裁回圆角
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=255)
    out = Image.composite(im, Image.new('RGBA', (S, S), (0, 0, 0, 0)), mask)
    out.save(f'{OUT}/{file}')
    print('saved', file)

# A：居中，柔和大光晕
make('A-居中柔光.png', 0.5, 0.5, 46, 190, 120)
# B：偏上，小光点，光晕收敛
make('B-偏上微光.png', 0.5, 0.40, 34, 120, 90)
# C：居中极小亮点，近乎无光晕（最极简）
make('C-极小亮点.png', 0.5, 0.5, 26, 70, 70)
print('done')
